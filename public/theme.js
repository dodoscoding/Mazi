// Mazi has one theme, night. A day choice saved by an earlier version is
// cleared. It is a blocking same-origin script because the app's
// Content-Security-Policy forbids inline scripts.
(function () {
  try {
    localStorage.removeItem("mazi.theme");
  } catch (error) {}
  document.documentElement.setAttribute("data-theme", "night");
})();
