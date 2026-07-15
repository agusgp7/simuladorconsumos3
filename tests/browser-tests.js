(function runBrowserTests(root) {
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

  function equal(actual, expected) {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  async function unitTests() {
    const p1 = app.parser.intervalForPeriod("2025-06-01", 1);
    report(unitResults, "PERIODO 1 representa 00:00–00:15", equal(p1, {
      start: "2025-06-01T00:00:00", end: "2025-06-01T00:15:00"
    }));

    const p96 = app.parser.intervalForPeriod("2025-06-01", 96);
    report(unitResults, "PERIODO 96 normaliza 23:45–24:00", equal(p96, {
      start: "2025-06-01T23:45:00", end: "2025-06-02T00:00:00"
    }));
    report(unitResults, "23:59 es la marca esperada del PERIODO 96", app.parser.expectedSourceTime(96) === "23:59:00");

    const rows = Array.from({ length: 96 }, (_, index) => {
      const period = index + 1;
      const interval = app.parser.intervalForPeriod("2025-06-01", period);
      const sourceTimestamp = period === 96 ? "2025-06-01T23:59:00" : interval.end;
      return {
        rowNumber: index + 2,
        timestampValue: sourceTimestamp,
        values: {
          "PUNTO MEDIDA": "1001",
          "FECHA-HORA": sourceTimestamp,
          PERIODO: period,
          MAGNITUD: "AE",
          INTERVALO: "QH",
          VALOR: 1.25,
          ORIGEN: "PRIME",
          "RESULT VALIDACION": "VALID"
        }
      };
    });
    const table = {
      sheetName: "Measures",
      headerRowNumber: 1,
      headers: [...app.config.requiredHeaders],
      rows,
      physicalRowCount: rows.length,
      blankRowCount: 0
    };
    const analysis = await app.validator.analyzeTable(table, { name: "unit.xlsx", size: 1, extension: ".xlsx" });
    report(unitResults, "AE completa puede continuar sin Q1", analysis.canContinue && analysis.summary.overallCompletionPercentage === 100);
    report(unitResults, "Q1 ausente produce advertencia y no bloquea", analysis.issues.some((issue) => issue.code === "Q1_MISSING") && analysis.status === "ready-with-warnings");
  }

  function checkHotel(analysis) {
    const ae = analysis.summary.magnitudes.find((item) => item.magnitude === "AE");
    const q1 = analysis.summary.magnitudes.find((item) => item.magnitude === "Q1");
    const aeGap = analysis.summary.gaps.find((item) => item.magnitude === "AE");
    const q1Gap = analysis.summary.gaps.find((item) => item.magnitude === "Q1");
    const change = analysis.summary.originChanges[0];

    report(hotelResults, "Hoja Measures y 69.848 filas", analysis.sheet && analysis.sheet.name === "Measures" && analysis.summary.dataRows === 69848);
    report(hotelResults, "34.924 AE de 35.040 esperados", ae && ae.validRows === 34924 && ae.expectedIntervals === 35040);
    report(hotelResults, "34.924 Q1 de 35.040 esperados", q1 && q1.validRows === 34924 && q1.expectedIntervals === 35040);
    report(hotelResults, "116 registros AE faltantes", aeGap && aeGap.missingCount === 116);
    report(hotelResults, "116 registros Q1 faltantes", q1Gap && q1Gap.missingCount === 116);
    report(hotelResults, "Hueco exacto 09/09/2025 07:00–10/09/2025 12:00", aeGap && q1Gap && aeGap.start === "2025-09-09T07:00:00" && aeGap.end === "2025-09-10T12:00:00" && q1Gap.start === aeGap.start && q1Gap.end === aeGap.end);
    report(hotelResults, "Cambio PRIME → KAIFA informado por separado", change && change.from === "PRIME" && change.to === "KAIFA" && change.previousIntervalEnd === "2025-09-09T07:00:00" && change.nextIntervalStart === "2025-09-10T12:00:00");
    report(hotelResults, "Sin duplicados", analysis.summary.duplicates.length === 0);
    report(hotelResults, "El archivo puede continuar con advertencias", analysis.canContinue && analysis.requiresAcknowledgement);
  }

  document.getElementById("hotel-run").addEventListener("click", async () => {
    hotelResults.innerHTML = "";
    const file = document.getElementById("hotel-file").files[0];
    if (!file) {
      report(hotelResults, "Seleccionar el archivo Hotel La Esmeralda", false);
      return;
    }
    try {
      const analysis = await app.importer.processFile(file);
      checkHotel(analysis);
    } catch (error) {
      report(hotelResults, "Procesar el archivo real", false, "el navegador informó un error");
    }
  });

  unitTests();
})(globalThis);
