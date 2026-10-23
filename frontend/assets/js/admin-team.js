'use strict';
(() => {
  const form = document.getElementById('team-form');
  const filters = document.getElementById('team-filters');
  const list = document.getElementById('team-list');
  const feedback = document.getElementById('team-feedback');
  const status = document.getElementById('admin-status');
  const heading = document.getElementById('team-editor-heading');
  const save = form.querySelector('button[type="submit"]');
  const fresh = document.getElementById('team-new');
  const previous = document.getElementById('team-previous');
  const next = document.getElementById('team-next');
  let editing = '', page = 1, search = '', filterStatus = '', version = 0;
  async function api(path, body) {
    const response = await fetch(`/api/admin/${path}`, {
      credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (response.status === 401) location.replace('/admin/login.html');
    if (!response.ok) {
      for (const [key, message] of Object.entries(data.errors || {})) form.elements.namedItem(key)?.setCustomValidity(message);
      form.reportValidity();
      throw new Error(data.message || 'Unable to load or save team details.');
    }
    return data;
  }
  function reset() {
    editing = '';
    form.reset();
    for (const name of ['name', 'role', 'email', 'phone', 'status']) form.elements.namedItem(name).setCustomValidity('');
    heading.textContent = 'Add team member';
  }
  async function load() {
    const current = ++version;
    previous.disabled = next.disabled = true;
    list.replaceChildren();
    status.textContent = 'Loading team…';
    try {
      const data = await api(`team?${new URLSearchParams({ page: String(page), search, status: filterStatus })}`);
      if (current !== version) return;
      if (page > 1 && !data.items.length) { page = Math.max(1, Math.ceil(data.total / data.pageSize)); return load(); }
      for (const member of data.items) {
        const card = document.createElement('article'); card.className = 'panel settings-panel';
        const title = document.createElement('h2'); title.textContent = member.name; card.append(title);
        for (const [label, value] of [['Role', member.role], ['Email', member.email], ['Phone', member.phone], ['Status', member.status]]) {
          const line = document.createElement('p'); line.textContent = `${label}: ${value || 'Not specified'}`; card.append(line);
        }
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'button secondary'; edit.textContent = 'Edit member';
        edit.addEventListener('click', () => {
          if (save.disabled) return;
          reset(); editing = member._id;
          for (const name of ['name', 'role', 'email', 'phone', 'status']) form.elements.namedItem(name).value = member[name] || '';
          heading.textContent = 'Edit team member';
          feedback.textContent = 'Update the details and save. Team changes do not rename past appointment records.';
          form.elements.namedItem('name').focus();
          heading.scrollIntoView({ block: 'center' });
        });
        card.append(edit); list.append(card);
      }
      status.textContent = data.total ? `${data.total} team members · Page ${page}` : 'No team members match your filters.';
      previous.disabled = page <= 1;
      next.disabled = page * data.pageSize >= data.total;
    } catch (error) { if (current === version) status.textContent = error.message; }
  }
  form.addEventListener('input', event => event.target.setCustomValidity?.(''));
  form.addEventListener('change', event => event.target.setCustomValidity?.(''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (save.disabled || !form.reportValidity()) return;
    save.disabled = fresh.disabled = true;
    feedback.textContent = 'Saving team member…';
    try {
      await api(editing ? `team/${encodeURIComponent(editing)}` : 'team', Object.fromEntries(new FormData(form)));
      reset(); feedback.textContent = 'Team member saved.'; await load();
    } catch (error) { feedback.textContent = `${error.message} Your entries are kept here.`; }
    finally { save.disabled = fresh.disabled = false; }
  });
  fresh.addEventListener('click', () => { reset(); feedback.textContent = ''; });
  filters.addEventListener('submit', event => { event.preventDefault(); search = filters.elements.namedItem('search').value.trim(); filterStatus = filters.elements.namedItem('status').value; page = 1; load(); });
  document.getElementById('team-clear').addEventListener('click', () => { filters.reset(); search = filterStatus = ''; page = 1; load(); });
  previous.addEventListener('click', () => { page--; load(); });
  next.addEventListener('click', () => { page++; load(); });
  load();
})();
