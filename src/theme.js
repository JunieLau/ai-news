(function () {
  var root = document.documentElement;

  function paint(theme) {
    root.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#000000");
    var buttons = document.querySelectorAll("[data-theme-set]");
    for (var i = 0; i < buttons.length; i += 1) {
      var on = buttons[i].getAttribute("data-theme-set") === root.getAttribute("data-theme");
      buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-theme-set]");
    if (!button) return;
    var theme = button.getAttribute("data-theme-set");
    paint(theme);
    try {
      sessionStorage.setItem("ai-news-theme", theme);
    } catch (error) {
      /* session storage can be blocked; the page still switches */
    }
  });

  paint(root.getAttribute("data-theme") || "dark");
})();
