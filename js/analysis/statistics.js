(function defineAnalysisStatistics(root) {
  "use strict";

  const app = root.FileSimulator;
  app.analysis = app.analysis || {};

  function sum(values) {
    let total = 0;
    let correction = 0;
    values.forEach((value) => {
      const adjusted = value - correction;
      const next = total + adjusted;
      correction = (next - total) - adjusted;
      total = next;
    });
    return total;
  }

  function percentile(sorted, probability) {
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * probability;
    const lower = Math.floor(index);
    const fraction = index - lower;
    return sorted[lower + 1] === undefined
      ? sorted[lower]
      : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
  }

  function describe(input) {
    const values = input.filter(Number.isFinite);
    if (!values.length) {
      return { count: 0, sum: null, min: null, max: null, mean: null, median: null, p95: null, standardDeviationPopulation: null };
    }
    const sorted = [...values].sort((left, right) => left - right);
    const total = sum(values);
    const mean = total / values.length;
    const variance = sum(values.map((value) => (value - mean) ** 2)) / values.length;
    return {
      count: values.length,
      sum: total,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      standardDeviationPopulation: Math.sqrt(variance)
    };
  }

  function measurementSummary(intervals, magnitude, unit) {
    const measurements = intervals.map((interval) => interval.measurements[magnitude]).filter(Boolean);
    const allValues = measurements.flatMap((measurement) => measurement.observations.map((item) => item.value));
    const reliableValues = measurements.filter((measurement) => measurement.observationCount === 1).map((measurement) => measurement.value);
    const presentIntervalCount = measurements.filter((measurement) => !measurement.isMissing).length;
    const ambiguousIntervalCount = measurements.filter((measurement) => measurement.isAmbiguous).length;
    const missingIntervalCount = intervals.length - presentIntervalCount;
    return {
      magnitude,
      unit,
      expectedIntervalCount: intervals.length,
      observationCount: allValues.length,
      presentIntervalCount,
      reliableIntervalCount: reliableValues.length,
      missingIntervalCount,
      ambiguousIntervalCount,
      completenessPercentage: intervals.length ? (presentIntervalCount / intervals.length) * 100 : null,
      reliableCoveragePercentage: intervals.length ? (reliableValues.length / intervals.length) * 100 : null,
      observedTotal: allValues.length ? sum(allValues) : null,
      reliableTotal: reliableValues.length ? sum(reliableValues) : null,
      observedStatistics: describe(allValues),
      reliableStatistics: describe(reliableValues),
      hasMissing: missingIntervalCount > 0,
      hasAmbiguity: ambiguousIntervalCount > 0
    };
  }

  function powerSummary(intervals) {
    const allValues = intervals.flatMap((interval) => interval.power.observationsKW.map((item) => item.valueKW));
    const reliableValues = intervals.filter((interval) => interval.power.observationCount === 1).map((interval) => interval.power.valueKW);
    const presentIntervalCount = intervals.filter((interval) => !interval.power.isMissing).length;
    const ambiguousIntervalCount = intervals.filter((interval) => interval.power.isAmbiguous).length;
    return {
      unit: "kW",
      formula: "AE_KWH_X_4",
      expectedIntervalCount: intervals.length,
      observationCount: allValues.length,
      presentIntervalCount,
      reliableIntervalCount: reliableValues.length,
      missingIntervalCount: intervals.length - presentIntervalCount,
      ambiguousIntervalCount,
      completenessPercentage: intervals.length ? (presentIntervalCount / intervals.length) * 100 : null,
      reliableCoveragePercentage: intervals.length ? (reliableValues.length / intervals.length) * 100 : null,
      observedStatistics: describe(allValues),
      reliableStatistics: describe(reliableValues),
      hasMissing: presentIntervalCount < intervals.length,
      hasAmbiguity: ambiguousIntervalCount > 0
    };
  }

  app.analysis.statistics = Object.freeze({ sum, percentile, describe, measurementSummary, powerSummary });
})(globalThis);
