const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, auditar } = require('../db');

const router = express.Router();

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
// Hash falso para gastar el mismo tiempo cuando el correo no existe
const HASH_FALSO = bcrypt.hashSync('contraseña-que-nadie-usa', 10);

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarRegistro({ nombre, correo, telefono, clave }) {
  const errores = {};
  if (!nombre || nombre.length < 3) errores.nombre = 'Escribe al menos 3 caracteres.';
  if (!correo || !RE_CORREO.test(correo)) errores.correo = 'Ese correo no parece válido.';
  if (!/^[0-9]{7,15}$/.test(telefono || '')) errores.telefono = 'Solo números, entre 7 y 15 dígitos.';
  if (!clave || clave.length < 8) errores.clave = 'Mínimo 8 caracteres.';
  return errores;
}

// POST /api/auth/registro
// Crea la cuenta como cliente. Si ese correo ya recibía paquetes, enlaza la
// cuenta con el cliente que ya existe en vez de duplicarlo.
router.post('/registro', async (req, res) => {
  const cuerpo = req.body || {};
  const datos = {
    nombre: String(cuerpo.nombre || '').trim(),
    correo: String(cuerpo.correo || '').trim().toLowerCase(),
    telefono: String(cuerpo.telefono || '').trim(),
    clave: String(cuerpo.clave || ''),
  };

  const errores = validarRegistro(datos);
  if (Object.keys(errores).length) {
    return res.status(400).json({ error: 'Revisa los datos del formulario', campos: errores });
  }

  const hash = await bcrypt.hash(datos.clave, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [yaTieneCuenta] = await conn.execute('SELECT 1 FROM usuarios WHERE email = ?', [datos.correo]);
    if (yaTieneCuenta.length) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Ese correo ya tiene una cuenta',
        campos: { correo: 'Ese correo ya tiene una cuenta.' },
      });
    }

    const [clientes] = await conn.execute(
      'SELECT id_cliente FROM clientes WHERE email = ? FOR UPDATE', [datos.correo]
    );
    let idCliente;
    if (clientes.length) {
      idCliente = clientes[0].id_cliente;
    } else {
      const [r] = await conn.execute(
        'INSERT INTO clientes (nombre, telefono, email) VALUES (?, ?, ?)',
        [datos.nombre, datos.telefono, datos.correo]
      );
      idCliente = r.insertId;
    }

    await conn.execute(
      "INSERT INTO usuarios (nombre, email, password_hash, rol, id_cliente) VALUES (?, ?, ?, 'cliente', ?)",
      [datos.nombre, datos.correo, hash, idCliente]
    );

    await conn.commit();
    res.status(201).json({ mensaje: 'Cuenta creada, ya puedes iniciar sesión' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const correo = String((req.body || {}).correo || '').trim().toLowerCase();
  const clave = String((req.body || {}).clave || '');
  if (!correo || !clave) {
    return res.status(400).json({ error: 'Escribe tu correo y tu contraseña' });
  }

  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, email, password_hash, rol, id_empresa, id_cliente, activo,
            intentos_fallidos,
            (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado,
            TIMESTAMPDIFF(MINUTE, NOW(), bloqueado_hasta) AS minutos_restantes
       FROM usuarios WHERE email = ?`,
    [correo]
  );
  const u = filas[0];

  // Siempre se compara la clave, exista o no el usuario, para no delatar qué correos están registrados
  const claveCorrecta = await bcrypt.compare(clave, u ? u.password_hash : HASH_FALSO);

  if (!u || !u.activo) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  if (u.bloqueado) {
    return res.status(423).json({
      error: `Cuenta bloqueada por demasiados intentos. Prueba de nuevo en ${u.minutos_restantes + 1} minutos.`,
    });
  }

  if (!claveCorrecta) {
    const intentos = u.intentos_fallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      await pool.execute(
        'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id_usuario = ?',
        [MINUTOS_BLOQUEO, u.id_usuario]
      );
      await auditar(u.email, 'LOGIN_BLOQUEO', `Cuenta bloqueada ${MINUTOS_BLOQUEO} minutos tras ${MAX_INTENTOS} intentos`);
      return res.status(423).json({
        error: `Demasiados intentos. La cuenta quedó bloqueada ${MINUTOS_BLOQUEO} minutos.`,
      });
    }
    await pool.execute('UPDATE usuarios SET intentos_fallidos = ? WHERE id_usuario = ?', [intentos, u.id_usuario]);
    await auditar(u.email, 'LOGIN_FALLIDO', `Intento ${intentos} de ${MAX_INTENTOS}`);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  await pool.execute(
    'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = NOW() WHERE id_usuario = ?',
    [u.id_usuario]
  );
  await auditar(u.email, 'LOGIN', 'Inicio de sesión correcto');

  const token = jwt.sign(
    { sub: u.id_usuario, nombre: u.nombre, email: u.email, rol: u.rol, id_empresa: u.id_empresa, id_cliente: u.id_cliente },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, usuario: { nombre: u.nombre, email: u.email, rol: u.rol } });
});

module.exports = router;
