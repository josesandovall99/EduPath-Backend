const { Area, Estudiante, Tema, Subtema, Contenido, Ejercicio, Evaluacion, Miniproyecto, Progreso, RespuestaEstudianteMiniproyecto, RespuestaEstudianteEjercicio, SecuenciaContenido, Persona, Actividad } = require('../models');
const { Op } = require('sequelize');
const puppeteer = require('puppeteer');
const desbloqueoService = require('../services/desbloqueo.service');

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('es-CO');
  } catch (e) {
    return '-';
  }
};

const isApprovedStatus = (estado) => String(estado || '').toUpperCase() === 'APROBADO';

const toSafeInt = (value) => {
  if (Number.isFinite(value)) return value;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeFallos = (contador, aprobado) => {
  const total = toSafeInt(contador);
  if (total <= 0) return 0;
  return aprobado ? Math.max(total - 1, 0) : total;
};

const buildReportHtml = ({ type, data }) => {
  const headerTitle = type === 'student'
    ? 'Progreso por Estudiante'
    : type === 'date'
      ? 'Progreso por Fecha de Creación'
      : type === 'activity'
        ? 'Desempeño por Actividad'
        : 'Fallos por Actividad';

  const stats = data.stats || [];
  const cards = stats.map((stat) => `
    <div class="card">
      <div class="card-title">${escapeHtml(stat.label)}</div>
      <div class="card-value">${escapeHtml(stat.value)}</div>
      <div class="card-sub">${escapeHtml(stat.sub || '')}</div>
    </div>
  `).join('');

  const rows = (data.tableRows || []).map((row) => `
    <tr>
      ${(row || []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
    </tr>
  `).join('');

  const tableHeaders = (data.tableHeaders || []).map((header) => `<th>${escapeHtml(header)}</th>`).join('');

  const sections = (data.sections || []).map((section) => `
    <div class="section">
      <div class="section-header">
        <div>
          <div class="section-title">${escapeHtml(section.title)}</div>
          ${section.subtitle ? `<div class="section-sub">${escapeHtml(section.subtitle)}</div>` : ''}
        </div>
      </div>
      <div class="section-body">${section.body || ''}</div>
    </div>
  `).join('');

  const charts = Array.isArray(data.charts) ? data.charts : [];
  const chartsHtml = charts.length
    ? `
      <div class="chart-grid">
        ${charts.map((chart) => `
          <div class="chart-card">
            <div class="chart-title">${escapeHtml(chart.title || '')}</div>
            ${chart.subtitle ? `<div class="chart-sub">${escapeHtml(chart.subtitle)}</div>` : ''}
            <div class="chart-canvas">
              <canvas id="${escapeHtml(chart.id)}"></canvas>
            </div>
          </div>
        `).join('')}
      </div>
    `
    : '';

  const chartsScript = charts.length
    ? `
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      <script>
        window.__chartsReady = false;
        const chartsData = ${JSON.stringify(charts)};
        const palette = ['#4A90E2', '#7ED6A7', '#F5A97F', '#A78BFA', '#FBBF24', '#34D399', '#60A5FA'];
        chartsData.forEach((chart, index) => {
          const ctx = document.getElementById(chart.id);
          if (!ctx) return;
          const colors = chart.colors && chart.colors.length
            ? chart.colors
            : (chart.type === 'pie' || chart.type === 'doughnut')
              ? chart.data.map((_, i) => palette[i % palette.length])
              : [chart.color || palette[index % palette.length]];
          const dataset = {
            data: chart.data || [],
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: chart.type === 'bar' ? 8 : 0
          };
          new Chart(ctx, {
            type: chart.type,
            data: {
              labels: chart.labels || [],
              datasets: [dataset]
            },
            options: {
              responsive: true,
              animation: false,
              plugins: {
                legend: {
                  display: chart.showLegend !== false,
                  position: chart.legendPosition || 'bottom'
                }
              },
              scales: chart.type === 'bar' ? {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { ticks: { maxRotation: 0, autoSkip: true } }
              } : undefined
            }
          });
        });
        window.__chartsReady = true;
      </script>
    `
    : '<script>window.__chartsReady = true;</script>';

  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EduPath Reporte</title>
    <style>
      :root {
        --blue: #4A90E2;
        --green: #7ED6A7;
        --orange: #F5A97F;
        --text: #3A4A5B;
        --muted: #6B7280;
        --bg: #F2F2F2;
      }
      * { box-sizing: border-box; }
      @page {
        size: A4;
        margin: 12mm;
      }
      body {
        margin: 0;
        font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        color: var(--text);
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        padding: 0;
      }
      .header {
        background: #fff;
        border-radius: 18px;
        padding: 24px 28px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
      }
      .header-title {
        font-size: 20px;
        font-weight: 700;
      }
      .header-sub {
        color: var(--muted);
        font-size: 12px;
        margin-top: 4px;
      }
      .badge {
        padding: 6px 14px;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--blue), #5B9FED);
        color: #fff;
        font-weight: 600;
        font-size: 12px;
      }
      .cards {
        margin-top: 20px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }
      .card {
        background: #fff;
        border-radius: 16px;
        padding: 16px 18px;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
      }
      .card-title {
        font-size: 12px;
        color: var(--muted);
      }
      .card-value {
        font-size: 24px;
        font-weight: 700;
        margin-top: 8px;
      }
      .card-sub {
        margin-top: 4px;
        font-size: 11px;
        color: #9CA3AF;
      }
      .section {
        margin-top: 22px;
        background: #fff;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
      }
      .section-header {
        padding: 18px 22px;
        background: linear-gradient(90deg, var(--blue), #5B9FED);
        color: #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .section-title {
        font-size: 16px;
        font-weight: 700;
      }
      .section-sub {
        font-size: 12px;
        opacity: 0.85;
      }
      .section-body {
        padding: 18px 22px 22px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      thead th {
        text-align: left;
        padding: 10px 12px;
        background: #F9FAFB;
        border-bottom: 1px solid #E5E7EB;
        color: var(--text);
      }
      tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid #E5E7EB;
        color: var(--muted);
      }
      .list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .list li {
        padding: 8px 0;
        border-bottom: 1px solid #E5E7EB;
        color: var(--muted);
      }
      .list li:last-child { border-bottom: none; }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .meta-item {
        background: #F9FAFB;
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 12px;
        color: var(--muted);
      }
      .meta-item strong { color: var(--text); display: block; font-size: 14px; margin-top: 6px; }
      .footer {
        text-align: center;
        margin-top: 18px;
        color: #9CA3AF;
        font-size: 11px;
      }
      .chart-grid {
        margin-top: 20px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .chart-card {
        background: #fff;
        border-radius: 18px;
        padding: 16px 18px 18px;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
      }
      .chart-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--text);
      }
      .chart-sub {
        margin-top: 4px;
        font-size: 11px;
        color: var(--muted);
      }
      .chart-canvas {
        margin-top: 12px;
        height: 200px;
      }
      .chart-canvas canvas {
        width: 100% !important;
        height: 100% !important;
      }
      .report-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .report-table thead th {
        text-align: left;
        padding: 10px 12px;
        background: #F9FAFB;
        border-bottom: 1px solid #E5E7EB;
        color: var(--text);
      }
      .report-table tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid #E5E7EB;
        color: var(--muted);
        vertical-align: middle;
      }
      .progress-bar {
        width: 140px;
        height: 8px;
        background: #E5E7EB;
        border-radius: 999px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 999px;
        background: var(--blue);
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
      }
      .status-ok {
        color: #1F7A4D;
        background: rgba(126, 214, 167, 0.25);
      }
      .status-warn {
        color: #8A6D1D;
        background: rgba(251, 191, 36, 0.2);
      }
      .status-bad {
        color: #A94442;
        background: rgba(245, 169, 127, 0.2);
      }
      .stat-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 12px;
      }
      .stat-card {
        background: #F9FAFB;
        border-radius: 12px;
        padding: 12px 14px;
      }
      .stat-card .label {
        font-size: 11px;
        color: var(--muted);
      }
      .stat-card .value {
        font-size: 18px;
        color: var(--text);
        font-weight: 700;
        margin-top: 4px;
      }
      .stat-card .sub {
        font-size: 10px;
        color: #9CA3AF;
        margin-top: 2px;
      }
      .grade-pill {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(74, 144, 226, 0.15);
        color: #4A90E2;
        font-size: 11px;
        font-weight: 600;
      }
      @media print {
        body { background: #ffffff; }
        .page { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div>
          <div class="header-title">EduPath - Generación de Informes</div>
          <div class="header-sub">${escapeHtml(data.subtitle || '')}</div>
        </div>
        <div class="badge">${escapeHtml(headerTitle)}</div>
      </div>

      ${cards ? `<div class="cards">${cards}</div>` : ''}

      ${sections}

      ${chartsHtml}

      ${(data.tableHeaders && data.tableHeaders.length)
        ? `
          <div class="section">
            <div class="section-header">
              <div>
                <div class="section-title">${escapeHtml(data.tableTitle || 'Detalle')}</div>
                ${data.tableSubtitle ? `<div class="section-sub">${escapeHtml(data.tableSubtitle)}</div>` : ''}
              </div>
            </div>
            <div class="section-body">
              <table class="report-table">
                <thead>
                  <tr>${tableHeaders}</tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="6">Sin datos</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        `
        : ''}

      <div class="footer">Reporte generado automáticamente por EduPath</div>
    </div>
    ${chartsScript}
  </body>
  </html>`;
};

const buildFailuresReportData = async ({ estudianteId }) => {
  const respuestaWhere = estudianteId ? { estudiante_id: estudianteId } : {};
  const evaluacionWhere = estudianteId ? { estudiante_id: estudianteId } : {};

  const [areas, evaluaciones, respuestasEjercicio, respuestasMiniproyecto] = await Promise.all([
    Area.findAll({ attributes: ['id', 'nombre'] }),
    Evaluacion.findAll({
      where: evaluacionWhere,
      attributes: ['estudiante_id', 'ejercicio_id', 'miniproyecto_id', 'estado']
    }),
    RespuestaEstudianteEjercicio.findAll({
      where: respuestaWhere,
      include: [
        {
          model: Ejercicio,
          as: 'ejercicio',
          include: [
            { model: Contenido, include: [{ model: Tema }] },
            { model: Actividad, as: 'actividad' }
          ]
        }
      ]
    }),
    RespuestaEstudianteMiniproyecto.findAll({
      where: respuestaWhere,
      include: [
        {
          model: Miniproyecto,
          as: 'miniproyecto',
          include: [
            { model: Area },
            { model: Actividad }
          ]
        }
      ]
    })
  ]);

  const areaMap = new Map(areas.map((area) => [String(area.id), area.nombre]));
  const approvedExercises = new Set();
  const approvedMinis = new Set();

  evaluaciones.forEach((evaluacion) => {
    if (!isApprovedStatus(evaluacion.estado)) return;
    if (evaluacion.ejercicio_id) {
      approvedExercises.add(`${evaluacion.estudiante_id}:${evaluacion.ejercicio_id}`);
    }
    if (evaluacion.miniproyecto_id) {
      approvedMinis.add(`${evaluacion.estudiante_id}:${evaluacion.miniproyecto_id}`);
    }
  });

  const items = [];

  respuestasEjercicio.forEach((respuesta) => {
    const ejercicio = respuesta.ejercicio;
    const contenido = ejercicio?.Contenido || ejercicio?.contenido;
    const tema = contenido?.Tema || contenido?.tema;
    const areaId = tema?.area_id ?? null;
    const areaName = areaId ? (areaMap.get(String(areaId)) || `Area ${areaId}`) : 'Sin area';
    const titulo = ejercicio?.actividad?.titulo || ejercicio?.Actividad?.titulo || `Ejercicio ${ejercicio?.id ?? respuesta.ejercicio_id}`;
    const key = `${respuesta.estudiante_id}:${respuesta.ejercicio_id}`;
    const aprobado = approvedExercises.has(key);
    const intentos = toSafeInt(respuesta.contador);
    const fallos = computeFallos(intentos, aprobado);
    const aciertos = Math.max(intentos - fallos, 0);
    items.push({
      tipo: 'ejercicio',
      actividad_id: respuesta.ejercicio_id,
      estudiante_id: respuesta.estudiante_id,
      titulo,
      area_id: areaId,
      area_name: areaName,
      intentos,
      fallos,
      aciertos,
      aprobado
    });
  });

  respuestasMiniproyecto.forEach((respuesta) => {
    const miniproyecto = respuesta.miniproyecto;
    const areaId = miniproyecto?.area_id ?? null;
    const areaName = areaId ? (areaMap.get(String(areaId)) || `Area ${areaId}`) : 'Sin area';
    const titulo = miniproyecto?.Actividad?.titulo || miniproyecto?.actividad?.titulo || `Miniproyecto ${miniproyecto?.id ?? respuesta.miniproyecto_id}`;
    const key = `${respuesta.estudiante_id}:${respuesta.miniproyecto_id}`;
    const aprobado = approvedMinis.has(key);
    const intentos = toSafeInt(respuesta.contador);
    const fallos = computeFallos(intentos, aprobado);
    const aciertos = Math.max(intentos - fallos, 0);
    items.push({
      tipo: 'miniproyecto',
      actividad_id: respuesta.miniproyecto_id,
      estudiante_id: respuesta.estudiante_id,
      titulo,
      area_id: areaId,
      area_name: areaName,
      intentos,
      fallos,
      aciertos,
      aprobado
    });
  });

  const totals = items.reduce((acc, item) => {
    acc.intentos += item.intentos;
    acc.fallos += item.fallos;
    acc.aciertos += item.aciertos;
    return acc;
  }, { intentos: 0, fallos: 0, aciertos: 0 });

  const byType = {
    ejercicios: { intentos: 0, fallos: 0, aciertos: 0 },
    miniproyectos: { intentos: 0, fallos: 0, aciertos: 0 }
  };

  const byAreaMap = new Map();
  items.forEach((item) => {
    const tipoKey = item.tipo === 'ejercicio' ? 'ejercicios' : 'miniproyectos';
    byType[tipoKey].intentos += item.intentos;
    byType[tipoKey].fallos += item.fallos;
    byType[tipoKey].aciertos += item.aciertos;

    const areaKey = item.area_id ? String(item.area_id) : 'sin-area';
    const current = byAreaMap.get(areaKey) || {
      area_id: item.area_id,
      area_name: item.area_name,
      intentos: 0,
      fallos: 0,
      aciertos: 0,
      ejercicios: 0,
      miniproyectos: 0
    };
    current.intentos += item.intentos;
    current.fallos += item.fallos;
    current.aciertos += item.aciertos;
    if (item.tipo === 'ejercicio') current.ejercicios += 1;
    else current.miniproyectos += 1;
    byAreaMap.set(areaKey, current);
  });

  const byArea = Array.from(byAreaMap.values()).sort((a, b) => b.fallos - a.fallos);

  const estudianteIds = Array.from(new Set(items.map((item) => item.estudiante_id)));
  const estudiantes = estudianteIds.length
    ? await Estudiante.findAll({
        where: { id: { [Op.in]: estudianteIds } },
        include: [{ model: Persona, as: 'persona' }]
      })
    : [];
  const estudianteMap = new Map(
    estudiantes.map((est) => [
      String(est.id),
      {
        id: est.id,
        nombre: est.persona?.nombre || est.nombre || `Estudiante ${est.id}`,
        email: est.persona?.email || est.email || est.correo || ''
      }
    ])
  );

  const byStudentMap = new Map();
  items.forEach((item) => {
    const key = String(item.estudiante_id);
    const info = estudianteMap.get(key) || { id: item.estudiante_id, nombre: `Estudiante ${item.estudiante_id}`, email: '' };
    const current = byStudentMap.get(key) || {
      estudiante_id: info.id,
      nombre: info.nombre,
      email: info.email,
      intentos: 0,
      fallos: 0,
      aciertos: 0,
      ejercicios: 0,
      miniproyectos: 0
    };
    current.intentos += item.intentos;
    current.fallos += item.fallos;
    current.aciertos += item.aciertos;
    if (item.tipo === 'ejercicio') current.ejercicios += 1;
    else current.miniproyectos += 1;
    byStudentMap.set(key, current);
  });

  const byStudent = Array.from(byStudentMap.values()).sort((a, b) => b.fallos - a.fallos);

  return { totals, byType, byArea, byStudent, items };
};

const incrementNestedCount = (store, keyA, keyB, delta = 1) => {
  const kA = String(keyA);
  const kB = String(keyB);
  if (!store[kA]) {
    store[kA] = {};
  }
  store[kA][kB] = (store[kA][kB] || 0) + delta;
};

const applyStudentFilters = (students, { semester, dateFrom, dateTo } = {}) => {
  let filtered = [...students];
  if (semester && String(semester) !== 'all') {
    filtered = filtered.filter(student => String(student.semester ?? '') === String(semester));
  }
  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    filtered = filtered.filter(student => {
      if (!student.createdDate) return false;
      const created = new Date(student.createdDate);
      if (Number.isNaN(created.getTime())) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  }
  return filtered;
};

const getResumenGeneralData = async ({ semester, dateFrom, dateTo } = {}) => {
  const [areas, temas, subtemas, contenidos, secuencias, estudiantes, ejercicios, miniproyectos] = await Promise.all([
    Area.findAll({ attributes: ['id', 'nombre'] }),
    Tema.findAll({ attributes: ['id', 'nombre', 'area_id'] }),
    Subtema.findAll({ attributes: ['id', 'nombre', 'tema_id'] }),
    Contenido.findAll({ attributes: ['id', 'tema_id', 'subtema_id'] }),
    SecuenciaContenido.findAll({ where: { estado: true }, attributes: ['contenido_origen_id', 'contenido_destino_id'] }),
    Estudiante.findAll({
      attributes: ['id', 'createdAt', 'semestre'],
      include: [{ model: Persona, as: 'persona', attributes: ['nombre', 'email'] }]
    }),
    Ejercicio.findAll({ attributes: ['id', 'contenido_id'] }),
    Miniproyecto.findAll({ attributes: ['id', 'area_id'] })
  ]);

  const temaById = new Map(temas.map(tema => [String(tema.id), tema]));
  const subtemaById = new Map(subtemas.map(subtema => [String(subtema.id), subtema]));

  const temasByArea = {};
  temas.forEach((tema) => {
    const areaId = String(tema.area_id);
    temasByArea[areaId] = temasByArea[areaId] || [];
    temasByArea[areaId].push(tema);
  });

  const subtemasByTema = {};
  subtemas.forEach((subtema) => {
    const temaId = String(subtema.tema_id);
    subtemasByTema[temaId] = subtemasByTema[temaId] || [];
    subtemasByTema[temaId].push(subtema);
  });

  const activeContentIds = new Set();
  secuencias.forEach((seq) => {
    if (seq.contenido_origen_id) activeContentIds.add(String(seq.contenido_origen_id));
    if (seq.contenido_destino_id) activeContentIds.add(String(seq.contenido_destino_id));
  });

  const contentToArea = new Map();
  const contentToTema = new Map();
  const contentToSubtema = new Map();
  const totalContentByArea = {};
  const totalContentByTema = {};
  const totalContentBySubtema = {};

  contenidos.forEach((contenido) => {
    const contentId = String(contenido.id);
    if (activeContentIds.size && !activeContentIds.has(contentId)) return;

    const temaId = String(contenido.tema_id);
    const subtemaId = String(contenido.subtema_id);
    const tema = temaById.get(temaId);
    const areaId = tema ? String(tema.area_id) : null;
    if (!areaId) return;

    contentToArea.set(contentId, areaId);
    contentToTema.set(contentId, temaId);
    contentToSubtema.set(contentId, subtemaId);

    totalContentByArea[areaId] = (totalContentByArea[areaId] || 0) + 1;
    totalContentByTema[temaId] = (totalContentByTema[temaId] || 0) + 1;
    totalContentBySubtema[subtemaId] = (totalContentBySubtema[subtemaId] || 0) + 1;
  });

  const progresoRows = activeContentIds.size
    ? await Progreso.findAll({
        attributes: ['estudiante_id', 'contenido_id'],
        where: {
          completado: true,
          estado: 'Visualizado',
          contenido_id: { [Op.in]: Array.from(activeContentIds) }
        }
      })
    : [];

  const progressContentByArea = {};
  const progressContentByTema = {};
  const progressContentBySubtema = {};

  progresoRows.forEach((row) => {
    const studentId = String(row.estudiante_id);
    const contentId = String(row.contenido_id);
    const areaId = contentToArea.get(contentId);
    const temaId = contentToTema.get(contentId);
    const subtemaId = contentToSubtema.get(contentId);
    if (!areaId || !temaId || !subtemaId) return;
    incrementNestedCount(progressContentByArea, studentId, areaId, 1);
    incrementNestedCount(progressContentByTema, studentId, temaId, 1);
    incrementNestedCount(progressContentBySubtema, studentId, subtemaId, 1);
  });

  const exerciseToArea = new Map();
  const totalExercisesByArea = {};
  const contenidoById = new Map(contenidos.map(c => [String(c.id), c]));
  
  ejercicios.forEach((ejercicio) => {
    const contenido = contenidoById.get(String(ejercicio.contenido_id));
    if (!contenido) return;
    const subtema = subtemaById.get(String(contenido.subtema_id));
    if (!subtema) return;
    const tema = temaById.get(String(subtema.tema_id));
    if (!tema) return;
    const areaId = String(tema.area_id);
    exerciseToArea.set(String(ejercicio.id), areaId);
    totalExercisesByArea[areaId] = (totalExercisesByArea[areaId] || 0) + 1;
  });

  const respuestasEjercicio = await RespuestaEstudianteEjercicio.findAll({
    attributes: ['estudiante_id', 'ejercicio_id'],
    where: { estado: { [Op.in]: ['ENVIADO', 'APROBADO'] } }
  });

  const completedExercisesByArea = {};
  respuestasEjercicio.forEach((respuesta) => {
    const areaId = exerciseToArea.get(String(respuesta.ejercicio_id));
    if (!areaId) return;
    incrementNestedCount(completedExercisesByArea, respuesta.estudiante_id, areaId, 1);
  });

  const totalMinisByArea = {};
  const miniproyectoToArea = new Map();
  miniproyectos.forEach((mini) => {
    const areaId = String(mini.area_id);
    totalMinisByArea[areaId] = (totalMinisByArea[areaId] || 0) + 1;
    miniproyectoToArea.set(String(mini.id), areaId);
  });

  const respuestasMiniproyecto = await RespuestaEstudianteMiniproyecto.findAll({
    attributes: ['estudiante_id', 'miniproyecto_id'],
    where: { estado: { [Op.in]: ['ENVIADO', 'COMPLETADO'] } }
  });

  const completedMinisByArea = {};
  respuestasMiniproyecto.forEach((respuesta) => {
    const areaId = miniproyectoToArea.get(String(respuesta.miniproyecto_id));
    if (!areaId) return;
    incrementNestedCount(completedMinisByArea, respuesta.estudiante_id, areaId, 1);
  });

  const students = estudiantes.map((student) => {
    const studentId = String(student.id);
    const subjects = areas.map((area) => {
      const areaId = String(area.id);
      const totalContents = totalContentByArea[areaId] || 0;
      const completedContents = progressContentByArea[studentId]?.[areaId] || 0;
      const totalExercises = totalExercisesByArea[areaId] || 0;
      const completedExercises = completedExercisesByArea[studentId]?.[areaId] || 0;
      const totalMinis = totalMinisByArea[areaId] || 0;
      const completedMinis = completedMinisByArea[studentId]?.[areaId] || 0;

      let totalItems = 0;
      let completedItems = 0;
      if (totalContents > 0) {
        totalItems += totalContents;
        completedItems += completedContents;
      }
      if (totalExercises > 0) {
        totalItems += totalExercises;
        completedItems += completedExercises;
      }
      if (totalMinis > 0) {
        totalItems += totalMinis;
        completedItems += completedMinis;
      }

      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      const topics = (temasByArea[areaId] || []).map((tema) => {
        const temaId = String(tema.id);
        const totalTema = totalContentByTema[temaId] || 0;
        const completedTema = progressContentByTema[studentId]?.[temaId] || 0;
        const temaProgress = totalTema > 0 ? Math.round((completedTema / totalTema) * 100) : 0;
        const subtopics = (subtemasByTema[temaId] || []).map((subtema) => {
          const subtemaId = String(subtema.id);
          const totalSubtema = totalContentBySubtema[subtemaId] || 0;
          const completedSubtema = progressContentBySubtema[studentId]?.[subtemaId] || 0;
          const subProgress = totalSubtema > 0 ? Math.round((completedSubtema / totalSubtema) * 100) : 0;
          return {
            name: subtema.nombre || `Subtema ${subtemaId}`,
            progress: subProgress,
            hasContent: totalSubtema > 0
          };
        });

        return { name: tema.nombre || `Tema ${temaId}`, progress: temaProgress, subtopics };
      });

      return {
        areaId,
        name: area.nombre || `Área ${areaId}`,
        progress,
        contentViewed: completedContents,
        exercisesCompleted: completedExercises,
        miniprojectsSubmitted: completedMinis,
        topics
      };
    });

    return {
      id: studentId,
      name: student.persona?.nombre || student.nombre || `Estudiante ${studentId}`,
      email: student.persona?.email || student.email || student.correo || '',
      createdDate: student.createdAt ? new Date(student.createdAt).toISOString().split('T')[0] : '',
      semester: student.semestre ?? '',
      subjects
    };
  });

  const filteredStudents = applyStudentFilters(students, { semester, dateFrom, dateTo });

  return {
    students: filteredStudents,
    areas: areas.map(area => ({ id: area.id, nombre: area.nombre }))
  };
};

// Resumen general: estudiantes con progreso por área/tema/subtema en un solo llamado
exports.obtenerResumenGeneralEstudiantes = async (req, res) => {
  try {
    const data = await getResumenGeneralData({
      semester: req.query.semester,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    });
    res.json(data);
  } catch (error) {
    console.error('❌ Error en obtenerResumenGeneralEstudiantes:', error);
    res.status(500).json({ message: 'Error al obtener resumen general de estudiantes', error: error.message || error });
  }
};

exports.create = async (req, res) => {
  try {
    res.status(201).json(await Progreso.create(req.body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Obtener progreso de un estudiante por TEMA (contenidos del tema)
exports.obtenerProgresoEstudiantePorTema = async (req, res) => {
  try {
    const { tema_id, estudiante_id } = req.query;

    if (!tema_id || !estudiante_id) {
      return res.status(400).json({ message: "tema_id y estudiante_id son requeridos como parámetros de query" });
    }

    const tId = parseInt(tema_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (isNaN(tId) || isNaN(esId)) {
      return res.status(400).json({ message: "tema_id y estudiante_id deben ser números válidos" });
    }

    const tema = await Tema.findByPk(tId);
    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });

    const contenidosDelTema = await Contenido.findAll({ where: { tema_id: tId }, attributes: ['id'] });
    const contenidoIdsDelTema = contenidosDelTema.map(c => c.id);

    const secuencias = await SecuenciaContenido.findAll({
      where: {
        estado: true,
        [Op.or]: [
          { contenido_origen_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } },
          { contenido_destino_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } }
        ]
      },
      attributes: ['contenido_origen_id', 'contenido_destino_id']
    });

    const contenidoIdsEnSecuencia = new Set();
    secuencias.forEach(seq => {
      contenidoIdsEnSecuencia.add(seq.contenido_origen_id);
      contenidoIdsEnSecuencia.add(seq.contenido_destino_id);
    });

    const contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelTema.includes(id));
    const totalContenidos = contenidoIds.length;

    const contenidosVisualizados = totalContenidos > 0 ? await Progreso.count({
      where: {
        estudiante_id: esId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    }) : 0;

    const porcentaje = totalContenidos > 0 ? Math.round((contenidosVisualizados / totalContenidos) * 100) : 0;

    res.json({
      tema: { id: tema.id, nombre: tema.nombre },
      estudiante_id: esId,
      progreso: {
        contenidos: {
          total: totalContenidos,
          completados: contenidosVisualizados,
          porcentaje
        }
      },
      resumen: {
        totalItems: totalContenidos,
        itemsCompletados: contenidosVisualizados,
        porcentajeTotalTema: porcentaje,
        estado: porcentaje === 100 ? 'Completado' : porcentaje >= 50 ? 'En progreso' : 'Iniciado'
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerProgresoEstudiantePorTema:', error);
    res.status(500).json({ message: 'Error al obtener progreso del estudiante por tema', error: error.message || error });
  }
};

// Obtener progreso de un estudiante por SUBTEMA (contenidos del subtema)
exports.obtenerProgresoEstudiantePorSubtema = async (req, res) => {
  try {
    const { subtema_id, estudiante_id } = req.query;

    if (!subtema_id || !estudiante_id) {
      return res.status(400).json({ message: "subtema_id y estudiante_id son requeridos como parámetros de query" });
    }

    const sId = parseInt(subtema_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (isNaN(sId) || isNaN(esId)) {
      return res.status(400).json({ message: "subtema_id y estudiante_id deben ser números válidos" });
    }

    const subtema = await Subtema.findByPk(sId);
    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });

    const contenidosDelSubtema = await Contenido.findAll({ where: { subtema_id: sId }, attributes: ['id'] });
    const contenidoIdsDelSubtema = contenidosDelSubtema.map(c => c.id);

    const secuencias = await SecuenciaContenido.findAll({
      where: {
        estado: true,
        [Op.or]: [
          { contenido_origen_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } },
          { contenido_destino_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } }
        ]
      },
      attributes: ['contenido_origen_id', 'contenido_destino_id']
    });

    const contenidoIdsEnSecuencia = new Set();
    secuencias.forEach(seq => {
      contenidoIdsEnSecuencia.add(seq.contenido_origen_id);
      contenidoIdsEnSecuencia.add(seq.contenido_destino_id);
    });

    const contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelSubtema.includes(id));
    const totalContenidos = contenidoIds.length;

    const contenidosVisualizados = totalContenidos > 0 ? await Progreso.count({
      where: {
        estudiante_id: esId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    }) : 0;

    const porcentaje = totalContenidos > 0 ? Math.round((contenidosVisualizados / totalContenidos) * 100) : 0;

    res.json({
      subtema: { id: subtema.id, nombre: subtema.nombre },
      estudiante_id: esId,
      progreso: {
        contenidos: {
          total: totalContenidos,
          completados: contenidosVisualizados,
          porcentaje
        }
      },
      resumen: {
        totalItems: totalContenidos,
        itemsCompletados: contenidosVisualizados,
        porcentajeTotalSubtema: porcentaje,
        estado: porcentaje === 100 ? 'Completado' : porcentaje >= 50 ? 'En progreso' : 'Iniciado'
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerProgresoEstudiantePorSubtema:', error);
    res.status(500).json({ message: 'Error al obtener progreso del estudiante por subtema', error: error.message || error });
  }
};

// Resumen de unidades para un estudiante (unidad = 'tema' o 'subtema')
// Query params: unidad_tipo ('tema'|'subtema'), unidad_id, estudiante_id
exports.obtenerResumenUnidadEstudiante = async (req, res) => {
  try {
    const { unidad_tipo, unidad_id, estudiante_id } = req.query;

    if (!unidad_tipo || !unidad_id || !estudiante_id) {
      return res.status(400).json({ message: "unidad_tipo, unidad_id y estudiante_id son requeridos como query params" });
    }

    const tipo = unidad_tipo.toString().toLowerCase();
    const uId = parseInt(unidad_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (!['tema', 'subtema'].includes(tipo)) {
      return res.status(400).json({ message: "unidad_tipo debe ser 'tema' o 'subtema'" });
    }
    if (isNaN(uId) || isNaN(esId)) {
      return res.status(400).json({ message: "unidad_id y estudiante_id deben ser números válidos" });
    }

    // Determinar contenidos y ejercicios según tipo
    let contenidoIds = [];
    let ejercicioIds = [];
    let areaId = null;

    if (tipo === 'tema') {
      const tema = await Tema.findByPk(uId);
      if (!tema) return res.status(404).json({ message: 'Tema no encontrado' });
      areaId = tema.area_id;

      const contenidos = await Contenido.findAll({ where: { tema_id: uId }, attributes: ['id'] });
      const contenidoIdsDelTema = contenidos.map(c => c.id);

      // contenidos válidos en secuencia activa
      const secuencias = await SecuenciaContenido.findAll({
        where: {
          estado: true,
          [Op.or]: [
            { contenido_origen_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } },
            { contenido_destino_id: { [Op.in]: contenidoIdsDelTema.length > 0 ? contenidoIdsDelTema : [0] } }
          ]
        },
        attributes: ['contenido_origen_id', 'contenido_destino_id']
      });

      const contenidoIdsEnSecuencia = new Set();
      secuencias.forEach(s => { contenidoIdsEnSecuencia.add(s.contenido_origen_id); contenidoIdsEnSecuencia.add(s.contenido_destino_id); });
      contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelTema.includes(id));

      const subtemas = await Subtema.findAll({ where: { tema_id: uId }, attributes: ['id'] });
      const subtemaIds = subtemas.map(s => s.id);
      const contenidosDelTemaParaEjercicios = await Contenido.findAll({ where: { subtema_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] } }, attributes: ['id'] });
      const contenidoIdsParaEjercicios = contenidosDelTemaParaEjercicios.map(c => c.id);
      const ejercicios = await Ejercicio.findAll({ where: { contenido_id: { [Op.in]: contenidoIdsParaEjercicios.length > 0 ? contenidoIdsParaEjercicios : [0] } }, attributes: ['id'] });
      ejercicioIds = ejercicios.map(e => e.id);

    } else { // subtema
      const subtema = await Subtema.findByPk(uId);
      if (!subtema) return res.status(404).json({ message: 'Subtema no encontrado' });

      const tema = await Tema.findByPk(subtema.tema_id);
      areaId = tema ? tema.area_id : null;

      const contenidos = await Contenido.findAll({ where: { subtema_id: uId }, attributes: ['id'] });
      const contenidoIdsDelSubtema = contenidos.map(c => c.id);

      const secuencias = await SecuenciaContenido.findAll({
        where: {
          estado: true,
          [Op.or]: [
            { contenido_origen_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } },
            { contenido_destino_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } }
          ]
        },
        attributes: ['contenido_origen_id', 'contenido_destino_id']
      });

      const contenidoIdsEnSecuencia = new Set();
      secuencias.forEach(s => { contenidoIdsEnSecuencia.add(s.contenido_origen_id); contenidoIdsEnSecuencia.add(s.contenido_destino_id); });
      contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelSubtema.includes(id));

      const ejercicios = await Ejercicio.findAll({ where: { contenido_id: { [Op.in]: contenidoIdsDelSubtema.length > 0 ? contenidoIdsDelSubtema : [0] } }, attributes: ['id'] });
      ejercicioIds = ejercicios.map(e => e.id);
    }

    // Conteos
    const totalContenidos = contenidoIds.length;
    const contenidosCompletados = totalContenidos > 0 ? await Progreso.count({ where: { estudiante_id: esId, contenido_id: { [Op.in]: contenidoIds }, completado: true, estado: 'Visualizado' } }) : 0;

    const totalEjercicios = ejercicioIds.length;
    const ejerciciosCompletados = totalEjercicios > 0 ? await RespuestaEstudianteEjercicio.count({ where: { estudiante_id: esId, ejercicio_id: { [Op.in]: ejercicioIds }, estado: { [Op.in]: ['ENVIADO', 'APROBADO'] } } }) : 0;

    let totalMiniproyectos = 0;
    let miniproyectosCompletados = 0;
    if (areaId) {
      const respuestasMiniproyectos = await RespuestaEstudianteMiniproyecto.findAll({
        where: { estudiante_id: esId, estado: { [Op.in]: ['ENVIADO', 'COMPLETADO'] } },
        include: [{ model: Miniproyecto, as: 'miniproyecto', where: { area_id: areaId }, attributes: ['id'] }]
      });
      totalMiniproyectos = await Miniproyecto.count({ where: { area_id: areaId } });
      miniproyectosCompletados = respuestasMiniproyectos.length;
    }

    res.json({
      unidad: { tipo, id: uId },
      estudiante_id: esId,
      resumen: {
        contenidos: { total: totalContenidos, completados: contenidosCompletados, porcentaje: totalContenidos > 0 ? Math.round((contenidosCompletados/totalContenidos)*100) : 0 },
        ejercicios: { total: totalEjercicios, completados: ejerciciosCompletados, porcentaje: totalEjercicios > 0 ? Math.round((ejerciciosCompletados/totalEjercicios)*100) : 0 },
        miniproyectos: { total: totalMiniproyectos, completados: miniproyectosCompletados, porcentaje: totalMiniproyectos > 0 ? Math.round((miniproyectosCompletados/totalMiniproyectos)*100) : 0 }
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerResumenUnidadEstudiante:', error);
    res.status(500).json({ message: 'Error al obtener resumen de unidad para el estudiante', error: error.message || error });
  }
};

exports.findAll = async (req, res) => {
  res.json(await Progreso.findAll());
};

exports.findOne = async (req, res) => {
  res.json(await Progreso.findByPk(req.params.id));
};

exports.update = async (req, res) => {
  await Progreso.update(req.body, { where: { id: req.params.id } });
  res.json({ message: 'Progreso actualizado' });
};

exports.delete = async (req, res) => {
  await Progreso.destroy({ where: { id: req.params.id } });
  res.json({ message: 'Progreso eliminado' });
};

// Obtener progreso de un estudiante por área (para la barra de progreso)
exports.obtenerProgresoEstudiantePorArea = async (req, res) => {
  try {
    const { area_id, estudiante_id } = req.query;

    if (!area_id || !estudiante_id) {
      return res.status(400).json({
        message: "area_id y estudiante_id son requeridos como parámetros de query"
      });
    }

    const aId = parseInt(area_id, 10);
    const esId = parseInt(estudiante_id, 10);

    if (isNaN(aId) || isNaN(esId)) {
      return res.status(400).json({
        message: "area_id y estudiante_id deben ser números válidos"
      });
    }

    const area = await Area.findByPk(aId);
    if (!area) {
      return res.status(404).json({ message: "Área no encontrada" });
    }

    const estudiante = await Estudiante.findByPk(esId);
    if (!estudiante) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }

    // Obtener solo temas activos (estado = true) para aplicar filtro en cascada
    const temas = await Tema.findAll({
      where: { area_id: aId, estado: true },
      attributes: ['id']
    });
    const temaIds = temas.map(t => t.id);

    // ==========================================
    // 1. CONTENIDOS DEL ÁREA (filtrados por secuencia activa)
    // ==========================================
    const contenidosDelArea = await Contenido.findAll({
      where: { tema_id: { [Op.in]: temaIds } },
      attributes: ['id']
    });
    const contenidoIdsDelArea = contenidosDelArea.map(c => c.id);

    const secuencias = await SecuenciaContenido.findAll({
      where: {
        estado: true,
        [Op.or]: [
          { contenido_origen_id: { [Op.in]: contenidoIdsDelArea } },
          { contenido_destino_id: { [Op.in]: contenidoIdsDelArea } }
        ]
      },
      attributes: ['contenido_origen_id', 'contenido_destino_id']
    });

    const contenidoIdsEnSecuencia = new Set();
    secuencias.forEach(seq => {
      contenidoIdsEnSecuencia.add(seq.contenido_origen_id);
      contenidoIdsEnSecuencia.add(seq.contenido_destino_id);
    });

    const contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelArea.includes(id));
    const totalContenidos = contenidoIds.length;

    const contenidosVisualizados = await Progreso.count({
      where: {
        estudiante_id: esId,
        contenido_id: { [Op.in]: contenidoIds },
        completado: true,
        estado: 'Visualizado'
      }
    });

    console.log(`📦 Contenido IDs usados para el cálculo de progreso (en secuencia activa):`, contenidoIds);
    console.log(`👁️ Contenidos visualizados por estudiante ${esId}: ${contenidosVisualizados}`);

    // ==========================================
    // 2. EJERCICIOS DEL ÁREA (desde respuestas enviadas o aprobadas)
    // ==========================================
    const subtemas = await Subtema.findAll({
      where: { tema_id: { [Op.in]: temaIds } },
      attributes: ['id']
    });
    const subtemaIds = subtemas.map(s => s.id);

    // Obtener ejercicios del área a través de contenidos de esos subtemas
    const contenidosParaEjercicios = await Contenido.findAll({
      where: { subtema_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] } },
      attributes: ['id']
    });
    const contenidoIdsParaEjercicios = contenidosParaEjercicios.map(c => c.id);

    const ejerciciosArea = await Ejercicio.findAll({
      where: { contenido_id: { [Op.in]: contenidoIdsParaEjercicios.length > 0 ? contenidoIdsParaEjercicios : [0] } },
      attributes: ['id']
    });
    const ejercicioIds = ejerciciosArea.map(e => e.id);
    const totalEjercicios = ejercicioIds.length;

    const ejerciciosCompletados = await RespuestaEstudianteEjercicio.count({
      where: {
        estudiante_id: esId,
        ejercicio_id: { [Op.in]: ejercicioIds },
        estado: { [Op.in]: ['ENVIADO', 'APROBADO'] }
      }
    });

    const totalMiniproyectos = await Miniproyecto.count({ where: { area_id: aId } });
    const miniproyectosAprobados = await Evaluacion.count({
      where: {
        estudiante_id: esId,
        estado: 'APROBADO',
        miniproyecto_id: { [Op.ne]: null }
      },
      include: [{ model: Miniproyecto, where: { area_id: aId }, required: true }]
    });
    const miniproyectosDesaprobados = await Evaluacion.count({
      where: {
        estudiante_id: esId,
        estado: 'REPROBADO',
        miniproyecto_id: { [Op.ne]: null }
      },
      include: [{ model: Miniproyecto, where: { area_id: aId }, required: true }]
    });

    // ==========================================
    // 4. CÁLCULO DE PORCENTAJE
    // ==========================================
    let totalItems = 0;
    let itemsCompletados = 0;

    if (totalContenidos > 0) {
      totalItems += totalContenidos;
      itemsCompletados += contenidosVisualizados;
    }

    if (totalEjercicios > 0) {
      totalItems += totalEjercicios;
      itemsCompletados += ejerciciosCompletados;
    }

    let porcentajeProgreso = 0;
    if (totalItems > 0) {
      porcentajeProgreso = Math.round((itemsCompletados / totalItems) * 100);
    }

    const progresoDetallado = {};

    if (totalContenidos > 0) {
      progresoDetallado.contenidos = {
        total: totalContenidos,
        completados: contenidosVisualizados,
        porcentaje: Math.round((contenidosVisualizados / totalContenidos) * 100)
      };
    }

    if (totalEjercicios > 0) {
      progresoDetallado.ejercicios = {
        total: totalEjercicios,
        completados: ejerciciosCompletados,
        porcentaje: Math.round((ejerciciosCompletados / totalEjercicios) * 100)
      };
    }

    res.json({
      area: {
        id: area.id,
        nombre: area.nombre
      },
      estudiante_id: esId,
      progreso: progresoDetallado,
      miniproyectos: {
        total: totalMiniproyectos,
        aprobados: miniproyectosAprobados,
        desaprobados: miniproyectosDesaprobados
      },
      resumen: {
        totalItems,
        itemsCompletados,
        porcentajeTotalArea: porcentajeProgreso,
        estado: porcentajeProgreso === 100 ? 'Completado' : porcentajeProgreso >= 50 ? 'En progreso' : 'Iniciado'
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerProgresoEstudiantePorArea:', error);
    res.status(500).json({
      message: "Error al obtener progreso del estudiante por área",
      error: error.message || error
    });
  }
};

// Obtener calificación estimada general de un estudiante
// Query params: estudiante_id
exports.getCalificacionEstimada = async (req, res) => {
  try {
    const estudianteId = parseInt(req.query.estudiante_id || req.params.estudiante_id, 10);
    if (!estudianteId || isNaN(estudianteId)) {
      return res.status(400).json({ message: 'estudiante_id es requerido y debe ser un número' });
    }

    // Obtener evaluaciones del estudiante (excluir estados claramente pendientes si aplica)
    const evaluaciones = await Evaluacion.findAll({
      where: {
        estudiante_id: estudianteId,
        estado: { [Op.notIn]: ['PENDIENTE', 'BORRADOR'] }
      },
      attributes: ['calificacion', 'ejercicio_id', 'miniproyecto_id', 'fecha_evaluacion', 'estado']
    });

    if (!evaluaciones || evaluaciones.length === 0) {
      return res.json({ estudiante_id: estudianteId, promedio: null, totalEvaluaciones: 0, mensaje: 'No hay evaluaciones disponibles' });
    }

    const total = evaluaciones.length;
    const suma = evaluaciones.reduce((acc, ev) => acc + (ev.calificacion ? parseFloat(ev.calificacion) : 0), 0);
    const promedio = parseFloat((suma / total).toFixed(2));

    // Desglose por tipo
    const porTipo = {
      ejercicios: { count: 0, promedio: null },
      miniproyectos: { count: 0, promedio: null }
    };

    const evalEjercicios = evaluaciones.filter(e => e.ejercicio_id !== null);
    if (evalEjercicios.length > 0) {
      const sumaE = evalEjercicios.reduce((a, e) => a + (e.calificacion ? parseFloat(e.calificacion) : 0), 0);
      porTipo.ejercicios.count = evalEjercicios.length;
      porTipo.ejercicios.promedio = parseFloat((sumaE / evalEjercicios.length).toFixed(2));
    }

    const evalMinis = evaluaciones.filter(e => e.miniproyecto_id !== null);
    if (evalMinis.length > 0) {
      const sumaM = evalMinis.reduce((a, e) => a + (e.calificacion ? parseFloat(e.calificacion) : 0), 0);
      porTipo.miniproyectos.count = evalMinis.length;
      porTipo.miniproyectos.promedio = parseFloat((sumaM / evalMinis.length).toFixed(2));
    }

    // Última evaluación
    const ultima = evaluaciones.reduce((latest, e) => {
      const fecha = e.fecha_evaluacion ? new Date(e.fecha_evaluacion) : null;
      if (!fecha) return latest;
      return !latest || fecha > latest ? fecha : latest;
    }, null);

    res.json({
      estudiante_id: estudianteId,
      promedio,
      totalEvaluaciones: total,
      porTipo,
      ultimaEvaluacion: ultima ? ultima.toISOString() : null
    });

  } catch (error) {
    console.error('❌ Error en getCalificacionEstimada:', error);
    res.status(500).json({ message: 'Error al obtener calificación estimada', error: error.message || error });
  }
};

// Reporte JSON de fallos por actividad (ejercicio/miniproyecto)
exports.obtenerReporteFallos = async (req, res) => {
  try {
    const rawEstudianteId = req.query.estudiante_id;
    const estudianteId = rawEstudianteId && rawEstudianteId !== 'all'
      ? parseInt(rawEstudianteId, 10)
      : null;

    if (rawEstudianteId && rawEstudianteId !== 'all' && isNaN(estudianteId)) {
      return res.status(400).json({ message: 'estudiante_id debe ser numerico o "all"' });
    }

    const data = await buildFailuresReportData({ estudianteId });
    res.json({
      estudiante_id: estudianteId || 'all',
      ...data
    });
  } catch (error) {
    console.error('❌ Error en obtenerReporteFallos:', error);
    res.status(500).json({ message: 'Error al generar reporte de fallos', error: error.message || error });
  }
};

// Generar PDF con tipo de reporte: 'student' | 'date' | 'activity' | 'failures'
// Query params:
// - type: 'student'|'date'|'activity'|'failures' (required)
// - estudiante_id: required when type='student'
exports.generarPdfReporte = async (req, res) => {
  try {
    const type = (req.query.type || '').toString().toLowerCase();
    if (!['student', 'date', 'activity', 'failures'].includes(type)) {
      return res.status(400).json({ message: "type query param requerido: 'student'|'date'|'activity'|'failures'" });
    }
    const filters = {
      semester: req.query.semester,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    let reportData = {
      subtitle: `Reporte generado el ${formatDate(new Date())}`,
      stats: [],
      sections: [],
      tableHeaders: [],
      tableRows: [],
      tableTitle: '',
      tableSubtitle: ''
    };

    if (type === 'student') {
      const rawEstudianteId = req.query.estudiante_id || req.params.estudiante_id;
      const estudianteId = rawEstudianteId && rawEstudianteId !== 'all' ? parseInt(rawEstudianteId, 10) : null;

      if (estudianteId) {
        const { students, areas } = await getResumenGeneralData(filters);
        const estudiante = students.find(student => String(student.id) === String(estudianteId));
        if (!estudiante) {
          return res.status(404).json({ message: `Estudiante con id ${estudianteId} no encontrado` });
        }

        const estudianteNombre = estudiante.name || `Estudiante ${estudianteId}`;
        const estudianteEmail = estudiante.email || '-';

        const totalContents = estudiante.subjects.reduce((sum, subj) => sum + (subj.contentViewed || 0), 0);
        const totalExercises = estudiante.subjects.reduce((sum, subj) => sum + (subj.exercisesCompleted || 0), 0);
        const totalMinis = estudiante.subjects.reduce((sum, subj) => sum + (subj.miniprojectsSubmitted || 0), 0);

        const areaRows = estudiante.subjects.map((subject) => {
          const progress = Math.round(subject.progress || 0);
          return `
            <tr>
              <td>${escapeHtml(subject.name)}</td>
              <td>${subject.contentViewed || 0}</td>
              <td>${subject.exercisesCompleted || 0}</td>
              <td>${subject.miniprojectsSubmitted || 0}</td>
              <td>${progress}%</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${progress}%; background:${subject.color || '#4A90E2'}"></div>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        const areasTable = `
          <table class="report-table">
            <thead>
              <tr>
                <th>Área</th>
                <th>Contenidos vistos</th>
                <th>Ejercicios</th>
                <th>Miniproyectos</th>
                <th>Progreso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${areaRows || '<tr><td colspan="6">Sin datos</td></tr>'}
            </tbody>
          </table>
        `;

        reportData = {
          ...reportData,
          stats: [
            { label: 'Contenidos vistos', value: totalContents, sub: 'Total en la aplicación' },
            { label: 'Ejercicios completados', value: totalExercises, sub: 'Enviados/Aprobados' },
            { label: 'Miniproyectos entregados', value: totalMinis, sub: 'Enviados/Completados' }
          ],
          sections: [
            {
              title: 'Resumen del Estudiante',
              subtitle: 'Información general y métricas clave',
              body: `
                <div class="meta">
                  <div class="meta-item">Nombre<strong>${escapeHtml(estudianteNombre)}</strong></div>
                  <div class="meta-item">Correo<strong>${escapeHtml(estudianteEmail)}</strong></div>
                </div>
              `
            },
            {
              title: 'Desempeño por Área',
              subtitle: 'Contenidos vistos, actividades y progreso',
              body: areasTable
            }
          ]
        };
      } else {
        const { students, areas } = await getResumenGeneralData(filters);
        const totalStudents = students.length;

        const studentSummaries = students.map((student) => {
          const avg = student.subjects.length
            ? student.subjects.reduce((acc, subj) => acc + (subj.progress || 0), 0) / student.subjects.length
            : 0;
          const status = avg >= 70 ? 'Al día' : avg >= 50 ? 'Regular' : 'Rezagado';
          return { ...student, avg, status };
        });

        const avgProgress = totalStudents
          ? studentSummaries.reduce((sum, s) => sum + s.avg, 0) / totalStudents
          : 0;

        const statusCounts = studentSummaries.reduce((acc, s) => {
          if (s.status === 'Al día') acc.ok += 1;
          else if (s.status === 'Regular') acc.warn += 1;
          else acc.bad += 1;
          return acc;
        }, { ok: 0, warn: 0, bad: 0 });

        const areaLabels = areas.map(area => area.nombre || `Área ${area.id}`);
        const areaValues = areas.map(area => {
          const areaId = String(area.id);
          const values = studentSummaries.map((student) => {
            const subject = student.subjects.find(subj => String(subj.areaId ?? '') === areaId || subj.name === (area.nombre || `Área ${areaId}`));
            return subject ? (subject.progress || 0) : 0;
          });
          return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
        });

        const tableRows = studentSummaries.map((student) => {
          const statusClass = student.status === 'Al día'
            ? 'status-ok'
            : student.status === 'Regular'
              ? 'status-warn'
              : 'status-bad';
          const progress = Math.round(student.avg);
          return `
            <tr>
              <td>${escapeHtml(student.name)}</td>
              <td>${escapeHtml(student.email || '-')}</td>
              <td>${progress}%</td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${progress}%"></div>
                </div>
              </td>
              <td><span class="status-pill ${statusClass}">${escapeHtml(student.status)}</span></td>
            </tr>
          `;
        }).join('');

        const tableHtml = `
          <table class="report-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Correo</th>
                <th>Promedio</th>
                <th>Progreso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="5">Sin datos</td></tr>'}
            </tbody>
          </table>
        `;

        reportData = {
          ...reportData,
          stats: [
            { label: 'Total estudiantes', value: totalStudents, sub: 'Filtrados' },
            { label: 'Promedio general', value: avgProgress.toFixed(1), sub: 'En todas las áreas' },
            { label: 'Al día', value: statusCounts.ok, sub: '≥ 70% de progreso' }
          ],
          sections: [
            {
              title: 'Resumen por Estudiante',
              subtitle: 'Progreso general y estado actual',
              body: tableHtml
            }
          ],
          charts: [
            {
              id: 'areaAvgChart',
              type: 'bar',
              title: 'Progreso Promedio por Área',
              labels: areaLabels,
              data: areaValues,
              color: '#4A90E2',
              showLegend: false
            },
            {
              id: 'statusDistChart',
              type: 'pie',
              title: 'Distribución de Estudiantes',
              labels: ['Al día', 'Regular', 'Rezagado'],
              data: [statusCounts.ok, statusCounts.warn, statusCounts.bad],
              colors: ['#7ED6A7', '#FBBF24', '#F5A97F'],
              showLegend: true,
              legendPosition: 'bottom'
            }
          ]
        };
      }

    } else if (type === 'date') {
      const { students } = await getResumenGeneralData(filters);
      const groups = {};
      students.forEach((student) => {
        const date = student.createdDate || 'unknown';
        groups[date] = groups[date] || [];
        groups[date].push(student);
      });

      const tableRows = [];
      let totalEstudiantes = 0;
      let totalPromedios = 0;
      const cohortLabels = [];
      const cohortAvgs = [];
      const cohortStudents = [];

      for (const date of Object.keys(groups).sort()) {
        const list = groups[date];
        const sumAvg = list.reduce((sum, s) => {
          const avg = s.subjects.length
            ? s.subjects.reduce((acc, subj) => acc + (subj.progress || 0), 0) / s.subjects.length
            : 0;
          return sum + avg;
        }, 0);
        const avgCohorte = list.length ? (sumAvg / list.length) : 0;
        totalEstudiantes += list.length;
        totalPromedios += avgCohorte;
        tableRows.push([date, list.length, avgCohorte.toFixed(1)]);
        cohortLabels.push(date);
        cohortAvgs.push(parseFloat(avgCohorte.toFixed(1)));
        cohortStudents.push(list.length);
      }

      reportData = {
        ...reportData,
        stats: [
          { label: 'Cohortes analizadas', value: Object.keys(groups).length, sub: 'Fechas de creación' },
          { label: 'Total de estudiantes', value: totalEstudiantes, sub: 'Todas las cohortes' },
          { label: 'Promedio general', value: Object.keys(groups).length ? (totalPromedios / Object.keys(groups).length).toFixed(1) : '0', sub: 'Promedio simple' }
        ],
        tableTitle: 'Comparativo por Cohorte',
        tableSubtitle: 'Promedio simple según progreso por áreas',
        tableHeaders: ['Fecha', 'Estudiantes', 'Promedio'],
        tableRows,
        charts: [
          {
            id: 'cohortAvgChart',
            type: 'bar',
            title: 'Progreso Promedio por Cohorte',
            labels: cohortLabels,
            data: cohortAvgs,
            color: '#7ED6A7',
            showLegend: false
          },
          {
            id: 'cohortDistChart',
            type: 'pie',
            title: 'Distribución de Estudiantes',
            labels: cohortLabels,
            data: cohortStudents,
            showLegend: true,
            legendPosition: 'bottom'
          }
        ]
      };

    } else if (type === 'activity') {
      const { students, areas } = await getResumenGeneralData(filters);
      const studentIds = students.map(student => student.id);

      const totalContenidos = studentIds.length
        ? await Progreso.count({ where: { estudiante_id: { [Op.in]: studentIds }, completado: true, estado: 'Visualizado' } })
        : 0;
      const totalEjercicios = studentIds.length
        ? await RespuestaEstudianteEjercicio.count({ where: { estudiante_id: { [Op.in]: studentIds }, estado: { [Op.in]: ['ENVIADO', 'APROBADO'] } } })
        : 0;
      const totalMinis = studentIds.length
        ? await RespuestaEstudianteMiniproyecto.count({ where: { estudiante_id: { [Op.in]: studentIds }, estado: { [Op.in]: ['ENVIADO', 'COMPLETADO'] } } })
        : 0;

      const areaRows = areas.map((area) => {
        const areaName = area.nombre || `Área ${area.id}`;
        const subjectValues = students.map(student => {
          const subject = student.subjects.find(subj => String(subj.areaId ?? '') === String(area.id) || subj.name === areaName);
          return subject || null;
        }).filter(Boolean);

        const totalContent = subjectValues.reduce((sum, subj) => sum + (subj.contentViewed || 0), 0);
        const totalExercise = subjectValues.reduce((sum, subj) => sum + (subj.exercisesCompleted || 0), 0);
        const totalMini = subjectValues.reduce((sum, subj) => sum + (subj.miniprojectsSubmitted || 0), 0);
        const avgProgress = subjectValues.length
          ? subjectValues.reduce((sum, subj) => sum + (subj.progress || 0), 0) / subjectValues.length
          : 0;

        return {
          areaName,
          totalContent,
          totalExercise,
          totalMini,
          avgProgress: Math.round(avgProgress)
        };
      });

      const activitySections = areas.map((area) => {
        const areaName = area.nombre || `Área ${area.id}`;
        const areaRow = areaRows.find(row => row.areaName === areaName);
        const studentsWithSubject = students.map((student) => {
          const subject = student.subjects.find(subj => String(subj.areaId ?? '') === String(area.id) || subj.name === areaName);
          if (!subject) return null;
          const estimatedGrade = ((subject.progress || 0) / 100) * 5;
          return {
            name: student.name,
            contentViewed: subject.contentViewed || 0,
            exercisesCompleted: subject.exercisesCompleted || 0,
            miniprojectsSubmitted: subject.miniprojectsSubmitted || 0,
            progress: Math.round(subject.progress || 0),
            grade: estimatedGrade.toFixed(1)
          };
        }).filter(Boolean);

        const studentRows = studentsWithSubject.map((row) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.contentViewed}</td>
            <td>${row.exercisesCompleted}</td>
            <td>${row.miniprojectsSubmitted}</td>
            <td>${row.progress}%</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${row.progress}%"></div>
              </div>
            </td>
            <td><span class="grade-pill">${row.grade}/5.0</span></td>
          </tr>
        `).join('');

        const statsHtml = areaRow
          ? `
            <div class="stat-grid">
              <div class="stat-card">
                <div class="label">Progreso promedio</div>
                <div class="value">${areaRow.avgProgress}%</div>
                <div class="sub">En el área</div>
              </div>
              <div class="stat-card">
                <div class="label">Contenidos visualizados</div>
                <div class="value">${areaRow.totalContent}</div>
                <div class="sub">Total agregado</div>
              </div>
              <div class="stat-card">
                <div class="label">Ejercicios completados</div>
                <div class="value">${areaRow.totalExercise}</div>
                <div class="sub">Total agregado</div>
              </div>
            </div>
          `
          : '';

        const tableHtml = `
          ${statsHtml}
          <table class="report-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Contenidos</th>
                <th>Ejercicios</th>
                <th>Miniproyectos</th>
                <th>Progreso</th>
                <th></th>
                <th>Calificación Est.</th>
              </tr>
            </thead>
            <tbody>
              ${studentRows || '<tr><td colspan="7">Sin datos</td></tr>'}
            </tbody>
          </table>
        `;

        return {
          title: `Desempeño Detallado: ${areaName}`,
          subtitle: 'Análisis de completitud y calificaciones',
          body: tableHtml
        };
      });

      const areaLabels = areaRows.map(row => row.areaName);
      const areaValues = areaRows.map(row => row.avgProgress);

      reportData = {
        ...reportData,
        stats: [
          { label: 'Contenidos visualizados', value: totalContenidos, sub: 'Total sistema' },
          { label: 'Ejercicios completados', value: totalEjercicios, sub: 'Enviados o aprobados' },
          { label: 'Miniproyectos entregados', value: totalMinis, sub: 'Enviados o completados' }
        ],
        sections: [
          {
            title: 'Notas del Informe',
            subtitle: 'Contexto de los datos',
            body: `
              <div class="meta">
                <div class="meta-item">Nota<strong>Los valores reflejan el agregado de estudiantes filtrados.</strong></div>
                <div class="meta-item">Fuente<strong>Registros de contenidos, ejercicios y miniproyectos.</strong></div>
              </div>
            `
          },
          ...activitySections
        ],
        charts: [
          {
            id: 'activityDistChart',
            type: 'pie',
            title: 'Distribución de Actividades',
            labels: ['Contenidos Visualizados', 'Ejercicios Completados', 'Miniproyectos Entregados'],
            data: [totalContenidos, totalEjercicios, totalMinis],
            colors: ['#4A90E2', '#7ED6A7', '#F5A97F'],
            showLegend: true,
            legendPosition: 'bottom'
          },
          {
            id: 'areaProgressChart',
            type: 'bar',
            title: 'Progreso Promedio por Área',
            labels: areaLabels,
            data: areaValues,
            color: '#4A90E2',
            showLegend: false
          }
        ]
      };
    } else if (type === 'failures') {
      const rawEstudianteId = req.query.estudiante_id || req.params.estudiante_id;
      const estudianteId = rawEstudianteId && rawEstudianteId !== 'all'
        ? parseInt(rawEstudianteId, 10)
        : null;
      if (rawEstudianteId && rawEstudianteId !== 'all' && isNaN(estudianteId)) {
        return res.status(400).json({ message: 'estudiante_id debe ser numerico o "all"' });
      }

      const failuresData = await buildFailuresReportData({ estudianteId });
      const totalIntentos = failuresData.totals.intentos;
      const totalFallos = failuresData.totals.fallos;
      const totalAciertos = failuresData.totals.aciertos;
      const tasaFallos = totalIntentos > 0 ? Math.round((totalFallos / totalIntentos) * 100) : 0;
      const tasaAciertos = totalIntentos > 0 ? Math.round((totalAciertos / totalIntentos) * 100) : 0;

      const itemsOrdenados = [...failuresData.items].sort((a, b) => {
        if (b.fallos !== a.fallos) return b.fallos - a.fallos;
        return b.intentos - a.intentos;
      });
      const itemsListados = estudianteId ? itemsOrdenados : itemsOrdenados.slice(0, 20);

      const activityRows = itemsListados.map((item) => `
        <tr>
          <td>${escapeHtml(item.tipo)}</td>
          <td>${escapeHtml(item.titulo)}</td>
          <td>${escapeHtml(item.area_name || '-')}</td>
          <td>${item.intentos}</td>
          <td>${item.aciertos}</td>
          <td>${item.fallos}</td>
          <td>${item.aprobado ? 'Si' : 'No'}</td>
        </tr>
      `).join('');

      const activityTable = `
        <table class="report-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Actividad</th>
              <th>Área</th>
              <th>Intentos</th>
              <th>Aciertos</th>
              <th>Fallos</th>
              <th>Aprobado</th>
            </tr>
          </thead>
          <tbody>
            ${activityRows || '<tr><td colspan="7">Sin datos</td></tr>'}
          </tbody>
        </table>
      `;

      const areaRows = failuresData.byArea.map((area) => `
        <tr>
          <td>${escapeHtml(area.area_name || 'Sin area')}</td>
          <td>${area.intentos}</td>
          <td>${area.aciertos}</td>
          <td>${area.fallos}</td>
          <td>${area.ejercicios}</td>
          <td>${area.miniproyectos}</td>
        </tr>
      `).join('');

      const areaTable = `
        <table class="report-table">
          <thead>
            <tr>
              <th>Área</th>
              <th>Intentos</th>
              <th>Aciertos</th>
              <th>Fallos</th>
              <th>Ejercicios</th>
              <th>Miniproyectos</th>
            </tr>
          </thead>
          <tbody>
            ${areaRows || '<tr><td colspan="6">Sin datos</td></tr>'}
          </tbody>
        </table>
      `;

      const studentsListados = estudianteId ? failuresData.byStudent : failuresData.byStudent.slice(0, 20);
      const studentRows = studentsListados.map((student) => `
        <tr>
          <td>${escapeHtml(student.nombre || `Estudiante ${student.estudiante_id}`)}</td>
          <td>${escapeHtml(student.email || '-')}</td>
          <td>${student.intentos}</td>
          <td>${student.aciertos}</td>
          <td>${student.fallos}</td>
          <td>${student.ejercicios}</td>
          <td>${student.miniproyectos}</td>
        </tr>
      `).join('');

      const studentTable = `
        <table class="report-table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Correo</th>
              <th>Intentos</th>
              <th>Aciertos</th>
              <th>Fallos</th>
              <th>Ejercicios</th>
              <th>Miniproyectos</th>
            </tr>
          </thead>
          <tbody>
            ${studentRows || '<tr><td colspan="7">Sin datos</td></tr>'}
          </tbody>
        </table>
      `;

      const areaLabels = failuresData.byArea.map((area) => area.area_name || 'Sin area');
      const areaFallos = failuresData.byArea.map((area) => area.fallos);
      const fallosEjercicios = failuresData.byType.ejercicios.fallos;
      const fallosMinis = failuresData.byType.miniproyectos.fallos;

      reportData = {
        ...reportData,
        stats: [
          { label: 'Intentos totales', value: totalIntentos, sub: estudianteId ? 'Del estudiante' : 'Agregado' },
          { label: 'Aciertos totales', value: totalAciertos, sub: 'Intentos aprobados' },
          { label: 'Fallos totales', value: totalFallos, sub: 'Intentos no aprobados' },
          { label: 'Tasa de acierto', value: `${tasaAciertos}%`, sub: 'Aciertos/Intentos' }
        ],
        sections: [
          {
            title: 'Resumen por Área',
            subtitle: 'Intentos y fallos acumulados',
            body: areaTable
          },
          {
            title: 'Fallos por Estudiante',
            subtitle: estudianteId ? 'Resumen del estudiante' : 'Top estudiantes con mas fallos',
            body: studentTable
          },
          {
            title: estudianteId ? 'Detalle por Actividad' : 'Top actividades con más fallos',
            subtitle: estudianteId ? 'Ejercicios y miniproyectos del estudiante' : 'Top 20 por fallos',
            body: activityTable
          }
        ],
        charts: [
          {
            id: 'failuresAreaChart',
            type: 'bar',
            title: 'Fallos por Área',
            labels: areaLabels,
            data: areaFallos,
            color: '#F5A97F',
            showLegend: false
          },
          {
            id: 'hitsVsFailsChart',
            type: 'pie',
            title: 'Aciertos vs Fallos',
            labels: ['Aciertos', 'Fallos'],
            data: [totalAciertos, totalFallos],
            colors: ['#7ED6A7', '#F5A97F'],
            showLegend: true,
            legendPosition: 'bottom'
          },
          {
            id: 'failuresTypeChart',
            type: 'pie',
            title: 'Distribución de Fallos por Tipo',
            labels: ['Ejercicios', 'Miniproyectos'],
            data: [fallosEjercicios, fallosMinis],
            colors: ['#4A90E2', '#7ED6A7'],
            showLegend: true,
            legendPosition: 'bottom'
          }
        ]
      };
    }

    const html = buildReportHtml({ type, data: reportData });

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__chartsReady === true', { timeout: 5000 }).catch(() => {});
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${type}.pdf"`);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('❌ Error en generarPdfReporte:', error);
    res.status(500).json({ message: 'Error al generar PDF', error: error.message || error });
  }
};

