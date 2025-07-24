const pLimit = require('p-limit').default;
const evaluacionesService = require('../services/evaluacionesService');
const { dbLectura } = require('../config/database');
const evaluacionesRepository = require('../repositories/evaluacionesRepository');
const usuariosRepository = require('../repositories/usuarioRepository');
const { enviarCorreo } = require('../services/emailService');
const { cargarTemplateYReemplazar } = require('../services/plantillaCorreo');
const limit = pLimit(5); 

// Función para crear una nueva evaluación
async function crearEvaluacion(req, res) {
    try {
        const evaluacion = await evaluacionesService.crearEvaluacion(req.usuario, req.body);
        res.status(201).json({
            success: true,
            message: 'Evaluación creada exitosamente',
            data: evaluacion
        });
    } catch (error) {
        // Manejo específico de errores de evaluaciones duplicadas
        if (error.tipo === 'EVALUACION_DUPLICADA') {
            return res.status(409).json({
                success: false,
                error: error.message,
                tipo: 'EVALUACION_DUPLICADA',
                detalles: error.detalles
            });
        }
        if (error.tipo === 'EVALUACION_DUPLICADA_USUARIO') {
            return res.status(409).json({
                success: false,
                error: error.message,
                tipo: 'EVALUACION_DUPLICADA_USUARIO'
            });
        }
        // Otros errores de duplicados (por si acaso)
        if (error.message.includes('Ya has evaluado') || error.message.includes('Ya existe')) {
            return res.status(409).json({
                success: false,
                error: error.message,
                tipo: 'EVALUACION_DUPLICADA'
            });
        }
        // Error interno del servidor
        console.error('Error interno del servidor:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al crear evaluación',
            detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Función para guardar respuestas
async function guardarRespuestas(req, res) {
    try {
        const { id } = req.params;
        const { respuestas } = req.body;
        // Validar que cada respuesta tenga evaluado_id e id_distributivo
        if (!respuestas || !Array.isArray(respuestas)) {
            return res.status(400).json({ error: 'Se requiere un array de respuestas' });
        }
        for (const respuesta of respuestas) {
            if (!respuesta.evaluado_id || !respuesta.id_distributivo) {
                return res.status(400).json({
                    error: 'Cada respuesta debe incluir evaluado_id e id_distributivo'
                });
            }
        }
        // Pasar el ID del usuario desde req.usuario
        await evaluacionesService.guardarRespuestas(id, respuestas, req.usuario.id);
        res.status(201).json({ mensaje: 'Respuestas guardadas correctamente' });
    } catch (error) {
        console.error('Error en guardarRespuestas:', error);
        res.status(500).json({ error: 'Error al guardar respuestas' });
    }
}

// Función para obtener evaluación por ID (se ocupa para cargar la evaluación formualrio en el frontend)
const obtenerEvaluacionPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const { distributivo } = req.query; // Obtener el parámetro distributivo de la query
        const evaluacion = await evaluacionesService.obtenerEvaluacionPorId(
            id,
            distributivo ? parseInt(distributivo) : null
        );
        if (!evaluacion) {
            return res.status(404).json({ error: "Evaluación no encontrada" });
        }
        res.json(evaluacion);
    } catch (err) {
        console.error("Error al obtener evaluación:", err);
        res.status(500).json({ error: "Error al obtener evaluación" });
    }
};

// Función para obtener resúmenes de evaluaciones por periodo (se ocupa en la tabla de resumen)
async function obtenerResúmenesPorPeriodo(req, res) {
    try {
        const { periodoId } = req.params;
        const resúmenes = await evaluacionesService.obtenerResúmenesPorPeriodo(req.usuario.id, periodoId);
        res.json(resúmenes);
    } catch (error) {
        console.error('Error al obtener resúmenes por periodo:', error);
        res.status(500).json({ error: 'Error al obtener resúmenes' });
    }
}

// Función para obtener mis evaluaciones por período (si se usa)
async function misEvaluaciones(req, res) {
    try {
        const evaluaciones = await evaluacionesService.obtenerMisEvaluacionesPorPeriodo(req.usuario.id);
        res.json(evaluaciones);
    } catch (error) {
        console.error('Error en misEvaluaciones:', error);
        if (error.message.includes('No se encontró un período activo')) {
            return res.status(404).json({ error: 'No se encontró un período activo para el estudiante' });
        }
        res.status(500).json({ error: 'Error al obtener mis evaluaciones' });
    }
}

// Función para obtener todas las evaluaciones del usuario (se usa en el perfil admin para la tabla de evaluaciones)
async function misEvaluacionesTodas(req, res) {
    try {
        const evaluaciones = await evaluacionesService.obtenerTodasMisEvaluaciones(req.usuario.id);
        res.json(evaluaciones);
    } catch (error) {
        console.error('Error al obtener todas las evaluaciones:', error);
        res.status(500).json({ error: 'Error al obtener todas las evaluaciones del usuario' });
    }
}

// Función para obtener evaluaciones de estudiante (solo heteroevaluaciones)
async function evaluacionesEstudiante(req, res) {
    try {
        const evaluaciones = await evaluacionesService.obtenerEvaluacionesEstudiante(req.usuario.id);
        res.json(evaluaciones);
    } catch (error) {
        console.error('Error al obtener evaluaciones de estudiante:', error);
        res.status(500).json({ error: 'Error al obtener evaluaciones de estudiante' });
    }
}

// Función para obtener evaluaciones de docente (coevaluación y autoevaluación)
async function evaluacionesDocente(req, res) {
    try {
        // Extraer cedula
        const cedula = req.usuario?.cedula;
        // Intentar múltiples posibles nombres para el ID del usuario
        const idUsuario = req.usuario?.id_usuario ||
            req.usuario?.id ||
            req.usuario?.usuario_id ||
            req.usuario?.user_id ||
            req.usuario?.ID_USUARIO ||
            req.usuario?.ID;
        // Validar que tenemos los datos necesarios
        if (!cedula) {
            return res.status(400).json({
                error: 'Cédula no encontrada en el token',
                debug: { usuario: req.usuario }
            });
        }
        if (!idUsuario) {
            return res.status(400).json({
                error: 'ID de usuario no encontrado en el token',
                debug: {
                    usuario: req.usuario,
                    propiedades: Object.keys(req.usuario || {})
                }
            });
        }
        const evaluaciones = await evaluacionesService.obtenerEvaluacionesDocentePorCedula(cedula, idUsuario);
        res.json(evaluaciones);
    } catch (error) {
        console.error('Error al obtener evaluaciones de docente:', error);
        res.status(500).json({ error: 'Error al obtener evaluaciones de docente' });
    }
}

// Función para notificar evaluación - PERMITIR MÚLTIPLES NOTIFICACIONES
async function notificarEvaluacion(req, res) {
    try {
        const { id } = req.params;
        // Validar que el ID sea válido
        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ error: 'ID de evaluación inválido' });
        }
        // Verificar que la evaluación existe antes de procesarla
        const evaluacion = await evaluacionesRepository.obtenerEvaluacionPorId(parseInt(id));
        if (!evaluacion) {
            return res.status(404).json({ error: 'Evaluación no encontrada' });
        }
        const resultado = await evaluacionesService.notificarEvaluacion(parseInt(id));
        // Respuesta detallada basada en el resultado
        if (resultado.enviadosExitosos === 0) {
            return res.status(500).json({
                error: 'No se pudo enviar ningún correo',
                detalles: resultado.errores
            });
        }
        const tipoAccion = resultado.esReNotificacion ? 'recordatorios' : 'notificaciones';
        const mensaje = resultado.enviadosExitosos === resultado.totalDestinatarios
            ? `Todos los ${tipoAccion} fueron enviados correctamente`
            : `Se enviaron ${resultado.enviadosExitosos} de ${resultado.totalDestinatarios} ${tipoAccion}`;
        res.status(200).json({
            message: mensaje,
            resultado: {
                totalDestinatarios: resultado.totalDestinatarios,
                enviadosExitosos: resultado.enviadosExitosos,
                errores: resultado.errores.length > 0 ? resultado.errores : undefined,
                fechaNotificacion: resultado.fechaNotificacion,
                tipo: resultado.tipo,
                esReNotificacion: resultado.esReNotificacion
            }
        });
    } catch (error) {
        console.error('Error al notificar evaluación:', error);
        // Manejar diferentes tipos de errores
        if (error.message === 'Evaluación no encontrada') {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('No se encontraron destinatarios')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Error interno al notificar evaluación',
            message: error.message
        });
    }
}

