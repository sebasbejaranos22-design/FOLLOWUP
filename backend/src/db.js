const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'followup_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // las fechas llegan como texto "2026-04-10 14:00:00", sin líos de zona horaria
});

// Corre fn con una conexión que sabe quién es el usuario. Los triggers de la
// base leen @usuario_app para anotar quién hizo cada cambio.
async function comoUsuario(email, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET @usuario_app = ?', [email]);
    return await fn(conn);
  } finally {
    await conn.query('SET @usuario_app = NULL').catch(() => {});
    conn.release();
  }
}

// Guarda un evento en auditoría. Si falla no debe tumbar la petición.
async function auditar(usuario, accion, detalle) {
  try {
    await pool.execute(
      'INSERT INTO auditoria (usuario, accion, tabla, detalle) VALUES (?, ?, ?, ?)',
      [usuario, accion, 'usuarios', detalle]
    );
  } catch (e) {
    console.error('No se pudo escribir en auditoría:', e.message);
  }
}

module.exports = { pool, comoUsuario, auditar };
