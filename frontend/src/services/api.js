// frontend/src/services/api.js

/**
 * Patrón Strategy: Detecta dinámicamente el entorno de ejecución.
 * En GitHub Codespaces transforma el origen del puerto 8081 al puerto 3000.
 */
function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname.endsWith('.app.github.dev')
  ) {
    const backendOrigin = window.location.origin.replace('-8081.', '-3000.');
    return `${backendOrigin}/api`;
  }

  return 'http://localhost:3000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

// Token JWT almacenado en memoria tras validar credenciales con Bcrypt
let authToken = null;

/**
 * Establece o elimina el token JWT activo en memoria.
 * @param {string|null} token
 */
export const setAuthToken = (token) => {
  authToken = token;
};

/**
 * Cliente HTTP centralizado con validación de errores, control de timeout
 * y cabeceras compatibles con el proxy de GitHub Codespaces.
 */
async function request(endpoint, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      mode: 'cors',
      credentials: 'omit', // Evita que el proxy de Codespaces bloquee por cookies cruzadas
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        `El puerto 3000 devolvió una página HTML en lugar de JSON. Abre ${API_BASE_URL}/paquetes/PKG001/rastreo en otra pestaña para autorizar el túnel de Codespaces.`
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || data.message || `Error HTTP ${response.status}`
      );
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con el backend.');
    }
    throw new Error(
      error.message === 'Failed to fetch'
        ? `Túnel bloqueado hacia ${API_BASE_URL}. Asegúrate de que el puerto 3000 sea 'Público' y abre ${API_BASE_URL}/paquetes/PKG001/rastreo una vez en el navegador.`
        : error.message
    );
  }
}

export const followUpApi = {
  // Clase Usuario -> +autenticar() | Caso de Uso: Iniciar Sesión
    // Consultar todos los paquetes permitidos para el usuario autenticado
  listarPaquetes: async () => {
    return await request('/paquetes', {
      method: 'GET',
    });
  },
  login: async (correo, clave) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        correo: String(correo || '').trim().toLowerCase(),
        clave: String(clave || ''),
      }),
    });

    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  },

  // Caso de Uso: Rastrear Paquete en Tiempo Real (Con Patrón Fallback)
  rastrearPaquete: async (guia) => {
    const guiaLimpia = encodeURIComponent(
      String(guia || '').trim().toUpperCase()
    );
    try {
      return await request(`/paquetes/${guiaLimpia}/rastreo`, {
        method: 'GET',
      });
    } catch (firstError) {
      // Si la ruta específica no existe, intenta con la ruta base del recurso
      return await request(`/paquetes/${guiaLimpia}`, {
        method: 'GET',
      });
    }
  },

  // Clase Paquete -> +actualizarEstado() | Caso de Uso: Gestionar Flota y Paquetes
  actualizarEstado: (guia, idEstado, comentario) => {
    const guiaLimpia = String(guia || '').trim().toUpperCase();
    const estadoNumerico = Number(idEstado) || 2;

    return request(`/paquetes/${encodeURIComponent(guiaLimpia)}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({
        guia: guiaLimpia,
        id_estado: estadoNumerico,
        idEstado: estadoNumerico,
        comentario: String(
          comentario || 'Actualización desde App FollowUp'
        ).trim(),
      }),
    });
  },
};