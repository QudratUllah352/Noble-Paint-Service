'use strict';
(() => {
  const form = document.getElementById('project-form');
  const filters = document.getElementById('project-filters');
  const list = document.getElementById('project-list');
  const feedback = document.getElementById('project-feedback');
  const status = document.getElementById('admin-status');
  const save = form.querySelector('button');
  const previous = document.getElementById('project-previous'), next = document.getElementById('project-next');
  const params = new URLSearchParams(location.search);
  const enquiryId = params.get('enquiry');
  const statuses = ['Planned', 'In progress', 'Completed', 'Cancelled'];
  let page = 1, search = '', filterStatus = statuses.includes(params.get('status')) ? params.get('status') : '', version = 0;
  filters.elements.namedItem('status').value = filterStatus;
  async function api(path, body) {
    const response = await fetch(`/api/admin/${path}`, {
      credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (response.status === 401) location.replace('/admin/login.html');
    if (!response.ok) {
      for (const [name, message] of Object.entries(data.errors || {})) form.elements.namedItem(name)?.setCustomValidity(message);
      form.reportValidity();
      throw Object.assign(new Error(data.message || 'Project request failed.'), { status: response.status });
    }
    return data;
  }
  async function loadMembers(project) {
    const select = form.elements.namedItem('assignedMember');
    select.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose an active team member'; select.append(placeholder);
    let teamPage = 1, loaded = 0, found = false;
    while (true) {
      const data = await api(`team?status=Active&page=${teamPage}`);
      for (const member of data.items) {
        const option = document.createElement('option'); option.value = member._id; option.textContent = `${member.name} — ${member.role}`; select.append(option);
        if (member._id === project?.assignedMember) found = true;
      }
      loaded += data.items.length;
      if (!data.items.length || loaded >= data.total) break;
      teamPage++;
    }
    if (project?.assignedMember && !found) {
      try {
        const { member } = await api(`team/${encodeURIComponent(project.assignedMember)}`);
        const option = document.createElement('option'); option.value = member._id; option.textContent = `${member.name} — ${member.status} (current assignment)`; select.append(option);
        found = true;
      } catch (error) { if (error.status !== 404) throw error; }
    }
    select.value = found ? project.assignedMember : '';
    if (!loaded && !found) placeholder.textContent = 'No active team members. Add one in Manage team, then refresh.';
  }
  async function loadEditor() {
    if (!enquiryId) return;
    const editor = document.getElementById('project-editor'); editor.hidden = false;
    if (!/^[a-f\d]{24}$/i.test(enquiryId)) { feedback.textContent = 'Invalid enquiry link. Open project management from an enquiry.'; return; }
    feedback.textContent = 'Loading project…'; save.disabled = true;
    try {
      const { enquiry, project } = await api(`consultations/${enquiryId}/project`);
      document.getElementById('project-customer').textContent = `${enquiry.fullName} · Enquiry status: ${enquiry.status}`;
      if (project) {
        for (const name of ['title', 'scope', 'startDate', 'targetDate', 'status']) form.elements.namedItem(name).value = project[name] || '';
        document.getElementById('project-heading').textContent = 'Edit project';
      } else {
        form.elements.namedItem('title').value = `${enquiry.fullName} — Painting project`;
        form.elements.namedItem('scope').value = enquiry.projectDetails || '';
      }
      await loadMembers(project);
      if (!project && enquiry.status !== 'Won') { feedback.textContent = 'Mark this enquiry Won in Enquiries, then refresh to create its project.'; return; }
      feedback.textContent = project ? 'Project loaded.' : 'Ready to create a project from this won enquiry.';
      save.disabled = false;
    } catch (error) { feedback.textContent = `${error.message} Refresh to retry.`; }
  }
  async function load() {
    const current = ++version; previous.disabled = next.disabled = true;
    list.replaceChildren(); status.textContent = 'Loading projects…';
    try {
      const data = await api(`projects?${new URLSearchParams({ page: String(page), search, status: filterStatus })}`);
      if (current !== version) return;
      if (page > 1 && !data.items.length) { page = Math.max(1, Math.ceil(data.total / data.pageSize)); return load(); }
      for (const project of data.items) {
        const card = document.createElement('article'); card.className = 'panel settings-panel';
        const title = document.createElement('h2'); title.textContent = project.title; card.append(title);
        for (const [label, value] of [['Customer', project.customerName], ['Status', project.status], ['Assigned to', project.assignedTo], ['Planned start', project.startDate], ['Target completion', project.targetDate], ['Scope', project.scope]]) {
          const line = document.createElement('p'); line.textContent = `${label}: ${value || 'Not specified'}`; card.append(line);
        }
        const edit = document.createElement('a'); edit.className = 'button secondary'; edit.textContent = 'Edit project'; edit.href = `/admin/projects.html?enquiry=${encodeURIComponent(project.consultation)}`;
        card.append(edit); list.append(card);
      }
      status.textContent = data.total ? `${data.total} projects · Page ${page}` : 'No projects match your filters.';
      previous.disabled = page <= 1; next.disabled = page * data.pageSize >= data.total;
    } catch (error) { if (current === version) status.textContent = error.message; }
  }
  function clearValidation(event) {
    event.target.setCustomValidity?.('');
    if (event.target.name === 'startDate') form.elements.namedItem('targetDate').setCustomValidity('');
  }
  form.addEventListener('input', clearValidation); form.addEventListener('change', clearValidation);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (save.disabled || !form.reportValidity()) return;
    save.disabled = true; feedback.textContent = 'Saving project…';
    try {
      await api(`consultations/${enquiryId}/project`, Object.fromEntries(new FormData(form)));
      document.getElementById('project-heading').textContent = 'Edit project';
      feedback.textContent = 'Project saved. No appointment or email was created.'; await load();
    } catch (error) { feedback.textContent = `${error.message} Your entries are kept here.`; }
    finally { save.disabled = false; }
  });
  filters.addEventListener('submit', event => { event.preventDefault(); page = 1; search = filters.elements.namedItem('search').value.trim(); filterStatus = filters.elements.namedItem('status').value; load(); });
  document.getElementById('project-clear').addEventListener('click', () => { filters.reset(); page = 1; search = filterStatus = ''; load(); });
  previous.addEventListener('click', () => { page--; load(); }); next.addEventListener('click', () => { page++; load(); });
  loadEditor(); load();
})();
