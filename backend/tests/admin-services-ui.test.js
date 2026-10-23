import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('service editor serializes categories and features, supports edits, and preserves failed saves', async () => {
  const source = await readFile(new URL('../../frontend/assets/js/admin-services.js', import.meta.url), 'utf8');
  function node() { return { value: '', checked: false, children: [], handlers: {}, setCustomValidity() {}, focus() {}, scrollIntoView() {}, append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; }, addEventListener(event, fn) { this.handlers[event] = fn; } }; }
  const ids = ['service-form', 'service-filters', 'service-list', 'service-feedback', 'admin-status', 'service-heading', 'service-new', 'service-previous', 'service-next', 'service-clear'];
  const elements = Object.fromEntries(ids.map(id => [id, node()]));
  const names = ['title', 'description', 'imageUrl', 'imageAlt', 'badge', 'status', 'sortOrder', 'features'];
  const fields = Object.fromEntries(names.map(name => [name, node()]));
  const categories = ['residential', 'commercial', 'specialty'].map(value => ({ ...node(), value }));
  const form = elements['service-form'], save = node();
  form.elements = { namedItem: name => fields[name] };
  form.querySelector = selector => selector.startsWith('button') ? save : categories[0];
  form.querySelectorAll = selector => selector.includes('[name=') ? categories : [...Object.values(fields), ...categories];
  form.reportValidity = () => true;
  form.reset = () => { for (const field of Object.values(fields)) field.value = ''; fields.status.value = 'Hidden'; fields.sortOrder.value = '100'; for (const field of categories) field.checked = false; };
  elements['service-filters'].elements = { namedItem: () => node() };
  let record = null, fail = false;
  const writes = [];
  vm.runInContext(source, vm.createContext({
    document: { getElementById: id => elements[id], createElement: node }, URLSearchParams, location: { replace() {} },
    FormData: class { get(name) { return fields[name].value; } getAll() { return categories.filter(field => field.checked).map(field => field.value); } },
    fetch: async (path, options) => {
      if (options.method) {
        writes.push({ path, method: options.method, body: JSON.parse(options.body) });
        if (fail) return { ok: false, status: 503, json: async () => ({ message: 'Save unavailable.' }) };
        record = { ...JSON.parse(options.body), _id: '1234567890abcdef12345678' };
        return { ok: true, json: async () => ({ service: record }) };
      }
      return { ok: true, json: async () => ({ items: record ? [record] : [], total: record ? 1 : 0, pageSize: 25 }) };
    }
  }));
  await new Promise(resolve => setImmediate(resolve));
  fields.title.value = 'Interior painting'; fields.description.value = 'Walls'; fields.status.value = 'Active'; fields.sortOrder.value = '10'; fields.features.value = 'Preparation\n\nFinishing'; categories[0].checked = true;
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(writes[0].method, 'POST'); assert.equal(writes[0].body.sortOrder, 10);
  assert.deepEqual(writes[0].body.categories, ['residential']); assert.deepEqual(writes[0].body.features, ['Preparation', 'Finishing']);
  const edit = elements['service-list'].children[0].children.find(item => item.textContent === 'Edit service');
  edit.handlers.click(); assert.equal(fields.title.value, 'Interior painting'); assert.equal(categories[0].checked, true);
  fields.status.value = 'Hidden'; fail = true;
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(fields.status.value, 'Hidden'); assert.match(elements['service-feedback'].textContent, /Save unavailable/);
  assert.equal(save.disabled, false);
  fail = false; await form.handlers.submit({ preventDefault() {} });
  assert.equal(writes.at(-1).method, 'PUT'); assert.equal(record.status, 'Hidden');
});