// Función para notificar docentes sobre coevaluación desde coordinador - OPTIMIZADA
async function notificarDocentesCoevaluacion(req, res) {
    try {
        const { idPeriodo } = req.params;
        if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
            return res.status(400).json({ error: 'ID de período inválido' });
        }
        
        // Obtener docentes del período
        const docentes = await usuariosRepository.obtenerCorreosDocentesPorPeriodo(parseInt(idPeriodo));
        if (docentes.length === 0) {
            return res.status(400).json({
                error: `No se encontraron docentes para el período ${idPeriodo}`
            });
        }

        // Obtener nombre del período
        let nombrePeriodo = `Período ${idPeriodo}`;
        try {
            const [periodoRows] = await dbLectura.query(`
                SELECT NOMBRE_PERIODO 
                FROM MATRICULACION_PERIODO 
                WHERE ID_PERIODO = ? AND DELETED_AT_PERIODO IS NULL
            `, [parseInt(idPeriodo)]);
            if (periodoRows.length > 0) {
                nombrePeriodo = periodoRows[0].NOMBRE_PERIODO;
            }
        } catch (error) {
            console.warn('Error obteniendo nombre del periodo:', error);
        }

        const promesasEnvio = docentes.map(docente =>
            limit(async () => {
                try {
                    const correoDestino = process.env.DEBUG_EMAIL || docente.correo;
                    const html = cargarTemplateYReemplazar({
                        NOMBRE: docente.nombre,
                        TIPO_EVALUACION: 'Coevaluación',
                        PERIODO: nombrePeriodo,
                        MENSAJE_ESPECIAL: 'Has sido asignado para participar en la coevaluación docente. Revisa tu panel de control para ver las evaluaciones asignadas.',
                        CONDICIONAL_CONTACTO: '<p>Si tienes dudas, comunícate con el coordinador académico.</p>',
                        ANIO: new Date().getFullYear()
                    });

                    const asunto = 'Coevaluación Docente Asignada';
                    
                    // VERIFICAR QUE LA FUNCIÓN EXISTE ANTES DE LLAMARLA
                    if (typeof enviarCorreo !== 'function') {
                        throw new Error('La función enviarCorreo no está disponible');
                    }

                    await enviarCorreo(correoDestino, asunto, html);
                    return { exito: true, correo: docente.correo };
                } catch (error) {
                    console.error(`❌ Error enviando correo a ${docente.correo}:`, error.message);
                    return { exito: false, correo: docente.correo, error: error.message };
                }
            })
        );

        // Esperar a que todos los correos se envíen
        const resultados = await Promise.all(promesasEnvio);

        const enviadosExitosos = resultados.filter(r => r.exito).length;
        const erroresEnvio = resultados.filter(r => !r.exito).map(r => `${r.correo}: ${r.error}`);

        const mensaje = enviadosExitosos === docentes.length
            ? `Todos los docentes fueron notificados correctamente (${enviadosExitosos})`
            : `Se notificaron ${enviadosExitosos} de ${docentes.length} docentes`;

        res.status(200).json({
            message: mensaje,
            resultado: {
                totalDocentes: docentes.length,
                enviadosExitosos,
                errores: erroresEnvio.length > 0 ? erroresEnvio : undefined,
                periodo: nombrePeriodo
            }
        });

    } catch (error) {
        console.error('Error al notificar docentes para coevaluación:', error);
        res.status(500).json({
            error: 'Error interno al notificar docentes',
            message: error.message
        });
    }
}

