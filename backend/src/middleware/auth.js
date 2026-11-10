const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Necesitas iniciar sesión' });

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Tu sesión expiró, vuelve a ingresar' });
  }
}

// Uso: requireRol('admin', 'empresa')
function requireRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para hacer esto' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRol };
