const { dbLectura, dbEscritura } = require('../config/database');

async function buscarPorCorreoYCedula(correo, cedula) {
  const [rows] = await dbLectura.query(
    `SELECT 
      ID_USUARIOS AS id, 
      CORREO_USUARIOS AS correo, 
      DOCUMENTO_USUARIOS AS cedula, 
      ID_PERFILES_USUARIOS AS rol 
    FROM SEGURIDAD_USUARIOS 
    WHERE CORREO_USUARIOS = ? AND DOCUMENTO_USUARIOS = ?`,
    [correo, cedula]
  );
  return rows[0];
}

async function obtenerNombreYPerfilPorId(id) {
  const [rows] = await dbLectura.query(
    `SELECT 
      CONCAT(NOMBRES_USUARIOS, ' ', APELLIDOS_USUARIOS) AS nombre,
      ID_PERFILES_USUARIOS AS perfil_id
    FROM SEGURIDAD_USUARIOS
    WHERE ID_USUARIOS = ?`,
    [id]
  );
  return rows[0];
}

async function obtenerEvaluacionPorId(idEvaluacion) {
  try {
    // Primero obtenemos los datos básicos de la evaluación
    const [rows] = await dbEscritura.query(`
            SELECT 
                e.id_evaluacion,
                e.id_formulario,
                e.id_periodo,
                e.fecha_inicio,
                e.fecha_fin,
                e.fecha_notificacion,
                e.estado,
                f.nombre AS nombre_formulario
            FROM evaluaciones e
            LEFT JOIN formularios f ON e.id_formulario = f.id_formulario
            WHERE e.id_evaluacion = ?
        `, [idEvaluacion]);

    if (rows.length === 0) {
      return null;
    }

    const evaluacion = rows[0];
    // Si tiene periodo, obtener el nombre del periodo desde dbLectura
    if (evaluacion.id_periodo) {
      try {
        const [periodoRows] = await dbLectura.query(`
                    SELECT NOMBRE_PERIODO 
                    FROM MATRICULACION_PERIODO 
                    WHERE ID_PERIODO = ? AND DELETED_AT_PERIODO IS NULL
                `, [evaluacion.id_periodo]);

        evaluacion.nombre_periodo = periodoRows[0]?.NOMBRE_PERIODO || `Periodo ${evaluacion.id_periodo}`;
      } catch (error) {
        console.error('Error obteniendo nombre del periodo:', error);
        evaluacion.nombre_periodo = `Periodo ${evaluacion.id_periodo}`;
      }
    } else {
      evaluacion.nombre_periodo = 'Sin periodo';
    }

    return evaluacion;
  } catch (error) {
    console.error('Error obteniendo evaluación por ID:', error);
    throw error;
  }
}

async function obtenerCorreosEstudiantesPorPeriodo(idPeriodo) {
  const [rows] = await dbLectura.query(`
        SELECT DISTINCT CORREO_USUARIOS, DOCUMENTO_USUARIOS, NOMBRES_USUARIOS, APELLIDOS_USUARIOS
        FROM SEGURIDAD_USUARIOS
        INNER JOIN MATRICULACION_ESTUDIANTES 
           ON DOCUMENTO_USUARIOS = DOCUMENTO_ESTUDIANTES
        INNER JOIN MATRICULACION_MATRICULA 
           ON MATRICULACION_ESTUDIANTES.ID_ESTUDIANTES = MATRICULACION_MATRICULA.ID_ESTUDIANTE_MATRICULA
        WHERE ID_PERFILES_USUARIOS = 14
          AND MATRICULACION_MATRICULA.ID_PERIODO_MATRICULA = ?
          AND SEGURIDAD_USUARIOS.DELETED_AT IS NULL
          AND CORREO_USUARIOS IS NOT NULL
          AND CORREO_USUARIOS != ''
    `, [idPeriodo]);

  return rows.map(row => ({
    correo: row.CORREO_USUARIOS,
    nombre: `${row.NOMBRES_USUARIOS} ${row.APELLIDOS_USUARIOS}`.trim()
  }));

}

async function obtenerCorreosDocentesPorPeriodo(idPeriodo) {
  const [rows] = await dbLectura.query(`
        SELECT DISTINCT su.CORREO_USUARIOS, su.DOCUMENTO_USUARIOS, NOMBRES_USUARIOS, APELLIDOS_USUARIOS
        FROM NOTAS_DISTRIBUTIVO nd
        JOIN HORARIOS_DOCENTE hd 
           ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
        JOIN SEGURIDAD_USUARIOS su 
           ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
        WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
          AND su.ID_PERFILES_USUARIOS = 15
          AND su.DELETED_AT IS NULL
          AND su.CORREO_USUARIOS IS NOT NULL
          AND su.CORREO_USUARIOS != ''
    `, [idPeriodo]);

  return rows.map(row => ({
    correo: row.CORREO_USUARIOS,
    nombre: `${row.NOMBRES_USUARIOS} ${row.APELLIDOS_USUARIOS}`.trim()
  }));

}

async function obtenerCorreoCoordinador() {
  const [rows] = await dbLectura.query(`
        SELECT CORREO_USUARIOS, DOCUMENTO_USUARIOS, NOMBRES_USUARIOS, APELLIDOS_USUARIOS
        FROM SEGURIDAD_USUARIOS
        WHERE ID_PERFILES_USUARIOS IN (1, 17)
          AND DELETED_AT IS NULL
          AND CORREO_USUARIOS IS NOT NULL
          AND CORREO_USUARIOS != '';
    `);

  return rows.map(row => ({
    correo: row.CORREO_USUARIOS,
    nombre: `${row.NOMBRES_USUARIOS} ${row.APELLIDOS_USUARIOS}`.trim()
  }));
}

module.exports = {
  buscarPorCorreoYCedula,
  obtenerNombreYPerfilPorId,
  obtenerCorreosEstudiantesPorPeriodo,
  obtenerCorreosDocentesPorPeriodo,
  obtenerCorreoCoordinador,
  obtenerEvaluacionPorId
};