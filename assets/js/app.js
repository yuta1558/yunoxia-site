document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  root.classList.remove("no-js");
  const container = document.querySelector("main");
  let observer;
  let linkHandler;

  const themeToggleHandler = (e) => {
    const dark = e.target.checked;
    root.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
    if (typeof gsap !== "undefined") {
      gsap.to("body", {
        backgroundColor: dark ? "#121212" : "#ffffff",
        color: dark ? "#ffffff" : "#000000",
        duration: 0.5,
      });
    }
  };

  const initTheme = () => {
    const checkbox = document.getElementById("theme-toggle");
    const stored = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored ? stored === "dark" : prefers;
    root.classList.toggle("dark", dark);
    if (checkbox) {
      checkbox.checked = dark;
      checkbox.addEventListener("change", themeToggleHandler);
    }
  };

  const initObserver = () => {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    });
    container.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
  };

  const animateNav = () => {
    if (typeof gsap === "undefined") return;
    gsap.from("nav a", {
      duration: 0.5,
      y: -10,
      opacity: 0,
      stagger: 0.1,
      delay: 0.2,
      ease: "power2.out",
    });
  };

  const animateMain = () => {
    if (typeof gsap === "undefined") return;
    gsap.from(container, { duration: 0.8, y: 30, opacity: 0, ease: "power2.out" });
  };

  const reinitScripts = () => {
    initObserver();
    animateMain();
    const checkbox = document.getElementById("theme-toggle");
    if (checkbox) {
      checkbox.removeEventListener("change", themeToggleHandler);
      checkbox.addEventListener("change", themeToggleHandler);
    }
  };

  const loadContent = async (url, push = true) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const newContent = doc.querySelector("main").innerHTML;

      container.innerHTML = newContent;
      document.title = doc.title;
      window.scrollTo({ top: 0, left: 0 });
      if (push) window.history.pushState(null, "", url);

      reinitScripts();
      initLinks();
    } catch {
      window.location.href = url;
    }
  };

  const initLinks = () => {
    if (linkHandler) document.removeEventListener("click", linkHandler);
    linkHandler = (e) => {
      const link = e.target.closest("a:not([target]):not([href^='#'])");
      if (!link) return;
      e.preventDefault();
      loadContent(link.href);
    };
    document.addEventListener("click", linkHandler);
  };

  window.addEventListener("popstate", () => loadContent(location.href, false));

  initTheme();
  animateNav();
  reinitScripts();
  initLinks();
});
