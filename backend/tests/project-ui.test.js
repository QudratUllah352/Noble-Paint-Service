import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../frontend/assets/js/admin-projects.js', import.meta.url), 'utf8');
async function setup(enquiryStatus) {
  function element() { return { value: '', disabled: true, children: [], handlers: {}, setCustomValidity() {}, append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; }, addEventListener(event, fn) { this.handlers[event] = fn; } }; }
  const ids = ['project-form', 'project-filters', 'project-list', 'project-feedback', 'admin-status', 'project-previous', 'project-next', 'project-editor', 'project-customer', 'project-heading', 'project-clear'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  const fields = Object.fromEntries(['title', 'scope', 'startDate', 'targetDate', 'status', 'assignedMember'].map(name => [name, element()]));
  fields.status.value = 'Planned';
  const form = elements['project-form'], save = element();
  form.querySelector = () => save; form.reportValidity = () => true; form.elements = { namedItem: name => fields[name] };
  elements['project-filters'].elements = { namedItem: () => element() };
  let fail = false;
  const writes = [];
  vm.runInContext(source, vm.createContext({
    document: { getElementById: id => elements[id], createElement: element }, URLSearchParams,
    location: { search: '?enquiry=111111111111111111111111', replace() {} },
    FormData: class { constructor() { return Object.entries(fields).map(([name, field]) => [name, field.value]); } },
    fetch: async (path, options) => {
      if (options.method) { writes.push(JSON.parse(options.body)); return { ok: !fail, status: fail ? 503 : 200, json: async () => fail ? { message: 'Storage unavailable.' } : { project: {} } }; }
      return { ok: true, status: 200, json: async () => path.endsWith('/project')
        ? { enquiry: { fullName: 'Customer', status: enquiryStatus, projectDetails: 'Paint the kitchen' }, project: null }
        : path.includes('/team?') ? { items: [{ _id: '1234567890abcdef12345678', name: 'Painter', role: 'Lead' }], total: 1 }
          : { items: [], total: 0, pageSize: 25 } };
    }
  }));
  await new Promise(resolve => setImmediate(resolve));
  return { fields, form, save, elements, writes, fail: () => { fail = true; } };
}

test('project editor loads enquiry details and team selection, and preserves failed saves', async () => {
  const ui = await setup('Won');
  assert.equal(ui.save.disabled, false);
  assert.equal(ui.fields.scope.value, 'Paint the kitchen');
  assert.ok(ui.fields.assignedMember.children.some(option => option.textContent === 'Painter — Lead'));
  ui.fields.assignedMember.value = '1234567890abcdef12345678';
  await ui.form.handlers.submit({ preventDefault() {} });
  assert.equal(ui.writes[0].status, 'Planned');
  assert.match(ui.elements['project-feedback'].textContent, /Project saved/);
  ui.fail(); ui.fields.scope.value = 'Updated scope';
  await ui.form.handlers.submit({ preventDefault() {} });
  assert.equal(ui.fields.scope.value, 'Updated scope');
  assert.match(ui.elements['project-feedback'].textContent, /Storage unavailable/);
  assert.equal(ui.save.disabled, false);
});

test('project editor explains when an enquiry must be marked Won', async () => {
  const ui = await setup('New');
  assert.equal(ui.save.disabled, true);
  assert.match(ui.elements['project-feedback'].textContent, /Mark this enquiry Won/);
});
