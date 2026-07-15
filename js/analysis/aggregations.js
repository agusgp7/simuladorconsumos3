(function defineAnalysisAggregations(root) {
  "use strict";

  const app = root.FileSimulator;
  app.analysis = app.analysis || {};

  const pad = (value) => String(value).padStart(2, "0");

  function utcDate(day) {
    const [year, month, date] = day.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, date));
  }

  function formatDay(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  function monthStart(day) {
    const date = utcDate(day);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;
  }

  function monthEnd(day) {
    const date = utcDate(day);
    return formatDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
  }

  function billingBounds(day, startDay) {
    const date = utcDate(day);
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth();
    if (date.getUTCDate() < startDay) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }
    const start = new Date(Date.UTC(year, month, startDay));
    const next = new Date(Date.UTC(year, month + 1, startDay));
    const end = new Date(next.valueOf() - 86400000);
    return { startDay: formatDay(start), endDay: formatDay(end) };
  }

  function groupBy(intervals, keySelector, metadataSelector) {
    const groups = new Map();
    intervals.forEach((interval) => {
      const key = keySelector(interval);
      if (!groups.has(key)) groups.set(key, { key, intervals: [], metadata: metadataSelector(interval) });
      groups.get(key).intervals.push(interval);
    });
    return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  function summarizeGroup(group, magnitudes, datasetRange) {
    const intervals = group.intervals;
    const first = intervals[0];
    const last = intervals[intervals.length - 1];
    const metadata = group.metadata;
    const fullStartDay = metadata.fullStartDay || first.day;
    const fullEndDay = metadata.fullEndDay || last.day;
    const fullExpected = app.parser.daysInclusive(fullStartDay, fullEndDay).length * 96;
    const measurements = {};
    magnitudes.forEach((magnitude) => {
      measurements[magnitude] = app.analysis.statistics.measurementSummary(
        intervals,
        magnitude,
        app.analysis.indexer.UNITS[magnitude] || null
      );
    });
    return {
      key: group.key,
      label: metadata.label || group.key,
      fullPeriodStartDay: fullStartDay,
      fullPeriodEndDay: fullEndDay,
      rangeStart: first.intervalStart,
      rangeEnd: last.intervalEnd,
      expectedIntervalsFullPeriod: fullExpected,
      expectedIntervalsInDatasetRange: intervals.length,
      isBoundaryPartial: fullStartDay < datasetRange.startDay || fullEndDay > datasetRange.endDay,
      measurements,
      power: app.analysis.statistics.powerSummary(intervals)
    };
  }

  function summarizeGroups(groups, magnitudes, datasetRange) {
    return groups.map((group) => summarizeGroup(group, magnitudes, datasetRange));
  }

  function daily(intervals, magnitudes, datasetRange) {
    const groups = groupBy(intervals, (interval) => interval.day, (interval) => ({
      label: interval.day,
      fullStartDay: interval.day,
      fullEndDay: interval.day
    }));
    return summarizeGroups(groups, magnitudes, datasetRange);
  }

  function calendarMonthly(intervals, magnitudes, datasetRange) {
    const groups = groupBy(intervals, (interval) => interval.day.slice(0, 7), (interval) => ({
      label: interval.day.slice(0, 7),
      fullStartDay: monthStart(interval.day),
      fullEndDay: monthEnd(interval.day)
    }));
    return summarizeGroups(groups, magnitudes, datasetRange);
  }

  function billingPeriods(intervals, magnitudes, datasetRange, startDay) {
    const groups = groupBy(intervals, (interval) => billingBounds(interval.day, startDay).startDay, (interval) => {
      const bounds = billingBounds(interval.day, startDay);
      return {
        label: `${bounds.startDay} — ${bounds.endDay}`,
        fullStartDay: bounds.startDay,
        fullEndDay: bounds.endDay
      };
    });
    return summarizeGroups(groups, magnitudes, datasetRange);
  }

  function byDayOfWeek(intervals, magnitudes) {
    const groups = groupBy(intervals, (interval) => String(interval.dayOfWeek).padStart(2, "0"), (interval) => ({
      label: interval.dayOfWeekName,
      dayOfWeek: interval.dayOfWeek
    }));
    return groups.map((group) => {
      const measurements = {};
      magnitudes.forEach((magnitude) => {
        measurements[magnitude] = app.analysis.statistics.measurementSummary(
          group.intervals,
          magnitude,
          app.analysis.indexer.UNITS[magnitude] || null
        );
      });
      return {
        dayOfWeek: group.metadata.dayOfWeek,
        dayOfWeekName: group.metadata.label,
        expectedIntervalCount: group.intervals.length,
        measurements,
        power: app.analysis.statistics.powerSummary(group.intervals)
      };
    });
  }

  function profile(intervals, magnitudes, predicate) {
    const selected = predicate ? intervals.filter(predicate) : intervals;
    const grouped = new Map();
    selected.forEach((interval) => {
      const group = grouped.get(interval.period) || [];
      group.push(interval);
      grouped.set(interval.period, group);
    });
    return Array.from({ length: 96 }, (_, index) => {
      const period = index + 1;
      const groupIntervals = grouped.get(period) || [];
      const measurements = {};
      magnitudes.forEach((magnitude) => {
        measurements[magnitude] = app.analysis.statistics.measurementSummary(
          groupIntervals,
          magnitude,
          app.analysis.indexer.UNITS[magnitude] || null
        );
      });
      const example = app.parser.intervalForPeriod("2000-01-01", period);
      return {
        period,
        startTime: example.start.slice(11),
        endTime: period === 96 ? "24:00:00" : example.end.slice(11),
        sampleIntervalCount: groupIntervals.length,
        measurements,
        power: app.analysis.statistics.powerSummary(groupIntervals)
      };
    });
  }

  function build(intervals, magnitudes, datasetRange, options) {
    return {
      daily: daily(intervals, magnitudes, datasetRange),
      calendarMonthly: calendarMonthly(intervals, magnitudes, datasetRange),
      billingPeriods: billingPeriods(intervals, magnitudes, datasetRange, options.billingCycleStartDay),
      byDayOfWeek: byDayOfWeek(intervals, magnitudes),
      averageProfile96: profile(intervals, magnitudes),
      weekdayProfile96: profile(intervals, magnitudes, (interval) => interval.dayType === "weekday"),
      weekendProfile96: profile(intervals, magnitudes, (interval) => interval.dayType === "weekend")
    };
  }

  app.analysis.aggregations = Object.freeze({ billingBounds, build });
})(globalThis);
