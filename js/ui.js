(function defineUserInterface(root) {
  "use strict";

  const app = root.FileSimulator;
  const { utils } = app;
  const byId = (id) => document.getElementById(id);

  const elements = {
    upload: byId("upload-view"),
    processing: byId("processing-view"),
    result: byId("result-view"),
    accepted: byId("accepted-view"),
    fatal: byId("fatal-error"),
    processingMessage: byId("processing-message"),
    processingFile: byId("processing-file"),
    progressBar: byId("progress-bar"),
    progressTrack: document.querySelector(".progress-track"),
    progressLabel: byId("progress-label"),
    fileSummary: byId("file-summary"),
    qualitySummary: byId("quality-summary"),
    dataPreview: byId("data-preview"),
    issuesList: byId("issues-list"),
    acknowledgement: byId("acknowledgement-area"),
    continueButton: byId("continue-button"),
    acceptedMessage: byId("accepted-message"),
    fatalMessage: byId("fatal-error-message")
  };

  function showView(name) {
    ["upload", "processing", "result", "accepted", "fatal"].forEach((view) => {
      elements[view].hidden = view !== name;
    });
  }

  function showProcessing(file) {
    showView("processing");
    elements.processingFile.innerHTML = `<strong>${utils.escapeHtml(file.name)}</strong> · ${utils.formatBytes(file.size)}`;
    setProgress({ message: "Preparando el archivo…", percentage: 3 });
  }

  function setProgress(progress) {
    const percentage = Math.max(0, Math.min(100, Number(progress.percentage) || 0));
    elements.processingMessage.textContent = progress.message;
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressTrack.setAttribute("aria-valuenow", String(percentage));
    elements.progressLabel.textContent = `${percentage} %`;
  }

  function statusLabel(status) {
    if (status === "blocked") return "Bloqueado";
    if (status === "ready-with-warnings") return "Utilizable con advertencias";
    return "Listo";
  }

  function renderFileSummary(analysis) {
    const sheet = analysis.sheet;
    elements.fileSummary.innerHTML = `
      <section class="file-card" aria-labelledby="file-heading">
        <span class="file-icon" aria-hidden="true">XLSX</span>
        <div class="file-details">
          <p class="eyebrow">Archivo procesado localmente</p>
          <h2 id="file-heading">${utils.escapeHtml(analysis.file.name)}</h2>
          <div class="file-meta">
            <span>${utils.formatBytes(analysis.file.size)}</span>
            <span>Hoja: ${utils.escapeHtml(sheet ? sheet.name : "No detectada")}</span>
            <span>Encabezado: ${sheet ? `fila ${sheet.headerRowNumber}` : "—"}</span>
          </div>
        </div>
        <span class="status-badge status-${analysis.status}">${statusLabel(analysis.status)}</span>
      </section>`;
  }

  function magnitudeRows(summary) {
    if (!summary.magnitudes.length) return '<p class="empty-note">No se detectaron magnitudes.</p>';
    return summary.magnitudes.map((magnitude) => `
      <div class="magnitude-row">
        <span class="magnitude-name">${utils.escapeHtml(magnitude.magnitude)}</span>
        <span>${utils.formatInteger(magnitude.validRows)} válidos</span>
        <strong>${utils.formatPercentage(magnitude.completionPercentage)}</strong>
      </div>`).join("");
  }

  function renderQualitySummary(analysis) {
    const summary = analysis.summary;
    const blocking = analysis.issues.filter((issue) => issue.severity === "blocking").length;
    const warnings = analysis.issues.filter((issue) => issue.severity === "warning").length;
    const missing = summary.gaps.reduce((total, gap) => total + gap.missingCount, 0);
    const range = summary.dateRange;

    elements.qualitySummary.innerHTML = `
      <section class="panel" aria-labelledby="quality-heading">
        <div class="section-heading">
          <div><p class="eyebrow">Resumen de calidad</p><h2 id="quality-heading">Qué encontró FileSimulator</h2></div>
          <div class="severity-summary"><span class="severity-error">${blocking} bloqueantes</span><span class="severity-warning">${warnings} advertencias</span></div>
        </div>
        <div class="kpi-grid">
          <article class="kpi-card kpi-accent"><span>Completitud AE</span><strong>${utils.formatPercentage(summary.overallCompletionPercentage)}</strong><small>Intervalos únicos sobre los esperados</small></article>
          <article class="kpi-card"><span>Registros válidos</span><strong>${utils.formatInteger(summary.validRows)}</strong><small>de ${utils.formatInteger(summary.dataRows)} filas detectadas</small></article>
          <article class="kpi-card"><span>Puntos de medida</span><strong>${summary.points.length}</strong><small class="mono">${utils.escapeHtml(summary.points.join(", ") || "No disponible")}</small></article>
          <article class="kpi-card"><span>Faltantes</span><strong>${utils.formatInteger(missing)}</strong><small>Suma por todas las magnitudes</small></article>
        </div>
        <div class="detail-grid">
          <article class="detail-panel">
            <h3>Período detectado</h3>
            <dl>
              <div><dt>Primera FECHA-HORA</dt><dd>${utils.formatDateTime(range && range.sourceStart)}</dd></div>
              <div><dt>Última FECHA-HORA</dt><dd>${utils.formatDateTime(range && range.sourceEnd)}</dd></div>
              <div><dt>Rango normalizado</dt><dd>${range ? `${utils.formatDateTime(range.normalizedStart)} – ${utils.formatDateTime(range.normalizedEnd)}` : "—"}</dd></div>
              <div><dt>Días comprendidos</dt><dd>${range ? range.dayCount : "—"}</dd></div>
            </dl>
          </article>
          <article class="detail-panel"><h3>Magnitudes</h3>${magnitudeRows(summary)}</article>
          <article class="detail-panel">
            <h3>Procedencia</h3>
            <dl>
              <div><dt>Intervalos</dt><dd>${utils.escapeHtml(summary.intervalCodes.join(", ") || "—")}</dd></div>
              <div><dt>Orígenes</dt><dd>${utils.escapeHtml(summary.origins.join(" → ") || "—")}</dd></div>
              <div><dt>Cambios de origen</dt><dd>${summary.originChanges.length}</dd></div>
            </dl>
          </article>
          <article class="detail-panel">
            <h3>Integridad</h3>
            <dl>
              <div><dt>Filas físicas</dt><dd>${utils.formatInteger(summary.physicalRows)}</dd></div>
              <div><dt>Filas vacías ignoradas</dt><dd>${utils.formatInteger(summary.blankRows)}</dd></div>
              <div><dt>Filas descartadas</dt><dd>${utils.formatInteger(summary.invalidRows)}</dd></div>
              <div><dt>Duplicados</dt><dd>${summary.duplicates.length}</dd></div>
              <div><dt>Valores negativos</dt><dd>${summary.negativeValues}</dd></div>
              <div><dt>Valores cero</dt><dd>${summary.zeroValues}</dd></div>
            </dl>
          </article>
        </div>
      </section>`;
  }

  function recordsTable(records, title) {
    if (!records.length) return "";
    return `
      <div class="preview-block">
        <h3>${title}</h3>
        <div class="table-scroll"><table class="preview-table">
          <thead><tr><th>Fila</th><th>Punto</th><th>FECHA-HORA</th><th>Período</th><th>Magnitud</th><th>Valor</th><th>Origen</th><th>Intervalo normalizado</th></tr></thead>
          <tbody>${records.map((record) => `
            <tr>
              <td>${record.rowNumber}</td><td class="mono">${utils.escapeHtml(record.point)}</td>
              <td>${utils.formatDateTime(record.sourceTimestamp)}</td><td>${record.period}</td>
              <td>${utils.escapeHtml(record.magnitude)}</td><td>${utils.escapeHtml(record.value.toLocaleString("es-UY"))}</td>
              <td>${utils.escapeHtml(record.origin || "—")}</td>
              <td>${utils.formatDateTime(record.intervalStart)} – ${utils.formatDateTime(record.intervalEnd)}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>`;
  }

  function periodDistribution(summary) {
    const entries = Object.entries(summary.periodDistribution);
    if (!entries.length) return "";
    return `
      <details class="period-distribution">
        <summary>Ver distribución por PERIODO (1–96)</summary>
        <div class="period-grid">${entries.map(([magnitude, counts]) => `
          <div><h3>${utils.escapeHtml(magnitude)}</h3><ol>${counts.map((count, index) => `<li><span>${index + 1}</span><strong>${utils.formatInteger(count)}</strong></li>`).join("")}</ol></div>`).join("")}</div>
      </details>`;
  }

  function renderDataPreview(analysis) {
    const validations = Object.entries(analysis.summary.validationResults)
      .map(([value, count]) => `${utils.escapeHtml(value)}: ${utils.formatInteger(count)}`).join(" · ") || "—";
    const headers = analysis.sheet ? analysis.sheet.headers.map(utils.escapeHtml).join(" · ") : "—";
    elements.dataPreview.innerHTML = `
      <section class="panel" aria-labelledby="preview-heading">
        <div class="section-heading"><div><p class="eyebrow">Estructura y muestra</p><h2 id="preview-heading">Datos detectados</h2></div></div>
        <div class="detected-facts">
          <div><span>Encabezados</span><strong>${headers}</strong></div>
          <div><span>RESULT VALIDACION</span><strong>${validations}</strong></div>
        </div>
        ${recordsTable(analysis.preview.first, "Primeros registros válidos")}
        ${recordsTable(analysis.preview.last, "Últimos registros válidos")}
        ${periodDistribution(analysis.summary)}
      </section>`;
  }

  const severityLabels = { blocking: "Errores bloqueantes", warning: "Advertencias", info: "Información" };
  const severityIcons = { blocking: "×", warning: "!", info: "i" };

  function exampleText(example) {
    const parts = [example.rowNumber ? `Fila ${example.rowNumber}` : "Evento"];
    if (example.timestamp) parts.push(utils.formatDateTime(example.timestamp));
    if (example.magnitude) parts.push(example.magnitude);
    if (example.value !== undefined) parts.push(`Valor: ${String(example.value)}`);
    if (example.detail) parts.push(example.detail);
    return utils.escapeHtml(parts.join(" · "));
  }

  function renderIssues(issues) {
    const groups = ["blocking", "warning", "info"].map((severity) => {
      const matching = issues.filter((issue) => issue.severity === severity);
      if (!matching.length) return "";
      return `
        <div class="issue-group" data-severity="${severity}">
          <h3>${severityLabels[severity]}</h3>
          <div class="issue-stack">${matching.map((issue) => `
            <article class="issue-card issue-${severity}">
              <span class="issue-icon" aria-hidden="true">${severityIcons[severity]}</span>
              <div class="issue-copy">
                <div class="issue-title-row"><h4>${utils.escapeHtml(issue.title)}</h4>${issue.count > 1 ? `<span class="count-pill">${utils.formatInteger(issue.count)}</span>` : ""}</div>
                <p>${utils.escapeHtml(issue.message)}</p>
                ${issue.examples.length ? `<details><summary>Ver ejemplos</summary><ul>${issue.examples.map((example) => `<li>${exampleText(example)}</li>`).join("")}</ul></details>` : ""}
              </div>
            </article>`).join("")}</div>
        </div>`;
    }).join("");

    elements.issuesList.innerHTML = `
      <section class="panel" aria-labelledby="issues-heading">
        <div class="section-heading">
          <div><p class="eyebrow">Diagnóstico</p><h2 id="issues-heading">Advertencias y errores</h2></div>
          <div class="issue-heading-actions"><span>${issues.length} tipos detectados</span>
            <label>Mostrar <select id="issue-filter"><option value="all">Todo</option><option value="blocking">Bloqueantes</option><option value="warning">Advertencias</option><option value="info">Información</option></select></label>
          </div>
        </div>${groups || '<p class="empty-note">No se detectaron problemas.</p>'}
      </section>`;

    const filter = byId("issue-filter");
    if (filter) filter.addEventListener("change", () => {
      elements.issuesList.querySelectorAll("[data-severity]").forEach((group) => {
        group.hidden = filter.value !== "all" && group.dataset.severity !== filter.value;
      });
    });
  }

  function renderAcknowledgement(analysis) {
    if (analysis.requiresAcknowledgement) {
      elements.acknowledgement.innerHTML = `
        <label class="acknowledgement"><input id="warnings-accepted" type="checkbox"><span>Revisé las advertencias y acepto continuar con los datos existentes.</span></label>`;
    } else if (!analysis.canContinue) {
      elements.acknowledgement.innerHTML = '<p class="blocking-note">Corregí los errores bloqueantes antes de continuar.</p>';
    } else {
      elements.acknowledgement.innerHTML = '<p class="ready-note">El archivo contiene los datos mínimos utilizables.</p>';
    }
  }

  function renderAnalysis(analysis) {
    renderFileSummary(analysis);
    renderQualitySummary(analysis);
    renderDataPreview(analysis);
    renderIssues(analysis.issues);
    renderAcknowledgement(analysis);
    elements.continueButton.disabled = true;
    showView("result");
  }

  function setContinueEnabled(enabled) {
    elements.continueButton.disabled = !enabled;
  }

  function showAccepted(analysis) {
    elements.acceptedMessage.textContent = `Se prepararon ${utils.formatInteger(analysis.summary.validRows)} registros válidos. En esta etapa todavía no se calculan consumos, potencia ni tarifas.`;
    showView("accepted");
  }

  function showFatal(message) {
    elements.fatalMessage.textContent = message;
    showView("fatal");
  }

  app.ui = Object.freeze({
    elements,
    showView,
    showProcessing,
    setProgress,
    renderAnalysis,
    setContinueEnabled,
    showAccepted,
    showFatal
  });
})(globalThis);
