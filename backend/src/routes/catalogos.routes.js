const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');

const router = express.Router();

// GET /api/estados  (público)
router.get('/estados', async (req, res) => {
  const [filas] = await pool.execute('SELECT id_estado, nombre_estado, es_final FROM estados ORDER BY id_estado');
  res.json(filas.map((f) => ({ ...f, es_final: f.es_final === 1 })));
});

// GET /api/clientes  (para elegir destinatario al crear un paquete)
router.get('/clientes', requireAuth, requireRol('empresa', 'admin'), async (req, res) => {
  const [filas] = await pool.execute('SELECT id_cliente, nombre, email FROM clientes ORDER BY nombre');
  res.json(filas);
});

// GET /api/empresas  (el admin elige desde qué empresa crea el paquete)
router.get('/empresas', requireAuth, requireRol('admin'), async (req, res) => {
  const [filas] = await pool.execute('SELECT id_empresa, nombre FROM empresas ORDER BY nombre');
  res.json(filas);
});

// GET /api/auditoria  (solo admin, los 50 movimientos más recientes)
router.get('/auditoria', requireAuth, requireRol('admin'), async (req, res) => {
  const [filas] = await pool.execute(
    'SELECT fecha, usuario, accion, detalle FROM auditoria ORDER BY fecha DESC, id DESC LIMIT 50'
  );
  res.json(filas);
});

module.exports = router;
