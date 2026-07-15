(function defineUtilities(root) {
  "use strict";

  const app = root.FileSimulator;

  function text(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function normalizedText(value) {
    return text(value).replace(/\s+/g, " ").toUpperCase();
  }

  function finiteNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const cleaned = value.trim();
    if (!/^-?\d+(?:[.,]\d+)?$/.test(cleaned)) return null;
    const parsed = Number(cleaned.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function integerPeriod(value) {
    const number = finiteNumber(value);
    return number !== null && Number.isInteger(number) && number >= 1 && number <= app.config.periodsPerDay
      ? number
      : null;
  }

  function fileExtension(name) {
    const index = String(name).lastIndexOf(".");
    return index >= 0 ? String(name).slice(index).toLowerCase() : "";
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  }

  function formatInteger(value) {
    return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(value);
  }

  function formatPercentage(value) {
    return value === null || value === undefined ? "No disponible" : `${value.toFixed(2)} %`;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : String(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function yieldToBrowser() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  app.utils = Object.freeze({
    text,
    normalizedText,
    finiteNumber,
    integerPeriod,
    fileExtension,
    formatBytes,
    formatInteger,
    formatPercentage,
    formatDateTime,
    escapeHtml,
    yieldToBrowser
  });
})(globalThis);
