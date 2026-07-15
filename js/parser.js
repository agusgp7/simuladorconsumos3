(function defineTemporalParser(root) {
  "use strict";

  const app = root.FileSimulator;
  const pad = (value) => String(value).padStart(2, "0");

  function formatDay(parts) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }

  function formatDateTime(parts) {
    return `${formatDay(parts)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  }

  function parseDateTime(value) {
    const normalized = String(value ?? "").trim();
    const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    const latin = normalized.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    const match = iso || latin;
    if (!match) return null;

    const parts = {
      year: Number(iso ? match[1] : match[3]),
      month: Number(match[2]),
      day: Number(iso ? match[3] : match[1]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: Number(match[6] || 0)
    };
    const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
    if (
      probe.getUTCFullYear() !== parts.year ||
      probe.getUTCMonth() + 1 !== parts.month ||
      probe.getUTCDate() !== parts.day ||
      parts.hour > 23 ||
      parts.minute > 59 ||
      parts.second > 59
    ) return null;
    return parts;
  }

  function decodeExcelDate(value) {
    if (typeof value === "number" && Number.isFinite(value) && root.XLSX) {
      const decoded = root.XLSX.SSF.parse_date_code(value);
      if (!decoded) return null;
      return formatDateTime({
        year: decoded.y,
        month: decoded.m,
        day: decoded.d,
        hour: decoded.H,
        minute: decoded.M,
        second: Math.round(decoded.S)
      });
    }
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return formatDateTime({
        year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate(),
        hour: value.getHours(), minute: value.getMinutes(), second: value.getSeconds()
      });
    }
    const parsed = parseDateTime(value);
    return parsed ? formatDateTime(parsed) : null;
  }

  function addDays(day, amount) {
    const [year, month, date] = day.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, date + amount));
    return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  }

  function daysInclusive(startDay, endDay) {
    const days = [];
    for (let day = startDay; day <= endDay; day = addDays(day, 1)) days.push(day);
    return days;
  }

  function intervalForPeriod(day, period) {
    if (!Number.isInteger(period) || period < 1 || period > app.config.periodsPerDay) return null;
    const startMinutes = (period - 1) * 15;
    const start = `${day}T${pad(Math.floor(startMinutes / 60))}:${pad(startMinutes % 60)}:00`;
    if (period === app.config.periodsPerDay) return { start, end: `${addDays(day, 1)}T00:00:00` };
    const endMinutes = period * 15;
    return {
      start,
      end: `${day}T${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}:00`
    };
  }

  function expectedSourceTime(period) {
    if (!Number.isInteger(period) || period < 1 || period > app.config.periodsPerDay) return null;
    if (period === app.config.periodsPerDay) return "23:59:00";
    const minutes = period * 15;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
  }

  function timePart(parts) {
    return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  }

  function dayOrdinal(day) {
    const [year, month, date] = day.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, date) / 86400000);
  }

  function slotOrdinal(day, period) {
    return dayOrdinal(day) * app.config.periodsPerDay + period - 1;
  }

  app.parser = Object.freeze({
    formatDay,
    formatDateTime,
    parseDateTime,
    decodeExcelDate,
    addDays,
    daysInclusive,
    intervalForPeriod,
    expectedSourceTime,
    timePart,
    slotOrdinal
  });
})(globalThis);
