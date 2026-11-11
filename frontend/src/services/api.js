// frontend/src/services/api.js

// Permite usar una URL pública de Codespaces si existe, o localhost:3000 por defecto
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

let authToken = null;

/**
 * Guarda o limpia el token JWT en memoria para peticiones autenticadas.
 * @param {string|null} token
 */
export const setAuthToken = (token) => {
  authToken = token;
};

/**
 * Cliente HTTP centralizado con manejo defensivo de errores y seguridad JWT.
 */
async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || data.message || `Error del servidor (${response.status})`
      );
    }

    return data;
  } catch (error) {
    throw new Error(
      error.message || 'No se pudo conectar con el backend de FollowUp'
    );
  }
}

export const followUpApi = {
  // Caso de Uso: Iniciar Sesión (+autenticar en clase Usuario)
  login: async (correo, clave) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo: correo.trim(), clave }),
    });
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  // Caso de Uso: Rastrear Paquete en Tiempo Real
  rastrearPaquete: (guia) =>
    request(
      `/paquetes/${encodeURIComponent(guia.trim().toUpperCase())}/rastreo`,
      { method: 'GET' }
    ),

  // Caso de Uso: Gestionar Flota y Paquetes (+actualizarEstado en clase Paquete)
  actualizarEstado: (guia, idEstado, comentario) =>
    request(
      `/paquetes/${encodeURIComponent(guia.trim().toUpperCase())}/estado`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          guia: guia.trim().toUpperCase(),
          id_estado: Number(idEstado),
          idEstado: Number(idEstado),
          comentario: comentario || 'Actualización desde App FollowUp',
        }),
      }
    ),
};