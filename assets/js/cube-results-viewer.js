/* Progressive-enhancement tabs for the supplied result figures. */
(function () {
  "use strict";
  const root = document.getElementById("cube-results-viewer");
  if (!root) return;
  const tabbar = root.querySelector(".cube-results-tabs");
  if (!tabbar) return;
  const tabs = Array.from(tabbar.querySelectorAll("[data-result-panel]"));
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute("data-result-panel")));
  if (tabs.length === 0 || new Set(panels).size !== tabs.length ||
      tabs.some(tab => !tab.id) || panels.some(panel =>
        !panel || !root.contains(panel) || !panel.classList.contains("cube-results-panel"))) return;

  const count = root.querySelector("#cube-results-count");
  function activate(index, focus) {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (count) count.textContent = String(index + 1).padStart(2, "0") + " / " + String(tabs.length).padStart(2, "0");
    if (focus) tabs[index].focus();
  }

  tabs.forEach((tab, index) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[index].id);
    panels[index].setAttribute("role", "tabpanel");
    panels[index].setAttribute("aria-labelledby", tab.id);
    panels[index].tabIndex = 0;
    tab.addEventListener("click", () => activate(index, false));
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(next, true);
    });
  });

  function revealHash() {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); }
    catch (_) { return; }
    if (!id) return;
    const target = document.getElementById(id);
    const index = panels.findIndex(panel => target && panel.contains(target));
    if (index < 0) return;
    activate(index, false);
    if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "start" });
  }

  activate(0, false);
  tabbar.hidden = false;
  if (count) count.hidden = false;
  root.dataset.ready = "true";
  window.addEventListener("hashchange", revealHash);
  revealHash();
})();
