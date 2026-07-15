(function defineAnalysisEngine(root) {
  "use strict";

  const app = root.FileSimulator;
  app.analysis = app.analysis || {};

  function invalidResult(dataset, options, diagnostics) {
    return {
      meta: {
        schemaVersion: app.analysis.contract.RESULT_SCHEMA,
        engineVersion: app.analysis.contract.ENGINE_VERSION,
        datasetSchemaVersion: dataset && dataset.schemaVersion ? dataset.schemaVersion : null,
        generatedAt: new Date().toISOString()
      },
      status: "invalid-input",
      config: { billingCycleStartDay: options && options.billingCycleStartDay || null },
      subject: null,
      capabilities: {
        activeEnergy: false,
        reactiveEnergy: false,
        intervalPowerDemand: false,
        calendarAggregation: false,
        billingAggregation: false,
        tariffSimulation: false
      },
      coverage: null,
      intervalSeries: [],
      totals: null,
      statistics: null,
      aggregations: null,
      quality: null,
      diagnostics
    };
  }

  function coverageFrom(summary) {
    return {
      unit: summary.unit,
      expectedIntervalCount: summary.expectedIntervalCount,
      observationCount: summary.observationCount,
      presentIntervalCount: summary.presentIntervalCount,
      reliableIntervalCount: summary.reliableIntervalCount,
      missingIntervalCount: summary.missingIntervalCount,
      ambiguousIntervalCount: summary.ambiguousIntervalCount,
      completenessPercentage: summary.completenessPercentage,
      reliableCoveragePercentage: summary.reliableCoveragePercentage
    };
  }

  function buildDiagnostics(status, summaries, quality) {
    const diagnostics = [];
    Object.values(summaries).forEach((summary) => {
      if (summary.missingIntervalCount > 0) {
        diagnostics.push({
          code: `MISSING_${summary.magnitude}`,
          severity: "warning",
          message: `Faltan ${summary.missingIntervalCount} intervalos ${summary.magnitude}; no se completaron ni inventaron valores.`
        });
      }
      if (summary.ambiguousIntervalCount > 0) {
        diagnostics.push({
          code: `AMBIGUOUS_${summary.magnitude}`,
          severity: "warning",
          message: `${summary.ambiguousIntervalCount} intervalos ${summary.magnitude} contienen duplicados y no tienen un valor canónico.`
        });
      }
    });
    if (status === "partial" && summaries.Q1 && summaries.Q1.observationCount === 0) {
      diagnostics.push({ code: "Q1_UNAVAILABLE", severity: "info", message: "No hay Q1; los resultados de energía reactiva no están disponibles." });
    }
    if (quality.originChanges.length > 0) {
      diagnostics.push({
        code: "ORIGIN_CHANGES_REPORTED_INDEPENDENTLY",
        severity: "info",
        message: "Los cambios de origen y los huecos de datos se informan como hechos independientes, sin atribuir causalidad."
      });
    }
    return diagnostics;
  }

  function analyze(dataset, options) {
    const config = { billingCycleStartDay: options && options.billingCycleStartDay };
    const validationErrors = app.analysis.contract.validateDataset(dataset, config);
    if (validationErrors.length) return invalidResult(dataset, config, validationErrors);

    const indexed = app.analysis.indexer.buildIntervalSeries(dataset);
    const summaries = {};
    indexed.magnitudes.forEach((magnitude) => {
      summaries[magnitude] = app.analysis.statistics.measurementSummary(
        indexed.intervals,
        magnitude,
        app.analysis.indexer.UNITS[magnitude] || null
      );
    });
    const power = app.analysis.statistics.powerSummary(indexed.intervals);
    const hasAmbiguity = Object.values(summaries).some((summary) => summary.hasAmbiguity);
    const q1UnavailableOrPartial = summaries.Q1.observationCount === 0 || summaries.Q1.hasMissing;
    const hasMissing = summaries.AE.hasMissing || q1UnavailableOrPartial;
    const status = hasAmbiguity ? "ambiguous" : hasMissing ? "partial" : "complete";
    const inheritedQuality = dataset.quality || {};
    const quality = {
      importerStatus: inheritedQuality.importerStatus || null,
      issues: Array.isArray(inheritedQuality.issues) ? inheritedQuality.issues.map((item) => ({ ...item })) : [],
      gaps: Array.isArray(inheritedQuality.gaps) ? inheritedQuality.gaps.map((item) => ({ ...item })) : [],
      duplicates: Array.isArray(inheritedQuality.duplicates) ? inheritedQuality.duplicates.map((item) => ({ ...item })) : [],
      originChanges: Array.isArray(inheritedQuality.originChanges) ? inheritedQuality.originChanges.map((item) => ({ ...item })) : [],
      causalRelationships: [],
      originChangesAreIndependentFromGaps: true
    };
    const aggregations = app.analysis.aggregations.build(indexed.intervals, indexed.magnitudes, dataset.dateRange, config);

    return {
      meta: {
        schemaVersion: app.analysis.contract.RESULT_SCHEMA,
        engineVersion: app.analysis.contract.ENGINE_VERSION,
        datasetSchemaVersion: dataset.schemaVersion,
        generatedAt: new Date().toISOString()
      },
      status,
      config,
      subject: {
        point: dataset.point,
        intervalMinutes: dataset.intervalMinutes,
        periodsPerDay: dataset.periodsPerDay,
        dateRange: { ...dataset.dateRange },
        units: { activeEnergy: "kWh", reactiveEnergy: "kvarh", powerDemand: "kW" }
      },
      capabilities: {
        activeEnergy: summaries.AE.observationCount > 0,
        reactiveEnergy: summaries.Q1.observationCount > 0,
        intervalPowerDemand: summaries.AE.observationCount > 0,
        calendarAggregation: true,
        billingAggregation: true,
        tariffSimulation: false
      },
      coverage: {
        measurements: Object.fromEntries(Object.entries(summaries).map(([magnitude, summary]) => [magnitude, coverageFrom(summary)])),
        power: coverageFrom(power)
      },
      intervalSeries: indexed.intervals,
      totals: {
        measurements: Object.fromEntries(Object.entries(summaries).map(([magnitude, summary]) => [magnitude, {
          unit: summary.unit,
          observedTotal: summary.observedTotal,
          reliableTotal: summary.reliableTotal,
          observationCount: summary.observationCount,
          reliableIntervalCount: summary.reliableIntervalCount,
          ambiguousIntervalCount: summary.ambiguousIntervalCount
        }]))
      },
      statistics: {
        measurements: Object.fromEntries(Object.entries(summaries).map(([magnitude, summary]) => [magnitude, {
          unit: summary.unit,
          observed: summary.observedStatistics,
          reliable: summary.reliableStatistics
        }])),
        power: {
          unit: "kW",
          formula: power.formula,
          observed: power.observedStatistics,
          reliable: power.reliableStatistics
        }
      },
      aggregations,
      quality,
      diagnostics: buildDiagnostics(status, summaries, quality)
    };
  }

  Object.assign(app.analysis, {
    analyze,
    fromImportAnalysis: app.analysis.contract.fromImportAnalysis
  });
})(globalThis);
