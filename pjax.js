
document.addEventListener("DOMContentLoaded", function () {
  const links = document.querySelectorAll("a:not([target]):not([href^='#'])");
  const container = document.querySelector("main");

  links.forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const url = this.href;
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
            window.history.pushState(null, "", url);
          }, 200);
        });
    });
  });
});
