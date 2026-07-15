(function runAnalysisTests(root) {
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

  function record(point, day, period, magnitude, value, rowNumber) {
    const interval = app.parser.intervalForPeriod(day, period);
    return {
      rowNumber,
      point,
      day,
      period,
      magnitude,
      knownMagnitude: true,
      intervalCode: "QH",
      value,
      origin: "TEST",
      validationResult: "VALID",
      sourceTimestamp: period === 96 ? `${day}T23:59:00` : interval.end,
      intervalStart: interval.start,
      intervalEnd: interval.end
    };
  }

  function dataset(startDay, endDay) {
    const records = [];
    let rowNumber = 2;
    app.parser.daysInclusive(startDay, endDay).forEach((day) => {
      for (let period = 1; period <= 96; period += 1) {
        records.push(record("TEST-1", day, period, "AE", period / 100, rowNumber++));
        records.push(record("TEST-1", day, period, "Q1", period / 200, rowNumber++));
      }
    });
    return {
      schemaVersion: app.analysis.contract.DATASET_SCHEMA,
      point: "TEST-1",
      intervalMinutes: 15,
      periodsPerDay: 96,
      dateRange: {
        startDay,
        endDay,
        start: `${startDay}T00:00:00`,
        endExclusive: app.parser.intervalForPeriod(endDay, 96).end,
        dayCount: app.parser.daysInclusive(startDay, endDay).length
      },
      magnitudes: ["AE", "Q1"],
      records,
      quality: { issues: [], gaps: [], duplicates: [], originChanges: [] }
    };
  }

  function runUnitTests() {
    const completeDataset = dataset("2025-06-02", "2025-06-03");
    const complete = app.analysis.analyze(completeDataset, { billingCycleStartDay: 3 });
    report(unitResults, "Devuelve AnalysisResult/1.0", complete.meta.schemaVersion === "AnalysisResult/1.0");
    report(unitResults, "Dos días generan exactamente 192 intervalos", complete.intervalSeries.length === 192);
    report(unitResults, "AE y Q1 completos producen estado complete", complete.status === "complete");
    report(unitResults, "La potencia canónica usa AE × 4", complete.intervalSeries[0].power.valueKW === complete.intervalSeries[0].measurements.AE.value * 4);
    report(unitResults, "Genera agregaciones diarias y mensuales", complete.aggregations.daily.length === 2 && complete.aggregations.calendarMonthly.length === 1);

    const missingDataset = dataset("2025-06-02", "2025-06-03");
    missingDataset.records = missingDataset.records.filter((item) => !(item.day === "2025-06-02" && item.period === 10 && item.magnitude === "AE"));
    const partial = app.analysis.analyze(missingDataset, { billingCycleStartDay: 3 });
    const missingSlot = partial.intervalSeries.find((item) => item.day === "2025-06-02" && item.period === 10);
    report(unitResults, "Un AE faltante se conserva como hueco", partial.status === "partial" && partial.coverage.measurements.AE.missingIntervalCount === 1);
    report(unitResults, "No inventa energía ni potencia para un hueco", missingSlot.measurements.AE.value === null && missingSlot.power.valueKW === null);

    const duplicateDataset = dataset("2025-06-02", "2025-06-03");
    duplicateDataset.records.push(record("TEST-1", "2025-06-02", 1, "AE", 9.5, 9999));
    const ambiguous = app.analysis.analyze(duplicateDataset, { billingCycleStartDay: 3 });
    const duplicateSlot = ambiguous.intervalSeries[0];
    report(unitResults, "Conserva todas las observaciones duplicadas", duplicateSlot.measurements.AE.observations.length === 2 && duplicateSlot.power.observationsKW.length === 2);
    report(unitResults, "El duplicado deja energía y potencia canónicas nulas", ambiguous.status === "ambiguous" && duplicateSlot.measurements.AE.value === null && duplicateSlot.power.valueKW === null);
    report(unitResults, "Separa el total observado del total confiable", ambiguous.totals.measurements.AE.observedTotal !== ambiguous.totals.measurements.AE.reliableTotal && ambiguous.coverage.measurements.AE.ambiguousIntervalCount === 1);

    const billingDataset = dataset("2025-06-02", "2025-06-03");
    const billing = app.analysis.analyze(billingDataset, { billingCycleStartDay: 3 });
    report(unitResults, "El ciclo configurable separa 02/06 de 03/06", billing.aggregations.billingPeriods.length === 2 && billing.aggregations.billingPeriods[0].fullPeriodStartDay === "2025-05-03" && billing.aggregations.billingPeriods[1].fullPeriodStartDay === "2025-06-03");
    const invalidConfig = app.analysis.analyze(billingDataset, { billingCycleStartDay: 31 });
    report(unitResults, "Rechaza un inicio de facturación fuera de 1–28", invalidConfig.status === "invalid-input" && invalidConfig.diagnostics.some((item) => item.code === "BILLING_START_DAY_INVALID"));
  }

  function checkHotel(importResult, result) {
    const aeGap = importResult.summary.gaps.find((item) => item.magnitude === "AE");
    const q1Gap = importResult.summary.gaps.find((item) => item.magnitude === "Q1");
    const change = result.quality.originChanges[0];
    report(hotelResults, "Motor recibe NormalizedDataset/1.0", result.meta.datasetSchemaVersion === "NormalizedDataset/1.0");
    report(hotelResults, "Período 01/06/2025–31/05/2026", result.subject.dateRange.startDay === "2025-06-01" && result.subject.dateRange.endDay === "2026-05-31");
    report(hotelResults, "35.040 intervalos esperados", result.intervalSeries.length === 35040);
    report(hotelResults, "34.924 AE y 116 faltantes", result.coverage.measurements.AE.observationCount === 34924 && result.coverage.measurements.AE.missingIntervalCount === 116);
    report(hotelResults, "34.924 Q1 y 116 faltantes", result.coverage.measurements.Q1.observationCount === 34924 && result.coverage.measurements.Q1.missingIntervalCount === 116);
    report(hotelResults, "Hueco exacto 09/09/2025 07:00–10/09/2025 12:00", aeGap && q1Gap && aeGap.start === "2025-09-09T07:00:00" && aeGap.end === "2025-09-10T12:00:00" && q1Gap.start === aeGap.start && q1Gap.end === aeGap.end);
    report(hotelResults, "Cambio PRIME → KAIFA conservado como hecho independiente", change && change.from === "PRIME" && change.to === "KAIFA" && result.quality.causalRelationships.length === 0 && result.quality.originChangesAreIndependentFromGaps);
    report(hotelResults, "12 meses calendario y 13 ciclos con inicio día 3", result.aggregations.calendarMonthly.length === 12 && result.aggregations.billingPeriods.length === 13);
    report(hotelResults, "La potencia se calcula con AE × 4", result.intervalSeries.find((item) => item.measurements.AE.value !== null).power.valueKW === result.intervalSeries.find((item) => item.measurements.AE.value !== null).measurements.AE.value * 4);
  }

  document.getElementById("hotel-run").addEventListener("click", async () => {
    hotelResults.innerHTML = "";
    const file = document.getElementById("hotel-file").files[0];
    if (!file) {
      report(hotelResults, "Seleccionar el archivo Hotel La Esmeralda", false);
      return;
    }
    try {
      const imported = await app.importer.processFile(file);
      const normalized = app.analysis.fromImportAnalysis(imported);
      const result = app.analysis.analyze(normalized, { billingCycleStartDay: 3 });
      checkHotel(imported, result);
    } catch (error) {
      report(hotelResults, "Completar la integración", false, error.message || "error inesperado");
    }
  });

  runUnitTests();
})(globalThis);
