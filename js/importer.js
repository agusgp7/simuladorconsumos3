(function defineWorkbookImporter(root) {
  "use strict";

  const app = root.FileSimulator;
  const { config, utils, parser, validator } = app;

  function blockingIssue(code, title, message) {
    return { code, severity: "blocking", title, message, count: 1, examples: [] };
  }

  function metadata(name, size) {
    return { name, size, extension: utils.fileExtension(name) };
  }

  function detectTable(workbook) {
    const matchingSheets = workbook.SheetNames.filter((name) => utils.normalizedText(name) === config.measuresSheetName);
    if (matchingSheets.length === 0) {
      return { table: null, issues: [blockingIssue("SHEET_NOT_FOUND", "No encontramos la hoja Measures", "El libro debe contener una hoja llamada Measures.")] };
    }
    if (matchingSheets.length > 1) {
      return { table: null, issues: [blockingIssue("SHEET_AMBIGUOUS", "Hay más de una hoja Measures", "No es seguro elegir una hoja automáticamente.")] };
    }

    const sheetName = matchingSheets[0];
    const sheet = workbook.Sheets[sheetName];
    const matrix = root.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true
    });
    if (!matrix.length) {
      return { table: null, issues: [blockingIssue("EMPTY_SHEET", "La hoja Measures está vacía", "No hay encabezados ni datos para importar.")] };
    }

    const scanLimit = Math.min(matrix.length, config.headerScanLimit);
    let headerIndex = -1;
    let bestIndex = 0;
    let bestMatches = -1;
    for (let index = 0; index < scanLimit; index += 1) {
      const normalized = matrix[index].map(utils.normalizedText);
      const matches = config.requiredHeaders.filter((header) => normalized.includes(header)).length;
      if (matches > bestMatches) {
        bestMatches = matches;
        bestIndex = index;
      }
      if (matches === config.requiredHeaders.length) {
        headerIndex = index;
        break;
      }
    }

    if (headerIndex < 0) {
      const normalized = matrix[bestIndex].map(utils.normalizedText);
      const missing = config.requiredHeaders.filter((header) => !normalized.includes(header));
      return {
        table: null,
        issues: [blockingIssue(
          "HEADER_MISSING",
          "Faltan columnas obligatorias",
          missing.length ? `No encontramos: ${missing.join(", ")}.` : "No encontramos un encabezado compatible en las primeras 100 filas."
        )]
      };
    }

    const rawHeaders = matrix[headerIndex].map((value) => utils.text(value));
    const normalizedHeaders = rawHeaders.map(utils.normalizedText);
    const duplicated = config.requiredHeaders.filter((header) => normalizedHeaders.filter((value) => value === header).length > 1);
    if (duplicated.length) {
      return {
        table: null,
        issues: [blockingIssue("HEADER_DUPLICATE", "Hay encabezados obligatorios duplicados", `No es seguro elegir entre las columnas: ${duplicated.join(", ")}.`)]
      };
    }

    const indexes = Object.fromEntries(config.requiredHeaders.map((header) => [header, normalizedHeaders.indexOf(header)]));
    const rows = [];
    let blankRowCount = 0;
    for (let index = headerIndex + 1; index < matrix.length; index += 1) {
      const row = matrix[index];
      if (row.every((value) => value === null || value === undefined || utils.text(value) === "")) {
        blankRowCount += 1;
        continue;
      }
      const values = Object.fromEntries(config.requiredHeaders.map((header) => [header, row[indexes[header]]]));
      rows.push({
        rowNumber: index + 1,
        values,
        timestampValue: parser.decodeExcelDate(values["FECHA-HORA"])
      });
    }

    return {
      table: {
        sheetName,
        headerRowNumber: headerIndex + 1,
        headers: rawHeaders.filter(Boolean),
        rows,
        physicalRowCount: matrix.length - headerIndex - 1,
        blankRowCount
      },
      issues: []
    };
  }

  async function processBuffer(buffer, name, size, onProgress) {
    const file = metadata(name, size);
    const initialIssues = [];
    if (!root.XLSX) initialIssues.push(blockingIssue("LIBRARY_UNAVAILABLE", "No pudimos iniciar el lector de Excel", "Falta la biblioteca local necesaria para abrir archivos XLSX."));
    if (file.extension !== config.supportedExtension) initialIssues.push(blockingIssue("UNSUPPORTED_FILE", "Formato no admitido", "La primera versión admite únicamente archivos .xlsx."));
    if (!size || !buffer.byteLength) initialIssues.push(blockingIssue("EMPTY_FILE", "El archivo está vacío", "Seleccioná un archivo Excel con datos."));
    if (initialIssues.length) return validator.blockedAnalysis(file, initialIssues);

    try {
      if (onProgress) onProgress({ stage: "reading", message: "Abriendo el libro Excel…", percentage: 20 });
      await utils.yieldToBrowser();
      const workbook = root.XLSX.read(buffer, { type: "array", cellDates: false, dense: true });
      if (onProgress) onProgress({ stage: "detecting", message: "Buscando la hoja Measures y sus columnas…", percentage: 42 });
      await utils.yieldToBrowser();
      const detection = detectTable(workbook);
      if (!detection.table) return validator.blockedAnalysis(file, detection.issues);
      if (onProgress) onProgress({ stage: "normalizing", message: "Normalizando fechas, períodos, magnitudes y valores…", percentage: 55 });
      await utils.yieldToBrowser();
      const analysis = await validator.analyzeTable(detection.table, file, detection.issues, onProgress);
      if (onProgress) onProgress({ stage: "complete", message: "Archivo procesado", percentage: 100 });
      return analysis;
    } catch (error) {
      return validator.blockedAnalysis(file, [blockingIssue(
        "WORKBOOK_READ_ERROR",
        "No pudimos abrir el Excel",
        "El archivo puede estar dañado, cifrado o no ser un XLSX válido."
      )]);
    }
  }

  async function processFile(file, onProgress) {
    if (onProgress) onProgress({ stage: "reading", message: "Leyendo el archivo en este navegador…", percentage: 8 });
    const buffer = await file.arrayBuffer();
    return processBuffer(buffer, file.name, file.size, onProgress);
  }

  app.importer = Object.freeze({ processBuffer, processFile, detectTable });
})(globalThis);
