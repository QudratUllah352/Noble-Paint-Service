import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('team editor saves new members, loads edits and keeps failed changes for retry', async () => {
  const source = await readFile(new URL('../../frontend/assets/js/admin-team.js', import.meta.url), 'utf8');
  function element() {
    return { value: '', handlers: {}, children: [], setCustomValidity() {}, focus() {}, scrollIntoView() {}, append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; }, addEventListener(event, fn) { this.handlers[event] = fn; } };
  }
  const ids = ['team-form', 'team-filters', 'team-list', 'team-feedback', 'admin-status', 'team-editor-heading', 'team-new', 'team-previous', 'team-next', 'team-clear'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  const fields = Object.fromEntries(['name', 'role', 'email', 'phone', 'status'].map(name => [name, element()]));
  const form = elements['team-form'], save = element();
  form.elements = { namedItem: name => fields[name] };
  form.querySelector = () => save;
  form.reportValidity = () => true;
  form.reset = () => Object.entries(fields).forEach(([name, field]) => { field.value = name === 'status' ? 'Active' : ''; });
  elements['team-filters'].elements = { namedItem: () => ({ value: '' }) };
  let record = null, fail = false;
  const writes = [];
  vm.runInContext(source, vm.createContext({
    document: { getElementById: id => elements[id], createElement: element }, URLSearchParams,
    location: { replace() {} },
    FormData: class { constructor() { return Object.entries(fields).map(([name, field]) => [name, field.value]); } },
    fetch: async (path, options) => {
      if (options.method) {
        writes.push({ path, method: options.method, body: JSON.parse(options.body) });
        if (fail) return { ok: false, status: 503, json: async () => ({ message: 'Save unavailable.' }) };
        record = { ...JSON.parse(options.body), _id: '1234567890abcdef12345678' };
        return { ok: true, status: 200, json: async () => ({ member: record }) };
      }
      return { ok: true, status: 200, json: async () => ({ items: record ? [record] : [], total: record ? 1 : 0, pageSize: 25 }) };
    }
  }));
  await new Promise(resolve => setImmediate(resolve));
  Object.assign(fields.name, { value: 'Test Painter' });
  fields.role.value = 'Painter'; fields.status.value = 'Active';
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(writes[0].method, 'POST');
  assert.equal(fields.name.value, '');
  const edit = elements['team-list'].children[0].children.find(item => item.textContent === 'Edit member');
  edit.handlers.click();
  assert.equal(fields.name.value, 'Test Painter');
  fields.status.value = 'Inactive';
  fail = true;
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(fields.status.value, 'Inactive');
  assert.match(elements['team-feedback'].textContent, /Save unavailable/);
  assert.equal(save.disabled, false);
  fail = false;
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(writes.at(-1).method, 'PUT');
  assert.match(writes.at(-1).path, /team\/1234567890abcdef12345678$/);
  assert.equal(record.status, 'Inactive');
});
