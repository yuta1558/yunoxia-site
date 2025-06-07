document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector("main");

  function loadContent(url, addToHistory = true) {
    fetch(url)
      .then(res => res.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newContent = doc.querySelector("main").innerHTML;

        container.classList.remove("fade-in");
        container.style.opacity = 0;

        setTimeout(() => {
          container.innerHTML = newContent;
          container.classList.add("fade-in");
          container.style.opacity = 1;

          if (addToHistory) {
            window.history.pushState(null, "", url);
          }

          // 再度Observer・トグル・アニメーション再適用
          reinitScripts();
        }, 200);
      });
  }

  function reinitScripts() {
    // IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    });
    document.querySelectorAll(".fade-in").forEach(el => observer.observe(el));

    // GSAPアニメーション（存在すれば）
    if (typeof gsap !== "undefined") {
      gsap.from("main", { duration: 0.8, y: 30, opacity: 0, ease: "power2.out" });
      gsap.from("nav a", {
        duration: 0.5,
        y: -10,
        opacity: 0,
        stagger: 0.1,
        delay: 0.2,
        ease: "power2.out"
      });
    }

    // ダークモードトグルイベント再バインド
    const checkbox = document.getElementById("theme-toggle");
    if (checkbox) {
      checkbox.removeEventListener("change", themeToggleHandler); // 重複防止
      checkbox.addEventListener("change", themeToggleHandler);
    }
  }

  function themeToggleHandler() {
    const darkMode = this.checked;
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }

  // 最初のテーマ設定
  const checkbox = document.getElementById("theme-toggle");
  const userTheme = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = userTheme ? userTheme === "dark" : systemDark;
  document.documentElement.classList.toggle("dark", isDark);
  if (checkbox) {
    checkbox.checked = isDark;
    checkbox.addEventListener("change", themeToggleHandler);
  }

  // 初回Observer実行
  reinitScripts();

  // PJAXナビゲーション設定
  function initLinks() {
    const links = document.querySelectorAll("a:not([target]):not([href^='#'])");
    links.forEach(link => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        const url = this.href;
        loadContent(url);
      });
    });
  }

  initLinks();

  // popstate（戻る／進む）対応
  window.addEventListener("popstate", () => {
    loadContent(location.href, false);
  });
});
