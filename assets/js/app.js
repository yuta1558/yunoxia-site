document.addEventListener("DOMContentLoaded", () => {
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
