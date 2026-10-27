
'use strict';
(() => {
  const grid = document.getElementById('team-grid');
  const status = document.getElementById('team-status');
  if (!grid || !status) return;

  grid.replaceChildren();

  function node(tag, classes, text) {
    const element = document.createElement(tag);
    element.className = classes;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  (async () => {
    try {
      const response = await fetch('/api/team', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Team information is unavailable.');
      if (!Array.isArray(data.items) || data.items.some(member =>
        !member || typeof member.name !== 'string' || typeof member.role !== 'string')) {
        throw new Error('Team information is unavailable.');
      }

      const cards = data.items.map(member => {
        const card = node('article', 'team-card flex flex-col bg-surface-container-lowest rounded-xl shadow-md p-6');
        const initials = member.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
        const icon = node('div', 'w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-md font-bold mb-5', initials);
        icon.setAttribute('aria-hidden', 'true');
        card.append(icon, node('h2', 'font-headline-md text-headline-md text-on-surface', member.name));
        card.append(node('p', 'font-body-sm text-body-sm text-primary font-semibold mt-2', member.role));
        return card;
      });

      grid.replaceChildren(...cards);
      grid.hidden = cards.length === 0;
      status.textContent = cards.length
        ? `${cards.length} active team member${cards.length === 1 ? '' : 's'}.`
        : 'No active team members are listed right now. Please contact us to discuss your project.';
    } catch (error) {
      grid.hidden = true;
      status.textContent = error.name === 'TimeoutError'
        ? 'Team information timed out. Please try again later or contact us.'
        : 'Team information is temporarily unavailable. Please contact us.';
    }
  })();
})();
    