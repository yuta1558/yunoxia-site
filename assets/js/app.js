document.addEventListener("DOMContentLoaded", async () => {
  const root = document.documentElement;
  root.classList.remove("no-js");
  let container;
  let observer;
  let linkHandler;
  let nav;
  let underline;
  let navUnderlineInitialized = false;

  const normalizePath = (url) => {
    const { pathname } = new URL(url, location.href);
    if (pathname === "/" || pathname === "") {
      return `${pathname === "" ? "/" : pathname}index.html`;
    }
    if (pathname.endsWith("/")) return `${pathname}index.html`;
    return pathname;
  };

  const moveUnderlineTo = (el) => {
    if (!nav || !underline || !el) return;
    const { left, width } = el.getBoundingClientRect();
    const navLeft = nav.getBoundingClientRect().left;
    underline.style.width = `${width}px`;
    underline.style.transform = `translateX(${left - navLeft}px)`;
  };

  const handleNavMouseOver = (event) => {
    if (!nav) return;
    const link = event.target.closest(".nav-link");
    if (link && nav.contains(link)) moveUnderlineTo(link);
  };

  const handleNavMouseOut = () => {
    if (!nav) return;
    const active = nav.querySelector(".nav-link.active");
    if (active) moveUnderlineTo(active);
  };

  const handleNavResize = () => {
    const active = nav ? nav.querySelector(".nav-link.active") : null;
    if (active) moveUnderlineTo(active);
  };

  const initNavUnderline = () => {
    nav = document.querySelector("nav");
    underline = document.querySelector(".nav-underline");
    if (!nav || !underline) return;
    if (!navUnderlineInitialized) {
      nav.addEventListener("mouseover", handleNavMouseOver);
      nav.addEventListener("mouseout", handleNavMouseOut);
      window.addEventListener("resize", handleNavResize);
      navUnderlineInitialized = true;
    }
    const active = nav.querySelector(".nav-link.active");
    if (active) moveUnderlineTo(active);
  };

  const setActiveNav = (url = location.href) => {
    nav = document.querySelector("nav");
    if (!nav) return;
    const navLinks = nav.querySelectorAll(".nav-link");
    const targetPath = normalizePath(url);
    let activeLink = null;
    navLinks.forEach((link) => {
      const isActive = normalizePath(link.href) === targetPath;
      link.classList.toggle("active", isActive);
      if (isActive) activeLink = link;
    });
    if (activeLink) {
      initNavUnderline();
      moveUnderlineTo(activeLink);
    }
  };

  const runRouteProgress = () => {
    const bar = document.getElementById("routeProgress");
    if (!bar) return;
    bar.style.transition = "none";
    bar.style.width = "0%";
    requestAnimationFrame(() => {
      bar.style.transition = "width 400ms ease";
      bar.style.width = "100%";
      setTimeout(() => {
        bar.style.transition = "none";
        bar.style.width = "0%";
      }, 480);
    });
  };

  const initCardTilt = () => {
    document.querySelectorAll(".card").forEach((card) => {
      if (card.dataset.tiltInit) return;
      card.dataset.tiltInit = "true";
      let rafId = null;
      let rx = 0;
      let ry = 0;
      const max = 4;

      const apply = () => {
        card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        card.classList.add("is-tilting");
        rafId = null;
      };

      const onPointerMove = (event) => {
        if (event.pointerType === "touch") return;
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const dx = px - 0.5;
        const dy = py - 0.5;
        ry = dx * max * 2;
        rx = -dy * max * 2;
        if (!rafId) rafId = requestAnimationFrame(apply);
      };

      const onPointerLeave = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        card.style.transform = "rotateX(0) rotateY(0)";
        card.classList.remove("is-tilting");
      };

      card.addEventListener("pointermove", onPointerMove);
      card.addEventListener("pointerleave", onPointerLeave);
      card.addEventListener("pointercancel", onPointerLeave);
    });
  };

  const loadPartials = async () => {
    const includes = document.querySelectorAll("[data-include]");
    for (const el of includes) {
      try {
        const res = await fetch(el.getAttribute("data-include"));
        if (res.ok) {
          el.outerHTML = await res.text();
        }
      } catch {
        /* ignore */
      }
    }
  };


  await loadPartials();
  container = document.querySelector("main");
  initNavUnderline();
  setActiveNav(location.href);
  initCardTilt();

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
    initCardTilt();
    setActiveNav(location.href);
    const checkbox = document.getElementById("theme-toggle");
    if (checkbox) {
      checkbox.removeEventListener("change", themeToggleHandler);
      checkbox.addEventListener("change", themeToggleHandler);
    }
  };

  const loadContent = async (url, push = true) => {
    runRouteProgress();
    setActiveNav(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const newContent = doc.querySelector("main").innerHTML;

      container.innerHTML = newContent;
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
