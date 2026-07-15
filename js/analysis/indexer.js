(function defineAnalysisIndexer(root) {
  "use strict";

  const app = root.FileSimulator;
  app.analysis = app.analysis || {};

  const UNITS = Object.freeze({ AE: "kWh", Q1: "kvarh" });
  const DAY_NAMES = Object.freeze(["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]);

  function slotKey(point, day, period) {
    return `${point}|${day}|${period}`;
  }

  function temporalAttributes(day) {
    const [year, month, date] = day.split("-").map(Number);
    const jsDay = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    return {
      dayOfWeek: isoDay,
      dayOfWeekName: DAY_NAMES[jsDay],
      dayType: isoDay >= 6 ? "weekend" : "weekday"
    };
  }

  function emptyMeasurement(magnitude) {
    return {
      magnitude,
      unit: UNITS[magnitude] || null,
      observations: [],
      observationCount: 0,
      value: null,
      isMissing: true,
      isAmbiguous: false
    };
  }

  function finalizeMeasurement(measurement) {
    const count = measurement.observations.length;
    measurement.observationCount = count;
    measurement.isMissing = count === 0;
    measurement.isAmbiguous = count > 1;
    measurement.value = count === 1 ? measurement.observations[0].value : null;
    return measurement;
  }

  function buildIntervalSeries(dataset) {
    const magnitudes = [...new Set(["AE", "Q1", ...(dataset.magnitudes || []), ...dataset.records.map((record) => record.magnitude)])];
    const slots = [];
    const byKey = new Map();

    app.parser.daysInclusive(dataset.dateRange.startDay, dataset.dateRange.endDay).forEach((day) => {
      const temporal = temporalAttributes(day);
      for (let period = 1; period <= 96; period += 1) {
        const interval = app.parser.intervalForPeriod(day, period);
        const measurements = {};
        magnitudes.forEach((magnitude) => { measurements[magnitude] = emptyMeasurement(magnitude); });
        const slot = {
          key: slotKey(dataset.point, day, period),
          point: dataset.point,
          day,
          period,
          intervalStart: interval.start,
          intervalEnd: interval.end,
          ...temporal,
          measurements,
          power: null,
          isAmbiguous: false,
          isReliable: false
        };
        slots.push(slot);
        byKey.set(slot.key, slot);
      }
    });

    dataset.records.forEach((record) => {
      const slot = byKey.get(slotKey(record.point, record.day, record.period));
      if (!slot) return;
      if (!slot.measurements[record.magnitude]) slot.measurements[record.magnitude] = emptyMeasurement(record.magnitude);
      slot.measurements[record.magnitude].observations.push({
        value: record.value,
        rowNumber: record.rowNumber == null ? null : record.rowNumber,
        sourceTimestamp: record.sourceTimestamp || null,
        origin: record.origin || null,
        validationResult: record.validationResult || null
      });
    });

    slots.forEach((slot) => {
      Object.values(slot.measurements).forEach(finalizeMeasurement);
      const ae = slot.measurements.AE;
      const observationsKW = ae.observations.map((observation) => ({
        valueKW: observation.value * 4,
        sourceRowNumber: observation.rowNumber
      }));
      slot.power = {
        unit: "kW",
        formula: "AE_KWH_X_4",
        observationsKW,
        observationCount: observationsKW.length,
        valueKW: observationsKW.length === 1 ? observationsKW[0].valueKW : null,
        isMissing: observationsKW.length === 0,
        isAmbiguous: observationsKW.length > 1
      };
      slot.isAmbiguous = Object.values(slot.measurements).some((measurement) => measurement.isAmbiguous);
      slot.isReliable = !slot.isAmbiguous && !ae.isMissing;
    });

    return { intervals: slots, magnitudes };
  }

  app.analysis.indexer = Object.freeze({ UNITS, slotKey, buildIntervalSeries });
})(globalThis);
