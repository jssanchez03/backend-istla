const asignacionesRepository = require('../repositories/asignacionesRepository');

async function asignarCoevaluador(data) {
    // Validaciones básicas
    if (!data.id_periodo || !data.id_docente_evaluador || !data.id_docente_evaluado) {
        throw new Error('Faltan datos requeridos: período, docente evaluador y docente evaluado');
    }    
    if (data.id_docente_evaluador === data.id_docente_evaluado) {
        throw new Error('Un docente no puede evaluarse a sí mismo');
    }    
    // Verificar que existan los docentes y el período
    const [docenteEvaluadorExiste, docenteEvaluadoExiste, periodoExiste] = await Promise.all([
        asignacionesRepository.verificarDocente(data.id_docente_evaluador),
        asignacionesRepository.verificarDocente(data.id_docente_evaluado),
        asignacionesRepository.verificarPeriodo(data.id_periodo)
    ]);    
    if (!docenteEvaluadorExiste) {
        throw new Error('El docente evaluador no existe');
    }
    if (!docenteEvaluadoExiste) {
        throw new Error('El docente evaluado no existe');
    }
    if (!periodoExiste) {
        throw new Error('El período no existe');
    }    
    // NUEVA VALIDACIÓN: Verificar si ya existe una asignación específica
    const yaExiste = await asignacionesRepository.verificarAsignacionExistente(
        data.id_periodo,
        data.id_docente_evaluador,
        data.id_docente_evaluado,
        data.id_asignatura || null
    );    
    if (yaExiste) {
        if (data.id_asignatura) {
            throw new Error('Ya existe una asignación entre estos docentes para esta asignatura en este período');
        } else {
            throw new Error('Ya existe una asignación general entre estos docentes para este período');
        }
    }   
    return await asignacionesRepository.crearAsignacion(data);
}

async function listarAsignaciones(id_periodo) {
    if (!id_periodo) {
        throw new Error('El ID del período es requerido');
    }
    return await asignacionesRepository.obtenerAsignacionesPorPeriodo(id_periodo);
}

async function eliminarAsignacion(id_asignacion) {
    if (!id_asignacion) {
        throw new Error('El ID de la asignación es requerido');
    }
    return await asignacionesRepository.eliminarAsignacion(id_asignacion);
}

async function editarAsignacion(id_asignacion, data) {
    if (!id_asignacion) {
        throw new Error('El ID de la asignación es requerido');
    }
    // Validaciones básicas (puedes agregar más si lo deseas)
    if (!data.id_periodo || !data.id_docente_evaluador || !data.id_docente_evaluado) {
        throw new Error('Faltan datos requeridos: período, docente evaluador y docente evaluado');
    }
    if (data.id_docente_evaluador === data.id_docente_evaluado) {
        throw new Error('Un docente no puede evaluarse a sí mismo');
    }
    return await asignacionesRepository.editarAsignacion(id_asignacion, data);
}

function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .toLowerCase()
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Función para limpiar y validar nombres de docentes
function limpiarNombreDocente(nombre) {
    if (!nombre || typeof nombre !== 'string') return null;
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    // Filtrar nombres inválidos
    if (nombreLimpio === '' ||
        nombreLimpio.includes('@') ||
        nombreLimpio.length < 2 ||
        nombreLimpio.toLowerCase() === 'null' ||
        nombreLimpio.toLowerCase() === 'undefined') {
        return null;
    }
    return toTitleCase(nombreLimpio);
}

// Obtener docentes evaluadores por periodo
async function obtenerDocentesEvaluadores(idPeriodo) {
    if (!idPeriodo) {
        throw new Error('El ID del período es requerido');
    }
    try {
        const docentes = await asignacionesRepository.obtenerDocentesEvaluadores(idPeriodo);
        return docentes
            .map(d => ({
                ...d,
                nombre: limpiarNombreDocente(d.nombre)
            }))
            .filter(d => d.nombre !== null) // Filtrar nombres inválidos
            .sort((a, b) => a.nombre.localeCompare(b.nombre)); // Ordenar alfabéticamente
    } catch (error) {
        console.error('Error en obtenerDocentesEvaluadores:', error);
        throw new Error('Error al obtener los docentes evaluadores');
    }
}

// Obtener docentes con sus materias por periodo
async function obtenerDocentesConMateriasPorPeriodo(idPeriodo) {
    if (!idPeriodo) {
        throw new Error('El ID del período es requerido');
    }
    try {
        const docentes = await asignacionesRepository.obtenerDocentesConMateriasPorPeriodo(idPeriodo);
        // Limpiar nombres y filtrar registros inválidos
        const docentesLimpios = docentes
            .map(d => ({
                ...d,
                nombre: limpiarNombreDocente(d.nombre)
            }))
            .filter(d => d.nombre !== null);
        // Agrupar por docente y sus materias
        const docentesAgrupados = {};
        docentesLimpios.forEach(d => {
            if (!docentesAgrupados[d.id_docente]) {
                docentesAgrupados[d.id_docente] = {
                    id_docente: d.id_docente,
                    nombre: d.nombre,
                    materias: []
                };
            }
            // Evitar materias duplicadas
            const materiaExiste = docentesAgrupados[d.id_docente].materias.some(
                m => m.id_distributivo === d.id_distributivo
            );
            if (!materiaExiste) {
                docentesAgrupados[d.id_docente].materias.push({
                    id_distributivo: d.id_distributivo,
                    id_asignatura: d.id_asignatura,
                    nombre_asignatura: d.nombre_asignatura || 'Materia sin nombre'
                });
            }
        });
        // Convertir a array y ordenar
        const resultado = Object.values(docentesAgrupados)
            .filter(d => d.materias.length > 0) // Solo docentes con materias
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
        return resultado;
    } catch (error) {
        console.error('Error en obtenerDocentesConMateriasPorPeriodo:', error);
        throw new Error('Error al obtener los docentes con materias');
    }
}

async function obtenerAsignacionesCompletas() {
    try {
        const asignaciones = await asignacionesRepository.obtenerAsignacionesCompletas();
        return asignaciones.map(asig => ({
            ...asig,
            nombre_evaluador: limpiarNombreDocente(asig.nombre_evaluador) || 'Docente no encontrado',
            nombre_evaluado: limpiarNombreDocente(asig.nombre_evaluado) || 'Docente no encontrado'
        }));
    } catch (error) {
        console.error('Error en obtenerAsignacionesCompletas:', error);
        throw new Error('Error al obtener las asignaciones completas');
    }
}

// Obtener asignaturas por periodo
async function obtenerAsignaturasPorPeriodo(idPeriodo) {
    if (!idPeriodo) {
        throw new Error('El ID del período es requerido');
    }
    try {
        return await asignacionesRepository.obtenerAsignaturasPorPeriodo(idPeriodo);
    } catch (error) {
        console.error('Error en obtenerAsignaturasPorPeriodo:', error);
        throw new Error('Error al obtener las asignaturas');
    }
}

module.exports = {
    asignarCoevaluador,
    listarAsignaciones,
    eliminarAsignacion,
    editarAsignacion,
    obtenerDocentesEvaluadores,
    obtenerDocentesConMateriasPorPeriodo,
    obtenerAsignacionesCompletas,
    obtenerAsignaturasPorPeriodo
};