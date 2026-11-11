// backend/src/controllers/paquete.controller.js
const paqueteService = require('../services/paquete.service');

class PaqueteController {
    /**
     * Controlador para listar todos los paquetes usando la vista optimizada v_rastreo.
     */
    async obtenerRastreoGeneral(req, res) {
        try {
            const resultados = await paqueteService.listarRastreo();
            return res.status(200).json({
                success: true,
                total: resultados.length,
                data: resultados
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Controlador para consultar un paquete específico por su número de guía.
     */
    async obtenerPaquetePorGuia(req, res) {
        try {
            const { guia } = req.params;
            const paquete = await paqueteService.consultarPorGuia(guia);
            return res.status(200).json({
                success: true,
                data: paquete
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Controlador para actualizar el estado del paquete (consumido por operadores o el módulo IoT ESP32).
     */
    async actualizarEstadoPaquete(req, res) {
        try {
            // Extrae el correo del usuario autenticado por el token JWT o asigna uno por defecto para IoT
            const usuarioEmail = req.usuario ? req.usuario.email : 'iot_portal@followup.com';
            
            const resultado = await paqueteService.actualizarEstado(req.body, usuarioEmail);
            return res.status(200).json({
                success: true,
                message: resultado.message
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new PaqueteController();