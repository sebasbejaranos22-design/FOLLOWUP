// Traduce los errores de la base de datos a respuestas claras, sin mostrar
// detalles internos del servidor.
function manejarErrores(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
  }

  // Reglas de negocio de los triggers y del procedimiento (SIGNAL 45000)
  if (err.sqlState === '45000') {
    return res.status(409).json({ error: err.sqlMessage });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ese dato ya existe' });
  }
  // Falla de un CHECK: MariaDB usa el 4025, MySQL el 3819
  if (err.errno === 4025 || err.errno === 3819) {
    return res.status(400).json({ error: 'Algún dato está fuera del rango permitido' });
  }
  // Llave foránea que apunta a algo que no existe
  if (err.errno === 1452) {
    return res.status(400).json({ error: 'Alguno de los datos enviados no existe' });
  }

  console.error(err);
  res.status(500).json({ error: 'Algo falló en el servidor, intenta de nuevo' });
}

module.exports = manejarErrores;