// ==================== NUEVOS ENDPOINTS DE DESBLOQUEO ====================

/**
 * Verifica si un contenido está desbloqueado para un estudiante
 * GET /api/progreso/verificar-contenido-desbloqueado?estudiante_id=X&contenido_id=Y
 */
exports.verificarContenidoDesbloqueado = async (req, res) => {
  try {
    const { estudiante_id, contenido_id } = req.query;

    if (!estudiante_id || !contenido_id) {
      return res.status(400).json({ 
        message: "estudiante_id y contenido_id son requeridos como parámetros de query" 
      });
    }

    const estudianteId = parseInt(estudiante_id, 10);
    const contenidoId = parseInt(contenido_id, 10);

    if (isNaN(estudianteId) || isNaN(contenidoId)) {
      return res.status(400).json({ 
        message: "estudiante_id y contenido_id deben ser números válidos" 
      });
    }

    const resultado = await desbloqueoService.verificarContenidoDesbloqueado(estudianteId, contenidoId);
    res.json(resultado);

  } catch (error) {
    console.error('❌ Error en verificarContenidoDesbloqueado:', error);
    res.status(500).json({ 
      message: 'Error al verificar contenido desbloqueado', 
      error: error.message || error 
    });
  }
};

/**
 * Verifica si un subtema está completo para un estudiante
 * GET /api/progreso/verificar-subtema-completo?estudiante_id=X&subtema_id=Y
 */
