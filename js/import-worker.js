"use strict";

importScripts(
  "vendor/xlsx.full.min.js",
  "namespace.js",
  "config.js",
  "utils.js",
  "parser.js",
  "validator.js",
  "importer.js"
);

self.onmessage = async function handleImport(event) {
  if (!event.data || event.data.type !== "import") return;
  const analysis = await self.FileSimulator.importer.processBuffer(
    event.data.buffer,
    event.data.name,
    event.data.size,
    (progress) => self.postMessage({ type: "progress", progress })
  );
  self.postMessage({ type: "complete", analysis });
};
