'use strict';
(() => {
  const status = document.getElementById('admin-status');
  const list = document.getElementById('appointment-list');
  const previous = document.getElementById('appointment-previous');
  const next = document.getElementById('appointment-next');
  const filter = document.getElementById('appointment-filter');
  const form = document.getElementById('appointment-form');
  const feedback = document.getElementById('appointment-feedback');
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const enquiryId = new URLSearchParams(location.search).get('enquiry');
  const emailActions = document.getElementById('appointment-email-actions');
  const emailButtons = new Map();
  const acceptedEmails = new Set();
  const historyViews = new Map();
  let page = 1, filterStatus = '', version = 0;
  async function api(path, body, method = 'PUT') {
    const response = await fetch(`/api/admin/${path}`, {
      credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (response.status === 401) location.replace('/admin/login.html');
    if (!response.ok) {
      for (const [name, message] of Object.entries(data.errors || {})) {
        form.elements.namedItem(name)?.setCustomValidity(message);
      }
      form.reportValidity();
      throw Object.assign(new Error(data.message || 'Appointment request failed.'), {
        status: response.status, emailState: data.emailState, emailVersion: data.emailVersion, emailHistory: data.emailHistory
      });
    }
    return data;
  }
  function renderHistory(view, item) {
    view.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Email history';
    view.append(heading);
    if (!item.emailHistory?.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No recorded email attempts. Emails sent before history was added are not included.';
      view.append(empty);
      return;
    }
    const labels = { Scheduled: 'Confirmation', Cancelled: 'Cancellation', Completed: 'Completion' };
    const outcomes = { Accepted: 'Accepted by SMTP', Failed: 'Failed / delivery unconfirmed', Sending: 'Sending / outcome not yet recorded' };
    for (const entry of [...item.emailHistory].reverse()) {
      const line = document.createElement('p');
      const outcome = entry.recovery ? (entry.recovery.resolution === 'received' ? 'Receipt verified manually by admin' : 'Manual retry permitted by admin; prior delivery uncertain') : (outcomes[entry.status] || entry.status);
      line.textContent = `${labels[entry.type] || entry.type} · ${outcome} · ${new Date(entry.finishedAt || entry.startedAt).toLocaleString()} · ${entry.recipient}${entry.errorCode ? ` · ${entry.errorCode}` : ''}`;
      view.append(line);
    }
  }
  function updateHistory(key, data) {
    if (!data.emailHistory) return;
    for (const { item, view } of historyViews.get(key) || []) {
      Object.assign(item, { emailHistory: data.emailHistory, emailState: data.emailState, emailVersion: data.emailVersion });
      renderHistory(view, item);
    }
  }
  function appendEmailAction(target, item, id) {
    const key = `${id}:${item.updatedAt}`;
    const history = document.createElement('section');
    history.setAttribute('aria-label', 'Appointment email history');
    renderHistory(history, item);
    const views = historyViews.get(key) || [];
    views.push({ item, view: history });
    historyViews.set(key, views);
    target.append(history);
    const help = document.createElement('p');
    if (!id) {
      help.textContent = 'Email unavailable: the linked enquiry is missing.';
      target.append(help);
      return;
    }
    if (!['Scheduled', 'Cancelled', 'Completed'].includes(item.status)) {
      help.textContent = 'Email unavailable for this appointment status.';
      target.append(help);
      return;
    }
    if (item.status === 'Scheduled' && new Date(item.startsAt) <= new Date()) {
      help.textContent = 'This visit is in the past. Reschedule and save a future visit before sending confirmation.';
      target.append(help);
      return;
    }
    help.textContent = 'This emails the saved details to the customer. Unsaved form changes are not included.';
    const mail = document.createElement('button');
    mail.type = 'button';
    mail.className = 'button primary';
    if (item.emailState === 'Accepted' && item.emailVersion === item.updatedAt) acceptedEmails.add(key);
    const labels = { Scheduled: 'Send confirmation email', Cancelled: 'Send cancellation email', Completed: 'Send completion email' };
    mail.textContent = acceptedEmails.has(key) ? 'Email accepted' : item.emailState === 'Sending' ? 'Email in progress — check history' : labels[item.status];
    mail.disabled = acceptedEmails.has(key) || item.emailState === 'Sending';
    const buttons = emailButtons.get(key) || [];
    buttons.push(mail);
    emailButtons.set(key, buttons);
    const mailFeedback = document.createElement('p');
    mailFeedback.setAttribute('role', 'status');
    mail.addEventListener('click', async () => {
      if (mail.disabled) return;
      for (const button of buttons) button.disabled = true;
      mailFeedback.textContent = 'Sending email…';
      try {
        const result = await api(`consultations/${encodeURIComponent(id)}/appointment/email`, { version: item.updatedAt }, 'POST');
        acceptedEmails.add(key);
        updateHistory(key, result);
        mailFeedback.textContent = result.message;
        for (const button of buttons) button.textContent = 'Email accepted';
      } catch (error) {
        updateHistory(key, error);
        mailFeedback.textContent = error.message;
        for (const button of buttons) button.disabled = error.status === 503;
      }
    });
    target.append(help, mail, mailFeedback);
  }
  function showEditorEmail(appointment) {
    emailActions.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Email saved appointment';
    const summary = document.createElement('p');
    summary.textContent = `${appointment.status} · ${new Date(appointment.startsAt).toLocaleString(undefined, { timeZone: appointment.timeZone })} (${appointment.timeZone}) · ${appointment.durationMinutes || 60} minutes · ${appointment.address}`;
    emailActions.append(heading, summary);
    appendEmailAction(emailActions, appointment, enquiryId);
  }
  async function load() {
    const current = ++version;
    previous.disabled = next.disabled = true;
    list.replaceChildren();
    status.textContent = 'Loading appointments…';
    try {
      const data = await api(`appointments?${new URLSearchParams({ page: String(page), status: filterStatus })}`);
      if (current !== version) return;
      if (page > 1 && !data.items.length) { page = Math.max(1, Math.ceil(data.total / data.pageSize)); return load(); }
      for (const item of data.items) {
        const card = document.createElement('article');
        card.className = 'panel settings-panel';
        const heading = document.createElement('h2');
        heading.textContent = item.consultation?.fullName || 'Enquiry unavailable';
        card.append(heading);
        for (const [label, value] of [
          ['Visit', `${new Date(item.startsAt).toLocaleString(undefined, { timeZone: item.timeZone })} (${item.timeZone})`],
          ['Status', item.status], ['Address', item.address], ['Assigned to', item.assignedTo],
          ['Duration', `${item.durationMinutes || 60} minutes`],
          ['Email', item.consultation?.emailAddr || 'Not available'], ['Phone', item.consultation?.phoneNumber || 'Not available']
        ]) {
          const line = document.createElement('p'); line.textContent = `${label}: ${value}`; card.append(line);
        }
        if (item.consultation?._id) {
          const edit = document.createElement('a'); edit.className = 'button secondary'; edit.textContent = 'Edit / reschedule';
          edit.href = `/admin/appointments.html?enquiry=${encodeURIComponent(item.consultation._id)}`;
          card.append(edit);
        }
        appendEmailAction(card, item, item.consultation?._id);
        list.append(card);
      }
      status.textContent = data.total ? `${data.total} appointments · Page ${page}` : 'No appointments match this filter.';
      previous.disabled = page <= 1;
      next.disabled = page * data.pageSize >= data.total;
    } catch (error) { if (current === version) status.textContent = error.message; }
  }
  async function loadTeamOptions(appointment) {
    const select = form.elements.namedItem('assignedMember');
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = appointment && !appointment.assignedMember
      ? `Previous assignment: ${appointment.assignedTo}. Choose a saved team member.` : 'Choose an active team member';
    select.append(placeholder);
    let teamPage = 1, found = false, loaded = 0;
    while (true) {
      const data = await api(`team?status=Active&page=${teamPage}`);
      for (const member of data.items) {
        const option = document.createElement('option');
        option.value = member._id;
        option.textContent = `${member.name} — ${member.role}`;
        select.append(option);
        if (member._id === appointment?.assignedMember) found = true;
      }
      loaded += data.items.length;
      if (!data.items.length || loaded >= data.total) break;
      teamPage++;
    }
    if (appointment?.assignedMember && !found) {
      const { member } = await api(`team/${encodeURIComponent(appointment.assignedMember)}`);
      const option = document.createElement('option');
      option.value = member._id;
      option.textContent = `${member.name} — ${member.status} (current assignment)`;
      select.append(option);
    }
    select.value = appointment?.assignedMember || '';
    if (!loaded && !appointment?.assignedMember) placeholder.textContent = 'No active team members. Add one in Manage team members, then refresh.';
  }
  async function loadEditor() {
    if (!enquiryId) return;
    if (!/^[a-f\d]{24}$/i.test(enquiryId)) { status.textContent = 'Invalid enquiry link. Open scheduling from an enquiry.'; return; }
    const editor = document.getElementById('appointment-editor');
    editor.hidden = false;
    const button = form.querySelector('button');
    button.disabled = true;
    document.getElementById('appointment-zone').textContent = `Enter the visit time in your browser time zone: ${zone}. Existing visits are converted to this zone for editing.`;
    feedback.textContent = 'Loading appointment details…';
    try {
      const { appointment } = await api(`consultations/${enquiryId}/appointment`);
      await loadTeamOptions(appointment);
      if (appointment) {
        const date = new Date(appointment.startsAt);
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        form.elements.namedItem('startsAt').value = local;
        for (const name of ['address', 'status']) form.elements.namedItem(name).value = appointment[name];
        form.elements.namedItem('durationMinutes').value = String(appointment.durationMinutes || 60);
        document.getElementById('appointment-heading').textContent = 'Edit appointment';
        showEditorEmail(appointment);
      }
      feedback.textContent = appointment ? 'Appointment loaded.' : 'No appointment yet. Enter confirmed visit details.';
      button.disabled = false;
    } catch (error) { feedback.textContent = `${error.message} Reload to try again.`; }
  }
  function clearValidation(event) {
    event.target.setCustomValidity?.('');
    if (['startsAt', 'assignedMember', 'durationMinutes'].includes(event.target.name)) form.elements.namedItem('startsAt').setCustomValidity('');
  }
  form.addEventListener('input', clearValidation);
  form.addEventListener('change', clearValidation);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    if (button.disabled || !form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form));
    const date = new Date(fields.startsAt);
    if (!Number.isFinite(date.getTime())) { feedback.textContent = 'Choose a valid date and time.'; return; }
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    if (local !== fields.startsAt) { feedback.textContent = 'This local time does not exist because of a clock change. Choose another time.'; return; }
    button.disabled = true;
    feedback.textContent = 'Saving appointment…';
    try {
      const { appointment } = await api(`consultations/${enquiryId}/appointment`, { ...fields, durationMinutes: Number(fields.durationMinutes), startsAt: date.toISOString(), timeZone: zone });
      showEditorEmail(appointment);
      feedback.textContent = 'Appointment saved. Use the email action below to notify the customer.';
      document.getElementById('appointment-heading').textContent = 'Edit appointment';
      await load();
    } catch (error) { feedback.textContent = `${error.message} Your entries are kept here.`; }
    finally { button.disabled = false; }
  });
  filter.addEventListener('submit', event => { event.preventDefault(); page = 1; filterStatus = filter.elements.namedItem('status').value; load(); });
  previous.addEventListener('click', () => { page--; load(); });
  next.addEventListener('click', () => { page++; load(); });
  loadEditor();
  load();
})();
