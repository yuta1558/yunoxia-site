document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector("main");

  const themeToggleHandler = (e) => {
    const dark = e.target.checked;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  };

  const initTheme = () => {
    const checkbox = document.getElementById("theme-toggle");
    const user = localStorage.getItem("theme");
    const system = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = user ? user === "dark" : system;
    document.documentElement.classList.toggle("dark", dark);
    if (checkbox) {
      checkbox.checked = dark;
      checkbox.addEventListener("change", themeToggleHandler);
    }
  };

  const initObserver = () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    });
    document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
  };

  const animate = () => {
    if (typeof gsap === "undefined") return;
    gsap.from("main", { duration: 0.8, y: 30, opacity: 0, ease: "power2.out" });
    gsap.from("nav a", {
      duration: 0.5,
      y: -10,
      opacity: 0,
      stagger: 0.1,
      delay: 0.2,
      ease: "power2.out",
    });
  };

  const reinitScripts = () => {
    initObserver();
    animate();
    const checkbox = document.getElementById("theme-toggle");
    if (checkbox) {
      checkbox.removeEventListener("change", themeToggleHandler);
      checkbox.addEventListener("change", themeToggleHandler);
    }
  };

  const loadContent = async (url, addToHistory = true) => {
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const newContent = doc.querySelector("main").innerHTML;

    container.classList.remove("fade-in");
    container.style.opacity = 0;

    setTimeout(() => {
      container.innerHTML = newContent;
      reinitScripts();

      container.classList.add("fade-in");
      container.style.opacity = 1;

      if (addToHistory) {
        window.history.pushState(null, "", url);
      }
    }, 200);
  };

  const initLinks = () => {
    document
      .querySelectorAll("a:not([target]):not([href^='#'])")
      .forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          loadContent(link.href);
        });
      });
  };

  window.addEventListener("popstate", () => loadContent(location.href, false));

  initTheme();
  initObserver();
  animate();
  initLinks();
});
