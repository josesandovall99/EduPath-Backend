const { Asignatura: AsignaturaModel, Estudiante, Tema, Subtema, Contenido, Ejercicio, Evaluacion, Miniproyecto, Progreso, RespuestaEstudianteMiniproyecto, RespuestaEstudianteEjercicio, SecuenciaContenido, Persona, Actividad } = require('../models');

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



const formatPercentValue = (value) => {

  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) return '0';

  const rounded = Math.round(numeric * 10) / 10;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);

};



const getStudentProgressStatus = (average) => {

  if (average >= 70) return 'Al día';

  if (average >= 50) return 'Regular';

  return 'Atrasado';

};



const getStudentAverageProgress = (student) => {

  if (!student?.subjects?.length) return 0;

  return student.subjects.reduce((acc, subj) => acc + (subj.progress || 0), 0) / student.subjects.length;

};



const buildStudentDetailedProgressHtml = (student) => {

  const average = getStudentAverageProgress(student);

  const status = getStudentProgressStatus(average);

  const statusClass = status === 'Al día'

    ? 'status-ok'

    : status === 'Regular'

      ? 'status-warn'

      : 'status-bad';



  const subjectCards = (student.subjects || []).map((subject) => {

    const subjectColor = subject.color || '#4A90E2';

    const topicsHtml = (subject.topics || []).map((topic) => {

      const subtopicsHtml = (topic.subtopics || []).map((subtopic) => `

        <div class="subtopic-row">

          <div class="subtopic-name">

            ${escapeHtml(subtopic.name)}

            ${subtopic.hasContent === false ? '<span class="subtopic-empty">Sin contenido</span>' : ''}

          </div>

          <div class="subtopic-progress-wrap">

            <div class="progress-bar compact-progress">

              <div class="progress-fill" style="width:${Math.max(0, Math.min(100, subtopic.progress || 0))}%; background:${escapeHtml(subjectColor)}"></div>

            </div>

            <span class="subtopic-progress-value">${formatPercentValue(subtopic.progress)}%</span>

          </div>

        </div>

      `).join('');



      return `

        <div class="topic-block">

          <div class="topic-header">

            <span class="topic-name">${escapeHtml(topic.name)}</span>

            <span class="topic-progress">${formatPercentValue(topic.progress)}%</span>

          </div>

          <div class="progress-bar compact-progress topic-progress-bar">

            <div class="progress-fill" style="width:${Math.max(0, Math.min(100, topic.progress || 0))}%; background:${escapeHtml(subjectColor)}"></div>

          </div>

          <div class="subtopic-list">

            ${subtopicsHtml || '<div class="subtopic-empty-row">Sin subtemas registrados</div>'}

          </div>

        </div>

      `;

    }).join('');



    return `

      <div class="subject-card-detail">

        <div class="subject-card-header">

          <div>

            <div class="subject-title-row">

              <span class="subject-color-dot" style="background:${escapeHtml(subjectColor)}"></span>

              <span class="subject-name">${escapeHtml(subject.name)}</span>

            </div>

            <div class="subject-activity-row">

              <span class="activity-chip">C ${subject.contentViewed || 0}</span>

              <span class="activity-chip">E ${subject.exercisesCompleted || 0}</span>

              <span class="activity-chip">M ${subject.miniprojectsSubmitted || 0}</span>

            </div>

          </div>

          <div class="subject-progress-badge">${formatPercentValue(subject.progress)}%</div>

        </div>

        <div class="progress-bar subject-progress-bar-detail">

          <div class="progress-fill" style="width:${Math.max(0, Math.min(100, subject.progress || 0))}%; background:${escapeHtml(subjectColor)}"></div>

        </div>

        <div class="topic-list">

          ${topicsHtml || '<div class="subtopic-empty-row">Sin temas registrados</div>'}

        </div>

      </div>

    `;

  }).join('');



  return `

    <div class="student-detail-block">

      <div class="student-detail-header">

        <div>

          <div class="student-detail-name">${escapeHtml(student.name || 'Estudiante')}</div>

          <div class="student-detail-meta">${escapeHtml(student.email || '-')} | Semestre ${escapeHtml(student.semester || '-')}</div>

        </div>

        <div class="student-detail-summary">

          <div class="student-detail-average">${formatPercentValue(average)}%</div>

          <span class="status-pill ${statusClass}">${escapeHtml(status)}</span>

        </div>

      </div>

      <div class="subject-card-grid">

        ${subjectCards || '<div class="subtopic-empty-row">Sin asignaturas registradas</div>'}

      </div>

    </div>

  `;

};



const buildStudentAsignaturaProgressSummaryHtml = (student) => {

  const rows = (student.subjects || []).map((subject) => {

    const color = subject.color || '#4A90E2';

    const progress = Math.max(0, Math.min(100, subject.progress || 0));

    return `

      <div class="inline-Asignatura-row">

        <span class="inline-Asignatura-name">${escapeHtml(subject.name)}</span>

        <div class="progress-bar inline-Asignatura-progress">

          <div class="progress-fill" style="width:${progress}%; background:${escapeHtml(color)}"></div>

        </div>

        <span class="inline-Asignatura-value">${formatPercentValue(progress)}%</span>

      </div>

    `;

  }).join('');



  return `<div class="inline-Asignatura-list">${rows || '<div class="subtopic-empty-row">Sin asignaturas registradas</div>'}</div>`;

};



