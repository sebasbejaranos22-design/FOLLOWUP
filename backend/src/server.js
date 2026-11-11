require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET. Copia backend/.env.example como backend/.env y complétalo.');
  process.exit(1);
}

const path = require('path');
const express = require('express');
const { pool } = require('./db');
const manejarErrores = require('./middleware/errores');
const cors = require('cors');

const app = express();
app.disable('x-powered-by');

// Configuración CORS para GitHub Codespaces
app.use(cors({
  origin: 'https://bookish-space-guacamole-jr776xqp94gpfxr6-8081.app.github.dev',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/paquetes', require('./routes/paquetes.routes'));
app.use('/api', require('./routes/catalogos.routes'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Esa ruta no existe' }));

// Servir archivos estáticos del frontend cuando corresponda
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use(manejarErrores);

const PUERTO = Number(process.env.PORT) || 3000;

pool.query('SELECT 1')
  .then(() => {
    app.listen(PUERTO, () => console.log(`FollowUp listo en http://localhost:${PUERTO}`));
  })
  .catch((err) => {
    console.error('No pude conectar con la base de datos:', err.message);
    console.error('Revisa backend/.env (usuario, contraseña) y que MySQL/MariaDB esté encendido.');
    process.exit(1);
  });
