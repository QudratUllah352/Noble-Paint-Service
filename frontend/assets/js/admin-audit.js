'use strict';
(() => {
  const labels = {
    'enquiry.status': 'Enquiry status', 'enquiry.notes': 'Enquiry notes',
    'appointment.save': 'Appointment saved', 'appointment.email': 'Appointment email requested',
    'team.create': 'Team member created', 'team.update': 'Team member updated',
    'project.save': 'Project saved', 'service.create': 'Service created', 'service.update': 'Service updated',
    'account.email': 'Sign-in email changed', 'account.password': 'Password changed',
    'recovery.unlock': 'Scheduling lock recovery', 'recovery.received': 'Email receipt recovery', 'recovery.retry': 'Email retry recovery'
  };
  const form = document.getElementById('audit-filters');
  const actions = document.getElementById('audit-action');
  const list = document.getElementById('audit-list');
  const status = document.getElementById('admin-status');
  const previous = document.getElementById('audit-prev'), next = document.getElementById('audit-next');
  const pageLabel = document.getElementById('audit-page');
  let page = 1, loading = false, filters = {};
  function text(parent, tag, value) {
    const node = document.createElement(tag); node.textContent = value; parent.append(node); return node;
  }
  for (const [value, label] of Object.entries(labels)) {
    const option = text(actions, 'option', label); option.value = value;
  }
  async function load() {
    if (loading) return;
    loading = true; previous.disabled = true; next.disabled = true;
    form.querySelector('button').disabled = true;
    list.replaceChildren(); pageLabel.textContent = ''; status.textContent = 'Loading history...';
    try {
      const query = new URLSearchParams({ ...filters, page: String(page) });
      const response = await fetch(`/api/admin/audit?${query}`, { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { location.replace('/admin/login.html'); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load audit history.');
      for (const item of data.items) {
        const row = document.createElement('article'); row.className = 'audit-entry'; list.append(row);
        text(row, 'h3', `${labels[item.action] || item.action} — ${item.outcome}`);
        text(row, 'p', `${new Date(item.createdAt).toLocaleString()} · Admin: ${item.actorEmail || item.actor}`);
        text(row, 'p', `Record: ${item.target}`);
        if (item.fields?.length) text(row, 'p', `Submitted fields: ${item.fields.join(', ')}`);
        if (item.finishedAt) text(row, 'p', `Outcome recorded: ${new Date(item.finishedAt).toLocaleString()}`);
      }
      if (!data.items.length) text(list, 'p', 'No audit entries match these filters.');
      const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
      pageLabel.textContent = `Page ${data.page} of ${pages}`;
      previous.disabled = page <= 1; next.disabled = page >= pages;
      status.textContent = `${data.total} recorded action${data.total === 1 ? '' : 's'}. Times shown in your browser time zone.`;
    } catch (error) { status.textContent = error.message || 'Could not load audit history.'; }
    finally { loading = false; form.querySelector('button').disabled = false; }
  }
  form.addEventListener('submit', event => {
    event.preventDefault(); if (loading) return;
    filters = Object.fromEntries(new FormData(form)); page = 1; load();
  });
  previous.addEventListener('click', () => { if (!loading && page > 1) { page--; load(); } });
  next.addEventListener('click', () => { if (!loading && !next.disabled) { page++; load(); } });
  load();
})();
