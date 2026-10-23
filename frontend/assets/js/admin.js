'use strict';

(() => {
  const STORAGE_KEY = 'noble-paint-admin-v1';
  const PAGE_SIZE = 6;
  const names = { enquiries: 'Enquiry', projects: 'Project', appointments: 'Appointment', services: 'Service', team: 'Team member' };
  const statuses = {
    enquiries: ['New', 'Contacted', 'Quoted', 'Won', 'Closed'],
    projects: ['Planned', 'In progress', 'Completed'],
    appointments: ['Scheduled', 'Completed', 'Cancelled'],
    services: ['Active', 'Hidden'], team: ['Active', 'On leave']
  };
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function localDate(offset = 0) {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function seed() {
    const serviceNames = ['Interior painting', 'Exterior painting', 'Cabinet refinishing', 'Commercial painting'];
    const clients = ['Olivia Bennett', 'James Wilson', 'Sophia Carter', 'Noah Martinez', 'Emma Thompson', 'Liam Anderson', 'Amelia Davis', 'Lucas Moore'];
    return {
      version: 1,
      settings: { business: 'Noble Paint Service', contact: '', email: '', currency: 'USD' },
      enquiries: clients.map((name, i) => ({ id: id(), name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: '+1 (202) 555-01' + String(i).padStart(2, '0'), service: serviceNames[i % 4], status: ['New', 'Contacted', 'Quoted', 'New', 'Won', 'Closed', 'New', 'Quoted'][i], date: localDate(-i), notes: 'Sample enquiry for exploring the dashboard. This is not a real customer request.' })),
      projects: [
        { id: id(), name: 'Riverside home refresh', client: 'Emma Thompson', service: serviceNames[0], assignee: 'Daniel Brooks', value: 3200, date: localDate(12), status: 'In progress', notes: 'Sample project: living room and hallway.' },
        { id: id(), name: 'Oak Street exterior', client: 'Ethan Reed', service: serviceNames[1], assignee: 'Maya Collins', value: 5400, date: localDate(21), status: 'Planned', notes: 'Sample project: exterior preparation and finish.' },
        { id: id(), name: 'Studio cabinet finish', client: 'Grace Parker', service: serviceNames[2], assignee: 'Daniel Brooks', value: 1800, date: localDate(-3), status: 'Completed', notes: 'Sample project, completed.' }
      ],
      appointments: [
        { id: id(), name: 'Olivia Bennett', service: serviceNames[0], date: localDate(), time: '10:00', assignee: 'Daniel Brooks', address: 'Sample address · Riverside', status: 'Scheduled', notes: 'Sample consultation. No actual visit is booked.' },
        { id: id(), name: 'James Wilson', service: serviceNames[1], date: localDate(1), time: '14:00', assignee: 'Maya Collins', address: 'Sample address · Oak Street', status: 'Scheduled', notes: 'Sample exterior assessment.' },
        { id: id(), name: 'Sophia Carter', service: serviceNames[2], date: localDate(2), time: '09:30', assignee: 'Daniel Brooks', address: 'Sample address · Maple Avenue', status: 'Scheduled', notes: '' }
      ],
      services: serviceNames.map((name, i) => ({ id: id(), name, price: [1200, 2500, 900, 4000][i], status: 'Active', notes: 'Sample starting estimate. This does not change public website pricing.' })),
      team: [
        { id: id(), name: 'Daniel Brooks', role: 'Lead painter', email: 'daniel@example.com', phone: '+1 (202) 555-0131', status: 'Active', notes: 'Sample team member.' },
        { id: id(), name: 'Maya Collins', role: 'Project manager', email: 'maya@example.com', phone: '+1 (202) 555-0132', status: 'Active', notes: 'Sample team member.' },
        { id: id(), name: 'Alex Morgan', role: 'Exterior specialist', email: 'alex@example.com', phone: '+1 (202) 555-0133', status: 'On leave', notes: 'Sample team member.' }
      ],
      activity: [{ id: id(), text: 'Sample workspace created', date: new Date().toISOString() }]
    };
  }
  let storageWarning = '', state;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? JSON.parse(saved) : seed();
    if (state.version !== 1 || !state.settings || !Object.keys(names).every(key => Array.isArray(state[key])) || !Array.isArray(state.activity)) throw Error('Unsupported saved data');
  } catch {
    state = seed();
    storageWarning = 'Saved workspace could not be loaded. This session uses sample data and will not overwrite the saved workspace. Export a backup before resetting.';
  }
  let view = 'overview', search = '', filter = 'All', page = 1, editing = null, toastTimer;
  const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: ['USD', 'PKR', 'GBP'].includes(state.settings.currency) ? state.settings.currency : 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const dateLabel = value => value ? new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set';
  const timeLabel = value => value ? new Date('2000-01-01T' + value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  function persist() {
    if (storageWarning) { toast('Changes are temporary. Browser storage is unavailable or saved data needs attention.'); return false; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch { storageWarning = 'Browser storage is unavailable or full. Changes in this session are temporary; export a backup before closing.'; return false; }
  }
  function toast(message) {
    clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6000);
  }
  function log(text) { state.activity.unshift({ id: id(), text, date: new Date().toISOString() }); state.activity = state.activity.slice(0, 30); }
  function badge(status) {
    const color = ({ New: 'blue', Contacted: 'amber', Quoted: 'amber', Won: 'green', Scheduled: 'blue', Completed: 'green', Active: 'green', 'In progress': 'blue', Planned: 'amber', Cancelled: 'red', 'On leave': 'amber' })[status] || '';
    return `<span class="status ${color}">${escape(status)}</span>`;
  }
  const person = (name, detail = '') => `<div class="person"><span class="person-badge" aria-hidden="true">${escape(String(name).split(/\s+/).map(s => s[0] || '').slice(0, 2).join(''))}</span><span><span class="cell-title">${escape(name)}</span><span class="cell-sub">${escape(detail)}</span></span></div>`;
  function overview() {
    const newCount = state.enquiries.filter(r => r.status === 'New').length;
    const active = state.projects.filter(r => r.status !== 'Completed');
    const upcoming = state.appointments.filter(r => r.status === 'Scheduled' && r.date >= localDate()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const stats = [
      ['Total enquiries', state.enquiries.length, `${newCount} waiting for a first response`, '✉'],
      ['Active projects', active.length, `${state.projects.filter(r => r.status === 'Completed').length} marked completed`, '▤'],
      ['Upcoming visits', upcoming.length, 'Scheduled from today onward', '▦'],
      ['Project value', money(state.projects.reduce((sum, r) => sum + Number(r.value || 0), 0)), 'Total estimates · not collected revenue', '↗']
    ];
    const counts = state.services.map(service => ({ name: service.name, count: state.enquiries.filter(r => r.service === service.name).length }));
    for (const enquiry of state.enquiries) if (!counts.some(c => c.name === enquiry.service)) counts.push({ name: enquiry.service, count: state.enquiries.filter(r => r.service === enquiry.service).length });
    const maximum = Math.max(1, ...counts.map(c => c.count));
    return `<section class="hero"><div><p class="eyebrow">A FRESH COAT OF CLARITY</p><h1>Your business, beautifully organised.</h1><p>Welcome to your workspace. Keep enquiries moving, coordinate your crew, and give every project the attention it deserves.</p></div><div class="hero-actions"><button class="button amber" data-add="enquiries"><span aria-hidden="true">＋</span> New enquiry</button></div></section>
      <div class="stats">${stats.map(([label, value, note, icon]) => `<article class="stat"><div class="stat-heading">${label}<span class="stat-icon" aria-hidden="true">${icon}</span></div><strong class="stat-value">${value}</strong><span class="stat-note"><span class="dot"></span>${note}</span></article>`).join('')}</div>
      <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Enquiries by service</h2><p>Where your customers need a little colour.</p></div><span class="status blue">All enquiries</span></div><div class="chart">${counts.length ? counts.map(c => `<div class="chart-row"><span>${escape(c.name)}</span><div class="chart-track"><div class="chart-fill" style="width:${c.count / maximum * 100}%" role="img" aria-label="${escape(c.name)}: ${c.count} enquiries"></div></div><strong>${c.count}</strong></div>`).join('') : '<p class="empty">No service enquiries yet.</p>'}<p class="chart-note">Counts reflect records in this sample workspace.</p></div></section>
      <section class="panel"><div class="panel-heading"><div><h2>Upcoming appointments</h2><p>The next steps to a beautiful finish.</p></div><a class="text-link" href="#appointments">View all →</a></div><div class="schedule-list">${upcoming.slice(0, 3).map(r => `<div class="schedule-item"><div class="date-tile">${Number(r.date.slice(8))}<span>${new Date(r.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span></div><div><h3>${escape(r.name)}</h3><p>${escape(r.service)} · ${escape(timeLabel(r.time))}</p><p>${escape(r.assignee || 'Unassigned')}</p>${badge(r.status)}</div><button class="icon-button" style="margin-left:auto" data-edit="appointments" data-id="${escape(r.id)}" aria-label="Edit appointment for ${escape(r.name)}">↗</button></div>`).join('') || '<div class="empty"><strong>Your schedule is clear.</strong>Add an appointment to plan your next visit.</div>'}</div></section></div>
      <section class="panel"><div class="panel-heading"><div><h2>Recent enquiries</h2><p>Every great transformation starts with a conversation.</p></div><a class="text-link" href="#enquiries">View all enquiries →</a></div>${table('enquiries', state.enquiries.slice(0, 5), false)}</section>
      <section class="panel" style="margin-top:24px"><div class="panel-heading"><div><h2>Workspace activity</h2><p>Your latest changes, in one place.</p></div></div><div class="activity-list">${state.activity.slice(0, 4).map(r => `<div class="activity-item">${escape(r.text)}<span>${escape(new Date(r.date).toLocaleString())}</span></div>`).join('') || '<p class="empty">No changes yet.</p>'}</div></section>`;
  }
  const columns = {
    enquiries: ['Customer', 'Service', 'Received', 'Status', 'Actions'],
    projects: ['Project', 'Assigned to', 'Target date', 'Estimate', 'Status', 'Actions'],
    appointments: ['Customer', 'Visit', 'Assigned to', 'Status', 'Actions'],
    services: ['Service', 'Starting estimate', 'Status', 'Actions'],
    team: ['Team member', 'Role', 'Phone', 'Status', 'Actions']
  };
  function cells(type, r) {
    if (type === 'enquiries') return [person(r.name, r.email), escape(r.service), dateLabel(r.date), badge(r.status)];
    if (type === 'projects') return [`<span class="cell-title">${escape(r.name)}</span><span class="cell-sub">${escape(r.client)} · ${escape(r.service)}</span>`, escape(r.assignee || 'Unassigned'), dateLabel(r.date), money(r.value), badge(r.status)];
    if (type === 'appointments') return [person(r.name, r.service), `<span class="cell-title">${dateLabel(r.date)} · ${escape(timeLabel(r.time))}</span><span class="cell-sub">${escape(r.address)}</span>`, escape(r.assignee || 'Unassigned'), badge(r.status)];
    if (type === 'services') return [`<span class="cell-title">${escape(r.name)}</span><span class="cell-sub">${escape(r.notes)}</span>`, money(r.price), badge(r.status)];
    return [person(r.name, r.email), escape(r.role), escape(r.phone), badge(r.status)];
  }
  function table(type, records, full = true) {
    if (!records.length) return `<div class="empty"><strong>No ${type} found.</strong>${search || filter !== 'All' ? 'Try another search or clear your filters.' : 'Add your first record to get started.'}</div>`;
    return `<div class="table-wrap"><table><caption class="skip-link">${escape(type)} records</caption><thead><tr>${columns[type].map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${records.map(r => `<tr>${cells(type, r).map(c => `<td>${c}</td>`).join('')}<td><div class="row-actions"><button data-edit="${type}" data-id="${escape(r.id)}" aria-label="Edit ${escape(r.name)}">Edit</button>${full && type === 'enquiries' && !['Won', 'Closed'].includes(r.status) ? `<button data-convert="${escape(r.id)}">Create project</button>` : ''}${full ? `<button class="delete" data-delete="${type}" data-id="${escape(r.id)}" aria-label="Delete ${escape(r.name)}">Delete</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
  }
  function filtered() {
    return state[view].filter(r => (filter === 'All' || r.status === filter) && Object.values(r).some(value => String(value).toLowerCase().includes(search.toLowerCase())));
  }
  function list() {
    const descriptions = { enquiries: 'Follow every conversation from first hello to a fresh finish.', projects: 'Keep your painting projects, estimates, and crew assignments in order.', appointments: 'Organise consultations and site visits. No calendar notifications are sent.', services: 'Manage your workspace service list. Public website content stays separate.', team: 'A clear view of your crew and their contact details.' };
    return `<div class="section-title"><div><p class="eyebrow">YOUR WORKSPACE</p><h1>${escape(view[0].toUpperCase() + view.slice(1))}</h1><p>${descriptions[view]}</p></div><button class="button primary" data-add="${view}">＋ Add ${names[view].toLowerCase()}</button></div><section class="panel"><div class="toolbar"><div class="toolbar-left"><label class="search"><span aria-hidden="true">⌕</span><input id="record-search" type="search" placeholder="Search ${view}…" aria-label="Search ${view}" value="${escape(search)}"></label><select id="status-filter" aria-label="Filter by status"><option>All</option>${statuses[view].map(s => `<option${filter === s ? ' selected' : ''}>${escape(s)}</option>`).join('')}</select></div><div class="toolbar-right"><button class="button secondary" data-export="${view}">↓ Export CSV</button></div></div><div id="table-content"></div></section>`;
  }
  function renderTable() {
    const records = filtered(), pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE)); page = Math.min(page, pages);
    $('#table-content').innerHTML = table(view, records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)) + `<div class="table-footer"><span>${records.length ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, records.length)}` : '0'} of ${records.length} records</span><div class="pagination"><button data-page="previous" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">←</button><span>${page} / ${pages}</span><button data-page="next" ${page === pages ? 'disabled' : ''} aria-label="Next page">→</button></div></div>`;
  }
  function field(key, label, type = 'text', options = {}) { return { key, label, type, ...options }; }
  function schema(type) {
    const service = field('service', 'Service', 'select', { options: state.services.map(s => s.name), required: true });
    const assignee = field('assignee', 'Assigned to', 'select', { options: ['', ...state.team.map(t => t.name)] });
    const status = field('status', 'Status', 'select', { options: statuses[type], required: true });
    const notes = field('notes', 'Notes', 'textarea', { wide: true });
    const contact = [field('name', 'Customer name', 'text', { required: true }), field('email', 'Email address', 'email', { required: true }), field('phone', 'Phone number', 'tel', { required: true })];
    if (type === 'enquiries') return [...contact, service, field('date', 'Received date', 'date', { required: true }), status, notes];
    if (type === 'projects') return [field('name', 'Project name', 'text', { required: true }), field('client', 'Customer name', 'text', { required: true }), service, assignee, field('date', 'Target completion date', 'date', { required: true }), field('value', `Estimated value (${state.settings.currency})`, 'number', { required: true }), status, notes];
    if (type === 'appointments') return [field('name', 'Customer name', 'text', { required: true }), service, field('date', 'Visit date', 'date', { required: true }), field('time', 'Visit time', 'time', { required: true }), assignee, status, field('address', 'Visit address', 'text', { wide: true, required: true }), notes];
    if (type === 'services') return [field('name', 'Service name', 'text', { required: true }), field('price', `Starting estimate (${state.settings.currency})`, 'number', { required: true }), status, notes];
    return [field('name', 'Full name', 'text', { required: true }), field('role', 'Role / specialty', 'text', { required: true }), field('email', 'Email address', 'email', { required: true }), field('phone', 'Phone number', 'tel', { required: true }), status, notes];
  }
  function fieldsHtml(fields, record = {}) {
    return fields.map(f => {
      const value = record[f.key] ?? '', attrs = `id="field-${f.key}" name="${f.key}" ${f.required ? 'required' : ''}`;
      let input;
      if (f.type === 'select') {
        const options = [...new Set([...f.options, ...(value && !f.options.includes(value) ? [value] : [])])];
        input = `<select ${attrs}>${f.required && !value ? '<option value="">Select an option</option>' : ''}${options.map(o => `<option value="${escape(o)}"${o === value ? ' selected' : ''}>${escape(o || 'Unassigned')}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') input = `<textarea ${attrs} maxlength="3000">${escape(value)}</textarea>`;
      else input = `<input ${attrs} type="${f.type}" value="${escape(value)}" ${f.type === 'number' ? 'min="0" max="1000000000" step="0.01"' : f.type === 'tel' ? 'maxlength="40"' : 'maxlength="200"'}>`;
      return `<label class="field ${f.wide ? 'wide' : ''}" for="field-${f.key}">${escape(f.label)}${f.required ? ' *' : ''}${input}</label>`;
    }).join('');
  }
  function openEditor(type, recordId = null, initial = null) {
    const record = recordId ? state[type].find(r => r.id === recordId) : { date: localDate(), status: statuses[type][0], ...initial };
    if (!record) return;
    editing = { type, id: recordId, sourceEnquiry: initial?.sourceEnquiry };
    $('#dialog-title').textContent = `${recordId ? 'Edit' : 'New'} ${names[type].toLowerCase()}`;
    $('#record-fields').innerHTML = fieldsHtml(schema(type), record); $('#form-error').textContent = '';
    $('#record-dialog').showModal();
  }
  function settings() {
    return `<div class="section-title"><div><p class="eyebrow">MAKE IT YOURS</p><h1>Workspace settings</h1><p>Local preferences for this dashboard. These do not update the public website.</p></div></div><section class="panel settings-panel"><h2>Business profile</h2><p>Use these details as a reference while managing your workspace.</p><form id="settings-form"><div class="form-grid">${fieldsHtml([field('business', 'Business name', 'text', { required: true }), field('currency', 'Display currency', 'select', { options: ['USD', 'PKR', 'GBP'], required: true }), field('contact', 'Business phone', 'tel'), field('email', 'Business email', 'email')], state.settings)}</div><p class="cell-sub">Changing currency relabels existing amounts; it does not convert their values.</p><button class="button primary" type="submit">Save preferences</button></form></section><section class="panel settings-panel"><h2>Your workspace data</h2><p>This dashboard has no login or server connection. Records stay in this browser and are not shared across devices. Use fictional data until secure backend storage and authentication are added.</p><div class="settings-actions"><button class="button secondary" data-backup>↓ Download JSON backup</button><button class="button danger" data-reset>Reset sample workspace</button></div></section>`;
  }
  function render() {
    const label = view[0].toUpperCase() + view.slice(1);
    document.title = `${label} | Noble Paint Admin`; $('#breadcrumb').textContent = label;
    $('#enquiry-count').textContent = state.enquiries.filter(r => r.status === 'New').length;
    document.querySelectorAll('[data-view]').forEach(a => { if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#view-content').innerHTML = (storageWarning ? `<div class="storage-warning" role="alert">${escape(storageWarning)}</div>` : '') + (view === 'overview' ? overview() : view === 'settings' ? settings() : list());
    if (names[view]) renderTable();
  }
  function route() {
    const menuWasOpen = $('#sidebar').classList.contains('open');
    const requested = location.hash.slice(1);
    view = ['overview', 'settings', ...Object.keys(names)].includes(requested) ? requested : 'overview';
    search = ''; filter = 'All'; page = 1; setMenu(false); render();
    if (menuWasOpen) $('#main').focus();
  }
  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCsv(type) {
    const records = names[view] && view === type ? filtered() : state[type];
    const keys = schema(type).map(f => f.key);
    const csvCell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
    download(`noble-${type}-${localDate()}.csv`, '\uFEFF' + [keys, ...records.map(r => keys.map(k => r[k]))].map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
    toast(`${records.length} records exported.`);
  }
  function validate(form) {
    form.querySelectorAll('input, textarea').forEach(input => {
      input.setCustomValidity('');
      if (input.required && !input.value.trim()) input.setCustomValidity('Please complete this field.');
      if (input.type === 'tel' && input.value.trim() && (!/^[+\d\s().-]+$/.test(input.value) || input.value.replace(/\D/g, '').length < 7 || input.value.replace(/\D/g, '').length > 15)) input.setCustomValidity('Enter a phone number with 7 to 15 digits.');
    });
    return form.reportValidity();
  }
  document.addEventListener('input', event => {
    if (event.target.setCustomValidity) event.target.setCustomValidity('');
    if (event.target.id === 'record-search') { search = event.target.value.trim(); page = 1; renderTable(); }
  });
  document.addEventListener('change', event => { if (event.target.id === 'status-filter') { filter = event.target.value; page = 1; renderTable(); } });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-add')) openEditor(button.dataset.add);
    if (button.hasAttribute('data-edit')) openEditor(button.dataset.edit, button.dataset.id);
    if (button.hasAttribute('data-close-dialog')) $('#record-dialog').close();
    if (button.hasAttribute('data-page')) { page += button.dataset.page === 'next' ? 1 : -1; renderTable(); }
    if (button.hasAttribute('data-export')) exportCsv(button.dataset.export);
    if (button.hasAttribute('data-delete')) {
      const type = button.dataset.delete, record = state[type].find(r => r.id === button.dataset.id);
      if (!record || !confirm(`Delete ${record.name} from this workspace? This cannot be undone.`)) return;
      state[type] = state[type].filter(r => r.id !== record.id); log(`Deleted ${names[type].toLowerCase()}: ${record.name}`);
      const saved = persist(); render(); toast(saved ? 'Record deleted from this browser.' : 'Record deleted for this session only. Export a backup to keep your changes.');
    }
    if (button.hasAttribute('data-convert')) {
      const r = state.enquiries.find(r => r.id === button.dataset.convert);
      if (r) openEditor('projects', null, { name: `${r.name} — ${r.service}`, client: r.name, service: r.service, notes: r.notes, sourceEnquiry: r.id });
    }
    if (button.hasAttribute('data-backup')) download(`noble-workspace-${localDate()}.json`, JSON.stringify(state, null, 2), 'application/json');
    if (button.hasAttribute('data-reset') && confirm('Replace this browser workspace with fresh sample data? Download a backup first if you want to keep your records.')) {
      state = seed(); storageWarning = ''; const saved = persist(); render(); toast(saved ? 'Sample workspace reset.' : 'Sample workspace reset for this session only.');
    }
  });
  $('#record-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget; if (!editing || !validate(form)) return;
    const fields = schema(editing.type), values = Object.fromEntries(new FormData(form));
    for (const f of fields) values[f.key] = f.type === 'number' ? Number(values[f.key]) : String(values[f.key] ?? '').trim();
    if (editing.type === 'services' && state.services.some(r => r.id !== editing.id && r.name.toLowerCase() === values.name.toLowerCase())) { $('#form-error').textContent = 'A service with this name already exists.'; return; }
    if (editing.id) {
      const existing = state[editing.type].find(r => r.id === editing.id);
      if (!existing) return;
      // Keep historical assignments consistent when workspace labels change.
      if (editing.type === 'services') for (const type of ['enquiries', 'projects', 'appointments']) state[type].forEach(r => { if (r.service === existing.name) r.service = values.name; });
      if (editing.type === 'team') for (const type of ['projects', 'appointments']) state[type].forEach(r => { if (r.assignee === existing.name) r.assignee = values.name; });
      Object.assign(existing, values);
    } else {
      state[editing.type].unshift({ id: id(), ...values });
      if (editing.sourceEnquiry) { const source = state.enquiries.find(r => r.id === editing.sourceEnquiry); if (source) source.status = 'Won'; }
    }
    log(`${editing.id ? 'Updated' : 'Added'} ${names[editing.type].toLowerCase()}: ${values.name}`);
    const saved = persist(); $('#record-dialog').close(); render(); toast(saved ? 'Changes saved in this browser.' : 'Changes kept for this session only. Export a backup before closing.');
  });
  document.addEventListener('submit', event => {
    if (event.target.id !== 'settings-form') return;
    event.preventDefault(); if (!validate(event.target)) return;
    state.settings = Object.fromEntries([...new FormData(event.target)].map(([k, v]) => [k, v.trim()]));
    log('Updated workspace preferences'); const saved = persist(); render(); toast(saved ? 'Workspace preferences saved. Public website unchanged.' : 'Preferences updated for this session only.');
  });
  function setMenu(open) {
    $('#sidebar').classList.toggle('open', open); $('#sidebar-scrim').hidden = !open;
    $('#menu-toggle').setAttribute('aria-expanded', String(open)); $('#menu-toggle').setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (window.matchMedia('(max-width: 800px)').matches) $('#sidebar').inert = !open;
    if (open) $('#sidebar a').focus();
  }
  $('#menu-toggle').addEventListener('click', () => setMenu($('#menu-toggle').getAttribute('aria-expanded') !== 'true'));
  $('#sidebar-scrim').addEventListener('click', () => { setMenu(false); $('#menu-toggle').focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#record-dialog').open) { setMenu(false); if (matchMedia('(max-width: 800px)').matches) $('#menu-toggle').focus(); }
    if (event.key === 'Tab' && $('#sidebar').classList.contains('open') && !$('#record-dialog').open) {
      const links = [...$('#sidebar').querySelectorAll('a')], first = links[0], last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  matchMedia('(max-width: 800px)').addEventListener('change', event => { setMenu(false); $('#sidebar').inert = event.matches; });
  $('#record-dialog').addEventListener('close', () => { editing = null; $('#record-fields').innerHTML = ''; });
  window.addEventListener('hashchange', route);
  $('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  route();
})();