exports.verificarSubtemaCompleto = async (req, res) => {
  try {
    const { estudiante_id, subtema_id } = req.query;

    if (!estudiante_id || !subtema_id) {
      return res.status(400).json({ 
        message: "estudiante_id y subtema_id son requeridos como parámetros de query" 
      });
    }

    const estudianteId = parseInt(estudiante_id, 10);
    const subtemaId = parseInt(subtema_id, 10);

    if (isNaN(estudianteId) || isNaN(subtemaId)) {
      return res.status(400).json({ 
        message: "estudiante_id y subtema_id deben ser números válidos" 
      });
    }

    const resultado = await desbloqueoService.verificarSubtemaCompleto(estudianteId, subtemaId);
    res.json(resultado);

  } catch (error) {
    console.error('❌ Error en verificarSubtemaCompleto:', error);
    res.status(500).json({ 
      message: 'Error al verificar subtema completo', 
      error: error.message || error 
    });
  }
};

/**
 * Verifica si un tema está completo para un estudiante
 * GET /api/progreso/verificar-tema-completo?estudiante_id=X&tema_id=Y
 */
exports.verificarTemaCompleto = async (req, res) => {
  try {
    const { estudiante_id, tema_id } = req.query;

    if (!estudiante_id || !tema_id) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id son requeridos como parámetros de query" 
      });
    }

    const estudianteId = parseInt(estudiante_id, 10);
    const temaId = parseInt(tema_id, 10);

    if (isNaN(estudianteId) || isNaN(temaId)) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id deben ser números válidos" 
      });
    }

    const resultado = await desbloqueoService.verificarTemaCompleto(estudianteId, temaId);
    res.json(resultado);

  } catch (error) {
    console.error('❌ Error en verificarTemaCompleto:', error);
    res.status(500).json({ 
      message: 'Error al verificar tema completo', 
      error: error.message || error 
    });
  }
};

