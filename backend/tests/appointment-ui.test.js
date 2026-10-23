import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../frontend/assets/js/admin-appointments.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('appointment editor sends UTC time and keeps entered details on a failed save', async () => {
  function element() {
    return { value: '', handlers: {}, children: [], setAttribute() {}, setCustomValidity(value) { this.validityMessage = value; }, append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; }, addEventListener(name, fn) { this.handlers[name] = fn; } };
  }
  const ids = ['admin-status', 'appointment-list', 'appointment-previous', 'appointment-next', 'appointment-filter', 'appointment-form', 'appointment-feedback', 'appointment-editor', 'appointment-zone', 'appointment-heading', 'appointment-email-actions'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  const fields = Object.fromEntries(['startsAt', 'durationMinutes', 'assignedMember', 'address', 'status'].map(name => [name, element()]));
  const form = elements['appointment-form'];
  const button = element();
  form.querySelector = () => button;
  form.elements = { namedItem: name => fields[name] };
  form.reportValidity = () => true;
  elements['appointment-filter'].elements = { namedItem: () => ({ value: '' }) };
  const requests = [];
  let fail = false, saveVersion = 0, deliveredVersion = '', history = [];
  const context = vm.createContext({
    document: { getElementById: id => elements[id], createElement: element },
    location: { search: '?enquiry=abcdef0123456789abcdef01', replace() {} },
    URLSearchParams, Intl,
    FormData: class { constructor() { return Object.entries(fields).map(([name, field]) => [name, field.value]); } },
    fetch: async (path, options) => {
      requests.push({ path, options });
      if (path.includes('/team?')) return { ok: true, status: 200, json: async () => ({ items: [{ _id: '1234567890abcdef12345678', name: 'Test Painter', role: 'Painter' }], total: 1, pageSize: 25 }) };
      if (options.method === 'POST') {
        deliveredVersion = JSON.parse(options.body).version;
        history = [{ type: fields.status.value, status: 'Accepted', recipient: 'customer@example.com', startedAt: '2026-01-01T00:00:00.000Z' }];
        return { ok: true, status: 200, json: async () => ({ message: 'Email accepted.', emailState: 'Accepted', emailVersion: deliveredVersion, emailHistory: history }) };
      }
      if (options.method === 'PUT') return { ok: !fail, status: fail ? 503 : 200, json: async () => fail ? { message: 'Storage unavailable.' } : { appointment: { ...JSON.parse(options.body), updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, saveVersion++)).toISOString() } } };
      return { ok: true, status: 200, json: async () => path.includes('/appointment?') || path.endsWith('/appointment') ? { appointment: null } : { items: [{ consultation: { _id: 'abcdef0123456789abcdef01', fullName: 'Customer' }, status: 'Scheduled', startsAt: '2099-06-01T09:00:00.000Z', timeZone: 'Asia/Karachi', updatedAt: '2026-01-01T00:00:00.000Z', emailState: deliveredVersion ? 'Accepted' : 'Idle', emailVersion: deliveredVersion, emailHistory: history }], total: 1, pageSize: 25 } };
    }
  });
  vm.runInContext(source, context);
  await tick();
  assert.equal(button.disabled, false);
  fields.startsAt.value = '2099-06-01T10:00';
  fields.durationMinutes.value = '60';
  assert.ok(fields.assignedMember.children.some(option => option.textContent === 'Test Painter — Painter'));
  fields.assignedMember.value = '1234567890abcdef12345678';
  fields.address.value = '12 Test Street';
  fields.status.value = 'Scheduled';
  await form.handlers.submit({ preventDefault() {} });
  const request = requests.find(item => item.options.method === 'PUT');
  const body = JSON.parse(request.options.body);
  assert.equal(body.startsAt, new Date('2099-06-01T10:00').toISOString());
  assert.equal(body.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.equal(body.durationMinutes, 60);
  assert.equal(body.assignedMember, '1234567890abcdef12345678');
  assert.equal(body.assignedTo, undefined);
  assert.match(elements['appointment-feedback'].textContent, /Appointment saved/);
  const mailButton = elements['appointment-email-actions'].children.find(item => item.textContent === 'Send confirmation email');
  assert.ok(mailButton, 'The email action must be visible directly below the save form.');
  const listButton = elements['appointment-list'].children[0].children.find(item => item.textContent === 'Send confirmation email');
  await mailButton.handlers.click();
  assert.equal(mailButton.disabled, true);
  assert.equal(mailButton.textContent, 'Email accepted');
  assert.equal(listButton.disabled, true, 'The same appointment should not remain sendable from its list card.');
  assert.equal(requests.filter(item => item.options.method === 'POST').length, 1);
  await mailButton.handlers.click();
  assert.equal(requests.filter(item => item.options.method === 'POST').length, 1);
  vm.runInContext(source, context);
  await tick();
  const reloadedCard = elements['appointment-list'].children[0];
  const persistedButton = reloadedCard.children.find(item => item.textContent === 'Email accepted');
  assert.ok(persistedButton, 'A fresh script load must use persisted acceptance to prevent a duplicate email.');
  assert.equal(persistedButton.disabled, true);
  const historyView = reloadedCard.children.find(item => item.children?.some(child => child.textContent === 'Email history'));
  assert.ok(historyView.children.some(item => item.textContent?.includes('Accepted by SMTP')));
  fail = true;
  await form.handlers.submit({ preventDefault() {} });
  assert.match(elements['appointment-feedback'].textContent, /Storage unavailable/);
  assert.equal(fields.address.value, '12 Test Street');
  assert.equal(button.disabled, false);
  fail = false;
  fields.status.value = 'Completed';
  await form.handlers.submit({ preventDefault() {} });
  const completionButton = elements['appointment-email-actions'].children.find(item => item.textContent === 'Send completion email');
  assert.ok(completionButton, 'Completed visits must have a completion email button below the save form.');
  await completionButton.handlers.click();
  assert.equal(completionButton.textContent, 'Email accepted');
  assert.equal(completionButton.disabled, true);
  assert.equal(elements['appointment-email-actions'].children.some(item => item.textContent === 'Send confirmation email'), false);
  fields.status.value = 'Cancelled';
  await form.handlers.submit({ preventDefault() {} });
  assert.ok(elements['appointment-email-actions'].children.some(item => item.textContent === 'Send cancellation email'));
  fields.startsAt.setCustomValidity('Time conflict.');
  form.handlers.change({ target: { name: 'assignedMember', setCustomValidity() {} } });
  assert.equal(fields.startsAt.validityMessage, '', 'Changing member must clear the previous time-conflict validation.');
});
