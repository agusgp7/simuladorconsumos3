(function runResultsTests(root) {
  "use strict";

  const app = root.FileSimulator;
  const unitResults = document.getElementById("unit-results");
  const hotelResults = document.getElementById("hotel-results");

  function report(list, label, passed, detail) {
    const item = document.createElement("li");
    item.className = passed ? "pass" : "fail";
    item.textContent = `${passed ? "✓" : "×"} ${label}${detail ? ` — ${detail}` : ""}`;
    list.appendChild(item);
  }

  function summary(magnitude, unit, values) {
    return {
      magnitude,
      unit,
      expectedIntervalCount: values.expected,
      observationCount: values.observations,
      presentIntervalCount: values.present,
      reliableIntervalCount: values.reliable,
      missingIntervalCount: values.missing,
      ambiguousIntervalCount: values.ambiguous,
      completenessPercentage: values.completeness,
      reliableCoveragePercentage: values.coverage,
      observedTotal: values.total,
      reliableTotal: values.total,
      observedStatistics: values.statistics,
      reliableStatistics: values.statistics,
      hasMissing: values.missing > 0,
      hasAmbiguity: values.ambiguous > 0
    };
  }

  function fixture() {
    const aeStats = { count: 101, sum: 12345.67, min: 1, max: 50, mean: 12.34, median: 10, p95: 40, standardDeviationPopulation: 5 };
    const q1Stats = { count: 202, sum: 2345.67, min: 0.1, max: 8, mean: 2.34, median: 2, p95: 6, standardDeviationPopulation: 1 };
    const powerStats = { count: 101, sum: 49382.68, min: 4, max: 987.654, mean: 321.123, median: 40, p95: 160, standardDeviationPopulation: 20 };
    const ae = summary("AE", "kWh", { expected: 110, observations: 101, present: 101, reliable: 101, missing: 9, ambiguous: 0, completeness: 91.818, coverage: 91.818, total: 12345.67, statistics: aeStats });
    const q1 = summary("Q1", "kvarh", { expected: 220, observations: 202, present: 202, reliable: 202, missing: 18, ambiguous: 0, completeness: 91.818, coverage: 91.818, total: 2345.67, statistics: q1Stats });
    const power = {
      unit: "kW", formula: "AE_KWH_X_4", expectedIntervalCount: 110, observationCount: 101,
      presentIntervalCount: 101, reliableIntervalCount: 101, missingIntervalCount: 9,
      ambiguousIntervalCount: 0, completenessPercentage: 91.818, reliableCoveragePercentage: 91.818,
      observedStatistics: powerStats, reliableStatistics: powerStats, hasMissing: true, hasAmbiguity: false
    };
    const group = {
      key: "2025-06-01", label: "2025-06", fullPeriodStartDay: "2025-06-01", fullPeriodEndDay: "2025-06-30",
      rangeStart: "2025-06-01T00:00:00", rangeEnd: "2025-06-02T00:00:00",
      expectedIntervalsFullPeriod: 2880, expectedIntervalsInDatasetRange: 96, isBoundaryPartial: true,
      measurements: { AE: ae, Q1: q1 }, power
    };
    const profile = {
      period: 1, startTime: "00:00:00", endTime: "00:15:00", sampleIntervalCount: 77,
      measurements: { AE: ae, Q1: q1 }, power
    };
    const result = {
      meta: { schemaVersion: "AnalysisResult/1.0", engineVersion: "1.0.0", datasetSchemaVersion: "NormalizedDataset/1.0", generatedAt: "2026-07-15T00:00:00.000Z" },
      status: "partial",
      subject: { point: "SENTINEL-POINT", intervalMinutes: 15, periodsPerDay: 96, dateRange: { startDay: "2025-06-01", endDay: "2025-06-30" }, units: { activeEnergy: "kWh", reactiveEnergy: "kvarh", powerDemand: "kW" } },
      capabilities: { activeEnergy: true, reactiveEnergy: true, intervalPowerDemand: true, calendarAggregation: true, billingAggregation: true, tariffSimulation: false },
      coverage: { measurements: { AE: ae, Q1: q1 }, power },
      totals: { measurements: { AE: { unit: "kWh", reliableTotal: 12345.67, observedTotal: 12345.67, observationCount: 101, reliableIntervalCount: 101, ambiguousIntervalCount: 0 }, Q1: { unit: "kvarh", reliableTotal: 2345.67, observedTotal: 2345.67, observationCount: 202, reliableIntervalCount: 202, ambiguousIntervalCount: 0 } } },
      statistics: { measurements: { AE: { unit: "kWh", observed: aeStats, reliable: aeStats }, Q1: { unit: "kvarh", observed: q1Stats, reliable: q1Stats } }, power: { unit: "kW", formula: "AE_KWH_X_4", observed: powerStats, reliable: powerStats } },
      aggregations: { daily: [group], calendarMonthly: [group], billingPeriods: [group], byDayOfWeek: [], averageProfile96: [profile], weekdayProfile96: [], weekendProfile96: [] },
      quality: {
        importerStatus: "ready-with-warnings",
        issues: [{ code: "IMPORT_SENTINEL", severity: "warning", title: "Advertencia heredada centinela", message: "Mensaje exacto del importador", count: 1, examples: [] }],
        gaps: [{ point: "SENTINEL-POINT", magnitude: "AE", missingCount: 9, start: "2025-06-03T01:00:00", end: "2025-06-03T03:15:00" }],
        duplicates: [], originChanges: [{ point: "SENTINEL-POINT", from: "PRIME", to: "KAIFA", previousIntervalEnd: "2025-06-03T01:00:00", nextIntervalStart: "2025-06-03T03:15:00" }],
        causalRelationships: [], originChangesAreIndependentFromGaps: true
      },
      diagnostics: [{ code: "MOTOR_SENTINEL", severity: "warning", message: "Mensaje exacto del Motor" }]
    };
    Object.defineProperty(result, "intervalSeries", {
      enumerable: true,
      get() { throw new Error("La presentación no debe acceder a intervalSeries"); }
    });
    Object.defineProperty(result, "config", {
      enumerable: true,
      get() { throw new Error("La presentación no debe exponer una configuración de facturación no confirmada"); }
    });
    return Object.freeze(result);
  }

  function runUnitTests() {
    const result = fixture();
    const container = document.getElementById("analysis-results-content");
    let rendered = false;
    try {
      rendered = app.resultsUI.render(result, container);
    } catch (error) {
      report(unitResults, "No accede a intervalSeries", false, error.message);
      return;
    }
    const text = container.textContent;
    report(unitResults, "Renderiza un AnalysisResult válido", rendered && text.includes("SENTINEL-POINT"));
    report(unitResults, "No accede a intervalSeries ni reconstruye estadísticas", true);
    report(unitResults, "Muestra AE confiable recibida", text.includes(app.resultsUI.formatMetric(12345.67, "kWh")));
    report(unitResults, "Muestra Q1 confiable recibida", text.includes(app.resultsUI.formatMetric(2345.67, "kvarh")));
    report(unitResults, "Muestra potencia máxima y promedio recibidas", text.includes(app.resultsUI.formatMetric(987.654, "kW")) && text.includes(app.resultsUI.formatMetric(321.123, "kW")));
    report(unitResults, "Muestra registros por magnitud sin total general", text.includes(app.resultsUI.formatNumber(101, 0)) && text.includes(app.resultsUI.formatNumber(202, 0)) && !text.includes("303 observaciones"));
    report(unitResults, "Separa advertencias del importador y del Motor", text.includes("Advertencia heredada centinela") && text.includes("MOTOR_SENTINEL"));
    report(unitResults, "Mantiene huecos y cambios de origen sin causalidad", text.includes("PRIME → KAIFA") && text.includes("No se afirma una relación causal"));
    report(unitResults, "No accede ni muestra una configuración de facturación", !text.includes("facturación") && !text.includes("ciclo") && !container.querySelector("input, select"));

    const shown = app.resultsController.show(result);
    report(unitResults, "El controlador conserva exactamente el mismo AnalysisResult", shown && app.resultsController.getCurrentResult() === result);
    app.resultsController.clear();

    const nullMetric = app.resultsUI.formatMetric(null, "kvarh");
    report(unitResults, "Un valor ausente se muestra como No disponible", nullMetric === "No disponible");
  }

  function checkHotel(importResult, result, container) {
    const text = container.textContent;
    const ae = result.coverage.measurements.AE;
    const q1 = result.coverage.measurements.Q1;
    report(hotelResults, "Flujo completo produce AnalysisResult/1.0", result.meta.schemaVersion === "AnalysisResult/1.0");
    report(hotelResults, "No muestra un ciclo de facturación supuesto", !text.includes("Inicio de facturación") && !text.includes("Día 3"));
    report(hotelResults, "Muestra el punto 7714990921", text.includes(result.subject.point) && result.subject.point === "7714990921");
    report(hotelResults, "Muestra 34.924 observaciones AE", ae.observationCount === 34924 && text.includes(app.resultsUI.formatNumber(ae.observationCount, 0)));
    report(hotelResults, "Muestra 34.924 observaciones Q1", q1.observationCount === 34924 && text.includes(app.resultsUI.formatNumber(q1.observationCount, 0)));
    report(hotelResults, "Conserva los 116 faltantes por magnitud", ae.missingIntervalCount === 116 && q1.missingIntervalCount === 116);
    report(hotelResults, "Muestra PRIME → KAIFA sin causalidad", text.includes("PRIME → KAIFA") && text.includes("No se afirma una relación causal"));
    report(hotelResults, "Presenta 12 meses, 365 días y 96 períodos", result.aggregations.calendarMonthly.length === 12 && result.aggregations.daily.length === 365 && result.aggregations.averageProfile96.length === 96);
    report(hotelResults, "Las advertencias heredadas siguen disponibles", importResult.issues.some((item) => item.severity === "warning") && result.quality.issues.length === importResult.issues.length);
  }

  document.getElementById("hotel-run").addEventListener("click", async () => {
    hotelResults.innerHTML = "";
    const file = document.getElementById("hotel-file").files[0];
    if (!file) {
      report(hotelResults, "Seleccionar Hotel La Esmeralda", false);
      return;
    }
    try {
      const importResult = await app.importer.processFile(file);
      const dataset = app.analysis.fromImportAnalysis(importResult);
      const result = app.analysis.analyze(dataset, { billingCycleStartDay: 1 });
      const container = document.getElementById("analysis-results-content");
      app.resultsUI.render(result, container);
      checkHotel(importResult, result, container);
    } catch (error) {
      report(hotelResults, "Completar la integración", false, error.message || "error inesperado");
    }
  });

  runUnitTests();
})(globalThis);
