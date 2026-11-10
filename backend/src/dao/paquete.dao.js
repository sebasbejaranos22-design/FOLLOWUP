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
            // Ejecuta el procedimiento almacenado que configuraste en tu base de datos
            await conexion.execute(
                'CALL sp_cambiar_estado(?, ?, ?, ?, ?, ?)',
                [guia, idEstado, comentario, usuario, latitud || null, longitud || null]
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