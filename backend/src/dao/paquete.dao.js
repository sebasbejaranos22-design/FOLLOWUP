// backend/src/dao/paquete.dao.js
const pool = require('../db'); // Importa la conexión singleton desde src/db.js

class PaqueteDAO {
    // Patrón DAO: Método exclusivo para consultar la vista optimizada de rastreo
    async obtenerTodos() {
        const [rows] = await pool.query('SELECT * FROM v_rastreo');
        return rows;
    }

    // Método para buscar un paquete específico por su número de serie (guía)
    async obtenerPorGuia(numeroSerie) {
        const [rows] = await pool.query(
            'SELECT * FROM v_rastreo WHERE numero_serie = ?', 
            [numeroSerie]
        );
        return rows[0] || null;
    }

    // Método para interactuar de forma segura con el procedimiento almacenado sp_cambiar_estado
    async cambiarEstado(guia, idEstado, comentario, usuario, latitud, longitud) {
        const conexion = await pool.getConnection();
        try {
            // Patrón de Sanitización: Aseguramos que idEstado sea un número entero válido, evitando NaN
            const estadoSeguro = (idEstado !== undefined && idEstado !== null && !isNaN(idEstado)) 
                ? parseInt(idEstado, 10) 
                : 2; // 2 por defecto (ej. En tránsito)

            // Ejecuta el procedimiento almacenado con parámetros limpios y tipados
            await conexion.execute(
                'CALL sp_cambiar_estado(?, ?, ?, ?, ?, ?)',
                [
                    guia, 
                    estadoSeguro, 
                    comentario || 'Actualización de estado operativa', 
                    usuario, 
                    latitud || null, 
                    longitud || null
                ]
            );
            return { success: true, message: 'Estado del paquete actualizado correctamente' };
        } catch (error) {
            throw new Error(`Error en la transacción SQL del DAO: ${error.message}`);
        } finally {
            conexion.release(); // Libera la conexión de vuelta al pool
        }
    }
}

module.exports = new PaqueteDAO();