const buildCohortDetailedHtml = (cohorts = []) => {

  return cohorts.map((cohort) => {

    const studentRows = (cohort.students || []).map((student) => {

      const average = getStudentAverageProgress(student);

      const status = getStudentProgressStatus(average);

      const statusClass = status === 'Al día'

        ? 'status-ok'

        : status === 'Regular'

          ? 'status-warn'

          : 'status-bad';



      return `

        <tr>

          <td>${escapeHtml(student.name || 'Estudiante')}</td>

          <td>${buildStudentAsignaturaProgressSummaryHtml(student)}</td>

          <td>${formatPercentValue(average)}%</td>

          <td><span class="status-pill ${statusClass}">${escapeHtml(status)}</span></td>

        </tr>

      `;

    }).join('');



    return `

      <div class="cohort-block">

        <div class="cohort-header">

          <div>

            <div class="cohort-title">Cohorte: ${escapeHtml(cohort.cohortLabel || cohort.date || 'Sin fecha')}</div>

            <div class="cohort-sub">${cohort.studentCount || 0} estudiantes</div>

          </div>

          <div class="cohort-metric">

            <div class="cohort-metric-value">${formatPercentValue(cohort.avgProgress || 0)}%</div>

            <div class="cohort-metric-sub">Promedio de avance</div>

          </div>

        </div>

        <table class="report-table report-table-cohort">

          <thead>

            <tr>

              <th>Estudiante</th>

              <th>Asignaturas</th>

              <th>Promedio</th>

              <th>Estado</th>

            </tr>

          </thead>

          <tbody>

            ${studentRows || '<tr><td colspan="4">Sin datos</td></tr>'}

          </tbody>

        </table>

      </div>

    `;

  }).join('');

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

          <div class="chart-card ${chart.span === 2 ? 'chart-card--wide' : ''}" style="--chart-height:${escapeHtml(chart.height || 180)}px">

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

        const truncateLabel = (value, maxLength = 18) => {

          const label = String(value ?? '');

          if (label.length <= maxLength) return label;

          return label.slice(0, Math.max(maxLength - 3, 1)) + '...';

        };

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

              maintainAspectRatio: false,

              animation: false,

              layout: {

                padding: { top: 6, right: 8, bottom: 0, left: 8 }

              },

              indexAxis: chart.orientation === 'horizontal' ? 'y' : 'x',

              plugins: {

                legend: {

                  display: chart.showLegend !== false,

                  position: chart.legendPosition || 'bottom',

                  labels: {

                    usePointStyle: true,

                    boxWidth: 10,

                    padding: 12,

                    font: {

                      size: 11

                    }

                  }

                }

              },

              scales: chart.type === 'bar'

                ? (chart.orientation === 'horizontal'

                    ? {

                        x: {

                          beginAtZero: true,

                          max: chart.percentScale ? 100 : undefined,

                          ticks: {

                            precision: 0,

                            callback: (value) => chart.percentScale ? String(value) + '%' : value,

                            font: { size: 10 }

                          },

                          grid: {

                            color: '#E5E7EB'

                          }

                        },

                        y: {

                          ticks: {

                            autoSkip: false,

                            callback: (value) => truncateLabel(chart.labels?.[value] ?? value, chart.labelMaxLength || 24),

                            font: { size: 10 }

                          },

                          grid: {

                            display: false

                          }

                        }

                      }

                    : {

                        y: {

                          beginAtZero: true,

                          max: chart.percentScale ? 100 : undefined,

                          ticks: {

                            precision: 0,

                            callback: (value) => chart.percentScale ? String(value) + '%' : value,

                            font: { size: 10 }

                          },

                          grid: {

                            color: '#E5E7EB'

                          }

                        },

                        x: {

                          ticks: {

                            maxRotation: 0,

                            autoSkip: true,

                            callback: (value, labelIndex) => truncateLabel(chart.labels?.[labelIndex] ?? value, chart.labelMaxLength || 14),

                            font: { size: 10 }

                          },

                          grid: {

                            display: false

                          }

                        }

                      })

                : undefined

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

        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));

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

        page-break-inside: avoid;

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

        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));

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

        align-items: start;

      }

      .chart-card {

        background: #fff;

        border-radius: 18px;

        padding: 14px 16px 16px;

        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);

        page-break-inside: avoid;

      }

      .chart-card--wide {

        grid-column: span 2;

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

        height: var(--chart-height, 180px);

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

      .report-table-student {

        table-layout: fixed;

      }

      .report-table-student th,

      .report-table-student td {

        padding: 9px 8px;

        font-size: 11px;

      }

      .report-table-student th:nth-child(1),

      .report-table-student td:nth-child(1) {

        width: 20%;

      }

      .report-table-student th:nth-child(2),

      .report-table-student td:nth-child(2) {

        width: 32%;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

        max-width: 0;

      }

      .report-table-student th:nth-child(3),

      .report-table-student td:nth-child(3) {

        width: 10%;

        white-space: nowrap;

      }

      .report-table-student th:nth-child(4),

      .report-table-student td:nth-child(4) {

        width: 10%;

        white-space: nowrap;

      }

      .report-table-student th:nth-child(5),

      .report-table-student td:nth-child(5) {

        width: 28%;

      }

      .report-table-cohort {

        table-layout: fixed;

      }

      .report-table-cohort th:nth-child(1),

      .report-table-cohort td:nth-child(1) {

        width: 22%;

      }

      .report-table-cohort th:nth-child(2),

      .report-table-cohort td:nth-child(2) {

        width: 53%;

      }

      .report-table-cohort th:nth-child(3),

      .report-table-cohort td:nth-child(3) {

        width: 12%;

        white-space: nowrap;

      }

      .report-table-cohort th:nth-child(4),

      .report-table-cohort td:nth-child(4) {

        width: 13%;

        white-space: nowrap;

      }

      .progress-bar {

        width: 140px;

        height: 8px;

        background: #E5E7EB;

        border-radius: 999px;

        overflow: hidden;

      }

      .report-table-student .progress-bar {

        width: 100%;

        min-width: 86px;

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

        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));

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

      .activity-summary {

        display: flex;

        gap: 4px;

        flex-wrap: nowrap;

        align-items: center;

      }

      .activity-chip {

        display: inline-flex;

        align-items: center;

        justify-content: center;

        min-width: 28px;

        padding: 3px 6px;

        border-radius: 999px;

        background: #F3F4F6;

        color: var(--text);

        font-size: 9px;

        font-weight: 600;

        white-space: nowrap;

      }

      .student-detail-block {

        border: 1px solid #E5E7EB;

        border-radius: 16px;

        padding: 16px;

        margin-bottom: 18px;

        page-break-inside: auto;

      }

      .student-detail-block:last-child {

        margin-bottom: 0;

      }

      .student-detail-header {

        display: flex;

        justify-content: space-between;

        align-items: flex-start;

        gap: 16px;

        margin-bottom: 14px;

      }

      .student-detail-name {

        font-size: 16px;

        font-weight: 700;

        color: var(--text);

      }

      .student-detail-meta {

        margin-top: 4px;

        font-size: 11px;

        color: var(--muted);

      }

      .student-detail-summary {

        display: flex;

        flex-direction: column;

        align-items: flex-end;

        gap: 6px;

      }

      .student-detail-average {

        font-size: 22px;

        font-weight: 700;

        color: var(--text);

      }

      .subject-card-grid {

        display: grid;

        grid-template-columns: 1fr;

        gap: 12px;

      }

      .subject-card-detail {

        background: #F9FAFB;

        border-radius: 14px;

        padding: 14px;

      }

      .subject-card-header {

        display: flex;

        justify-content: space-between;

        align-items: flex-start;

        gap: 12px;

      }

      .subject-title-row {

        display: flex;

        align-items: center;

        gap: 8px;

      }

      .subject-color-dot {

        width: 10px;

        height: 10px;

        border-radius: 999px;

        flex: 0 0 auto;

      }

      .subject-name {

        font-size: 13px;

        font-weight: 700;

        color: var(--text);

      }

      .subject-activity-row {

        display: flex;

        gap: 4px;

        margin-top: 8px;

        flex-wrap: wrap;

      }

      .subject-progress-badge {

        font-size: 13px;

        font-weight: 700;

        color: var(--text);

        white-space: nowrap;

      }

      .subject-progress-bar-detail {

        width: 100%;

        margin-top: 10px;

      }

      .topic-list {

        margin-top: 12px;

        display: grid;

        gap: 10px;

      }

      .topic-block {

        background: #FFFFFF;

        border: 1px solid #E5E7EB;

        border-radius: 12px;

        padding: 10px 12px;

      }

      .topic-header {

        display: flex;

        justify-content: space-between;

        align-items: center;

        gap: 12px;

      }

      .topic-name {

        font-size: 12px;

        font-weight: 700;

        color: var(--text);

      }

      .topic-progress {

        font-size: 11px;

        font-weight: 700;

        color: var(--text);

        white-space: nowrap;

      }

      .topic-progress-bar {

        width: 100%;

        margin-top: 8px;

      }

      .subtopic-list {

        display: grid;

        gap: 6px;

        margin-top: 10px;

      }

      .subtopic-row {

        display: grid;

        grid-template-columns: minmax(0, 1fr) 180px;

        gap: 10px;

        align-items: center;

      }

      .subtopic-name {

        font-size: 11px;

        color: var(--muted);

      }

      .subtopic-progress-wrap {

        display: flex;

        align-items: center;

        gap: 8px;

      }

      .compact-progress {

        width: 100%;

        min-width: 0;

        height: 7px;

      }

      .subtopic-progress-value {

        font-size: 10px;

        color: var(--muted);

        min-width: 34px;

        text-align: right;

      }

      .subtopic-empty,

      .subtopic-empty-row {

        display: inline-block;

        font-size: 10px;

        color: #B45309;

      }

      .subtopic-empty-row {

        color: #9CA3AF;

      }

      .inline-Asignatura-list {

        display: grid;

        gap: 6px;

      }

      .inline-Asignatura-row {

        display: grid;

        grid-template-columns: minmax(0, 1fr) 110px 36px;

        gap: 8px;

        align-items: center;

      }

      .inline-Asignatura-name {

        font-size: 10px;

        color: var(--text);

      }

      .inline-Asignatura-progress {

        width: 100%;

        min-width: 0;

        height: 7px;

      }

      .inline-Asignatura-value {

        font-size: 10px;

        color: var(--muted);

        text-align: right;

      }

      .cohort-block {

        border: 1px solid #E5E7EB;

        border-radius: 16px;

        padding: 16px;

        margin-bottom: 18px;

        page-break-inside: avoid;

      }

      .cohort-block:last-child {

        margin-bottom: 0;

      }

      .cohort-header {

        display: flex;

        justify-content: space-between;

        align-items: flex-start;

        gap: 16px;

        margin-bottom: 14px;

      }

      .cohort-title {

        font-size: 16px;

        font-weight: 700;

        color: var(--text);

      }

      .cohort-sub {

        margin-top: 4px;

        font-size: 11px;

        color: var(--muted);

      }

      .cohort-metric {

        text-align: right;

      }

      .cohort-metric-value {

        font-size: 22px;

        font-weight: 700;

        color: var(--text);

      }

      .cohort-metric-sub {

        font-size: 10px;

        color: var(--muted);

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



const buildFailuresReportData = async ({ estudianteId, asignaturaIds } = {}) => {

  const respuestaWhere = estudianteId ? { estudiante_id: estudianteId } : {};

  const evaluacionWhere = estudianteId ? { estudiante_id: estudianteId } : {};

  const normalizedAsignaturaIds = Array.isArray(asignaturaIds)

    ? asignaturaIds

        .map((id) => Number.parseInt(id, 10))

        .filter((id) => Number.isFinite(id))

    : [];

  const AsignaturaFilterSet = normalizedAsignaturaIds.length > 0

    ? new Set(normalizedAsignaturaIds.map((id) => String(id)))

    : null;



  const [asignaturas, temas, contenidos, ejercicios, evaluaciones, respuestasEjercicio, respuestasMiniproyecto] = await Promise.all([

    AsignaturaModel.findAll({ where: { estado: true }, attributes: ['id', 'nombre'] }),

    Tema.findAll({ where: { estado: true }, attributes: ['id', 'asignatura_id'] }),

    Contenido.findAll({ where: { estado: true }, attributes: ['id', 'tema_id'] }),

    Ejercicio.findAll({ attributes: ['id', 'contenido_id'] }),

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

            { model: AsignaturaModel },

            { model: Actividad }

          ]

        }

      ]

    })

  ]);



  const AsignaturaMap = new Map(asignaturas.map((Asignatura) => [String(Asignatura.id), Asignatura.nombre]));

  const temaById = new Map(temas.map((tema) => [String(tema.id), tema]));

  const contenidoById = new Map(contenidos.map((contenido) => [String(contenido.id), contenido]));

  const ejercicioasignaturaIdById = new Map();



  ejercicios.forEach((ejercicio) => {

    const contenido = contenidoById.get(String(ejercicio.contenido_id));

    if (!contenido) return;

    const tema = temaById.get(String(contenido.tema_id));

    if (!tema || !Number.isFinite(Number(tema.asignatura_id))) return;

    ejercicioasignaturaIdById.set(String(ejercicio.id), Number(tema.asignatura_id));

  });



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



  let items = [];



  respuestasEjercicio.forEach((respuesta) => {

    const ejercicio = respuesta.ejercicio;

    const contenido = ejercicio?.Contenido || ejercicio?.contenido;

    const tema = contenido?.Tema || contenido?.tema;

    const mappedasignaturaId = ejercicioasignaturaIdById.get(String(respuesta.ejercicio_id));

    const asignaturaId = Number.isFinite(mappedasignaturaId)

      ? mappedasignaturaId

      : (tema?.asignatura_id ?? null);

    const asignaturaName = asignaturaId ? (AsignaturaMap.get(String(asignaturaId)) || `Asignatura ${asignaturaId}`) : 'Sin Asignatura';

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

      asignatura_id: asignaturaId,

      Asignatura_name: asignaturaName,

      intentos,

      fallos,

      aciertos,

      aprobado

    });

  });



  respuestasMiniproyecto.forEach((respuesta) => {

    const miniproyecto = respuesta.miniproyecto;

    const asignaturaId = miniproyecto?.asignatura_id ?? null;

    const asignaturaName = asignaturaId ? (AsignaturaMap.get(String(asignaturaId)) || `Asignatura ${asignaturaId}`) : 'Sin Asignatura';

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

      asignatura_id: asignaturaId,

      Asignatura_name: asignaturaName,

      intentos,

      fallos,

      aciertos,

      aprobado

    });

  });



  if (AsignaturaFilterSet) {

    items = items.filter((item) => item.asignatura_id !== null && AsignaturaFilterSet.has(String(item.asignatura_id)));

  }



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



  const byAsignaturaMap = new Map();

  items.forEach((item) => {

    const tipoKey = item.tipo === 'ejercicio' ? 'ejercicios' : 'miniproyectos';

    byType[tipoKey].intentos += item.intentos;

    byType[tipoKey].fallos += item.fallos;

    byType[tipoKey].aciertos += item.aciertos;



    const AsignaturaKey = item.asignatura_id ? String(item.asignatura_id) : 'sin-Asignatura';

    const current = byAsignaturaMap.get(AsignaturaKey) || {

      asignatura_id: item.asignatura_id,

      Asignatura_name: item.Asignatura_name,

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

    byAsignaturaMap.set(AsignaturaKey, current);

  });



  const byAsignatura = asignaturas

    .filter((Asignatura) => !AsignaturaFilterSet || AsignaturaFilterSet.has(String(Asignatura.id)))

    .map((Asignatura) => {

      const key = String(Asignatura.id);

      const current = byAsignaturaMap.get(key);

      if (current) return current;

      return {

        asignatura_id: Asignatura.id,

        Asignatura_name: Asignatura.nombre,

        intentos: 0,

        fallos: 0,

        aciertos: 0,

        ejercicios: 0,

        miniproyectos: 0

      };

    })

    .sort((a, b) => b.fallos - a.fallos);



  const estudianteIds = Array.from(new Set(items.map((item) => item.estudiante_id)));

  const estudiantes = estudianteIds.length

    ? await Estudiante.findAll({

        where: { id: { [Op.in]: estudianteIds } },

        include: [{ model: Persona, as: 'persona' }]

      })

    : [];

  const missingPersonaIds = estudiantes

    .filter((est) => !est.persona && Number.isFinite(Number(est.persona_id)))

    .map((est) => Number(est.persona_id));

  const matchedStudentIdSet = new Set(estudiantes.map((est) => String(est.id)));

  const rawPersonaFallbackIds = estudianteIds

    .map((id) => Number(id))

    .filter((id) => Number.isFinite(id) && !matchedStudentIdSet.has(String(id)));

  const fallbackPersonaIds = Array.from(new Set([...missingPersonaIds, ...rawPersonaFallbackIds]));

  const fallbackPersonas = fallbackPersonaIds.length

    ? await Persona.findAll({

        where: { id: { [Op.in]: fallbackPersonaIds } },

        attributes: ['id', 'nombre', 'email']

      })

    : [];

  const fallbackPersonaMap = new Map(

    fallbackPersonas.map((persona) => [

      String(persona.id),

      {

        nombre: persona.nombre,

        email: persona.email,

      }

    ])

  );

  const estudianteMap = new Map(

    estudiantes.map((est) => [

      String(est.id),

      {

        id: est.id,

        nombre: est.persona?.nombre || fallbackPersonaMap.get(String(est.persona_id))?.nombre || est.nombre || `Estudiante ${est.id}`,

        email: est.persona?.email || fallbackPersonaMap.get(String(est.persona_id))?.email || est.email || est.correo || ''

      }

    ])

  );



  const byStudentMap = new Map();

  items.forEach((item) => {

    const key = String(item.estudiante_id);

    const fallbackPersona = fallbackPersonaMap.get(key);

    const info = estudianteMap.get(key) || {

      id: item.estudiante_id,

      nombre: fallbackPersona?.nombre || `Estudiante ${item.estudiante_id}`,

      email: fallbackPersona?.email || ''

    };

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



  return { totals, byType, byAsignatura, byStudent, items };

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



const getResumenGeneralData = async ({ semester, dateFrom, dateTo, asignaturaIds } = {}) => {

  const [asignaturas, temas, subtemas, contenidos, secuencias, estudiantes, ejercicios, miniproyectos] = await Promise.all([

    AsignaturaModel.findAll({ where: { estado: true }, attributes: ['id', 'nombre'] }),

    Tema.findAll({ where: { estado: true }, attributes: ['id', 'nombre', 'asignatura_id'] }),

    Subtema.findAll({ where: { estado: true }, attributes: ['id', 'nombre', 'tema_id'] }),

    Contenido.findAll({ where: { estado: true }, attributes: ['id', 'tema_id', 'subtema_id'] }),

    SecuenciaContenido.findAll({ where: { estado: true }, attributes: ['contenido_origen_id', 'contenido_destino_id'] }),

    Estudiante.findAll({

      attributes: ['id', 'createdAt', 'semestre', 'codigoEstudiantil'],

      include: [{ model: Persona, as: 'persona', attributes: ['nombre', 'email'] }]

    }),

    Ejercicio.findAll({ attributes: ['id', 'contenido_id'] }),

    Miniproyecto.findAll({ attributes: ['id', 'asignatura_id'] })

  ]);



  const normalizedAsignaturaIds = Array.isArray(asignaturaIds)

    ? asignaturaIds

        .map((id) => Number.parseInt(id, 10))

        .filter((id) => Number.isFinite(id))

    : [];

  const AsignaturaFilterSet = normalizedAsignaturaIds.length > 0

    ? new Set(normalizedAsignaturaIds.map((id) => String(id)))

    : null;



  const scopedAsignaturas = AsignaturaFilterSet

    ? asignaturas.filter((Asignatura) => AsignaturaFilterSet.has(String(Asignatura.id)))

    : asignaturas;

  const scopedasignaturaIdSet = new Set(scopedAsignaturas.map((Asignatura) => String(Asignatura.id)));



  const scopedTemas = temas.filter((tema) => scopedasignaturaIdSet.has(String(tema.asignatura_id)));

  const scopedTemaIdSet = new Set(scopedTemas.map((tema) => String(tema.id)));



  const scopedSubtemas = subtemas.filter((subtema) => scopedTemaIdSet.has(String(subtema.tema_id)));

  const scopedSubtemaIdSet = new Set(scopedSubtemas.map((subtema) => String(subtema.id)));



  const scopedContenidos = contenidos.filter(

    (contenido) => scopedTemaIdSet.has(String(contenido.tema_id)) || scopedSubtemaIdSet.has(String(contenido.subtema_id))

  );

  const scopedContenidoIdSet = new Set(scopedContenidos.map((contenido) => String(contenido.id)));



  const scopedEjercicios = ejercicios.filter((ejercicio) => scopedContenidoIdSet.has(String(ejercicio.contenido_id)));

  const scopedMiniproyectos = miniproyectos.filter((mini) => scopedasignaturaIdSet.has(String(mini.asignatura_id)));



  const temaById = new Map(scopedTemas.map(tema => [String(tema.id), tema]));

  const subtemaById = new Map(scopedSubtemas.map(subtema => [String(subtema.id), subtema]));



  const temasByAsignatura = {};

  scopedTemas.forEach((tema) => {

    const asignaturaId = String(tema.asignatura_id);

    temasByAsignatura[asignaturaId] = temasByAsignatura[asignaturaId] || [];

    temasByAsignatura[asignaturaId].push(tema);

  });



  const subtemasByTema = {};

  scopedSubtemas.forEach((subtema) => {

    const temaId = String(subtema.tema_id);

    subtemasByTema[temaId] = subtemasByTema[temaId] || [];

    subtemasByTema[temaId].push(subtema);

  });



  const activeContentIds = new Set();

  secuencias.forEach((seq) => {

    if (seq.contenido_origen_id) activeContentIds.add(String(seq.contenido_origen_id));

    if (seq.contenido_destino_id) activeContentIds.add(String(seq.contenido_destino_id));

  });



  const contentToAsignatura = new Map();

  const contentToTema = new Map();

  const contentToSubtema = new Map();

  const totalContentByAsignatura = {};

  const totalContentByTema = {};

  const totalContentBySubtema = {};



  scopedContenidos.forEach((contenido) => {

    const contentId = String(contenido.id);

    if (activeContentIds.size && !activeContentIds.has(contentId)) return;



    const temaId = String(contenido.tema_id);

    const subtemaId = String(contenido.subtema_id);

    const tema = temaById.get(temaId);

    const asignaturaId = tema ? String(tema.asignatura_id) : null;

    if (!asignaturaId) return;



    contentToAsignatura.set(contentId, asignaturaId);

    contentToTema.set(contentId, temaId);

    contentToSubtema.set(contentId, subtemaId);



    totalContentByAsignatura[asignaturaId] = (totalContentByAsignatura[asignaturaId] || 0) + 1;

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



  const progressContentByAsignatura = {};

  const progressContentByTema = {};

  const progressContentBySubtema = {};



  progresoRows.forEach((row) => {

    const studentId = String(row.estudiante_id);

    const contentId = String(row.contenido_id);

    const asignaturaId = contentToAsignatura.get(contentId);

    const temaId = contentToTema.get(contentId);

    const subtemaId = contentToSubtema.get(contentId);

    if (!asignaturaId || !temaId || !subtemaId) return;

    incrementNestedCount(progressContentByAsignatura, studentId, asignaturaId, 1);

    incrementNestedCount(progressContentByTema, studentId, temaId, 1);

    incrementNestedCount(progressContentBySubtema, studentId, subtemaId, 1);

  });



  const exerciseToAsignatura = new Map();

  const totalExercisesByAsignatura = {};

  const contenidoById = new Map(scopedContenidos.map(c => [String(c.id), c]));

  

  scopedEjercicios.forEach((ejercicio) => {

    const contenido = contenidoById.get(String(ejercicio.contenido_id));

    if (!contenido) return;

    const subtema = subtemaById.get(String(contenido.subtema_id));

    if (!subtema) return;

    const tema = temaById.get(String(subtema.tema_id));

    if (!tema) return;

    const asignaturaId = String(tema.asignatura_id);

    exerciseToAsignatura.set(String(ejercicio.id), asignaturaId);

    totalExercisesByAsignatura[asignaturaId] = (totalExercisesByAsignatura[asignaturaId] || 0) + 1;

  });



  const respuestasEjercicio = await RespuestaEstudianteEjercicio.findAll({

    attributes: ['estudiante_id', 'ejercicio_id'],

    where: { estado: { [Op.in]: ['ENVIADO', 'APROBADO'] } }

  });



  const completedExercisesByAsignatura = {};

  respuestasEjercicio.forEach((respuesta) => {

    const asignaturaId = exerciseToAsignatura.get(String(respuesta.ejercicio_id));

    if (!asignaturaId) return;

    incrementNestedCount(completedExercisesByAsignatura, respuesta.estudiante_id, asignaturaId, 1);

  });



  const totalMinisByAsignatura = {};

  const miniproyectoToAsignatura = new Map();

  scopedMiniproyectos.forEach((mini) => {

    const asignaturaId = String(mini.asignatura_id);

    totalMinisByAsignatura[asignaturaId] = (totalMinisByAsignatura[asignaturaId] || 0) + 1;

    miniproyectoToAsignatura.set(String(mini.id), asignaturaId);

  });



  const respuestasMiniproyecto = await RespuestaEstudianteMiniproyecto.findAll({

    attributes: ['estudiante_id', 'miniproyecto_id'],

    where: { estado: { [Op.in]: ['ENVIADO', 'COMPLETADO'] } }

  });



  const completedMinisByAsignatura = {};

  respuestasMiniproyecto.forEach((respuesta) => {

    const asignaturaId = miniproyectoToAsignatura.get(String(respuesta.miniproyecto_id));

    if (!asignaturaId) return;

    incrementNestedCount(completedMinisByAsignatura, respuesta.estudiante_id, asignaturaId, 1);

  });



  const students = estudiantes.map((student) => {

    const studentId = String(student.id);

    const subjects = scopedAsignaturas.map((Asignatura) => {

      const asignaturaId = String(Asignatura.id);

      const totalContents = totalContentByAsignatura[asignaturaId] || 0;

      const completedContents = progressContentByAsignatura[studentId]?.[asignaturaId] || 0;

      const totalExercises = totalExercisesByAsignatura[asignaturaId] || 0;

      const completedExercises = completedExercisesByAsignatura[studentId]?.[asignaturaId] || 0;

      const totalMinis = totalMinisByAsignatura[asignaturaId] || 0;

      const completedMinis = completedMinisByAsignatura[studentId]?.[asignaturaId] || 0;



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



      const topics = (temasByAsignatura[asignaturaId] || []).map((tema) => {

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

        asignaturaId,

        name: Asignatura.nombre || `Asignatura ${asignaturaId}`,

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

      codigo: student.codigoEstudiantil ?? '',

      subjects

    };

  });



  const filteredStudents = applyStudentFilters(students, { semester, dateFrom, dateTo });



  return {

    students: filteredStudents,

    asignaturas: scopedAsignaturas.map(Asignatura => ({ id: Asignatura.id, nombre: Asignatura.nombre }))

  };

};



const resolveDocenteasignaturaIdFromRequest = (req) => {

  const candidates = [

    req.docenteAsignaturaId,

    req.headers?.['x-asignatura-id'],

    req.query?.asignatura_id,

    req.body?.asignatura_id

  ];



  for (const candidate of candidates) {

    const parsed = Number.parseInt(candidate, 10);

    if (Number.isFinite(parsed)) {

      return parsed;

    }

  }



  return null;

};



// Resumen general: estudiantes con progreso por asignatura/tema/subtema en un solo llamado

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



exports.obtenerResumenGeneralDocente = async (req, res) => {

  try {

    const asignaturaId = resolveDocenteasignaturaIdFromRequest(req);



    if (!asignaturaId) {

      return res.status(403).json({ message: 'No se pudo determinar el asignatura asignada al docente' });

    }



    const data = await getResumenGeneralData({

      semester: req.query.semester,

      dateFrom: req.query.dateFrom,

      dateTo: req.query.dateTo,

      asignaturaIds: [asignaturaId]

    });



    res.json({

      ...data,

      asignatura_id: asignaturaId

    });

  } catch (error) {

    console.error('❌ Error en obtenerResumenGeneralDocente:', error);

    res.status(500).json({ message: 'Error al obtener resumen de progreso para docente', error: error.message || error });

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



    const tema = await Tema.findOne({ where: { id: tId, estado: true } });

    if (!tema) return res.status(404).json({ message: "Tema no encontrado" });



    const contenidosDelTema = await Contenido.findAll({ where: { tema_id: tId, estado: true }, attributes: ['id'] });

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



    const subtema = await Subtema.findOne({ where: { id: sId, estado: true } });

    if (!subtema) return res.status(404).json({ message: "Subtema no encontrado" });



    const contenidosDelSubtema = await Contenido.findAll({ where: { subtema_id: sId, estado: true }, attributes: ['id'] });

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

    let asignaturaId = null;



    if (tipo === 'tema') {

      const tema = await Tema.findOne({ where: { id: uId, estado: true } });

      if (!tema) return res.status(404).json({ message: 'Tema no encontrado' });

      asignaturaId = tema.asignatura_id;



      const contenidos = await Contenido.findAll({ where: { tema_id: uId, estado: true }, attributes: ['id'] });

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



      const subtemas = await Subtema.findAll({ where: { tema_id: uId, estado: true }, attributes: ['id'] });

      const subtemaIds = subtemas.map(s => s.id);

      const contenidosDelTemaParaEjercicios = await Contenido.findAll({ where: { subtema_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] }, estado: true }, attributes: ['id'] });

      const contenidoIdsParaEjercicios = contenidosDelTemaParaEjercicios.map(c => c.id);

      const ejercicios = await Ejercicio.findAll({ where: { contenido_id: { [Op.in]: contenidoIdsParaEjercicios.length > 0 ? contenidoIdsParaEjercicios : [0] } }, attributes: ['id'] });

      ejercicioIds = ejercicios.map(e => e.id);



    } else { // subtema

      const subtema = await Subtema.findOne({ where: { id: uId, estado: true } });

      if (!subtema) return res.status(404).json({ message: 'Subtema no encontrado' });



      const tema = await Tema.findOne({ where: { id: subtema.tema_id, estado: true } });

      asignaturaId = tema ? tema.asignatura_id : null;



      const contenidos = await Contenido.findAll({ where: { subtema_id: uId, estado: true }, attributes: ['id'] });

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

    if (asignaturaId) {

      const respuestasMiniproyectos = await RespuestaEstudianteMiniproyecto.findAll({

        where: { estudiante_id: esId, estado: { [Op.in]: ['ENVIADO', 'COMPLETADO'] } },

        include: [{ model: Miniproyecto, as: 'miniproyecto', where: { asignatura_id: asignaturaId }, attributes: ['id'] }]

      });

      totalMiniproyectos = await Miniproyecto.count({ where: { asignatura_id: asignaturaId } });

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



// Obtener progreso de un estudiante por asignatura (para la barra de progreso)

exports.obtenerProgresoEstudiantePorAsignatura = async (req, res) => {

  try {

    const { asignatura_id, estudiante_id } = req.query;



    if (!asignatura_id || !estudiante_id) {

      return res.status(400).json({

        message: "asignatura_id y estudiante_id son requeridos como parámetros de query"

      });

    }



    const aId = parseInt(asignatura_id, 10);

    const esId = parseInt(estudiante_id, 10);



    if (isNaN(aId) || isNaN(esId)) {

      return res.status(400).json({

        message: "asignatura_id y estudiante_id deben ser números válidos"

      });

    }



    const Asignatura = await AsignaturaModel.findOne({ where: { id: aId, estado: true } });

    if (!Asignatura) {

      return res.status(404).json({ message: "Asignatura no encontrada" });

    }



    const estudiante = await Estudiante.findByPk(esId);

    if (!estudiante) {

      return res.status(404).json({ message: "Estudiante no encontrado" });

    }



    // Obtener solo temas activos (estado = true) para aplicar filtro en cascada

    const temas = await Tema.findAll({

      where: { asignatura_id: aId, estado: true },

      attributes: ['id', 'nombre', 'orden'],

      order: [['orden', 'ASC'], ['id', 'ASC']]

    });

    const temaIds = temas.map(t => t.id);



    // ==========================================

    // 1. CONTENIDOS DEL ÁREA (filtrados por secuencia activa)

    // ==========================================

    const contenidosDelAsignatura = await Contenido.findAll({

      where: { tema_id: { [Op.in]: temaIds }, estado: true },

      attributes: ['id']

    });

    const contenidoIdsDelAsignatura = contenidosDelAsignatura.map(c => c.id);



    const secuencias = await SecuenciaContenido.findAll({

      where: {

        estado: true,

        [Op.or]: [

          { contenido_origen_id: { [Op.in]: contenidoIdsDelAsignatura } },

          { contenido_destino_id: { [Op.in]: contenidoIdsDelAsignatura } }

        ]

      },

      attributes: ['contenido_origen_id', 'contenido_destino_id']

    });



    const contenidoIdsEnSecuencia = new Set();

    secuencias.forEach(seq => {

      contenidoIdsEnSecuencia.add(seq.contenido_origen_id);

      contenidoIdsEnSecuencia.add(seq.contenido_destino_id);

    });



    const contenidoIds = [...contenidoIdsEnSecuencia].filter(id => contenidoIdsDelAsignatura.includes(id));

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

      where: { tema_id: { [Op.in]: temaIds }, estado: true },

      attributes: ['id']

    });

    const subtemaIds = subtemas.map(s => s.id);



    // Obtener ejercicios del asignatura a través de contenidos de esos subtemas

    const contenidosParaEjercicios = await Contenido.findAll({

      where: { subtema_id: { [Op.in]: subtemaIds.length > 0 ? subtemaIds : [0] }, estado: true },

      attributes: ['id']

    });

    const contenidoIdsParaEjercicios = contenidosParaEjercicios.map(c => c.id);



    const ejerciciosAsignatura = await Ejercicio.findAll({

      where: { contenido_id: { [Op.in]: contenidoIdsParaEjercicios.length > 0 ? contenidoIdsParaEjercicios : [0] } },

      attributes: ['id']

    });

    const ejercicioIds = ejerciciosAsignatura.map(e => e.id);

    const totalEjercicios = ejercicioIds.length;



    const ejerciciosCompletados = await RespuestaEstudianteEjercicio.count({

      where: {

        estudiante_id: esId,

        ejercicio_id: { [Op.in]: ejercicioIds },

        estado: { [Op.in]: ['ENVIADO', 'APROBADO'] }

      }

    });



    const totalMiniproyectos = await Miniproyecto.count({ where: { asignatura_id: aId } });

    const miniproyectosAprobados = await Evaluacion.count({

      where: {

        estudiante_id: esId,

        estado: 'APROBADO',

        miniproyecto_id: { [Op.ne]: null }

      },

      include: [{ model: Miniproyecto, where: { asignatura_id: aId }, required: true }]

    });

    const miniproyectosDesaprobados = await Evaluacion.count({

      where: {

        estudiante_id: esId,

        estado: 'REPROBADO',

        miniproyecto_id: { [Op.ne]: null }

      },

      include: [{ model: Miniproyecto, where: { asignatura_id: aId }, required: true }]

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



    // ==========================================

    // 5. INFO POR TEMA (para tarjetas del dashboard)

    //    Un tema está COMPLETO solo si:

    //      • todos sus contenidos en secuencia activa están visualizados, Y

    //      • todos sus ejercicios están aprobados.

    // ==========================================

    const contenidosPorTema = await Contenido.findAll({

      where: {

        tema_id: { [Op.in]: temaIds.length > 0 ? temaIds : [0] },

        id: { [Op.in]: contenidoIds.length > 0 ? contenidoIds : [0] },

        estado: true

      },

      attributes: ['id', 'tema_id']

    });



    // Mapa tema_id → [contenido_ids] y contenido_id → tema_id

    const contenidosPorTemaMap = new Map();

    const contenidoToTema = new Map();

    for (const c of contenidosPorTema) {

      const tId = Number(c.tema_id);

      const cId = Number(c.id);

      if (!contenidosPorTemaMap.has(tId)) contenidosPorTemaMap.set(tId, []);

      contenidosPorTemaMap.get(tId).push(cId);

      contenidoToTema.set(cId, tId);

    }



    // Contenidos visualizados por el estudiante

    const visualizadosRows = await Progreso.findAll({

      where: {

        estudiante_id: esId,

        contenido_id: { [Op.in]: contenidoIds.length > 0 ? contenidoIds : [0] },

        completado: true,

        estado: 'Visualizado'

      },

      attributes: ['contenido_id']

    });

    const visualizadosSet = new Set(visualizadosRows.map(r => Number(r.contenido_id)));



    // Ejercicios por tema (vía contenido_id → tema_id)

    const ejerciciosConContenido = await Ejercicio.findAll({

      where: { id: { [Op.in]: ejercicioIds.length > 0 ? ejercicioIds : [0] } },

      attributes: ['id', 'contenido_id']

    });

    const ejerciciosPorTemaMap = new Map();

    for (const ej of ejerciciosConContenido) {

      const tId = contenidoToTema.get(Number(ej.contenido_id));

      if (!tId) continue;

      if (!ejerciciosPorTemaMap.has(tId)) ejerciciosPorTemaMap.set(tId, []);

      ejerciciosPorTemaMap.get(tId).push(Number(ej.id));

    }



    // Ejercicios estrictamente APROBADOS (no basta con ENVIADO)

    const ejerciciosAprobadosRows = await RespuestaEstudianteEjercicio.findAll({

      where: {

        estudiante_id: esId,

        ejercicio_id: { [Op.in]: ejercicioIds.length > 0 ? ejercicioIds : [0] },

        estado: 'APROBADO'

      },

      attributes: ['ejercicio_id']

    });

    const ejerciciosAprobadosSet = new Set(ejerciciosAprobadosRows.map(r => Number(r.ejercicio_id)));



    let temasCompletados = 0;

    let siguienteTemaNombre = null;

    const temasDetalle = temas.map(t => {

      const cIds = contenidosPorTemaMap.get(Number(t.id)) || [];

      const eIds = ejerciciosPorTemaMap.get(Number(t.id)) || [];

      const totalC = cIds.length;

      const totalE = eIds.length;

      const vistos = cIds.filter(id => visualizadosSet.has(id)).length;

      const aprobados = eIds.filter(id => ejerciciosAprobadosSet.has(id)).length;



      // Tema completo: tiene items Y todos están terminados

      const totalTotal = totalC + totalE;

      const hechosTotal = vistos + aprobados;

      const completado = totalTotal > 0 && hechosTotal === totalTotal;



      if (completado) temasCompletados += 1;

      else if (!siguienteTemaNombre) siguienteTemaNombre = t.nombre;



      return {

        id: t.id,

        nombre: t.nombre,

        totalContenidos: totalC,

        contenidosVistos: vistos,

        totalEjercicios: totalE,

        ejerciciosAprobados: aprobados,

        completado

      };

    });



    res.json({

      Asignatura: {

        id: Asignatura.id,

        nombre: Asignatura.nombre

      },

      estudiante_id: esId,

      progreso: progresoDetallado,

      miniproyectos: {

        total: totalMiniproyectos,

        aprobados: miniproyectosAprobados,

        desaprobados: miniproyectosDesaprobados

      },

      temas: {

        total: temas.length,

        completados: temasCompletados,

        pendientes: temas.length - temasCompletados,

        siguiente: siguienteTemaNombre || (temas.length > 0 ? 'Todos los temas completados' : 'Sin temas registrados'),

        detalle: temasDetalle

      },

      resumen: {

        totalItems,

        itemsCompletados,

        porcentajeTotalAsignatura: porcentajeProgreso,

        estado: porcentajeProgreso === 100 ? 'Completado' : porcentajeProgreso >= 50 ? 'En progreso' : 'Iniciado'

      }

    });



  } catch (error) {

    console.error('❌ Error en obtenerProgresoEstudiantePorAsignatura:', error);

    res.status(500).json({

      message: "Error al obtener progreso del estudiante por asignatura",

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



exports.obtenerReporteFallosDocente = async (req, res) => {

  try {

    const asignaturaId = resolveDocenteasignaturaIdFromRequest(req);



    if (!asignaturaId) {

      return res.status(403).json({ message: 'No se pudo determinar el asignatura asignada al docente' });

    }



    const rawEstudianteId = req.query.estudiante_id;

    const estudianteId = rawEstudianteId && rawEstudianteId !== 'all'

      ? parseInt(rawEstudianteId, 10)

      : null;



    if (rawEstudianteId && rawEstudianteId !== 'all' && isNaN(estudianteId)) {

      return res.status(400).json({ message: 'estudiante_id debe ser numerico o "all"' });

    }



    const data = await buildFailuresReportData({ estudianteId, asignaturaIds: [asignaturaId] });

    res.json({

      estudiante_id: estudianteId || 'all',

      asignatura_id: asignaturaId,

      ...data

    });

  } catch (error) {

    console.error('❌ Error en obtenerReporteFallosDocente:', error);

    res.status(500).json({ message: 'Error al generar reporte de fallos para docente', error: error.message || error });

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

    const isDocente = req.tipoUsuario === 'DOCENTE';

    const docenteAsignaturaId = isDocente ? resolveDocenteasignaturaIdFromRequest(req) : null;



    if (isDocente && !docenteAsignaturaId) {

      return res.status(403).json({ message: 'No se pudo determinar el asignatura asignada al docente' });

    }



    const asignaturaIds = docenteAsignaturaId ? [docenteAsignaturaId] : undefined;

    const filters = {

      semester: req.query.semester,

      dateFrom: req.query.dateFrom,

      dateTo: req.query.dateTo,

      asignaturaIds

    };



    let reportData = {

      subtitle: `Reporte generado el ${formatDate(new Date())}${docenteAsignaturaId ? ` · Asignatura asignada ${docenteAsignaturaId}` : ''}`,

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

        const { students, asignaturas } = await getResumenGeneralData(filters);

        const estudiante = students.find(student => String(student.id) === String(estudianteId));

        if (!estudiante) {

          return res.status(404).json({ message: `Estudiante con id ${estudianteId} no encontrado` });

        }



        const estudianteNombre = estudiante.name || `Estudiante ${estudianteId}`;

        const estudianteEmail = estudiante.email || '-';



        const totalContents = estudiante.subjects.reduce((sum, subj) => sum + (subj.contentViewed || 0), 0);

        const totalExercises = estudiante.subjects.reduce((sum, subj) => sum + (subj.exercisesCompleted || 0), 0);

        const totalMinis = estudiante.subjects.reduce((sum, subj) => sum + (subj.miniprojectsSubmitted || 0), 0);

        const averageProgress = getStudentAverageProgress(estudiante);



        const AsignaturaRows = estudiante.subjects.map((subject) => {

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



        const asignaturasTable = `

          <table class="report-table">

            <thead>

              <tr>

                <th>Asignatura</th>

                <th>Contenidos vistos</th>

                <th>Ejercicios</th>

                <th>Miniproyectos</th>

                <th>Progreso</th>

                <th></th>

              </tr>

            </thead>

            <tbody>

              ${AsignaturaRows || '<tr><td colspan="6">Sin datos</td></tr>'}

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

                  <div class="meta-item">Semestre<strong>${escapeHtml(estudiante.semester || '-')}</strong></div>

                  <div class="meta-item">Promedio general<strong>${formatPercentValue(averageProgress)}%</strong></div>

                </div>

              `

            },

            {

              title: 'Desempeño por Asignatura',

              subtitle: 'Contenidos vistos, actividades y progreso',

              body: asignaturasTable

            },

            {

              title: 'Detalle Completo por Asignatura, Tema y Subtema',

              subtitle: 'Muestra el mismo desglose de porcentajes visible en la aplicación.',

              body: buildStudentDetailedProgressHtml(estudiante)

            }

          ]

        };

      } else {

        const { students, asignaturas } = await getResumenGeneralData(filters);

        const totalStudents = students.length;



        const studentSummaries = students.map((student) => {

          const avg = student.subjects.length

            ? student.subjects.reduce((acc, subj) => acc + (subj.progress || 0), 0) / student.subjects.length

            : 0;

          const status = getStudentProgressStatus(avg);

          return { ...student, avg, status };

        });



        const sortedStudentSummaries = [...studentSummaries].sort((a, b) => {

          if (b.avg !== a.avg) return b.avg - a.avg;

          return String(a.name || '').localeCompare(String(b.name || ''));

        });

        const displayedStudentSummaries = sortedStudentSummaries.slice(0, 15);

        const detailedStudentsHtml = displayedStudentSummaries

          .map((student) => buildStudentDetailedProgressHtml(student))

          .join('');



        const avgProgress = totalStudents

          ? studentSummaries.reduce((sum, s) => sum + s.avg, 0) / totalStudents

          : 0;



        const totalContents = studentSummaries.reduce((sum, student) => {

          return sum + student.subjects.reduce((acc, subj) => acc + (subj.contentViewed || 0), 0);

        }, 0);

        const totalExercises = studentSummaries.reduce((sum, student) => {

          return sum + student.subjects.reduce((acc, subj) => acc + (subj.exercisesCompleted || 0), 0);

        }, 0);

        const totalMinis = studentSummaries.reduce((sum, student) => {

          return sum + student.subjects.reduce((acc, subj) => acc + (subj.miniprojectsSubmitted || 0), 0);

        }, 0);



        const statusCounts = studentSummaries.reduce((acc, s) => {

          if (s.status === 'Al día') acc.ok += 1;

          else if (s.status === 'Regular') acc.warn += 1;

          else acc.bad += 1;

          return acc;

        }, { ok: 0, warn: 0, bad: 0 });



        const topStudent = sortedStudentSummaries.reduce((best, current) => {

          if (!best) return current;

          return current.avg > best.avg ? current : best;

        }, null);



        const asignaturasummaries = asignaturas.map((Asignatura) => {

          const asignaturaId = String(Asignatura.id);

          let totalAsignaturaProgress = 0;

          let activeStudents = 0;

          let totalAsignaturaContents = 0;

          let totalAsignaturaExercises = 0;

          let totalAsignaturaMinis = 0;



          studentSummaries.forEach((student) => {

            const subject = student.subjects.find((subj) => String(subj.asignaturaId ?? '') === asignaturaId || subj.name === (Asignatura.nombre || `Asignatura ${asignaturaId}`));

            if (!subject) return;

            activeStudents += 1;

            totalAsignaturaProgress += subject.progress || 0;

            totalAsignaturaContents += subject.contentViewed || 0;

            totalAsignaturaExercises += subject.exercisesCompleted || 0;

            totalAsignaturaMinis += subject.miniprojectsSubmitted || 0;

          });



          return {

            name: Asignatura.nombre || `Asignatura ${Asignatura.id}`,

            avgProgress: activeStudents ? totalAsignaturaProgress / activeStudents : 0,

            activeStudents,

            totalContents: totalAsignaturaContents,

            totalExercises: totalAsignaturaExercises,

            totalMinis: totalAsignaturaMinis

          };

        }).sort((a, b) => b.avgProgress - a.avgProgress);



        const AsignaturaLabels = asignaturas.map(Asignatura => Asignatura.nombre || `Asignatura ${Asignatura.id}`);

        const AsignaturaValues = asignaturasummaries.map((Asignatura) => Asignatura.avgProgress);



        const tableRows = displayedStudentSummaries.map((student) => {

          const progress = Math.round(student.avg);

          return `

            <tr>

              <td>${escapeHtml(student.name)}</td>

              <td>${escapeHtml(student.email || '-')}</td>

              <td>${escapeHtml(student.semester || '-')}</td>

              <td>${progress}%</td>

              <td>

                <div class="progress-bar">

                  <div class="progress-fill" style="width:${progress}%"></div>

                </div>

              </td>

            </tr>

          `;

        }).join('');



        const AsignaturaTableRows = asignaturasummaries.map((Asignatura) => `

          <tr>

            <td>${escapeHtml(Asignatura.name)}</td>

            <td>${Asignatura.activeStudents}</td>

            <td>${formatPercentValue(Asignatura.avgProgress)}%</td>

            <td>${Asignatura.totalContents}</td>

            <td>${Asignatura.totalExercises}</td>

            <td>${Asignatura.totalMinis}</td>

          </tr>

        `).join('');



        const tableHtml = `

          <table class="report-table report-table-student">

            <thead>

              <tr>

                <th>Estudiante</th>

                <th>Correo</th>

                <th>Semestre</th>

                <th>Promedio</th>

                <th>Progreso</th>

              </tr>

            </thead>

            <tbody>

              ${tableRows || '<tr><td colspan="5">Sin datos</td></tr>'}

            </tbody>

          </table>

        `;



        const AsignaturaTableHtml = `

          <table class="report-table">

            <thead>

              <tr>

                <th>Asignatura</th>

                <th>Estudiantes activos</th>

                <th>Promedio</th>

                <th>Contenidos</th>

                <th>Ejercicios</th>

                <th>Miniproyectos</th>

              </tr>

            </thead>

            <tbody>

              ${AsignaturaTableRows || '<tr><td colspan="6">Sin datos</td></tr>'}

            </tbody>

          </table>

        `;



        reportData = {

          ...reportData,

          stats: [

            { label: 'Total estudiantes', value: totalStudents, sub: 'Filtrados' },

            { label: 'Mostrados en detalle', value: displayedStudentSummaries.length, sub: 'Top 15 por progreso' },

            { label: 'Promedio general', value: `${formatPercentValue(avgProgress)}%`, sub: 'Porcentaje promedio en todas las asignaturas' },

            { label: 'Al día', value: statusCounts.ok, sub: '≥ 70% de progreso' },

            { label: 'Atrasados', value: statusCounts.bad, sub: '< 50% de progreso' }

          ],

          sections: [

            {

              title: 'Indicadores del Grupo',

              subtitle: 'Resumen operativo del reporte filtrado',

              body: `

                <div class="meta">

                  <div class="meta-item">Mejor promedio<strong>${escapeHtml(topStudent?.name || 'Sin datos')} (${formatPercentValue(topStudent?.avg || 0)}%)</strong></div>

                  <div class="meta-item">Asignaturas analizadas<strong>${asignaturas.length}</strong></div>

                  <div class="meta-item">Contenidos vistos<strong>${totalContents}</strong></div>

                  <div class="meta-item">Ejercicios completados<strong>${totalExercises}</strong></div>

                  <div class="meta-item">Miniproyectos entregados<strong>${totalMinis}</strong></div>

                  <div class="meta-item">Estudiantes regulares<strong>${statusCounts.warn}</strong></div>

                </div>

              `

            },

            {

              title: 'Resumen por Estudiante',

              subtitle: 'Top 15 estudiantes con mayor progreso general y estado actual',

              body: tableHtml

            },

            {

              title: 'Resumen por Asignatura',

              subtitle: 'Promedio y volumen de actividad por materia',

              body: AsignaturaTableHtml

            },

            {

              title: 'Detalle Completo de Estudiantes',

              subtitle: 'Se muestran hasta 15 estudiantes ordenados por mayor progreso, con asignaturas, temas y subtemas.',

              body: detailedStudentsHtml || '<div class="subtopic-empty-row">Sin estudiantes para mostrar</div>'

            }

          ],

          charts: [

            {

              id: 'AsignaturaAvgChart',

              type: 'bar',

              title: 'Progreso Promedio por Asignatura',

              subtitle: 'Se compacta en formato horizontal para mejorar la lectura de nombres largos.',

              labels: asignaturasummaries.map((Asignatura) => Asignatura.name),

              data: AsignaturaValues,

              color: '#4A90E2',

              showLegend: false,

              orientation: 'horizontal',

              percentScale: true,

              labelMaxLength: 26,

              height: 180

            },

            {

              id: 'statusDistChart',

              type: 'doughnut',

              title: 'Distribución de Estudiantes',

              subtitle: 'Estado general del grupo según el promedio acumulado.',

              labels: ['Al día', 'Regular', 'Atrasado'],

              data: [statusCounts.ok, statusCounts.warn, statusCounts.bad],

              colors: ['#7ED6A7', '#FBBF24', '#F5A97F'],

              showLegend: true,

              legendPosition: 'bottom',

              height: 180

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



      const allCohorts = Object.keys(groups).sort().map((date) => {

        const list = [...groups[date]].sort((a, b) => {

          const avgA = getStudentAverageProgress(a);

          const avgB = getStudentAverageProgress(b);

          if (avgB !== avgA) return avgB - avgA;

          return String(a.name || '').localeCompare(String(b.name || ''));

        });

        const sumAvg = list.reduce((sum, s) => sum + getStudentAverageProgress(s), 0);

        const avgCohorte = list.length ? (sumAvg / list.length) : 0;

        return {

          date,

          cohortLabel: formatDate(date),

          avgProgress: parseFloat(avgCohorte.toFixed(1)),

          studentCount: list.length,

          students: list

        };

      });



      const sortedCohorts = [...allCohorts].sort((a, b) => {

        if (b.avgProgress !== a.avgProgress) return b.avgProgress - a.avgProgress;

        if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount;

        return String(a.date).localeCompare(String(b.date));

      });

      const visibleCohorts = sortedCohorts.slice(0, 8);

      const hiddenCohortsCount = Math.max(0, sortedCohorts.length - visibleCohorts.length);

      const totalEstudiantes = allCohorts.reduce((sum, cohort) => sum + cohort.studentCount, 0);

      const totalPromedios = allCohorts.reduce((sum, cohort) => sum + cohort.avgProgress, 0);

      const tableRows = visibleCohorts.map((cohort) => [cohort.cohortLabel, cohort.studentCount, `${formatPercentValue(cohort.avgProgress)}%`]);

      const cohortLabels = visibleCohorts.map((cohort) => cohort.cohortLabel);

      const cohortAvgs = visibleCohorts.map((cohort) => cohort.avgProgress);

      const cohortStudents = visibleCohorts.map((cohort) => cohort.studentCount);

      const cohortDetailsHtml = buildCohortDetailedHtml(visibleCohorts);



      reportData = {

        ...reportData,

        stats: [

          { label: 'Cohortes analizadas', value: Object.keys(groups).length, sub: 'Fechas de creación' },

          { label: 'Cohortes visibles', value: visibleCohorts.length, sub: 'Top 8 por avance' },

          { label: 'Total de estudiantes', value: totalEstudiantes, sub: 'Todas las cohortes' },

          { label: 'Promedio general', value: `${formatPercentValue(Object.keys(groups).length ? (totalPromedios / Object.keys(groups).length) : 0)}%`, sub: 'Porcentaje promedio simple entre cohortes' }

        ],

        sections: [

          {

            title: 'Notas del Informe',

            subtitle: 'Contexto del comparativo por cohorte',

            body: `

              <div class="meta">

                <div class="meta-item">Criterio de orden<strong>Las cohortes se muestran por mayor progreso promedio.</strong></div>

                <div class="meta-item">Detalle visible<strong>Hasta 8 cohortes para conservar legibilidad.</strong></div>

                <div class="meta-item">Cohortes ocultas<strong>${hiddenCohortsCount}</strong></div>

                <div class="meta-item">Fuente<strong>Promedio por asignaturas y estado actual de estudiantes.</strong></div>

              </div>

            `

          },

          {

            title: 'Análisis por Fecha de Creación',

            subtitle: 'Comparación de cohortes y estudiantes rezagados como en la aplicación.',

            body: cohortDetailsHtml || '<div class="subtopic-empty-row">Sin cohortes para mostrar</div>'

          }

        ],

        tableTitle: 'Comparativo por Cohorte',

        tableSubtitle: 'Top 8 cohortes ordenadas por progreso promedio',

        tableHeaders: ['Fecha', 'Estudiantes', 'Promedio'],

        tableRows,

        charts: [

          {

            id: 'cohortAvgChart',

            type: 'bar',

            title: 'Progreso Promedio por Cohorte',

            subtitle: 'Promedio simple del avance acumulado por fecha de creación.',

            labels: cohortLabels,

            data: cohortAvgs,

            color: '#7ED6A7',

            showLegend: false,

            percentScale: true,

            labelMaxLength: 12,

            height: 180

          },

          {

            id: 'cohortDistChart',

            type: 'doughnut',

            title: 'Distribución de Estudiantes',

            subtitle: 'Cantidad de estudiantes por cohorte visible.',

            labels: cohortLabels,

            data: cohortStudents,

            showLegend: true,

            legendPosition: 'bottom',

            height: 180

          }

        ]

      };



    } else if (type === 'activity') {

      const { students, asignaturas } = await getResumenGeneralData(filters);

      const studentIds = students.map(student => student.id);



      const totalContenidos = students.reduce((sum, student) => {

        return sum + student.subjects.reduce((acc, subj) => acc + (subj.contentViewed || 0), 0);

      }, 0);

      const totalEjercicios = students.reduce((sum, student) => {

        return sum + student.subjects.reduce((acc, subj) => acc + (subj.exercisesCompleted || 0), 0);

      }, 0);

      const totalMinis = students.reduce((sum, student) => {

        return sum + student.subjects.reduce((acc, subj) => acc + (subj.miniprojectsSubmitted || 0), 0);

      }, 0);



      const AsignaturaRows = asignaturas.map((Asignatura) => {

        const asignaturaName = Asignatura.nombre || `Asignatura ${Asignatura.id}`;

        const subjectValues = students.map(student => {

          const subject = student.subjects.find(subj => String(subj.asignaturaId ?? '') === String(Asignatura.id) || subj.name === asignaturaName);

          return subject || null;

        }).filter(Boolean);



        const totalContent = subjectValues.reduce((sum, subj) => sum + (subj.contentViewed || 0), 0);

        const totalExercise = subjectValues.reduce((sum, subj) => sum + (subj.exercisesCompleted || 0), 0);

        const totalMini = subjectValues.reduce((sum, subj) => sum + (subj.miniprojectsSubmitted || 0), 0);

        const avgProgress = subjectValues.length

          ? subjectValues.reduce((sum, subj) => sum + (subj.progress || 0), 0) / subjectValues.length

          : 0;



        return {

          asignaturaName,

          totalContent,

          totalExercise,

          totalMini,

          avgProgress: Math.round(avgProgress)

        };

      });



      const activitySections = asignaturas.map((Asignatura) => {

        const asignaturaName = Asignatura.nombre || `Asignatura ${Asignatura.id}`;

        const AsignaturaRow = AsignaturaRows.find(row => row.asignaturaName === asignaturaName);

        const studentsWithSubject = students.map((student) => {

          const subject = student.subjects.find(subj => String(subj.asignaturaId ?? '') === String(Asignatura.id) || subj.name === asignaturaName);

          if (!subject) return null;

          return {

            name: student.name,

            contentViewed: subject.contentViewed || 0,

            exercisesCompleted: subject.exercisesCompleted || 0,

            miniprojectsSubmitted: subject.miniprojectsSubmitted || 0,

            progress: Math.round(subject.progress || 0)

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


          </tr>

        `).join('');



        const statsHtml = AsignaturaRow

          ? `

            <div class="stat-grid">

              <div class="stat-card">

                <div class="label">Progreso promedio</div>

                <div class="value">${AsignaturaRow.avgProgress}%</div>

                <div class="sub">En el asignatura</div>

              </div>

              <div class="stat-card">

                <div class="label">Contenidos visualizados</div>

                <div class="value">${AsignaturaRow.totalContent}</div>

                <div class="sub">Total agregado</div>

              </div>

              <div class="stat-card">

                <div class="label">Ejercicios completados</div>

                <div class="value">${AsignaturaRow.totalExercise}</div>

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


              </tr>

            </thead>

            <tbody>

              ${studentRows || '<tr><td colspan="6">Sin datos</td></tr>'}

            </tbody>

          </table>

        `;



        return {

          title: `Desempeño Detallado: ${asignaturaName}`,

          subtitle: 'Análisis de completitud y calificaciones',

          body: tableHtml

        };

      });



      const AsignaturaLabels = AsignaturaRows.map(row => row.asignaturaName);

      const AsignaturaValues = AsignaturaRows.map(row => row.avgProgress);



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

            type: 'doughnut',

            title: 'Distribución de Actividades',

            subtitle: 'Volumen agregado de contenidos, ejercicios y miniproyectos.',

            labels: ['Contenidos Visualizados', 'Ejercicios Completados', 'Miniproyectos Entregados'],

            data: [totalContenidos, totalEjercicios, totalMinis],

            colors: ['#4A90E2', '#7ED6A7', '#F5A97F'],

            showLegend: true,

            legendPosition: 'bottom',

            height: 180

          },

          {

            id: 'AsignaturaProgressChart',

            type: 'bar',

            title: 'Progreso Promedio por Asignatura',

            subtitle: 'Vista compacta por materia para evitar expansión innecesaria.',

            labels: AsignaturaLabels,

            data: AsignaturaValues,

            color: '#4A90E2',

            showLegend: false,

            orientation: 'horizontal',

            percentScale: true,

            labelMaxLength: 26,

            height: 180

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



      const failuresData = await buildFailuresReportData({ estudianteId, asignaturaIds });

      const totalIntentos = failuresData.totals.intentos;

      const totalFallos = failuresData.totals.fallos;

      const totalAciertos = failuresData.totals.aciertos;

      const tasaFallos = totalIntentos > 0 ? Math.round((totalFallos / totalIntentos) * 100) : 0;

      const tasaAciertos = totalIntentos > 0 ? Math.round((totalAciertos / totalIntentos) * 100) : 0;



      const itemsAgrupados = estudianteId

        ? [...failuresData.items]

        : Array.from(

            failuresData.items.reduce((map, item) => {

              const key = `${item.tipo}-${item.actividad_id}-${item.asignatura_id ?? 'sin-Asignatura'}`;

              const current = map.get(key);

              if (!current) {

                map.set(key, {

                  ...item,

                  estudiante_id: 0,

                  aprobado: Boolean(item.aprobado),

                  estudiantesAfectados: 1

                });

                return map;

              }



              current.intentos += item.intentos || 0;

              current.fallos += item.fallos || 0;

              current.aciertos += item.aciertos || 0;

              current.aprobado = current.aprobado && Boolean(item.aprobado);

              current.estudiantesAfectados = (current.estudiantesAfectados || 0) + 1;

              map.set(key, current);

              return map;

            }, new Map()).values()

          );

      const itemsOrdenados = [...itemsAgrupados].sort((a, b) => {

        if (b.fallos !== a.fallos) return b.fallos - a.fallos;

        return b.intentos - a.intentos;

      });

      const itemsListados = estudianteId ? itemsOrdenados : itemsOrdenados.slice(0, 20);

      const shouldShowAsignaturaColumn = !isDocente || !estudianteId;

      const activityColumnHeader = isDocente ? (estudianteId ? '' : '<th>Estudiantes afectados</th>') : '<th>Asignatura</th>';

      const emptyActivityColspan = shouldShowAsignaturaColumn ? 7 : 6;



      const activityRows = itemsListados.map((item) => `

        <tr>

          <td>${escapeHtml(item.tipo)}</td>

          <td>${escapeHtml(item.titulo)}</td>

          ${shouldShowAsignaturaColumn ? `<td>${escapeHtml(isDocente ? String(item.estudiantesAfectados || 0) : (item.Asignatura_name || '-'))}</td>` : ''}

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

              ${activityColumnHeader}

              <th>Intentos</th>

              <th>Aciertos</th>

              <th>Fallos</th>

              <th>Aprobado</th>

            </tr>

          </thead>

          <tbody>

            ${activityRows || `<tr><td colspan="${emptyActivityColspan}">Sin datos</td></tr>`}

          </tbody>

        </table>

      `;



      const AsignaturaRows = failuresData.byAsignatura.map((Asignatura) => `

        <tr>

          <td>${escapeHtml(Asignatura.Asignatura_name || 'Sin Asignatura')}</td>

          <td>${Asignatura.intentos}</td>

          <td>${Asignatura.aciertos}</td>

          <td>${Asignatura.fallos}</td>

          <td>${Asignatura.ejercicios}</td>

          <td>${Asignatura.miniproyectos}</td>

        </tr>

      `).join('');



      const AsignaturaTable = `

        <table class="report-table">

          <thead>

            <tr>

              <th>Asignatura</th>

              <th>Intentos</th>

              <th>Aciertos</th>

              <th>Fallos</th>

              <th>Ejercicios</th>

              <th>Miniproyectos</th>

            </tr>

          </thead>

          <tbody>

            ${AsignaturaRows || '<tr><td colspan="6">Sin datos</td></tr>'}

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



      const AsignaturaLabels = failuresData.byAsignatura.map((Asignatura) => Asignatura.Asignatura_name || 'Sin Asignatura');

      const AsignaturaFallos = failuresData.byAsignatura.map((Asignatura) => Asignatura.fallos);

      const fallosEjercicios = failuresData.byType.ejercicios.fallos;

      const fallosMinis = failuresData.byType.miniproyectos.fallos;

      const topStudentChartRows = failuresData.byStudent

        .slice(0, 8)

        .map((student) => ({

          label: student.nombre || `Estudiante ${student.estudiante_id}`,

          value: student.fallos

        }));

      const topActivityChartRows = itemsOrdenados

        .slice(0, 8)

        .map((item) => ({

          label: item.titulo || `${item.tipo} ${item.actividad_id}`,

          value: item.fallos

        }));

      const docenteCharts = [

        {

          id: 'topStudentsFailuresChart',

          type: 'bar',

          title: 'Estudiantes con Más Fallos',

          subtitle: estudianteId ? 'El estudiante filtrado dentro del grupo actual.' : 'Top estudiantes que requieren atención prioritaria.',

          labels: topStudentChartRows.map((item) => item.label),

          data: topStudentChartRows.map((item) => item.value),

          color: '#F97316',

          showLegend: false,

          orientation: 'horizontal',

          labelMaxLength: 26,

          height: 220

        },

        {

          id: 'hitsVsFailsChart',

          type: 'doughnut',

          title: 'Aciertos vs Fallos',

          subtitle: 'Relación global de resultados sobre los intentos.',

          labels: ['Aciertos', 'Fallos'],

          data: [totalAciertos, totalFallos],

          colors: ['#7ED6A7', '#F5A97F'],

          showLegend: true,

          legendPosition: 'bottom',

          height: 180

        },

        {

          id: 'topActivitiesFailuresChart',

          type: 'bar',

          title: 'Actividades con Más Fallos',

          subtitle: estudianteId ? 'Actividades donde el estudiante presenta más dificultad.' : 'Top actividades donde la materia concentra más errores.',

          labels: topActivityChartRows.map((item) => item.label),

          data: topActivityChartRows.map((item) => item.value),

          color: '#DC2626',

          showLegend: false,

          orientation: 'horizontal',

          labelMaxLength: 30,

          height: 220

        }

      ];

      const defaultCharts = [

        {

          id: 'failuresAsignaturaChart',

          type: 'bar',

          title: 'Fallos por Asignatura',

          subtitle: 'Comparativo compacto por materia filtrada.',

          labels: AsignaturaLabels,

          data: AsignaturaFallos,

          color: '#F5A97F',

          showLegend: false,

          orientation: 'horizontal',

          labelMaxLength: 26,

          height: 180

        },

        {

          id: 'hitsVsFailsChart',

          type: 'doughnut',

          title: 'Aciertos vs Fallos',

          subtitle: 'Relación global de resultados sobre los intentos.',

          labels: ['Aciertos', 'Fallos'],

          data: [totalAciertos, totalFallos],

          colors: ['#7ED6A7', '#F5A97F'],

          showLegend: true,

          legendPosition: 'bottom',

          height: 180

        },

        {

          id: 'failuresTypeChart',

          type: 'doughnut',

          title: 'Distribución de Fallos por Tipo',

          subtitle: 'Separación entre ejercicios y miniproyectos.',

          labels: ['Ejercicios', 'Miniproyectos'],

          data: [fallosEjercicios, fallosMinis],

          colors: ['#4A90E2', '#7ED6A7'],

          showLegend: true,

          legendPosition: 'bottom',

          height: 180

        }

      ];



      reportData = {

        ...reportData,

        stats: [

          { label: 'Intentos totales', value: totalIntentos, sub: estudianteId ? 'Del estudiante' : 'Agregado' },

          { label: 'Aciertos totales', value: totalAciertos, sub: 'Intentos aprobados' },

          { label: 'Fallos totales', value: totalFallos, sub: 'Intentos no aprobados' },

          { label: 'Tasa de acierto', value: `${tasaAciertos}%`, sub: 'Porcentaje de aciertos sobre intentos' }

        ],

        sections: [

          {

            title: 'Notas del Informe',

            subtitle: 'Contexto del reporte de fallos',

            body: `

              <div class="meta">

                <div class="meta-item">Alcance<strong>${estudianteId ? 'Resumen del estudiante seleccionado' : 'Vista agregada del grupo filtrado'}</strong></div>

                <div class="meta-item">Top visible<strong>${estudianteId ? 'Todas las actividades del estudiante' : 'Top 20 actividades con más fallos'}</strong></div>

                <div class="meta-item">Tasa de acierto<strong>${tasaAciertos}%</strong></div>

                <div class="meta-item">Tasa de fallos<strong>${tasaFallos}%</strong></div>

              </div>

            `

          },

          {

            title: 'Resumen por Asignatura',

            subtitle: 'Intentos y fallos acumulados, como se visualiza en la aplicación.',

            body: AsignaturaTable

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

        charts: isDocente ? docenteCharts : defaultCharts

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

    const nombreES = { student: 'estudiante', date: 'fecha', activity: 'actividad', failures: 'fallos' };

    res.setHeader('Content-Disposition', `attachment; filename="reporte_${nombreES[type] ?? type}.pdf"`);

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

 * Obtiene el estado de todos los temas de un asignatura para un estudiante

 * GET /api/progreso/estado-temas-asignatura?estudiante_id=X&asignatura_id=Y

 */

exports.obtenerEstadoTemasAsignatura = async (req, res) => {

  try {

    const { estudiante_id, asignatura_id } = req.query;



    if (!estudiante_id || !asignatura_id) {

      return res.status(400).json({ 

        message: "estudiante_id y asignatura_id son requeridos como parámetros de query" 

      });

    }



    const estudianteId = parseInt(estudiante_id, 10);

    const asignaturaId = parseInt(asignatura_id, 10);



    if (isNaN(estudianteId) || isNaN(asignaturaId)) {

      return res.status(400).json({ 

        message: "estudiante_id y asignatura_id deben ser números válidos" 

      });

    }



    const resultado = await desbloqueoService.obtenerEstadoTemasAsignatura(estudianteId, asignaturaId);

    res.json({

      estudiante_id: estudianteId,

      asignatura_id: asignaturaId,

      temas: resultado

    });



  } catch (error) {

    console.error('❌ Error en obtenerEstadoTemasAsignatura:', error);

    res.status(500).json({ 

      message: 'Error al obtener estado de temas del asignatura', 

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

