(function defineResultsUserInterface(root) {
  "use strict";

  const app = root.FileSimulator;
  const { utils } = app;

  function formatNumber(value, maximumFractionDigits = 2) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "No disponible";
    return new Intl.NumberFormat("es-UY", {
      minimumFractionDigits: 0,
      maximumFractionDigits
    }).format(value);
  }

  function formatMetric(value, unit, maximumFractionDigits = 2) {
    const formatted = formatNumber(value, maximumFractionDigits);
    return formatted === "No disponible" ? formatted : `${formatted} ${unit || ""}`.trim();
  }

  function formatDay(day) {
    const match = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "No disponible";
  }

  function statusInfo(status) {
    const values = {
      complete: { label: "Análisis completo", description: "Todos los intervalos esperados tienen datos confiables." },
      partial: { label: "Análisis parcial", description: "Los resultados utilizan exclusivamente los intervalos confiables disponibles." },
      ambiguous: { label: "Análisis con ambigüedades", description: "Existen intervalos duplicados que no tienen un valor canónico." },
      "invalid-input": { label: "Análisis no disponible", description: "El dataset normalizado no cumple el contrato del Motor de Análisis." }
    };
    return values[status] || { label: "Estado desconocido", description: "No se pudo interpretar el estado del análisis." };
  }

  function measurement(result, magnitude) {
    return result.totals && result.totals.measurements ? result.totals.measurements[magnitude] || null : null;
  }

  function coverage(result, magnitude) {
    return result.coverage && result.coverage.measurements ? result.coverage.measurements[magnitude] || null : null;
  }

  function renderInvalid(result) {
    const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
    return `
      <section class="panel analysis-invalid" aria-labelledby="analysis-invalid-heading">
        <p class="eyebrow">Motor de análisis</p>
        <h1 id="analysis-invalid-heading">No se pudo generar el análisis</h1>
        <p>El Motor devolvió un resultado <code>invalid-input</code>. No se presentan cálculos parciales.</p>
        <ul>${diagnostics.map((item) => `<li><strong>${utils.escapeHtml(item.code || "DIAGNOSTIC")}</strong> · ${utils.escapeHtml(item.message || "Sin detalle")}</li>`).join("")}</ul>
      </section>`;
  }

  function renderHeader(result) {
    const state = statusInfo(result.status);
    const subject = result.subject;
    return `
      <section class="panel analysis-header" aria-labelledby="analysis-title">
        <div>
          <p class="eyebrow">Resultados del análisis</p>
          <h1 id="analysis-title">Resumen del consumo eléctrico</h1>
          <p>${utils.escapeHtml(state.description)}</p>
        </div>
        <span class="analysis-status analysis-status-${utils.escapeHtml(result.status)}">${utils.escapeHtml(state.label)}</span>
        <dl class="analysis-subject">
          <div><dt>Punto de medida</dt><dd class="mono">${utils.escapeHtml(subject.point)}</dd></div>
          <div><dt>Período analizado</dt><dd>${formatDay(subject.dateRange.startDay)} – ${formatDay(subject.dateRange.endDay)}</dd></div>
          <div><dt>Intervalo</dt><dd>${formatNumber(subject.intervalMinutes, 0)} minutos</dd></div>
        </dl>
      </section>`;
  }

  function renderMainMetrics(result) {
    const ae = measurement(result, "AE");
    const q1 = measurement(result, "Q1");
    const power = result.statistics && result.statistics.power ? result.statistics.power : null;
    const reliablePower = power ? power.reliable : null;
    return `
      <section class="panel" aria-labelledby="main-metrics-heading">
        <div class="section-heading">
          <div><p class="eyebrow">Datos confiables</p><h2 id="main-metrics-heading">Indicadores principales</h2></div>
        </div>
        <div class="kpi-grid analysis-kpi-grid">
          <article class="kpi-card kpi-accent">
            <span>AE acumulada</span>
            <strong>${formatMetric(ae && ae.reliableTotal, ae && ae.unit)}</strong>
            <small>Intervalos confiables disponibles</small>
          </article>
          <article class="kpi-card">
            <span>Q1 acumulada</span>
            <strong>${formatMetric(q1 && q1.reliableTotal, q1 && q1.unit)}</strong>
            <small>${result.capabilities.reactiveEnergy ? "Intervalos confiables disponibles" : "Magnitud no disponible"}</small>
          </article>
          <article class="kpi-card">
            <span>Potencia máxima</span>
            <strong>${formatMetric(reliablePower && reliablePower.max, power && power.unit)}</strong>
            <small>Máximo confiable calculado por el Motor</small>
          </article>
          <article class="kpi-card">
            <span>Potencia promedio</span>
            <strong>${formatMetric(reliablePower && reliablePower.mean, power && power.unit)}</strong>
            <small>Promedio confiable calculado por el Motor</small>
          </article>
        </div>
      </section>`;
  }

  function coverageRows(result) {
    const entries = result.coverage && result.coverage.measurements
      ? Object.entries(result.coverage.measurements)
      : [];
    return entries.map(([magnitude, item]) => `
      <tr>
        <td><span class="magnitude-name">${utils.escapeHtml(magnitude)}</span></td>
        <td>${formatNumber(item.observationCount, 0)}</td>
        <td>${formatNumber(item.expectedIntervalCount, 0)}</td>
        <td>${formatNumber(item.reliableIntervalCount, 0)}</td>
        <td>${formatNumber(item.missingIntervalCount, 0)}</td>
        <td>${formatNumber(item.ambiguousIntervalCount, 0)}</td>
        <td>${utils.formatPercentage(item.reliableCoveragePercentage)}</td>
      </tr>`).join("");
  }

  function renderCoverage(result) {
    return `
      <section class="panel" aria-labelledby="coverage-heading">
        <div class="section-heading">
          <div><p class="eyebrow">Cobertura</p><h2 id="coverage-heading">Registros y magnitudes disponibles</h2></div>
        </div>
        <div class="analysis-capabilities">
          <span class="${result.capabilities.activeEnergy ? "available" : "unavailable"}">AE · ${result.capabilities.activeEnergy ? "Disponible" : "No disponible"}</span>
          <span class="${result.capabilities.reactiveEnergy ? "available" : "unavailable"}">Q1 · ${result.capabilities.reactiveEnergy ? "Disponible" : "No disponible"}</span>
          <span class="${result.capabilities.intervalPowerDemand ? "available" : "unavailable"}">Potencia · ${result.capabilities.intervalPowerDemand ? "Disponible" : "No disponible"}</span>
        </div>
        <div class="table-scroll">
          <table class="analysis-table">
            <thead><tr><th>Magnitud</th><th>Observaciones</th><th>Esperados</th><th>Confiables</th><th>Faltantes</th><th>Ambiguos</th><th>Cobertura confiable</th></tr></thead>
            <tbody>${coverageRows(result)}</tbody>
          </table>
        </div>
        <p class="analysis-note">Las observaciones se muestran por magnitud. La interfaz no suma registros ni reconstruye totales generales.</p>
      </section>`;
  }

  function renderGaps(gaps) {
    if (!gaps.length) return '<p class="empty-note">No se informaron huecos.</p>';
    return `<ul class="analysis-fact-list">${gaps.map((gap) => `
      <li><strong>${utils.escapeHtml(gap.magnitude)}</strong><span>${formatNumber(gap.missingCount, 0)} faltantes</span><span>${utils.formatDateTime(gap.start)} – ${utils.formatDateTime(gap.end)}</span></li>`).join("")}</ul>`;
  }

  function renderDuplicates(duplicates) {
    if (!duplicates.length) return '<p class="empty-note">No se informaron duplicados.</p>';
    return `<ul class="analysis-fact-list">${duplicates.map((item) => `
      <li><strong>${utils.escapeHtml(item.magnitude)}</strong><span>${formatDay(item.day)} · período ${formatNumber(item.period, 0)}</span><span>${utils.escapeHtml(item.kind || "ambiguo")}</span></li>`).join("")}</ul>`;
  }

  function renderOriginChanges(changes) {
    if (!changes.length) return '<p class="empty-note">No se informaron cambios de origen.</p>';
    return `<ul class="analysis-fact-list">${changes.map((item) => `
      <li><strong>${utils.escapeHtml(item.from)} → ${utils.escapeHtml(item.to)}</strong><span>${utils.formatDateTime(item.previousIntervalEnd)} – ${utils.formatDateTime(item.nextIntervalStart)}</span></li>`).join("")}</ul>`;
  }

  function renderQuality(result) {
    const quality = result.quality || { gaps: [], duplicates: [], originChanges: [] };
    const gaps = Array.isArray(quality.gaps) ? quality.gaps : [];
    const duplicates = Array.isArray(quality.duplicates) ? quality.duplicates : [];
    const originChanges = Array.isArray(quality.originChanges) ? quality.originChanges : [];
    return `
      <section class="panel" aria-labelledby="dataset-quality-heading">
        <div class="section-heading"><div><p class="eyebrow">Calidad del dataset</p><h2 id="dataset-quality-heading">Hechos conservados por el análisis</h2></div></div>
        <div class="analysis-quality-grid">
          <article><h3>Registros faltantes</h3>${renderGaps(gaps)}</article>
          <article><h3>Duplicados y ambigüedades</h3>${renderDuplicates(duplicates)}</article>
          <article><h3>Cambios de origen</h3>${renderOriginChanges(originChanges)}</article>
        </div>
        ${quality.originChangesAreIndependentFromGaps ? '<p class="analysis-causality-note">Los cambios de origen y los huecos se muestran como hechos independientes. No se afirma una relación causal.</p>' : ""}
      </section>`;
  }

  function groupCondition(group) {
    const ae = group.measurements && group.measurements.AE;
    if (ae && ae.hasAmbiguity) return "Ambiguo";
    if (ae && ae.hasMissing) return "Incompleto";
    if (group.isBoundaryPartial) return "Período de frontera";
    return "Completo";
  }

  function aggregationRow(group, label) {
    const ae = group.measurements && group.measurements.AE;
    const q1 = group.measurements && group.measurements.Q1;
    const power = group.power;
    return `
      <tr>
        <td>${utils.escapeHtml(label)}</td>
        <td>${formatMetric(ae && ae.reliableTotal, ae && ae.unit)}</td>
        <td>${formatMetric(q1 && q1.reliableTotal, q1 && q1.unit)}</td>
        <td>${formatMetric(power && power.reliableStatistics.max, power && power.unit)}</td>
        <td>${formatMetric(power && power.reliableStatistics.mean, power && power.unit)}</td>
        <td>${ae ? utils.formatPercentage(ae.reliableCoveragePercentage) : "No disponible"}</td>
        <td>${utils.escapeHtml(groupCondition(group))}</td>
      </tr>`;
  }

  function aggregationTable(groups, type) {
    if (!groups.length) return '<p class="empty-note">No hay agregaciones disponibles.</p>';
    return `
      <div class="table-scroll ${type === "daily" ? "analysis-table-tall" : ""}">
        <table class="analysis-table">
          <thead><tr><th>${type === "daily" ? "Día" : "Período"}</th><th>AE confiable</th><th>Q1 confiable</th><th>Potencia máxima</th><th>Potencia promedio</th><th>Cobertura AE</th><th>Estado</th></tr></thead>
          <tbody>${groups.map((group) => aggregationRow(group, type === "daily" ? formatDay(group.key) : group.label)).join("")}</tbody>
        </table>
      </div>`;
  }

  function renderAggregations(result) {
    const aggregations = result.aggregations;
    return `
      <section class="panel" aria-labelledby="monthly-heading">
        <div class="section-heading"><div><p class="eyebrow">Resumen mensual</p><h2 id="monthly-heading">Meses calendario</h2></div></div>
        ${aggregationTable(aggregations.calendarMonthly || [], "monthly")}
      </section>
      <section class="panel" aria-labelledby="daily-heading">
        <div class="section-heading"><div><p class="eyebrow">Resumen diario</p><h2 id="daily-heading">Detalle por día</h2></div></div>
        ${aggregationTable(aggregations.daily || [], "daily")}
      </section>`;
  }

  function renderProfile(result) {
    const profile = result.aggregations.averageProfile96 || [];
    return `
      <section class="panel" aria-labelledby="profile-heading">
        <div class="section-heading"><div><p class="eyebrow">Perfil promedio</p><h2 id="profile-heading">96 períodos de 15 minutos</h2></div></div>
        <div class="table-scroll analysis-table-tall">
          <table class="analysis-table">
            <thead><tr><th>Período</th><th>Horario</th><th>AE promedio</th><th>Q1 promedio</th><th>Potencia promedio</th><th>Potencia máxima</th><th>Muestras</th></tr></thead>
            <tbody>${profile.map((item) => {
              const ae = item.measurements && item.measurements.AE;
              const q1 = item.measurements && item.measurements.Q1;
              return `<tr>
                <td>${formatNumber(item.period, 0)}</td>
                <td>${utils.escapeHtml(item.startTime)} – ${utils.escapeHtml(item.endTime)}</td>
                <td>${formatMetric(ae && ae.reliableStatistics.mean, ae && ae.unit)}</td>
                <td>${formatMetric(q1 && q1.reliableStatistics.mean, q1 && q1.unit)}</td>
                <td>${formatMetric(item.power && item.power.reliableStatistics.mean, item.power && item.power.unit)}</td>
                <td>${formatMetric(item.power && item.power.reliableStatistics.max, item.power && item.power.unit)}</td>
                <td>${formatNumber(item.sampleIntervalCount, 0)}</td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>
      </section>`;
  }

  function importerIssue(item) {
    return `
      <article class="analysis-warning-item">
        <strong>${utils.escapeHtml(item.title || item.code || "Advertencia")}</strong>
        <p>${utils.escapeHtml(item.message || "Sin detalle")}</p>
      </article>`;
  }

  function engineDiagnostic(item) {
    return `
      <article class="analysis-warning-item">
        <strong>${utils.escapeHtml(item.code || "DIAGNOSTIC")}</strong>
        <p>${utils.escapeHtml(item.message || "Sin detalle")}</p>
      </article>`;
  }

  function renderWarnings(result) {
    const inherited = result.quality && Array.isArray(result.quality.issues)
      ? result.quality.issues.filter((item) => item.severity === "warning" || item.severity === "blocking")
      : [];
    const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
    return `
      <section class="panel" aria-labelledby="warnings-heading">
        <div class="section-heading"><div><p class="eyebrow">Trazabilidad</p><h2 id="warnings-heading">Advertencias del análisis</h2></div></div>
        <div class="analysis-warning-grid">
          <article><h3>Heredadas del importador</h3><div class="analysis-warning-stack">${inherited.length ? inherited.map(importerIssue).join("") : '<p class="empty-note">Sin advertencias heredadas.</p>'}</div></article>
          <article><h3>Generadas por el Motor</h3><div class="analysis-warning-stack">${diagnostics.length ? diagnostics.map(engineDiagnostic).join("") : '<p class="empty-note">Sin diagnósticos del Motor.</p>'}</div></article>
        </div>
      </section>`;
  }

  function render(result, container) {
    if (!result || !container) return false;
    if (result.status === "invalid-input") {
      container.innerHTML = renderInvalid(result);
      return true;
    }
    container.innerHTML = [
      renderHeader(result),
      renderMainMetrics(result),
      renderCoverage(result),
      renderQuality(result),
      renderAggregations(result),
      renderProfile(result),
      renderWarnings(result)
    ].join("");
    return true;
  }

  app.resultsUI = Object.freeze({ render, formatNumber, formatMetric, formatDay, statusInfo });
})(globalThis);
