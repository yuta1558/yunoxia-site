beforeEach(() => {
  document.body.innerHTML = '<main></main><input id="theme-toggle" type="checkbox">';
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
  });
  localStorage.clear();
  jest.resetModules();
  require('../assets/js/app.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
});

test('toggling theme adds dark class and persists value', () => {
  const checkbox = document.getElementById('theme-toggle');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(localStorage.getItem('theme')).toBe('dark');
});
