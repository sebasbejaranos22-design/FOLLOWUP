// backend/src/services/paquete.service.js
const paqueteDAO = require('../dao/paquete.dao');

class PaqueteService {
    /**
     * Obtiene el listado completo de rastreo desde la vista optimizada.
     * Patrón Service Layer: Centraliza la lógica de negocio y validaciones previas.
     */
    async listarRastreo() {
        try {
            const resultados = await paqueteDAO.obtenerTodos();
            return resultados;
        } catch (error) {
            throw new Error(`Error en el servicio de rastreo: ${error.message}`);
        }
    }

    /**
     * Consulta un paquete específico por su número de guía.
     * Incluye manejo de errores de negocio si el paquete no existe.
     */
    async consultarPorGuia(guia) {
        const paquete = await paqueteDAO.obtenerPorGuia(guia);
        if (!paquete) {
            throw new Error(`El paquete con número de guía '${guia}' no se encuentra registrado.`);
        }
        return paquete;
    }

    /**
     * Gestiona la actualización de estado utilizando el procedimiento almacenado transaccional.
     */
    async actualizarEstado(datos, usuarioEmail) {
        const { guia, idEstado, comentario, latitud, longitud } = datos;
        
        if (!guia || !idEstado) {
            throw new Error('Los campos "guia" y "idEstado" son obligatorios.');
        }

        return await paqueteDAO.cambiarEstado(guia, idEstado, comentario, usuarioEmail, latitud, longitud);
    }
}

module.exports = new PaqueteService();