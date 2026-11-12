
const express = require('express');
const { pool, comoUsuario } = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');

const router = express.Router();

const RE_GUIA = /^[A-Za-z0-9-]{4,50}$/;

// Enmascarar nombre del destinatario
function enmascarar(nombre) {
  const partes = String(nombre || 'Cliente').trim().split(/\s+/);

  return partes.length > 1
    ? `${partes[0]} ${partes[partes.length - 1][0]}.`
    : partes[0];
}

const aNumero = (v) =>
  v === null || v === undefined ? null : Number(v);

// Buscar paquete
async function buscarPaquete(guia) {
  const [filas] = await pool.execute(
    `SELECT id_paquete, id_empresa, es_final
     FROM v_rastreo
     WHERE numero_serie = ?`,
    [guia]
  );

  return filas[0];
}

// ==========================================
// GET: RASTREAR PAQUETE (PÚBLICO)
// ==========================================

router.get('/:guia/rastreo', async (req, res) => {
  try {
    const { guia } = req.params;

    if (!RE_GUIA.test(guia)) {
      return res.status(400).json({
        error: 'La guía no es válida'
      });
    }

    const [filas] = await pool.execute(
      `SELECT
        id_paquete,
        numero_serie,
        descripcion,
        empresa,
        cliente,
        id_estado,
        estado,
        es_final,
        fecha_envio,
        fecha_entrega,
        ultima_latitud,
        ultima_longitud,
        fecha_ultima_ubicacion
       FROM v_rastreo
       WHERE numero_serie = ?`,
      [guia]
    );

    const p = filas[0];

    if (!p) {
      return res.status(404).json({
        error: `No encontramos ningún paquete con la guía ${guia}`
      });
    }

    // Historial de estados
    const [historial] = await pool.execute(
      `SELECT
        es.nombre_estado AS estado,
        h.comentario,
        h.fecha
       FROM historial_estados h
       JOIN estados es ON es.id_estado = h.id_estado
       WHERE h.id_paquete = ?
       ORDER BY h.fecha DESC, h.id_historial DESC`,
      [p.id_paquete]
    );

    // Historial de ubicaciones
    const [ubicaciones] = await pool.execute(
      `SELECT latitud, longitud, fecha
       FROM ubicaciones
       WHERE id_paquete = ?
       ORDER BY fecha ASC, id_ubicacion ASC`,
      [p.id_paquete]
    );

    res.json({
      paquete: {
        numero_serie: p.numero_serie,
        descripcion: p.descripcion,
        empresa: p.empresa,
        destinatario: enmascarar(p.cliente),
        id_estado: p.id_estado,
        estado: p.estado,
        cerrado: Number(p.es_final) === 1,
        fecha_envio: p.fecha_envio,
        fecha_entrega: p.fecha_entrega,

        ultima_ubicacion:
          p.ultima_latitud === null
            ? null
            : {
                latitud: Number(p.ultima_latitud),
                longitud: Number(p.ultima_longitud),
                fecha: p.fecha_ultima_ubicacion
              }
      },

      historial,

      ubicaciones: ubicaciones.map((u) => ({
        latitud: Number(u.latitud),
        longitud: Number(u.longitud),
        fecha: u.fecha
      }))
    });

  } catch (error) {
    console.error('Error al rastrear paquete:', error);

    res.status(500).json({
      error: 'Error interno al consultar el paquete'
    });
  }
});

// ==========================================
// GET: LISTAR PAQUETES (AUTENTICADO)
// ==========================================

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rol, id_empresa, id_cliente } = req.usuario;

    let donde = '';
    let params = [];

    if (rol === 'empresa') {
      donde = 'WHERE id_empresa = ?';
      params = [id_empresa];
    }

    if (rol === 'cliente') {
      donde = 'WHERE id_cliente = ?';
      params = [id_cliente];
    }

    const [filas] = await pool.execute(
      `SELECT
      numero_serie,
      descripcion,
      empresa,
      cliente,
      id_estado,
      estado,
      es_final,
      fecha_envio,
      fecha_entrega,
      ultima_latitud,
      ultima_longitud,
      fecha_ultima_ubicacion
      FROM v_rastreo
      ${donde}
      ORDER BY id_paquete DESC`,
      params
      );

    res.json(
      filas.map((f) => ({
        ...f,
        cerrado: Number(f.es_final) === 1
      }))
    );

  } catch (error) {
    console.error('Error al listar paquetes:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los paquetes'
    });
  }
});

// ==========================================
// POST: REGISTRAR PAQUETE
// ==========================================

