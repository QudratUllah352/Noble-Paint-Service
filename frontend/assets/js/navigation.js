// The inner pages use the same responsive navigation as the homepage.
(() => {
  const button = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!button || !menu) return;

  function setOpen(open) {
    menu.classList.toggle('hidden', !open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close Navigation Menu' : 'Open Navigation Menu');
    const icon = button.querySelector('i');
    if (icon) icon.className = open ? 'fa-solid fa-xmark text-xl' : 'fa-solid fa-bars text-xl';
  }

  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', () => setOpen(false));
})();
