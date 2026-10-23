'use strict';
(() => {
  const status = document.getElementById('admin-status');
  let page = 1;
  async function api(path, body, method = 'POST') {
    const response = await fetch(`/api/admin/${path}`, {
      credentials: 'same-origin', cache: 'no-store',
      ...(body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && path !== 'login') location.replace('/admin/login.html');
      throw new Error(result.message || 'The request failed.');
    }
    return result;
  }
  const login = document.getElementById('admin-login');
  if (login && new URLSearchParams(location.search).get('accountUpdated') === '1') {
    status.textContent = 'Account updated. Sign in with your updated details.';
  }
  if (login) login.addEventListener('submit', async event => {
    event.preventDefault();
    const button = login.querySelector('button');
    button.disabled = true;
    status.textContent = 'Signing in…';
    try {
      await api('login', Object.fromEntries(new FormData(login)));
      login.reset();
      location.replace('/admin/overview.html');
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  const list = document.getElementById('live-enquiries');
  const overview = document.getElementById('live-overview');
  document.getElementById('admin-logout')?.addEventListener('click', async () => {
    try {
      await api('logout', {});
      list?.replaceChildren();
      overview?.replaceChildren();
      document.getElementById('recent-enquiries')?.replaceChildren();
      document.getElementById('appointment-list')?.replaceChildren();
      document.getElementById('team-list')?.replaceChildren();
      document.getElementById('project-list')?.replaceChildren();
      document.getElementById('service-list')?.replaceChildren();
      document.getElementById('project-summary')?.replaceChildren();
      document.getElementById('recovery-lock')?.replaceChildren();
      document.getElementById('recovery-emails')?.replaceChildren();
      document.getElementById('audit-list')?.replaceChildren();
      document.getElementById('upcoming-appointments')?.replaceChildren();
      location.replace('/admin/login.html');
    } catch (error) { status.textContent = error.message; }
  });
  if (overview) {
    const refreshOverview = document.getElementById('refresh-overview');
    const recent = document.getElementById('recent-enquiries');
    async function loadOverview() {
      refreshOverview.disabled = true;
      overview.replaceChildren();
      recent.replaceChildren();
      document.getElementById('upcoming-appointments')?.replaceChildren();
      status.textContent = 'Loading overview…';
      document.getElementById('project-summary')?.replaceChildren();
      try {
        const data = await api('overview');
        const grid = document.createElement('div');
        grid.className = 'stats';
        for (const [label, count] of [['All enquiries', data.total], ...Object.entries(data.byStatus)]) {
          const link = document.createElement('a');
          link.className = 'stat';
          link.href = label === 'All enquiries' ? '/admin/enquiries.html' : `/admin/enquiries.html?status=${encodeURIComponent(label)}`;
          const heading = document.createElement('h2');
          heading.textContent = label;
          const number = document.createElement('p');
          number.className = 'stat-value';
          number.textContent = String(count);
          link.append(heading, number);
          grid.append(link);
        }
        overview.append(grid);
        const projectSummary = document.getElementById('project-summary');
        if (projectSummary && data.projectSummary) {
          for (const [label, count] of [['All projects', data.projectSummary.total], ...Object.entries(data.projectSummary.byStatus)]) {
            const row = document.createElement('p');
            const link = document.createElement('a');
            link.className = 'button secondary';
            link.textContent = `${label}: ${count}`;
            link.href = label === 'All projects' ? '/admin/projects.html' : `/admin/projects.html?status=${encodeURIComponent(label)}`;
            row.append(link); projectSummary.append(row);
          }
        }
        for (const item of data.recent) {
          const row = document.createElement('p');
          row.textContent = `${item.fullName} · ${item.source === 'homepage' ? 'Homepage' : 'Contact page'} · ${item.status === 'pending' ? 'New' : item.status} · ${new Date(item.createdAt).toLocaleString()}`;
          recent.append(row);
        }
        if (!data.recent.length) recent.textContent = 'No enquiries yet.';
        const upcoming = document.getElementById('upcoming-appointments');
        if (upcoming) {
          upcoming.replaceChildren();
          for (const item of data.upcomingAppointments || []) {
            const row = document.createElement('p');
            const link = document.createElement('a');
            link.className = 'button secondary';
            link.textContent = `${item.consultation?.fullName || 'Enquiry unavailable'} · ${new Date(item.startsAt).toLocaleString(undefined, { timeZone: item.timeZone })} (${item.timeZone}) · ${item.assignedTo}`;
            link.href = item.consultation?._id ? `/admin/appointments.html?enquiry=${encodeURIComponent(item.consultation._id)}` : '/admin/appointments.html';
            row.append(link); upcoming.append(row);
          }
          if (!data.upcomingAppointments?.length) upcoming.textContent = 'No upcoming appointments.';
        }
        status.textContent = 'Overview updated.';
      } catch (error) { status.textContent = error.message; }
      finally { refreshOverview.disabled = false; }
    }
    refreshOverview.addEventListener('click', loadOverview);
    loadOverview();
  }
  if (!list) return;
  const previous = document.getElementById('previous-page');
  const next = document.getElementById('next-page');
  const refresh = document.getElementById('refresh-enquiries');
  const filters = document.getElementById('enquiry-filters');
  const searchInput = document.getElementById('enquiry-search');
  const statusFilter = document.getElementById('enquiry-status-filter');
  let search = '', filterStatus = '', loadVersion = 0;
  const initialStatus = new URLSearchParams(location.search).get('status');
  if (['New', 'Contacted', 'Quoted', 'Won', 'Closed'].includes(initialStatus)) {
    filterStatus = initialStatus;
    statusFilter.value = initialStatus;
  }
  async function load() {
    const version = ++loadVersion;
    previous.disabled = next.disabled = refresh.disabled = true;
    list.replaceChildren();
    status.textContent = 'Loading requests…';
    try {
      const query = new URLSearchParams({ page: String(page), search, status: filterStatus });
      const data = await api(`consultations?${query}`);
      if (version !== loadVersion) return;
      if (page > 1 && data.items.length === 0) {
        page = Math.max(1, Math.ceil(data.total / data.pageSize));
        return load();
      }
      for (const item of data.items) {
        const card = document.createElement('article');
        card.className = 'panel settings-panel';
        const title = document.createElement('h2');
        title.textContent = item.fullName;
        card.append(title);
        const source = document.createElement('p');
        source.textContent = `Source: ${item.source === 'homepage' ? 'Homepage' : 'Contact page'}`;
        card.append(source);
        const schedule = document.createElement('a');
        schedule.className = 'button secondary';
        schedule.textContent = 'Schedule / edit appointment';
        schedule.href = `/admin/appointments.html?enquiry=${encodeURIComponent(item._id)}`;
        card.append(schedule);
        const projectLink = document.createElement('a');
        projectLink.className = 'button secondary';
        projectLink.textContent = 'Create / view project';
        projectLink.href = `/admin/projects.html?enquiry=${encodeURIComponent(item._id)}`;
        card.append(projectLink);
        const statusLabel = document.createElement('label');
        statusLabel.className = 'field';
        statusLabel.textContent = 'Enquiry status';
        const select = document.createElement('select');
        for (const value of ['New', 'Contacted', 'Quoted', 'Won', 'Closed']) {
          const option = document.createElement('option');
          option.value = option.textContent = value;
          select.append(option);
        }
        let savedStatus = item.status === 'pending' ? 'New' : item.status;
        select.value = savedStatus;
        statusLabel.append(select);
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'button primary';
        save.textContent = 'Save status';
        const feedback = document.createElement('p');
        feedback.setAttribute('role', 'status');
        const statusLine = document.createElement('p');
        statusLine.textContent = `Status: ${savedStatus}`;
        save.addEventListener('click', async () => {
          select.disabled = save.disabled = true;
          feedback.textContent = 'Saving status…';
          try {
            const result = await api(`consultations/${encodeURIComponent(item._id)}/status`, { status: select.value }, 'PATCH');
            savedStatus = result.status;
            select.value = savedStatus;
            statusLine.textContent = `Status: ${savedStatus}`;
            feedback.textContent = 'Status saved.';
            if (filterStatus && savedStatus !== filterStatus) await load();
          } catch (error) {
            select.value = savedStatus;
            feedback.textContent = error.message;
          } finally { select.disabled = save.disabled = false; }
        });
        card.append(statusLine, statusLabel, save, feedback);
        for (const [label, value] of [['Email', item.emailAddr], ['Phone', item.phoneNumber], ['Project', item.selectedProjectType], ['Area', item.sqft], ['Preferred date', item.consultDate || 'Not specified'], ['Arrival window', item.consultTime], ['Details', item.projectDetails || 'Not specified'], ['Received', new Date(item.createdAt).toLocaleString()]]) {
          const line = document.createElement('p');
          line.textContent = `${label}: ${value || 'Not specified'}`;
          card.append(line);
        }
        const notesLabel = document.createElement('label');
        notesLabel.className = 'field';
        notesLabel.textContent = 'Private admin notes (up to 5,000 characters)';
        const notes = document.createElement('textarea');
        notes.rows = 4;
        notes.maxLength = 5000;
        notes.value = item.adminNotes || '';
        notes.placeholder = 'Record calls, estimates, and follow-ups. These notes are not emailed.';
        notesLabel.append(notes);
        const saveNotes = document.createElement('button');
        saveNotes.type = 'button';
        saveNotes.className = 'button primary';
        saveNotes.textContent = 'Save notes';
        const notesFeedback = document.createElement('p');
        notesFeedback.setAttribute('role', 'status');
        notes.addEventListener('input', () => { notesFeedback.textContent = 'Unsaved changes.'; });
        saveNotes.addEventListener('click', async () => {
          notes.disabled = saveNotes.disabled = true;
          notesFeedback.textContent = 'Saving notes…';
          try {
            const result = await api(`consultations/${encodeURIComponent(item._id)}/notes`, { adminNotes: notes.value }, 'PATCH');
            notes.value = result.adminNotes;
            notesFeedback.textContent = 'Notes saved.';
          } catch (error) {
            notesFeedback.textContent = `${error.message} Your notes are still in this field; they have not been saved.`;
          } finally { notes.disabled = saveNotes.disabled = false; }
        });
        card.append(notesLabel, saveNotes, notesFeedback);
        list.append(card);
      }
      status.textContent = data.total ? `${data.total} matching requests · Page ${page}` : search || filterStatus ? 'No enquiries match your filters.' : 'No consultation requests yet.';
      previous.disabled = page <= 1;
      next.disabled = page * data.pageSize >= data.total;
    } catch (error) { if (version === loadVersion) status.textContent = error.message; }
    finally { if (version === loadVersion) refresh.disabled = false; }
  }
  filters.addEventListener('submit', event => {
    event.preventDefault();
    search = searchInput.value.trim();
    filterStatus = statusFilter.value;
    page = 1;
    load();
  });
  document.getElementById('clear-enquiry-filters').addEventListener('click', () => {
    filters.reset();
    search = filterStatus = '';
    page = 1;
    load();
  });
  previous.addEventListener('click', () => { page--; load(); });
  next.addEventListener('click', () => { page++; load(); });
  refresh.addEventListener('click', load);
  load();
})();
