'use strict';
// Presentation only: existing form controls, text, listeners and API calls stay intact.
(() => {
  const badgeColors = {
    New: 'blue', Contacted: 'blue', Quoted: 'amber', Won: 'green', Closed: 'red',
    Scheduled: 'blue', Completed: 'green', Cancelled: 'red', Active: 'green',
    'On leave': 'amber', Inactive: 'red', Hidden: 'amber', Planned: 'blue', 'In progress': 'amber'
  };
  function decorate() {
    document.querySelectorAll('[role="status"], [id$="-feedback"]').forEach(node => {
      const text = node.textContent.trim();
      let state = 'info';
      if (/failed|error|incorrect|invalid|unavailable|could not|cannot|not saved|not configured|not confirmed|not recorded|not found|not allowed|overlap|already has|concurrent|conflict|too many|may have|try again|please check/i.test(text)) state = 'error';
      else if (/^(loading|saving|sending|signing in)/i.test(text)) state = 'loading';
      else if (/^(no |nothing )/i.test(text)) state = 'empty';
      else if (/\b(saved|updated|accepted|created|recorded)\b|account loaded/i.test(text)) state = 'success';
      node.dataset.adminState = state;
    });
    document.querySelectorAll('.settings-panel > p').forEach(node => {
      const value = node.textContent.match(/^(?:Status|Visibility): (.+)$/)?.[1];
      if (!value || !badgeColors[value]) return;
      node.classList.add('admin-status-badge'); node.dataset.adminBadge = badgeColors[value];
    });
    document.querySelectorAll('.table-wrap').forEach(node => {
      node.tabIndex = 0;
      if (!node.hasAttribute('aria-label')) node.setAttribute('aria-label', 'Scrollable admin table');
    });
  }
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; decorate(); });
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
  decorate();
})();
