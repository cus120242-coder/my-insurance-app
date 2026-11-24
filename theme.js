// 화면 색: 기본은 밝게. 설정에서 밤 모드를 켜면 어둡게 (이 기기에만 저장)
(function () {
  var dark = false;
  try { dark = localStorage.getItem("theme") === "dark"; } catch (e) {}
  window.applyTheme = function (isDark) {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    var m = document.querySelector('meta[name="color-scheme"]');
    if (m) m.content = isDark ? "dark" : "light";
    var t = document.querySelector('meta[name="theme-color"]');
    if (t) t.content = isDark ? "#0f1115" : "#3b5bff";
  };
  window.applyTheme(dark);
})();
