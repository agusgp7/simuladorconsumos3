(function defineAnalysisContract(root) {
  "use strict";

  const app = root.FileSimulator;
  app.analysis = app.analysis || {};

  const DATASET_SCHEMA = "NormalizedDataset/1.0";
  const RESULT_SCHEMA = "AnalysisResult/1.0";
  const ENGINE_VERSION = "1.0.0";
  const MIN_BILLING_CYCLE_START_DAY = 1;
  const MAX_BILLING_CYCLE_START_DAY = 28;

  function diagnostic(code, message, path) {
    return { code, severity: "error", message, path: path || null };
  }

  function dayFromTimestamp(value) {
    const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T/);
    return match ? match[1] : null;
  }

  function validDay(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    return probe.getUTCFullYear() === year && probe.getUTCMonth() + 1 === month && probe.getUTCDate() === day;
  }

  function deriveDateRange(records, importedRange) {
    const days = records.map((record) => record.day).filter(Boolean).sort();
    if (!days.length) return null;
    const startDay = dayFromTimestamp(importedRange && importedRange.normalizedStart) || days[0];
    const importedEndExclusive = importedRange && importedRange.normalizedEnd;
    const importedLastDay = importedEndExclusive ? app.parser.addDays(dayFromTimestamp(importedEndExclusive), -1) : null;
    const endDay = importedLastDay || days[days.length - 1];
    return {
      startDay,
      endDay,
      start: `${startDay}T00:00:00`,
      endExclusive: app.parser.intervalForPeriod(endDay, app.config.periodsPerDay).end,
      dayCount: app.parser.daysInclusive(startDay, endDay).length
    };
  }

  function fromImportAnalysis(importAnalysis) {
    const source = importAnalysis || {};
    const records = Array.isArray(source.records) ? source.records.map((record) => ({ ...record })) : [];
    const summary = source.summary || {};
    const points = Array.isArray(summary.points) ? summary.points : [];
    const point = points[0] || (records[0] && records[0].point) || "";
    return {
      schemaVersion: DATASET_SCHEMA,
      point,
      intervalMinutes: 15,
      periodsPerDay: 96,
      dateRange: deriveDateRange(records, summary.dateRange),
      magnitudes: [...new Set(records.map((record) => record.magnitude))].sort(),
      records,
      quality: {
        importerStatus: source.status || null,
        issues: Array.isArray(source.issues) ? source.issues.map((issue) => ({ ...issue })) : [],
        gaps: Array.isArray(summary.gaps) ? summary.gaps.map((gap) => ({ ...gap })) : [],
        duplicates: Array.isArray(summary.duplicates) ? summary.duplicates.map((item) => ({ ...item })) : [],
        originChanges: Array.isArray(summary.originChanges) ? summary.originChanges.map((item) => ({ ...item })) : []
      },
      source: source.file ? { name: source.file.name || null } : null
    };
  }

  function validateDataset(dataset, options) {
    const errors = [];
    const billingCycleStartDay = options && options.billingCycleStartDay;
    if (!dataset || typeof dataset !== "object") {
      return [diagnostic("DATASET_REQUIRED", "Se requiere un dataset normalizado.", "dataset")];
    }
    if (dataset.schemaVersion !== DATASET_SCHEMA) {
      errors.push(diagnostic("DATASET_SCHEMA_UNSUPPORTED", `Se esperaba ${DATASET_SCHEMA}.`, "schemaVersion"));
    }
    if (dataset.intervalMinutes !== 15 || dataset.periodsPerDay !== 96) {
      errors.push(diagnostic("INTERVAL_UNSUPPORTED", "AnalysisResult v1 requiere 96 intervalos diarios de 15 minutos.", "intervalMinutes"));
    }
    if (!Number.isInteger(billingCycleStartDay) || billingCycleStartDay < MIN_BILLING_CYCLE_START_DAY || billingCycleStartDay > MAX_BILLING_CYCLE_START_DAY) {
      errors.push(diagnostic("BILLING_START_DAY_INVALID", "billingCycleStartDay debe ser un entero entre 1 y 28.", "options.billingCycleStartDay"));
    }
    if (!dataset.point) errors.push(diagnostic("POINT_REQUIRED", "Falta el punto de medida.", "point"));
    if (!dataset.dateRange || !dataset.dateRange.startDay || !dataset.dateRange.endDay) {
      errors.push(diagnostic("DATE_RANGE_REQUIRED", "Falta el rango normalizado del dataset.", "dateRange"));
    } else if (!validDay(dataset.dateRange.startDay) || !validDay(dataset.dateRange.endDay) || dataset.dateRange.startDay > dataset.dateRange.endDay) {
      errors.push(diagnostic("DATE_RANGE_INVALID", "El rango normalizado no contiene días válidos y ordenados.", "dateRange"));
    }
    if (!Array.isArray(dataset.records) || dataset.records.length === 0) {
      errors.push(diagnostic("RECORDS_REQUIRED", "El dataset no contiene registros normalizados.", "records"));
      return errors;
    }

    let aeCount = 0;
    dataset.records.forEach((record, index) => {
      const path = `records[${index}]`;
      if (!record || typeof record !== "object") {
        errors.push(diagnostic("RECORD_INVALID", "El registro no es un objeto.", path));
        return;
      }
      if (record.point !== dataset.point) errors.push(diagnostic("POINT_MISMATCH", "El registro pertenece a otro punto de medida.", `${path}.point`));
      const dayIsValid = validDay(record.day);
      const periodIsValid = Number.isInteger(record.period) && record.period >= 1 && record.period <= 96;
      if (!dayIsValid) errors.push(diagnostic("DAY_INVALID", "El día normalizado no es válido.", `${path}.day`));
      if (!periodIsValid) errors.push(diagnostic("PERIOD_INVALID", "El período debe estar entre 1 y 96.", `${path}.period`));
      if (!record.magnitude) errors.push(diagnostic("MAGNITUDE_REQUIRED", "Falta la magnitud.", `${path}.magnitude`));
      if (!Number.isFinite(record.value)) errors.push(diagnostic("VALUE_INVALID", "El valor debe ser un número finito.", `${path}.value`));
      if (dayIsValid && dataset.dateRange && (record.day < dataset.dateRange.startDay || record.day > dataset.dateRange.endDay)) {
        errors.push(diagnostic("RECORD_OUTSIDE_RANGE", "El registro queda fuera del rango normalizado.", `${path}.day`));
      }
      if (dayIsValid && periodIsValid) {
        const expected = app.parser.intervalForPeriod(record.day, record.period);
        if (record.intervalStart && record.intervalStart !== expected.start) errors.push(diagnostic("INTERVAL_START_MISMATCH", "intervalStart no coincide con el día y período normalizados.", `${path}.intervalStart`));
        if (record.intervalEnd && record.intervalEnd !== expected.end) errors.push(diagnostic("INTERVAL_END_MISMATCH", "intervalEnd no coincide con el día y período normalizados.", `${path}.intervalEnd`));
      }
      if (record.magnitude === "AE") aeCount += 1;
    });
    if (aeCount === 0) errors.push(diagnostic("AE_REQUIRED", "Se necesita al menos un registro AE para analizar consumo y potencia.", "records"));
    return errors;
  }

  Object.assign(app.analysis, {
    contract: Object.freeze({
      DATASET_SCHEMA,
      RESULT_SCHEMA,
      ENGINE_VERSION,
      MIN_BILLING_CYCLE_START_DAY,
      MAX_BILLING_CYCLE_START_DAY,
      fromImportAnalysis,
      validateDataset
    })
  });
})(globalThis);
