document.addEventListener("DOMContentLoaded", () => {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll("[data-animate]").forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });

  const checkbox = document.getElementById("theme-toggle");
  const userTheme = localStorage.getItem("theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = userTheme ? userTheme === "dark" : systemDark;
  document.documentElement.classList.toggle("dark", isDark);
  checkbox.checked = isDark;

  checkbox.addEventListener("change", () => {
    const darkMode = checkbox.checked;
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  });
});