router.post(
  '/',
  requireAuth,
  requireRol('empresa', 'admin'),
  async (req, res) => {
    try {
      const b = req.body || {};

      const guia = String(b.numero_serie || '').trim();
      const idCliente = Number(b.id_cliente);

      const descripcion =
        String(b.descripcion || '').trim().slice(0, 200) || null;

      const idEmpresa =
        req.usuario.rol === 'empresa'
          ? req.usuario.id_empresa
          : Number(b.id_empresa);

      const campos = {};

      if (!RE_GUIA.test(guia)) {
        campos.numero_serie =
          'Letras, números y guiones, mínimo 4.';
      }

      if (!Number.isInteger(idCliente) || idCliente < 1) {
        campos.id_cliente = 'Elige un cliente.';
      }

      if (!Number.isInteger(idEmpresa) || idEmpresa < 1) {
        campos.id_empresa = 'Elige una empresa.';
      }

      if (Object.keys(campos).length) {
        return res.status(400).json({
          error: 'Revisa los datos',
          campos
        });
      }

      await comoUsuario(req.usuario.email, (conn) =>
        conn.execute(
          `INSERT INTO paquetes
           (numero_serie, descripcion, id_empresa, id_cliente, fecha_envio)
           VALUES (?, ?, ?, ?, CURDATE())`,
          [guia, descripcion, idEmpresa, idCliente]
        )
      );

      res.status(201).json({
        mensaje: 'Paquete registrado',
        numero_serie: guia
      });

    } catch (error) {
      console.error('Error al registrar paquete:', error);

      res.status(500).json({
        error: 'No se pudo registrar el paquete'
      });
    }
  }
);

// ==========================================
// PATCH: CAMBIAR ESTADO DEL PAQUETE
// ==========================================


router.patch('/:guia/estado', requireAuth, requireRol('empresa', 'admin'), async (req, res) => {
  const { guia } = req.params;
  const b = req.body || {};

  const estadoFinal = Number(b.id_estado);
  const comentario = String(b.comentario || '').trim().slice(0, 200) || null;

  const tieneUbicacion =
    b.latitud !== undefined && b.latitud !== '' &&
    b.longitud !== undefined && b.longitud !== '';

  const lat = tieneUbicacion ? Number(b.latitud) : null;
  const lon = tieneUbicacion ? Number(b.longitud) : null;

  if (!RE_GUIA.test(guia)) {
    return res.status(400).json({ error: 'Guía no válida' });
  }

  if (![1, 2, 3, 4].includes(estadoFinal)) {
    return res.status(400).json({ error: 'El estado debe ser 1, 2, 3 o 4' });
  }

  if (tieneUbicacion &&
      (!Number.isFinite(lat) || !Number.isFinite(lon) ||
       Math.abs(lat) > 90 || Math.abs(lon) > 180)) {
    return res.status(400).json({ error: 'La ubicación no es válida' });
  }

  const p = await buscarPaquete(guia);

  if (!p) {
    return res.status(404).json({ error: 'Ese paquete no existe' });
  }

  if (p.es_final === 1) {
    return res.status(409).json({ error: 'El paquete ya está cerrado' });
  }

  if (req.usuario.rol === 'empresa' &&
      p.id_empresa !== req.usuario.id_empresa) {
    return res.status(403).json({ error: 'Ese paquete es de otra empresa' });
  }

  await pool.query(
    'CALL sp_cambiar_estado(?, ?, ?, ?, ?, ?)',
    [guia, estadoFinal, comentario, req.usuario.email, lat, lon]
  );

  res.json({
    mensaje: 'Estado actualizado correctamente',
    guia,
    id_estado: estadoFinal
  });
});


// ==========================================
// POST: REGISTRAR UBICACIÓN GPS
// ==========================================

router.post(
  '/:guia/ubicaciones',
  requireAuth,
  requireRol('empresa', 'admin'),
  async (req, res) => {
    try {
      const { guia } = req.params;

      const lat = Number((req.body || {}).latitud);
      const lon = Number((req.body || {}).longitud);

      if (!RE_GUIA.test(guia)) {
        return res.status(400).json({
          error: 'Guía no válida'
        });
      }

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      ) {
        return res.status(400).json({
          error: 'La ubicación no es válida'
        });
      }

      const p = await buscarPaquete(guia);

      if (!p) {
        return res.status(404).json({
          error: 'Ese paquete no existe'
        });
      }

      if (
        req.usuario.rol === 'empresa' &&
        Number(p.id_empresa) !== Number(req.usuario.id_empresa)
      ) {
        return res.status(403).json({
          error: 'Ese paquete pertenece a otra empresa'
        });
      }

      if (Number(p.es_final) === 1) {
        return res.status(409).json({
          error: 'El paquete ya está cerrado'
        });
      }

      await pool.execute(
        `INSERT INTO ubicaciones
         (id_paquete, latitud, longitud)
         VALUES (?, ?, ?)`,
        [p.id_paquete, lat, lon]
      );

      res.status(201).json({
        mensaje: 'Ubicación registrada'
      });

    } catch (error) {
      console.error('Error al registrar ubicación:', error);

      res.status(500).json({
        error: 'No se pudo registrar la ubicación'
      });
    }
  }
);

module.exports = router;