/**
 * Obtiene el estado de todos los contenidos de un tema para un estudiante
 * GET /api/progreso/estado-contenidos-tema?estudiante_id=X&tema_id=Y
 */
exports.obtenerEstadoContenidosTema = async (req, res) => {
  try {
    const { estudiante_id, tema_id } = req.query;

    if (!estudiante_id || !tema_id) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id son requeridos como parámetros de query" 
      });
    }

    const estudianteId = parseInt(estudiante_id, 10);
    const temaId = parseInt(tema_id, 10);

    if (isNaN(estudianteId) || isNaN(temaId)) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id deben ser números válidos" 
      });
    }

    const resultado = await desbloqueoService.obtenerEstadoContenidosTema(estudianteId, temaId);
    res.json({
      estudiante_id: estudianteId,
      tema_id: temaId,
      contenidos: resultado
    });

  } catch (error) {
    console.error('❌ Error en obtenerEstadoContenidosTema:', error);
    res.status(500).json({ 
      message: 'Error al obtener estado de contenidos del tema', 
      error: error.message || error 
    });
  }
};

/**
 * Obtiene el estado de todos los subtemas de un tema para un estudiante
 * GET /api/progreso/estado-subtemas-tema?estudiante_id=X&tema_id=Y
 */
exports.obtenerEstadoSubtemasTema = async (req, res) => {
  try {
    const { estudiante_id, tema_id } = req.query;

    if (!estudiante_id || !tema_id) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id son requeridos como parámetros de query" 
      });
    }

    const estudianteId = parseInt(estudiante_id, 10);
    const temaId = parseInt(tema_id, 10);

    if (isNaN(estudianteId) || isNaN(temaId)) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id deben ser números válidos" 
      });
    }

    const resultado = await desbloqueoService.obtenerEstadoSubtemasTema(estudianteId, temaId);
    res.json({
      estudiante_id: estudianteId,
      tema_id: temaId,
      subtemas: resultado
    });

  } catch (error) {
    console.error('❌ Error en obtenerEstadoSubtemasTema:', error);
    res.status(500).json({ 
      message: 'Error al obtener estado de subtemas del tema', 
      error: error.message || error 
    });
  }
};

