(function startApplication(root) {
  "use strict";

  const app = root.FileSimulator;
  const { ui, importer, analysis, resultsController } = app;
  const byId = (id) => document.getElementById(id);
  const CALENDAR_COMPATIBILITY_START_DAY = 1;
  let activeImportResult = null;
  let activeAnalysisResult = null;
  let activeWorker = null;
  let operationToken = 0;

  function stopWorker() {
    if (activeWorker) activeWorker.terminate();
    activeWorker = null;
  }

  function discard() {
    operationToken += 1;
    stopWorker();
    activeImportResult = null;
    activeAnalysisResult = null;
    resultsController.clear();
    byId("file-input").value = "";
    byId("drop-zone").classList.remove("drop-zone-active");
    ui.showView("upload");
  }

  function completeImport(importResult, token) {
    if (token !== operationToken) return;
    activeImportResult = importResult;
    ui.renderAnalysis(importResult);
    const acknowledgement = byId("warnings-accepted");
    if (acknowledgement) {
      acknowledgement.addEventListener("change", () => {
        ui.setContinueEnabled(importResult.canContinue && acknowledgement.checked);
      });
    } else {
      ui.setContinueEnabled(importResult.canContinue);
    }
  }

  async function processOnMainThread(file, token) {
    try {
      const importResult = await importer.processFile(file, ui.setProgress);
      completeImport(importResult, token);
    } catch (error) {
      if (token === operationToken) ui.showFatal("El navegador no pudo leer el archivo seleccionado.");
    }
  }

  async function processWithWorker(file, token) {
    try {
      ui.setProgress({ message: "Leyendo el archivo en este navegador…", percentage: 8 });
      const buffer = await file.arrayBuffer();
      if (token !== operationToken) return;
      const worker = new Worker("js/import-worker.js");
      activeWorker = worker;
      let fellBack = false;

      worker.onmessage = (event) => {
        if (token !== operationToken) return;
        if (event.data.type === "progress") ui.setProgress(event.data.progress);
        if (event.data.type === "complete") {
          stopWorker();
          completeImport(event.data.analysis, token);
        }
      };
      worker.onerror = () => {
        if (fellBack || token !== operationToken) return;
        fellBack = true;
        stopWorker();
        processOnMainThread(file, token);
      };
      worker.postMessage({ type: "import", buffer, name: file.name, size: file.size }, [buffer]);
    } catch (error) {
      if (token === operationToken) processOnMainThread(file, token);
    }
  }

  function processFile(file) {
    if (!file) return;
    operationToken += 1;
    const token = operationToken;
    stopWorker();
    activeImportResult = null;
    activeAnalysisResult = null;
    resultsController.clear();
    ui.showProcessing(file);

    const workerCompatible = location.protocol !== "file:" && typeof Worker !== "undefined";
    if (workerCompatible) processWithWorker(file, token);
    else processOnMainThread(file, token);
  }

  function initialize() {
    const fileInput = byId("file-input");
    const dropZone = byId("drop-zone");

    byId("select-file-button").addEventListener("click", (event) => {
      event.stopPropagation();
      fileInput.click();
    });
    fileInput.addEventListener("change", () => processFile(fileInput.files && fileInput.files[0]));

    dropZone.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      fileInput.click();
    });
    dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });
    ["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      dropZone.classList.add("drop-zone-active");
    }));
    ["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      dropZone.classList.remove("drop-zone-active");
    }));
    dropZone.addEventListener("drop", (event) => processFile(event.dataTransfer.files && event.dataTransfer.files[0]));

    byId("cancel-button").addEventListener("click", discard);
    byId("discard-button").addEventListener("click", discard);
    byId("accepted-discard-button").addEventListener("click", discard);
    byId("analysis-discard-button").addEventListener("click", discard);
    byId("retry-button").addEventListener("click", discard);
    byId("continue-button").addEventListener("click", () => {
      if (!activeImportResult || !activeImportResult.canContinue) return;
      const token = operationToken;
      ui.showProcessing(activeImportResult.file);
      ui.setProgress({ message: "Generando el análisis a partir del dataset normalizado…", percentage: 72 });

      root.setTimeout(() => {
        if (token !== operationToken || !activeImportResult) return;
        try {
          const dataset = analysis.fromImportAnalysis(activeImportResult);
          activeAnalysisResult = analysis.analyze(dataset, {
            billingCycleStartDay: CALENDAR_COMPATIBILITY_START_DAY
          });
          if (token === operationToken) resultsController.show(activeAnalysisResult);
        } catch (error) {
          if (token === operationToken) ui.showFatal("No pudimos generar el análisis del dataset normalizado.");
        }
      }, 0);
    });

    ui.showView("upload");
  }

  initialize();
})(globalThis);
