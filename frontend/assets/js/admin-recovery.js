'use strict';
(() => {
  const status = document.getElementById('admin-status');
  const lock = document.getElementById('recovery-lock');
  const emails = document.getElementById('recovery-emails');
  const refresh = document.getElementById('recovery-refresh');
  const base = 'node --env-file=.env scripts/recovery.js';
  function text(parent, tag, value) {
    const element = document.createElement(tag); element.textContent = value; parent.append(element); return element;
  }
  function time(value) { return value ? new Date(value).toLocaleString() : 'Unknown time'; }
  // Only render command arguments known to be shell-safe. Legacy malformed records need operator inspection.
  const tokenSafe = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,200}$/.test(value);
  async function load() {
    refresh.disabled = true; lock.replaceChildren(); emails.replaceChildren(); status.textContent = 'Loading recovery report...';
    try {
      const response = await fetch('/api/admin/recovery', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { location.replace('/admin/login.html'); return; }
      const report = await response.json();
      if (!response.ok) throw new Error(report.message || 'Could not load recovery report.');
      if (report.lock) {
        text(lock, 'p', `Lock created: ${time(report.lock.createdAt)}`);
        text(lock, 'p', `Token: ${report.lock.token}`);
        if (tokenSafe(report.lock.token)) text(lock, 'pre', `${base} unlock ${report.lock.token}`);
      } else text(lock, 'p', 'No scheduling lock is held.');
      if (!report.emails.length) text(emails, 'p', 'No appointment emails are awaiting an outcome.');
      for (const item of report.emails) {
        const row = document.createElement('article'); emails.append(row);
        text(row, 'h3', `Appointment ${item.id}`);
        text(row, 'p', `Started: ${time(item.startedAt)}. Attempt: ${item.attemptId || 'Unavailable'}`);
        if (/^[a-f\d]{24}$/i.test(item.id) && tokenSafe(item.attemptId)) {
          text(row, 'p', 'After verifying receipt:'); text(row, 'pre', `${base} email ${item.id} ${item.attemptId} received`);
          text(row, 'p', 'To permit a manual retry after checking delivery:'); text(row, 'pre', `${base} email ${item.id} ${item.attemptId} retry`);
        } else text(row, 'p', 'Missing recovery identifiers. Ask the database operator to inspect this record.');
      }
      status.textContent = `Report loaded. Showing up to ${report.limit} unresolved emails. Refresh after recovery to see any remaining items.`;
    } catch (error) { status.textContent = error.message || 'Could not load recovery report.'; }
    finally { refresh.disabled = false; }
  }
  refresh.addEventListener('click', load); load();
})();