/**
 * Obtiene el estado de todos los temas de un área para un estudiante
 * GET /api/progreso/estado-temas-area?estudiante_id=X&area_id=Y
 */
exports.obtenerEstadoTemasArea = async (req, res) => {
  try {
    const { estudiante_id, area_id } = req.query;

    if (!estudiante_id || !area_id) {
      return res.status(400).json({ 
        message: "estudiante_id y area_id son requeridos como parámetros de query" 
      });
    }

    const estudianteId = parseInt(estudiante_id, 10);
    const areaId = parseInt(area_id, 10);

    if (isNaN(estudianteId) || isNaN(areaId)) {
      return res.status(400).json({ 
        message: "estudiante_id y area_id deben ser números válidos" 
      });
    }

    const resultado = await desbloqueoService.obtenerEstadoTemasArea(estudianteId, areaId);
    res.json({
      estudiante_id: estudianteId,
      area_id: areaId,
      temas: resultado
    });

  } catch (error) {
    console.error('❌ Error en obtenerEstadoTemasArea:', error);
    res.status(500).json({ 
      message: 'Error al obtener estado de temas del área', 
      error: error.message || error 
    });
  }
};

/**
 * Obtiene el siguiente contenido disponible para un estudiante en un tema
 * GET /api/progreso/siguiente-contenido?estudiante_id=X&tema_id=Y
 */
exports.obtenerSiguienteContenido = async (req, res) => {
  try {
    const { estudiante_id, tema_id } = req.query;

    if (!estudiante_id || !tema_id) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id son requeridos como parámetros de query" 
      });
    }

    const estudianteId = parseInt(estudiante_id, 10);
    const temaId = parseInt(tema_id, 10);

    if (isNaN(estudianteId) || isNaN(temaId)) {
      return res.status(400).json({ 
        message: "estudiante_id y tema_id deben ser números válidos" 
      });
    }

    const resultado = await desbloqueoService.obtenerSiguienteContenido(estudianteId, temaId);
    
    if (!resultado) {
      return res.json({
        estudiante_id: estudianteId,
        tema_id: temaId,
        siguiente_contenido: null,
        mensaje: 'No hay contenidos disponibles o todos están completados'
      });
    }

    res.json({
      estudiante_id: estudianteId,
      tema_id: temaId,
      siguiente_contenido: resultado
    });

  } catch (error) {
    console.error('❌ Error en obtenerSiguienteContenido:', error);
    res.status(500).json({ 
      message: 'Error al obtener siguiente contenido', 
      error: error.message || error 
    });
  }
};
