(function defineQualityValidator(root) {
  "use strict";

  const app = root.FileSimulator;
  const { config, utils, parser } = app;

  class IssueCollector {
    constructor(initialIssues) {
      this.items = new Map();
      (initialIssues || []).forEach((issue) => this.items.set(issue.code, { ...issue, examples: [...issue.examples] }));
    }

    add(code, severity, title, message, example, increment = 1) {
      const current = this.items.get(code);
      if (current) {
        current.count += increment;
        if (example && current.examples.length < config.issueExampleLimit) current.examples.push(example);
        return;
      }
      this.items.set(code, {
        code, severity, title, message, count: increment, examples: example ? [example] : []
      });
    }

    list() {
      const weight = { blocking: 0, warning: 1, info: 2 };
      return [...this.items.values()].sort((left, right) =>
        weight[left.severity] - weight[right.severity] || left.title.localeCompare(right.title)
      );
    }
  }

  function emptySummary() {
    return {
      physicalRows: 0,
      blankRows: 0,
      dataRows: 0,
      validRows: 0,
      invalidRows: 0,
      points: [],
      intervalCodes: [],
      origins: [],
      validationResults: {},
      periodDistribution: {},
      magnitudes: [],
      overallCompletionPercentage: null,
      dateRange: null,
      gaps: [],
      duplicates: [],
      originChanges: [],
      zeroValues: 0,
      negativeValues: 0,
      outOfOrderRows: 0,
      period96Normalizations: 0
    };
  }

  function blockedAnalysis(file, issues, table) {
    const summary = emptySummary();
    if (table) {
      summary.physicalRows = table.physicalRowCount;
      summary.blankRows = table.blankRowCount;
      summary.dataRows = table.rows.length;
    }
    return {
      file,
      status: "blocked",
      canContinue: false,
      requiresAcknowledgement: false,
      sheet: table ? { name: table.sheetName, headerRowNumber: table.headerRowNumber, headers: table.headers } : null,
      summary,
      issues,
      records: [],
      preview: { first: [], last: [] }
    };
  }

  function recordKey(record) {
    return `${record.point}|${record.day}|${record.period}|${record.magnitude}`;
  }

  function rowExample(row, extra) {
    return { rowNumber: row.rowNumber, ...(extra || {}) };
  }

  function calculateDuplicates(records, issues) {
    const grouped = new Map();
    records.forEach((record) => {
      const key = recordKey(record);
      const group = grouped.get(key) || [];
      group.push(record);
      grouped.set(key, group);
    });

    const duplicates = [];
    grouped.forEach((group, key) => {
      if (group.length < 2) return;
      const values = group.map((record) => record.value);
      const kind = new Set(values).size === 1 ? "exact" : "conflicting";
      const duplicate = {
        key,
        point: group[0].point,
        day: group[0].day,
        period: group[0].period,
        magnitude: group[0].magnitude,
        rowNumbers: group.map((record) => record.rowNumber),
        values,
        kind
      };
      duplicates.push(duplicate);
      issues.add(
        kind === "exact" ? "DUPLICATE_EXACT" : "DUPLICATE_CONFLICTING",
        "warning",
        kind === "exact" ? "Registros duplicados" : "Duplicados con valores diferentes",
        "Los registros se conservaron sin cambios. Todos los valores existentes permanecen en el dataset.",
        {
          rowNumber: group[0].rowNumber,
          timestamp: group[0].sourceTimestamp,
          period: group[0].period,
          magnitude: group[0].magnitude,
          detail: `Filas ${duplicate.rowNumbers.join(", ")}`
        }
      );
    });
    return duplicates;
  }

  function calculateOriginChanges(records, issues) {
    const slots = new Map();
    records.forEach((record) => {
      if (!record.origin) return;
      const key = `${record.point}|${record.intervalStart}`;
      const slot = slots.get(key) || {
        point: record.point, start: record.intervalStart, end: record.intervalEnd, origins: new Set()
      };
      slot.origins.add(record.origin);
      slots.set(key, slot);
    });

    const ordered = [...slots.values()].sort((left, right) =>
      left.point.localeCompare(right.point) || left.start.localeCompare(right.start)
    );
    const changes = [];
    let previous = null;
    ordered.forEach((slot) => {
      if (slot.origins.size > 1) {
        issues.add(
          "ORIGIN_CONFLICT",
          "warning",
          "Más de un origen en el mismo intervalo",
          "Se conservaron los orígenes informados sin decidir cuál es correcto.",
          { timestamp: slot.start, detail: [...slot.origins].join(", ") }
        );
      }
      if (previous && previous.point === slot.point && previous.origins.size === 1 && slot.origins.size === 1) {
        const from = [...previous.origins][0];
        const to = [...slot.origins][0];
        if (from !== to) {
          const change = {
            point: slot.point,
            from,
            to,
            previousIntervalEnd: previous.end,
            nextIntervalStart: slot.start
          };
          changes.push(change);
          issues.add(
            `ORIGIN_CHANGED_${changes.length}`,
            "warning",
            `Cambio de origen ${from} → ${to}`,
            `El cambio se detectó entre ${previous.end} y ${slot.start}. Se informa junto con los huecos, sin afirmar causalidad.`,
            { timestamp: slot.start, detail: `${from} → ${to}` }
          );
        }
      }
      previous = slot;
    });
    return changes;
  }

  function calculateGaps(records, point, startDay, endDay, magnitude, issues) {
    const magnitudeRecords = records.filter((record) => record.point === point && record.magnitude === magnitude);
    const existing = new Set(magnitudeRecords.map((record) => `${record.day}|${record.period}`));
    const missing = [];
    const days = parser.daysInclusive(startDay, endDay);

    days.forEach((day) => {
      for (let period = 1; period <= config.periodsPerDay; period += 1) {
        if (!existing.has(`${day}|${period}`)) missing.push({ day, period, ordinal: parser.slotOrdinal(day, period) });
      }
    });

    const gaps = [];
    let startIndex = 0;
    while (startIndex < missing.length) {
      let endIndex = startIndex;
      while (endIndex + 1 < missing.length && missing[endIndex + 1].ordinal === missing[endIndex].ordinal + 1) endIndex += 1;
      const first = parser.intervalForPeriod(missing[startIndex].day, missing[startIndex].period);
      const last = parser.intervalForPeriod(missing[endIndex].day, missing[endIndex].period);
      if (first && last) {
        const gap = {
          point,
          magnitude,
          missingCount: endIndex - startIndex + 1,
          start: first.start,
          end: last.end
        };
        gaps.push(gap);
        issues.add(
          `GAP_${magnitude}_${gaps.length}`,
          "warning",
          `Faltan ${gap.missingCount} registros ${magnitude}`,
          `Hueco entre ${gap.start} y ${gap.end}. FileSimulator no completó ni inventó valores.`,
          { timestamp: gap.start, magnitude, detail: `${gap.missingCount} intervalos` }
        );
      }
      startIndex = endIndex + 1;
    }

    return { gaps, uniqueIntervals: existing.size, expectedIntervals: days.length * config.periodsPerDay };
  }

  async function analyzeTable(table, file, initialIssues, onProgress) {
    const issues = new IssueCollector(initialIssues);
    const records = [];
    const points = new Set();
    const intervalCodes = new Set();
    const origins = new Set();
    const validationResults = new Map();
    const rawMagnitudeCounts = new Map();
    const lastStartBySeries = new Map();
    const periodDistribution = new Map();
    let zeroValues = 0;
    let negativeValues = 0;
    let outOfOrderRows = 0;
    let period96Normalizations = 0;

    if (table.rows.length === 0) {
      issues.add("NO_DATA_ROWS", "blocking", "No hay filas de datos", "La hoja detectada no contiene registros utilizables.");
    }

    for (let index = 0; index < table.rows.length; index += 1) {
      const row = table.rows[index];
      const point = utils.text(row.values["PUNTO MEDIDA"]);
      const period = utils.integerPeriod(row.values.PERIODO);
      const magnitude = utils.normalizedText(row.values.MAGNITUD);
      const intervalCode = utils.normalizedText(row.values.INTERVALO);
      const value = utils.finiteNumber(row.values.VALOR);
      const origin = utils.text(row.values.ORIGEN);
      const validationResult = utils.normalizedText(row.values["RESULT VALIDACION"]);
      const timestamp = parser.parseDateTime(row.timestampValue);

      if (point) points.add(point);
      if (intervalCode) intervalCodes.add(intervalCode);
      if (origin) origins.add(origin);
      if (magnitude) rawMagnitudeCounts.set(magnitude, (rawMagnitudeCounts.get(magnitude) || 0) + 1);
      const validationKey = validationResult || "(VACÍO)";
      validationResults.set(validationKey, (validationResults.get(validationKey) || 0) + 1);

      let rowValid = true;
      if (!point) {
        rowValid = false;
        issues.add("ROW_MISSING_POINT", "warning", "Punto de medida vacío", "La fila se excluyó del dataset.", rowExample(row));
      }
      if (!timestamp) {
        rowValid = false;
        issues.add("ROW_INVALID_DATE", "warning", "Fecha u hora inválida", "La fila se excluyó porque FECHA-HORA no pudo interpretarse.", rowExample(row, { value: row.values["FECHA-HORA"] }));
      }
      if (period === null) {
        rowValid = false;
        issues.add("ROW_INVALID_PERIOD", "warning", "Período inválido", "PERIODO debe ser un entero entre 1 y 96. La fila se excluyó.", rowExample(row, { value: row.values.PERIODO }));
      }
      if (!magnitude) {
        rowValid = false;
        issues.add("ROW_MISSING_MAGNITUDE", "warning", "Magnitud vacía", "La fila se excluyó del dataset.", rowExample(row));
      }
      if (value === null) {
        rowValid = false;
        issues.add("ROW_NON_NUMERIC_VALUE", "warning", "Valor no numérico", "La fila se excluyó porque VALOR no es un número finito.", rowExample(row, { value: row.values.VALOR, magnitude }));
      }
      if (intervalCode !== config.quarterHourCode) {
        rowValid = false;
        issues.add("UNSUPPORTED_INTERVAL", "blocking", "Intervalo no soportado", "La primera versión solamente admite INTERVALO = QH.", rowExample(row, { value: row.values.INTERVALO }));
      }
      if (validationResult !== config.validResult) {
        rowValid = false;
        issues.add("ROW_NOT_VALIDATED", "warning", "Lectura no validada por el medidor", "Solamente RESULT VALIDACION = VALID entra al dataset. La fila se conservó en el informe.", rowExample(row, { value: row.values["RESULT VALIDACION"], magnitude }));
      }
      if (timestamp && period !== null) {
        const expected = parser.expectedSourceTime(period);
        if (expected !== parser.timePart(timestamp)) {
          rowValid = false;
          issues.add("TIMESTAMP_PERIOD_MISMATCH", "warning", "FECHA-HORA no coincide con PERIODO", "La fila se excluyó sin corregir el timestamp ni el período.", rowExample(row, {
            timestamp: parser.formatDateTime(timestamp), period, detail: `Hora esperada ${expected}`
          }));
        }
      }

      if (rowValid && timestamp && period !== null && value !== null) {
        const day = parser.formatDay(timestamp);
        const interval = parser.intervalForPeriod(day, period);
        const knownMagnitude = config.knownMagnitudes.includes(magnitude);
        if (!knownMagnitude) {
          issues.add("UNKNOWN_MAGNITUDE", "warning", "Magnitud desconocida", "La magnitud se conserva, pero no se interpreta como AE o Q1.", rowExample(row, { magnitude }));
        }
        if (value < 0) {
          negativeValues += 1;
          issues.add("NEGATIVE_VALUE", "warning", "Valor negativo", "El valor se conservó sin corregir. Revisalo antes de continuar.", rowExample(row, { magnitude, value }));
        }
        if (value === 0) zeroValues += 1;
        if (period === config.periodsPerDay) period96Normalizations += 1;

        const record = {
          rowNumber: row.rowNumber,
          point,
          day,
          period,
          magnitude,
          knownMagnitude,
          intervalCode,
          value,
          origin,
          validationResult,
          sourceTimestamp: parser.formatDateTime(timestamp),
          intervalStart: interval.start,
          intervalEnd: interval.end
        };
        const distribution = periodDistribution.get(magnitude) || Array.from({ length: config.periodsPerDay }, () => 0);
        distribution[period - 1] += 1;
        periodDistribution.set(magnitude, distribution);

        const seriesKey = `${point}|${magnitude}`;
        const previousStart = lastStartBySeries.get(seriesKey);
        if (previousStart && record.intervalStart < previousStart) {
          outOfOrderRows += 1;
          issues.add("OUT_OF_ORDER", "warning", "Registros fuera de orden", "El dataset normalizado se ordenó cronológicamente sin alterar los valores.", {
            rowNumber: row.rowNumber, timestamp: record.sourceTimestamp, magnitude
          });
        }
        lastStartBySeries.set(seriesKey, record.intervalStart);
        records.push(record);
      }

      if (index > 0 && index % 4000 === 0) {
        if (onProgress) onProgress({ stage: "normalizing", message: "Normalizando y validando registros…", percentage: 55 + Math.round((index / table.rows.length) * 25) });
        await utils.yieldToBrowser();
      }
    }

    if (points.size > 1) {
      issues.add("MULTIPLE_POINTS", "blocking", "Más de un punto de medida", `Se detectaron ${points.size} puntos. La primera versión admite uno por importación.`, { detail: [...points].join(", ") });
    }

    const validAe = records.filter((record) => record.magnitude === "AE");
    if (validAe.length === 0) issues.add("NO_VALID_AE", "blocking", "No hay registros AE utilizables", "Se necesita al menos una lectura AE con estado VALID.");
    const validQ1 = records.filter((record) => record.magnitude === "Q1");
    if (validQ1.length === 0) issues.add("Q1_MISSING", "warning", "No hay registros Q1 utilizables", "Podés continuar con consumo, pero las funciones de reactiva quedarán deshabilitadas.");

    records.sort((left, right) =>
      left.intervalStart.localeCompare(right.intervalStart) ||
      left.point.localeCompare(right.point) ||
      left.period - right.period ||
      left.magnitude.localeCompare(right.magnitude) ||
      left.rowNumber - right.rowNumber
    );

    if (onProgress) onProgress({ stage: "quality", message: "Comprobando huecos, duplicados y cambios de origen…", percentage: 84 });
    await utils.yieldToBrowser();
    const duplicates = calculateDuplicates(records, issues);
    const originChanges = calculateOriginChanges(records, issues);
    const primaryRecords = validAe.length ? validAe : records;
    const sortedPrimary = [...primaryRecords].sort((left, right) => left.intervalStart.localeCompare(right.intervalStart));
    const first = sortedPrimary[0];
    const last = sortedPrimary[sortedPrimary.length - 1];
    const point = [...points][0] || "";
    const gaps = [];
    const magnitudeSummaries = [];
    let overallCompletionPercentage = null;
    let dateRange = null;

    if (first && last && point) {
      const days = parser.daysInclusive(first.day, last.day);
      dateRange = {
        sourceStart: first.sourceTimestamp,
        sourceEnd: last.sourceTimestamp,
        normalizedStart: `${first.day}T00:00:00`,
        normalizedEnd: parser.intervalForPeriod(last.day, config.periodsPerDay).end,
        dayCount: days.length
      };

      config.knownMagnitudes.forEach((magnitude) => {
        const magnitudeRows = records.filter((record) => record.magnitude === magnitude);
        if (!magnitudeRows.length) {
          magnitudeSummaries.push({
            magnitude, totalRows: rawMagnitudeCounts.get(magnitude) || 0, validRows: 0,
            uniqueIntervals: 0, expectedIntervals: null, completionPercentage: null, known: true
          });
          return;
        }
        const result = calculateGaps(records, point, first.day, last.day, magnitude, issues);
        gaps.push(...result.gaps);
        const completion = Math.min(100, (result.uniqueIntervals / result.expectedIntervals) * 100);
        magnitudeSummaries.push({
          magnitude,
          totalRows: rawMagnitudeCounts.get(magnitude) || 0,
          validRows: magnitudeRows.length,
          uniqueIntervals: result.uniqueIntervals,
          expectedIntervals: result.expectedIntervals,
          completionPercentage: completion,
          known: true
        });
        if (magnitude === "AE") overallCompletionPercentage = completion;
      });
    }

    rawMagnitudeCounts.forEach((totalRows, magnitude) => {
      if (config.knownMagnitudes.includes(magnitude)) return;
      const magnitudeRows = records.filter((record) => record.magnitude === magnitude);
      magnitudeSummaries.push({
        magnitude,
        totalRows,
        validRows: magnitudeRows.length,
        uniqueIntervals: new Set(magnitudeRows.map(recordKey)).size,
        expectedIntervals: null,
        completionPercentage: null,
        known: false
      });
    });

    if (zeroValues > 0) issues.add("ZERO_VALUES", "info", "Valores cero conservados", `Se encontraron ${zeroValues} valores cero válidos. No se modificaron.`, null, zeroValues);
    if (period96Normalizations > 0) issues.add("PERIOD_96_NORMALIZED", "info", "Cierre diario normalizado", `${period96Normalizations} registros con PERIODO 96 conservaron 23:59 como origen y se normalizaron a 23:45–24:00.`, null, period96Normalizations);
    issues.add("FILE_INSPECTED", "info", "Archivo inspeccionado localmente", `Se leyó la hoja ${table.sheetName} sin enviar el archivo a ningún servidor.`);

    const issueList = issues.list();
    const hasBlocking = issueList.some((issue) => issue.severity === "blocking");
    const hasWarnings = issueList.some((issue) => issue.severity === "warning");
    const canContinue = !hasBlocking && validAe.length > 0;

    return {
      file,
      status: hasBlocking ? "blocked" : hasWarnings ? "ready-with-warnings" : "ready",
      canContinue,
      requiresAcknowledgement: canContinue && hasWarnings,
      sheet: { name: table.sheetName, headerRowNumber: table.headerRowNumber, headers: table.headers },
      summary: {
        physicalRows: table.physicalRowCount,
        blankRows: table.blankRowCount,
        dataRows: table.rows.length,
        validRows: records.length,
        invalidRows: table.rows.length - records.length,
        points: [...points].sort(),
        intervalCodes: [...intervalCodes].sort(),
        origins: [...origins].sort(),
        validationResults: Object.fromEntries([...validationResults.entries()].sort()),
        periodDistribution: Object.fromEntries([...periodDistribution.entries()].sort()),
        magnitudes: magnitudeSummaries,
        overallCompletionPercentage,
        dateRange,
        gaps,
        duplicates,
        originChanges,
        zeroValues,
        negativeValues,
        outOfOrderRows,
        period96Normalizations
      },
      issues: issueList,
      records,
      preview: { first: records.slice(0, config.previewSize), last: records.slice(-config.previewSize) }
    };
  }

  app.validator = Object.freeze({ analyzeTable, blockedAnalysis });
})(globalThis);
