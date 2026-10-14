// Applies the saved theme before first paint. It is a blocking same-origin
// script because the app's Content-Security-Policy forbids inline scripts.
(function () {
  var theme = "night";
  try {
    if (localStorage.getItem("mazi.theme") === "day") theme = "day";
  } catch (error) {}
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "day" ? "#f4f2ec" : "#05070c");
})();
