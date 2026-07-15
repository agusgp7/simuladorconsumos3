(function defineResultsController(root) {
  "use strict";

  const app = root.FileSimulator;
  const byId = (id) => document.getElementById(id);
  let currentResult = null;

  function show(result) {
    const view = byId("analysis-results-view");
    const content = byId("analysis-results-content");
    if (!view || !content || !app.resultsUI.render(result, content)) return false;

    ["upload-view", "processing-view", "result-view", "accepted-view", "fatal-error"].forEach((id) => {
      const element = byId(id);
      if (element) element.hidden = true;
    });
    const hero = byId("import-hero");
    if (hero) hero.hidden = true;
    currentResult = result;
    view.hidden = false;
    root.scrollTo({ top: 0, behavior: "auto" });
    return true;
  }

  function clear() {
    currentResult = null;
    const view = byId("analysis-results-view");
    const content = byId("analysis-results-content");
    const hero = byId("import-hero");
    if (view) view.hidden = true;
    if (content) content.innerHTML = "";
    if (hero) hero.hidden = false;
  }

  function getCurrentResult() {
    return currentResult;
  }

  app.resultsController = Object.freeze({ show, clear, getCurrentResult });
})(globalThis);
