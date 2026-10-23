'use strict';
(() => {
  const form = document.getElementById('service-form'), filters = document.getElementById('service-filters');
  const list = document.getElementById('service-list'), feedback = document.getElementById('service-feedback'), status = document.getElementById('admin-status');
  const heading = document.getElementById('service-heading'), save = form.querySelector('button[type="submit"]'), fresh = document.getElementById('service-new');
  const previous = document.getElementById('service-previous'), next = document.getElementById('service-next');
  const textFields = ['title', 'description', 'imageUrl', 'imageAlt', 'badge', 'status'];
  let editing = '', page = 1, search = '', filterStatus = '', version = 0;
  async function api(path, body) {
    const response = await fetch(`/api/admin/${path}`, { credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (response.status === 401) location.replace('/admin/login.html');
    if (!response.ok) {
      for (const [name, message] of Object.entries(data.errors || {})) {
        const field = form.elements.namedItem(name);
        if (typeof field?.setCustomValidity === 'function') field.setCustomValidity(message);
      }
      form.reportValidity(); throw new Error(data.message || 'Service request failed.');
    }
    return data;
  }
  function reset() {
    editing = ''; form.reset(); heading.textContent = 'Add service';
    for (const field of form.querySelectorAll('input, textarea, select')) field.setCustomValidity('');
  }
  async function load() {
    const current = ++version; previous.disabled = next.disabled = true;
    list.replaceChildren(); status.textContent = 'Loading services…';
    try {
      const data = await api(`services?${new URLSearchParams({ page: String(page), search, status: filterStatus })}`);
      if (current !== version) return;
      if (page > 1 && !data.items.length) { page = Math.max(1, Math.ceil(data.total / data.pageSize)); return load(); }
      for (const item of data.items) {
        const card = document.createElement('article'); card.className = 'panel settings-panel';
        const title = document.createElement('h2'); title.textContent = item.title; card.append(title);
        for (const [label, value] of [['Description', item.description], ['Categories', item.categories.join(', ')], ['Visibility', item.status], ['Display order', item.sortOrder]]) {
          const line = document.createElement('p'); line.textContent = `${label}: ${value}`; card.append(line);
        }
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'button secondary'; edit.textContent = 'Edit service';
        edit.addEventListener('click', () => {
          if (save.disabled) return;
          reset(); editing = item._id;
          for (const name of textFields) form.elements.namedItem(name).value = item[name] || '';
          form.elements.namedItem('sortOrder').value = String(item.sortOrder);
          form.elements.namedItem('features').value = item.features.join('\n');
          for (const field of form.querySelectorAll('input[name="categories"]')) field.checked = item.categories.includes(field.value);
          heading.textContent = 'Edit service'; feedback.textContent = 'Save to update this service. Active changes appear on the public Services page.';
          form.elements.namedItem('title').focus(); heading.scrollIntoView({ block: 'center' });
        });
        card.append(edit); list.append(card);
      }
      status.textContent = data.total ? `${data.total} services · Page ${page}` : 'No services match your filters.';
      previous.disabled = page <= 1; next.disabled = page * data.pageSize >= data.total;
    } catch (error) { if (current === version) status.textContent = error.message; }
  }
  function clearValidation(event) {
    event.target.setCustomValidity?.('');
    if (event.target.name === 'categories') for (const field of form.querySelectorAll('input[name="categories"]')) field.setCustomValidity('');
  }
  form.addEventListener('input', clearValidation); form.addEventListener('change', clearValidation);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (save.disabled || !form.reportValidity()) return;
    const data = new FormData(form);
    const payload = Object.fromEntries(textFields.map(name => [name, data.get(name)]));
    payload.sortOrder = Number(data.get('sortOrder'));
    payload.categories = data.getAll('categories');
    payload.features = String(data.get('features')).split('\n').map(line => line.trim()).filter(Boolean);
    if (!payload.categories.length) {
      const field = form.querySelector('input[name="categories"]'); field.setCustomValidity('Choose at least one category.'); form.reportValidity(); return;
    }
    save.disabled = fresh.disabled = true; feedback.textContent = 'Saving service…';
    try {
      await api(editing ? `services/${encodeURIComponent(editing)}` : 'services', payload);
      reset(); feedback.textContent = 'Service saved. Refresh the public Services page to see active changes.'; await load();
    } catch (error) { feedback.textContent = `${error.message} Your entries are kept here.`; }
    finally { save.disabled = fresh.disabled = false; }
  });
  fresh.addEventListener('click', () => { reset(); feedback.textContent = ''; });
  filters.addEventListener('submit', event => { event.preventDefault(); page = 1; search = filters.elements.namedItem('search').value.trim(); filterStatus = filters.elements.namedItem('status').value; load(); });
  document.getElementById('service-clear').addEventListener('click', () => { filters.reset(); page = 1; search = filterStatus = ''; load(); });
  previous.addEventListener('click', () => { page--; load(); }); next.addEventListener('click', () => { page++; load(); });
  load();
})();
