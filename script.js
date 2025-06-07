
// IntersectionObserverで.fade-in要素を検知
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
});
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ダークモード切り替え（システム＆手動）
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (prefersDark) document.documentElement.classList.add('dark');

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
});

// GSAP アニメーション
window.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap !== 'undefined') {
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
});
