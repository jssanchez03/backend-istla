const { dbEscritura } = require('../config/database');

class AutoridadesRepository {

    // Obtener todas las autoridades activas ordenadas por orden_firma
    async obtenerTodasLasAutoridades() {
        const [rows] = await dbEscritura.query(`
            SELECT 
                id_autoridad,
                nombre_autoridad,
                cargo_autoridad,
                orden_firma,
                estado,
                created_at,
                updated_at
            FROM autoridades_reportes
            WHERE estado = 'ACTIVO'
            ORDER BY orden_firma ASC
        `);
        return rows;
    }

    // Obtener autoridad por ID
    async obtenerAutoridadPorId(idAutoridad) {
        const [rows] = await dbEscritura.query(`
            SELECT 
                id_autoridad,
                nombre_autoridad,
                cargo_autoridad,
                orden_firma,
                estado,
                created_at,
                updated_at
            FROM autoridades_reportes
            WHERE id_autoridad = ?
        `, [idAutoridad]);
        return rows[0] || null;
    }

    // Crear nueva autoridad
    async crearAutoridad(datosAutoridad) {
        const { nombre_autoridad, cargo_autoridad, orden_firma } = datosAutoridad;

        const [result] = await dbEscritura.query(`
            INSERT INTO autoridades_reportes (
                nombre_autoridad, 
                cargo_autoridad, 
                orden_firma, 
                estado
            ) VALUES (?, ?, ?, 'ACTIVO')
        `, [nombre_autoridad, cargo_autoridad, orden_firma]);

        return result.insertId;
    }

    // Actualizar autoridad
    async actualizarAutoridad(idAutoridad, datosActualizados) {
        const { nombre_autoridad, cargo_autoridad, orden_firma } = datosActualizados;

        const [result] = await dbEscritura.query(`
            UPDATE autoridades_reportes 
            SET 
                nombre_autoridad = ?, 
                cargo_autoridad = ?, 
                orden_firma = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id_autoridad = ?
        `, [nombre_autoridad, cargo_autoridad, orden_firma, idAutoridad]);

        return result.affectedRows > 0;
    }

    // Eliminar autoridad (cambiar estado a INACTIVO)
    async eliminarAutoridad(idAutoridad) {
        const [result] = await dbEscritura.query(`
            UPDATE autoridades_reportes 
            SET 
                estado = 'INACTIVO',
                updated_at = CURRENT_TIMESTAMP
            WHERE id_autoridad = ?
        `, [idAutoridad]);

        return result.affectedRows > 0;
    }

    // Obtener autoridades para firmas de reportes (solo las que se usan)
    async obtenerAutoridadesParaFirmas() {
        const [rows] = await dbEscritura.query(`
            SELECT 
                id_autoridad,
                nombre_autoridad,
                cargo_autoridad,
                orden_firma
            FROM autoridades_reportes
            WHERE estado = 'ACTIVO'
            ORDER BY orden_firma ASC
            LIMIT 2
        `);
        return rows;
    }

    // Verificar si existe una autoridad con el mismo orden
    async verificarOrdenExistente(orden_firma, idAutoridad = null) {
        let query = `
            SELECT id_autoridad 
            FROM autoridades_reportes 
            WHERE orden_firma = ? AND estado = 'ACTIVO'
        `;
        let params = [orden_firma];

        if (idAutoridad) {
            query += ` AND id_autoridad != ?`;
            params.push(idAutoridad);
        }

        const [rows] = await dbEscritura.query(query, params);
        return rows.length > 0;
    }

    // Obtener siguiente orden disponible
    async obtenerSiguienteOrden() {
        const [rows] = await dbEscritura.query(`
            SELECT COALESCE(MAX(orden_firma), 0) + 1 AS siguiente_orden
            FROM autoridades_reportes
            WHERE estado = 'ACTIVO'
        `);
        return rows[0].siguiente_orden;
    }

    // Agregar este método al AutoridadesRepository
    async actualizarOrdenesMultiples(actualizaciones) {
        const connection = await dbEscritura.getConnection();

        try {
            await connection.beginTransaction();

            for (const actualizacion of actualizaciones) {
                await connection.query(`
                UPDATE autoridades_reportes 
                SET orden_firma = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id_autoridad = ?
            `, [actualizacion.orden_firma, actualizacion.id_autoridad]);
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}


module.exports = new AutoridadesRepository();