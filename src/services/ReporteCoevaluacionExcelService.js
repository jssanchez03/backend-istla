// ========== SERVICIO EXCEL MEJORADO PARA IMPRESIÓN A4 ==========
const reporteCoevaluacionRepository = require('../repositories/reporteCoevaluacionRepository');
const autoridadesRepository = require('../repositories/autoridadesRepository');
const ExcelJS = require('exceljs');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

class ReporteCoevaluacionExcelService {
    // 🔄 Obtener datos filtrados por carrera del coordinador (igual que PDF)
    async obtenerDatosParaReporte(idPeriodo, cedulaCoordinador) {
        try {
            // Obtener carrera del coordinador
            const coordinadorData = await reporteCoevaluacionRepository.obtenerCarreraCoordinador(cedulaCoordinador);
            const idCarrera = coordinadorData ? coordinadorData.id_carrera : null;

            // Obtener datos filtrados por carrera
            const asignaciones = await reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, idCarrera);

            if (asignaciones.length === 0) {
                return [];
            }

            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, idCarrera);

            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));

            return asignacionesEnriquecidas;
        } catch (error) {
            console.error('Error en obtenerDatosParaReporte:', error);
            throw error;
        }
    }

    // 🆕 Generar reporte Excel filtrado por carrera del coordinador
    async generarReporteExcel(idPeriodo, cedulaCoordinador) {
        try {
            // Obtener carrera del coordinador
            const coordinadorData = await reporteCoevaluacionRepository.obtenerCarreraCoordinador(cedulaCoordinador);
            const idCarrera = coordinadorData ? coordinadorData.id_carrera : null;

            // Obtener datos filtrados y autoridades para firmas
            const [asignaciones, periodo, autoridades] = await Promise.all([
                reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, idCarrera),
                reporteCoevaluacionRepository.obtenerPeriodo(idPeriodo),
                autoridadesRepository.obtenerAutoridadesParaFirmas()
            ]);

            if (asignaciones.length === 0) {
                throw new Error('No se encontraron asignaciones para el período y carrera seleccionada');
            }

            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, idCarrera);

            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));

            // Agrupar por carrera y nivel
            const asignacionesAgrupadas = this.agruparAsignaciones(asignacionesEnriquecidas);

            // Generar Excel con ambas firmas (coordinador y vicerrectora)
            const excelBuffer = await this.crearExcel(asignacionesAgrupadas, periodo, autoridades);
            return excelBuffer;
        } catch (error) {
            console.error('Error en generarReporteExcel:', error);
            throw error;
        }
    }

    // 🆕 NUEVO: Obtener datos filtrados por carrera específica (para administradores)
    async obtenerDatosParaReportePorCarrera(idPeriodo, idCarrera) {
        try {
            // Obtener datos filtrados por carrera específica
            const asignaciones = await reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, idCarrera);

            if (asignaciones.length === 0) {
                return [];
            }

            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, idCarrera);

            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));

            return asignacionesEnriquecidas;
        } catch (error) {
            console.error('Error en obtenerDatosParaReportePorCarrera:', error);
            throw error;
        }
    }

    // 🆕 NUEVO: Generar reporte Excel por carrera específica (para administradores)
    async generarReporteExcelPorCarrera(idPeriodo, idCarrera) {
        try {
            // Obtener datos filtrados por carrera específica y autoridades para firmas
            const [asignaciones, periodo, autoridades] = await Promise.all([
                reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, idCarrera),
                reporteCoevaluacionRepository.obtenerPeriodo(idPeriodo),
                autoridadesRepository.obtenerAutoridadesParaFirmas()
            ]);

            if (asignaciones.length === 0) {
                throw new Error('No se encontraron asignaciones para el período y carrera seleccionada');
            }

            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, idCarrera);

            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));

            // Agrupar por carrera y nivel
            const asignacionesAgrupadas = this.agruparAsignaciones(asignacionesEnriquecidas);

            // Generar Excel con solo la firma de la vicerrectora
            const excelBuffer = await this.crearExcel(asignacionesAgrupadas, periodo, autoridades, true);
            return excelBuffer;
        } catch (error) {
            console.error('Error en generarReporteExcelPorCarrera:', error);
            throw error;
        }
    }

    // 🆕 Generar reporte Excel general (todas las carreras) para admin/rectora
    async generarReporteExcelGeneral(idPeriodo) {
        try {
            // Obtener todas las asignaciones y autoridades para firmas
            const [asignaciones, periodo, autoridades] = await Promise.all([
                reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo),
                reporteCoevaluacionRepository.obtenerPeriodo(idPeriodo),
                autoridadesRepository.obtenerAutoridadesParaFirmas()
            ]);

            if (asignaciones.length === 0) {
                throw new Error('No se encontraron asignaciones para el período seleccionado');
            }

            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds);

            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));

            // Agrupar por carrera y nivel
            const asignacionesAgrupadas = this.agruparAsignaciones(asignacionesEnriquecidas);

            // Generar Excel con solo la firma de la vicerrectora
            const excelBuffer = await this.crearExcel(asignacionesAgrupadas, periodo, autoridades, true);
            return excelBuffer;
        } catch (error) {
            console.error('Error en generarReporteExcelGeneral:', error);
            throw error;
        }
    }

    // ✅ Función para capitalizar texto (igual que PDF)
    capitalizarTexto(texto) {
        if (!texto || typeof texto !== 'string') return '—';

        return texto
            .toLowerCase()
            .split(' ')
            .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
            .join(' ');
    }

    // ✅ Agrupar asignaciones (igual que PDF)
    agruparAsignaciones(asignaciones) {
        const grupos = {};
        asignaciones.forEach(asig => {
            const carreraNombre = asig.carrera.nombre;
            const nivelNombre = asig.nivel.nombre;

            if (!grupos[carreraNombre]) {
                grupos[carreraNombre] = {};
            }
            if (!grupos[carreraNombre][nivelNombre]) {
                grupos[carreraNombre][nivelNombre] = [];
            }

            grupos[carreraNombre][nivelNombre].push(asig);
        });
        return grupos;
    }

    // 🆕 Crear archivo Excel optimizado para impresión A4
    async crearExcel(asignacionesAgrupadas, periodo, autoridades, soloVicerrectora = false) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Coevaluaciones');

        // Configurar propiedades del documento
        workbook.creator = 'Sistema de Coevaluaciones';
        workbook.lastModifiedBy = 'Sistema';
        workbook.created = new Date();
        workbook.modified = new Date();

        // 🎯 CONFIGURACIÓN OPTIMIZADA PARA IMPRESIÓN A4
        worksheet.pageSetup = {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0, // Permitir múltiples páginas en altura
            margins: {
                left: 0.7,
                right: 0.7,
                top: 0.75,
                bottom: 0.75,
                header: 0.3,
                footer: 0.3
            },
            printArea: 'A1:G1000' // Limitar área de impresión a 7 columnas
        };

        // 🎯 CONFIGURAR ANCHOS DE COLUMNAS OPTIMIZADOS (Total: ~19.5 cm para A4)
        worksheet.columns = [
            { header: 'N°', key: 'numero', width: 5 },                    // ~1.2 cm
            { header: 'Docente Evaluador', key: 'evaluador', width: 18 }, // ~4.3 cm
            { header: 'Docente Evaluado', key: 'evaluado', width: 18 },   // ~4.3 cm
            { header: 'Asignatura', key: 'asignatura', width: 20 },       // ~4.8 cm
            { header: 'Fecha', key: 'fecha', width: 10 },                 // ~2.4 cm
            { header: 'Horario', key: 'horario', width: 12 },             // ~2.9 cm
            { header: 'Día', key: 'dia', width: 10 }                      // ~2.4 cm
        ];

        let currentRow = 1;

        // 🎯 AGREGAR IMÁGENES DE ENCABEZADO
        await this.agregarImagenesYEncabezado(worksheet, periodo);

        // 🎯 ENCABEZADO PRINCIPAL MÁS COMPACTO (después de las imágenes)
        currentRow = 6; // Empezar después de las imágenes
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const titleCell = worksheet.getCell(`A${currentRow}`);
        titleCell.value = 'REPORTE DE ASIGNACIONES DE COEVALUACIONES';
        titleCell.font = { size: 14, bold: true, name: 'Arial' };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6FA' }
        };
        this.aplicarBordes(titleCell);
        worksheet.getRow(currentRow).height = 22;

        // 🎯 INFORMACIÓN DEL PERÍODO
        currentRow = 7;
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const periodoCell = worksheet.getCell(`A${currentRow}`);
        periodoCell.value = `PERÍODO: ${periodo ? periodo.descripcion_periodo : 'No especificado'}`;
        periodoCell.font = { size: 11, bold: true, name: 'Arial' };
        periodoCell.alignment = { horizontal: 'center', vertical: 'middle' };
        periodoCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' }
        };
        this.aplicarBordes(periodoCell);
        worksheet.getRow(currentRow).height = 18;

        // 🎯 FECHA DE GENERACIÓN
        currentRow = 8;
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
        const fechaCell = worksheet.getCell(`A${currentRow}`);
        fechaCell.value = `Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`;
        fechaCell.font = { size: 9, name: 'Arial' };
        fechaCell.alignment = { horizontal: 'center', vertical: 'middle' };
        this.aplicarBordes(fechaCell);
        worksheet.getRow(currentRow).height = 15;

        currentRow = 10; // Espacio después del encabezado

        // 🎯 ITERAR POR CARRERA Y NIVEL
        Object.keys(asignacionesAgrupadas).forEach((carrera, carreraIndex) => {
            // Título de la carrera
            worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
            const carreraCell = worksheet.getCell(`A${currentRow}`);
            carreraCell.value = `Carrera: ${this.capitalizarTexto(carrera)}`;
            carreraCell.font = { size: 11, bold: true, name: 'Arial' };
            carreraCell.alignment = { horizontal: 'left', vertical: 'middle' };
            carreraCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' }
            };
            this.aplicarBordes(carreraCell);
            worksheet.getRow(currentRow).height = 18;
            currentRow++;

            // Iterar por los niveles de esta carrera
            Object.keys(asignacionesAgrupadas[carrera]).forEach((nivel, nivelIndex) => {
                const asignaciones = asignacionesAgrupadas[carrera][nivel];

                // Título del nivel
                worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
                const nivelCell = worksheet.getCell(`A${currentRow}`);
                nivelCell.value = `Nivel: ${this.capitalizarTexto(nivel)}`;
                nivelCell.font = { size: 10, bold: true, name: 'Arial' };
                nivelCell.alignment = { horizontal: 'left', vertical: 'middle' };
                nivelCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF0F0F0' }
                };
                this.aplicarBordes(nivelCell);
                worksheet.getRow(currentRow).height = 16;
                currentRow++;

                // 🎯 ENCABEZADOS DE LA TABLA OPTIMIZADOS (SIN FONDO AZUL)
                const headerRow = worksheet.getRow(currentRow);
                headerRow.values = ['N°', 'Docente Evaluador', 'Docente Evaluado', 'Asignatura', 'Fecha', 'Horario', 'Día'];
                headerRow.font = { bold: true, name: 'Arial', size: 9 };
                headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

                // Aplicar formato a los encabezados
                for (let col = 1; col <= 7; col++) {
                    const cell = headerRow.getCell(col);
                    cell.font = { color: { argb: 'FF000000' }, bold: true, name: 'Arial', size: 9 }; // Texto negro
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFD3D3D3' }
                    };
                    this.aplicarBordes(cell);
                }
                headerRow.height = 18;
                currentRow++;

                // 🎯 DATOS DE ASIGNACIONES OPTIMIZADOS
                asignaciones.forEach((asig, index) => {
                    const dataRow = worksheet.getRow(currentRow);

                    // Combinar inicio y fin en una sola columna "Horario"
                    const horario = this.formatearHorario(asig.hora_inicio, asig.hora_fin);

                    dataRow.values = [
                        index + 1,
                        this.truncarTexto(this.capitalizarTexto(asig.nombre_evaluador) || '—', 25),
                        this.truncarTexto(this.capitalizarTexto(asig.nombre_evaluado) || '—', 25),
                        this.truncarTexto(this.capitalizarTexto(asig.nombre_asignatura) || '—', 30),
                        asig.fecha ? moment(asig.fecha).format('DD/MM/YYYY') : '—',
                        horario,
                        this.truncarTexto(this.capitalizarTexto(asig.dia) || '—', 12)
                    ];

                    // 🎯 CONFIGURAR ALINEACIÓN Y FORMATO
                    dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                    dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                    dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
                    dataRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
                    dataRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
                    dataRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
                    dataRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

                    // Fuente más pequeña para datos
                    for (let col = 1; col <= 7; col++) {
                        const cell = dataRow.getCell(col);
                        cell.font = { name: 'Arial', size: 8 };
                        this.aplicarBordes(cell);
                    }

                    // Altura de fila más compacta
                    dataRow.height = 16;

                    // 🎯 ALTERNAR COLOR DE FONDO
                    if (index % 2 === 1) {
                        for (let col = 1; col <= 7; col++) {
                            dataRow.getCell(col).fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF8F8F8' }
                            };
                        }
                    }

                    currentRow++;
                });

                currentRow++; // Espacio entre niveles
            });

            currentRow++; // Espacio extra entre carreras
        });

        // 🎯 AGREGAR SECCIÓN DE FIRMAS OPTIMIZADA
        currentRow = this.agregarSeccionFirmasExcel(worksheet, currentRow, autoridades, soloVicerrectora);

        // 🎯 CONFIGURAR IMPRESIÓN
        worksheet.pageSetup.printTitlesRow = '1:8'; // Repetir encabezados incluyendo imágenes

        // Convertir a buffer
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    // 🆕 Función para agregar imágenes y encabezado como en PDF
    async agregarImagenesYEncabezado(worksheet, periodo) {
        try {
            // Rutas de las imágenes
            const logoPath = path.join(__dirname, '../assets/logo_istla.png');
            const encabezadoPath = path.join(__dirname, '../assets/encabezado.png');

            // Verificar si las imágenes existen
            const logoExists = fs.existsSync(logoPath);
            const encabezadoExists = fs.existsSync(encabezadoPath);

            if (encabezadoExists) {
                // Imagen de encabezado de fondo - estirada a lo ancho
                const encabezadoImageId = worksheet.workbook.addImage({
                    filename: encabezadoPath,
                    extension: 'png',
                });

                // Agregar imagen de encabezado en las primeras filas
                worksheet.addImage(encabezadoImageId, {
                    tl: { col: 0, row: 0 }, // Top-left: columna A, fila 1
                    br: { col: 7, row: 4 }, // Bottom-right: columna G, fila 4
                    editAs: 'oneCell'
                });

                // Configurar altura de las filas para la imagen de encabezado
                worksheet.getRow(1).height = 15;
                worksheet.getRow(2).height = 15;
                worksheet.getRow(3).height = 15;
                worksheet.getRow(4).height = 15;
            }

            if (logoExists) {
                // Logo sobrepuesto en la esquina superior izquierda
                const logoImageId = worksheet.workbook.addImage({
                    filename: logoPath,
                    extension: 'png',
                });

                // Agregar logo
                worksheet.addImage(logoImageId, {
                    tl: { col: 0.4, row: 0.2 }, // Posición ajustada
                    br: { col: 2.9, row: 3.5 }, // Tamaño ajustado
                    editAs: 'oneCell'
                });
            }

        } catch (error) {
            console.error('Error al cargar imágenes:', error.message);
            // Continuar sin imágenes si hay error
            // Configurar filas vacías para mantener el espaciado
            worksheet.getRow(1).height = 15;
            worksheet.getRow(2).height = 15;
            worksheet.getRow(3).height = 15;
            worksheet.getRow(4).height = 15;
        }
    }

    // 🆕 Función para formatear horario (inicio - fin)
    formatearHorario(inicio, fin) {
        const inicioFormat = inicio ? moment(inicio, 'HH:mm:ss').format('HH:mm') : '—';
        const finFormat = fin ? moment(fin, 'HH:mm:ss').format('HH:mm') : '—';

        if (inicioFormat === '—' && finFormat === '—') {
            return '—';
        }

        return `${inicioFormat} - ${finFormat}`;
    }

    // 🆕 Función para truncar texto si es muy largo
    truncarTexto(texto, maxLength) {
        if (!texto || typeof texto !== 'string') return '—';

        if (texto.length <= maxLength) {
            return texto;
        }

        return texto.substring(0, maxLength - 3) + '...';
    }

    // 🆕 Función para aplicar bordes consistentes
    aplicarBordes(cell) {
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
    }

    // 🆕 Función para agregar sección de firmas en Excel OPTIMIZADA
    agregarSeccionFirmasExcel(worksheet, startRow, autoridades, soloVicerrectora = false) {
        let currentRow = startRow + 2;

        // Filtrar solo la vicerrectora si corresponde
        let autoridadesFiltradas = autoridades;
        if (soloVicerrectora && Array.isArray(autoridades)) {
            autoridadesFiltradas = autoridades.filter(a => a.cargo_autoridad && a.cargo_autoridad.toUpperCase().includes('VICERRECTOR'));
        }
        if (!autoridadesFiltradas || autoridadesFiltradas.length === 0) {
            return this.agregarFirmasDefaultExcel(worksheet, currentRow);
        }
        // Si hay dos autoridades, mostrar ambas (izquierda y derecha)
        if (autoridadesFiltradas.length === 2) {
            this.agregarFirmaIndividual(worksheet, currentRow, autoridadesFiltradas[0], 'A', 'C');
            this.agregarFirmaIndividual(worksheet, currentRow, autoridadesFiltradas[1], 'E', 'G');
        } else {
            // Solo una firma centrada
            this.agregarFirmaIndividual(worksheet, currentRow, autoridadesFiltradas[0], 'B', 'F', true);
        }
        return currentRow + 5;
    }

    // 🆕 Función para agregar firma individual
    agregarFirmaIndividual(worksheet, startRow, autoridad, startCol, endCol, espacioExtra = false) {
        // Línea de firma
        worksheet.mergeCells(`${startCol}${startRow}:${endCol}${startRow}`);
        const lineaFirma = worksheet.getCell(`${startCol}${startRow}`);
        lineaFirma.value = '________________________';
        lineaFirma.alignment = { horizontal: 'center', vertical: 'middle' };
        lineaFirma.font = { name: 'Arial', size: 10 };
        worksheet.getRow(startRow).height = 15;

        // Nombre de la autoridad
        worksheet.mergeCells(`${startCol}${startRow + 1}:${endCol}${startRow + 1}`);
        const nombreAutoridad = worksheet.getCell(`${startCol}${startRow + 1}`);
        nombreAutoridad.value = autoridad.nombre_autoridad;
        nombreAutoridad.font = { bold: true, name: 'Arial', size: 9 };
        nombreAutoridad.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(startRow + 1).height = 16;

        // Cargo de la autoridad
        worksheet.mergeCells(`${startCol}${startRow + 2}:${endCol}${startRow + 2}`);
        const cargoAutoridad = worksheet.getCell(`${startCol}${startRow + 2}`);
        cargoAutoridad.value = autoridad.cargo_autoridad.toUpperCase();
        cargoAutoridad.font = { size: 8, name: 'Arial' };
        cargoAutoridad.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(startRow + 2).height = 14;
    }

    // 🆕 Función para firmas por defecto en Excel OPTIMIZADA (SIN TÍTULO)
    agregarFirmasDefaultExcel(worksheet, startRow) {
        let currentRow = startRow;

        // 🎯 COORDINADOR (columnas A-C)
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const lineaCoordinador = worksheet.getCell(`A${currentRow}`);
        lineaCoordinador.value = '________________________';
        lineaCoordinador.alignment = { horizontal: 'center', vertical: 'middle' };
        lineaCoordinador.font = { name: 'Arial', size: 10 };

        // 🎯 VICERRECTORA (columnas E-G)
        worksheet.mergeCells(`E${currentRow}:G${currentRow}`);
        const lineaVicerrectora = worksheet.getCell(`E${currentRow}`);
        lineaVicerrectora.value = '________________________';
        lineaVicerrectora.alignment = { horizontal: 'center', vertical: 'middle' };
        lineaVicerrectora.font = { name: 'Arial', size: 10 };
        worksheet.getRow(currentRow).height = 15;

        // 🎯 NOMBRES
        worksheet.mergeCells(`A${currentRow + 1}:C${currentRow + 1}`);
        const nombreCoordinador = worksheet.getCell(`A${currentRow + 1}`);
        nombreCoordinador.value = 'Mg. Javier Cevallos';
        nombreCoordinador.font = { bold: true, name: 'Arial', size: 9 };
        nombreCoordinador.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`E${currentRow + 1}:G${currentRow + 1}`);
        const nombreVicerrectora = worksheet.getCell(`E${currentRow + 1}`);
        nombreVicerrectora.value = 'Mg. Sandra Rivilla Requelme';
        nombreVicerrectora.font = { bold: true, name: 'Arial', size: 9 };
        nombreVicerrectora.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(currentRow + 1).height = 16;

        // 🎯 CARGOS
        worksheet.mergeCells(`A${currentRow + 2}:C${currentRow + 2}`);
        const cargoCoordinador = worksheet.getCell(`A${currentRow + 2}`);
        cargoCoordinador.value = 'COORDINADOR';
        cargoCoordinador.font = { size: 8, name: 'Arial' };
        cargoCoordinador.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells(`E${currentRow + 2}:G${currentRow + 2}`);
        const cargoVicerrectora = worksheet.getCell(`E${currentRow + 2}`);
        cargoVicerrectora.value = 'VICERRECTORA';
        cargoVicerrectora.font = { size: 8, name: 'Arial' };
        cargoVicerrectora.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(currentRow + 2).height = 14;

        return currentRow + 5;
    }
}

module.exports = new ReporteCoevaluacionExcelService();