// Eliminar evaluación
async function eliminarEvaluacion(req, res) {
    try {
        const { id } = req.params;
        const ok = await evaluacionesService.eliminarEvaluacion(id);
        if (ok) {
            return res.json({ success: true, message: 'Evaluación eliminada correctamente' });
        } else {
            return res.status(404).json({ success: false, error: 'Evaluación no encontrada' });
        }
    } catch (error) {
        console.error('Error al eliminar evaluación:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar evaluación', detalles: error.message });
    }
}

// Editar evaluación
async function editarEvaluacion(req, res) {
    try {
        const { id } = req.params;
        const data = req.body;
        const ok = await evaluacionesService.editarEvaluacion(id, data);
        if (ok) {
            return res.json({ success: true, message: 'Evaluación actualizada correctamente' });
        } else {
            return res.status(404).json({ success: false, error: 'Evaluación no encontrada o sin cambios' });
        }
    } catch (error) {
        console.error('Error al editar evaluación:', error);
        res.status(500).json({ success: false, error: 'Error al editar evaluación', detalles: error.message });
    }
}

module.exports = {
    crearEvaluacion,
    guardarRespuestas,
    misEvaluaciones,
    obtenerEvaluacionPorId,
    obtenerResúmenesPorPeriodo,
    misEvaluacionesTodas,
    evaluacionesEstudiante,
    evaluacionesDocente,
    notificarEvaluacion,
    notificarDocentesCoevaluacion,
    eliminarEvaluacion,
    editarEvaluacion
};