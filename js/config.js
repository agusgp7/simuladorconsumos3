(function defineConfiguration(root) {
  "use strict";

  const app = root.FileSimulator;

  app.config = Object.freeze({
    version: "0.2.0",
    supportedExtension: ".xlsx",
    measuresSheetName: "MEASURES",
    headerScanLimit: 100,
    issueExampleLimit: 5,
    previewSize: 5,
    periodsPerDay: 96,
    quarterHourCode: "QH",
    validResult: "VALID",
    knownMagnitudes: Object.freeze(["AE", "Q1"]),
    requiredHeaders: Object.freeze([
      "PUNTO MEDIDA",
      "FECHA-HORA",
      "PERIODO",
      "MAGNITUD",
      "INTERVALO",
      "VALOR",
      "ORIGEN",
      "RESULT VALIDACION"
    ])
  });
})(globalThis);
