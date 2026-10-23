import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../frontend/assets/js/admin-settings.js', import.meta.url), 'utf8');
async function mount(fail = false) {
  const elements = { 'admin-status': {}, 'account-email-feedback': {}, 'account-password-feedback': {} };
  function field() { return { value: '', setCustomValidity(value) { this.error = value; } }; }
  const forms = {};
  for (const [type, names] of Object.entries({ email: ['email', 'currentPassword'], password: ['currentPassword', 'newPassword', 'confirmPassword'] })) {
    const fields = Object.fromEntries(names.map(name => [name, field()])), button = { disabled: true };
    forms[type] = { fields, button, handlers: {}, querySelector: () => button, elements: { namedItem: name => fields[name] }, reportValidity: () => true, reset() { for (const input of Object.values(fields)) input.value = ''; }, addEventListener(event, handler) { this.handlers[event] = handler; } };
    elements[`account-${type}-form`] = forms[type];
  }
  const writes = [], redirects = [];
  vm.runInContext(source, vm.createContext({
    document: { getElementById: id => elements[id] },
    location: { replace: path => redirects.push(path) },
    FormData: class { constructor(form) { return Object.entries(form.fields).map(([key, input]) => [key, input.value]); } },
    fetch: async (path, options) => {
      if (options.method) {
        writes.push({ path, body: JSON.parse(options.body) });
        return { ok: !fail, status: fail ? 403 : 200, json: async () => fail ? { message: 'Current password is incorrect.' } : { signInRequired: true } };
      }
      return { ok: true, status: 200, json: async () => ({ email: 'admin@example.com' }) };
    }
  }));
  await new Promise(resolve => setImmediate(resolve));
  return { elements, forms, writes, redirects };
}

test('account settings load the current email and redirect to login after a successful change', async () => {
  const ui = await mount();
  assert.equal(ui.forms.email.fields.email.value, 'admin@example.com');
  assert.equal(ui.forms.email.button.disabled, false);
  ui.forms.email.fields.email.value = 'new@example.com'; ui.forms.email.fields.currentPassword.value = 'test current password';
  await ui.forms.email.handlers.submit({ preventDefault() {} });
  assert.equal(ui.writes[0].path, '/api/admin/account/email');
  assert.equal(ui.redirects[0], '/admin/login.html?accountUpdated=1');
  assert.equal(ui.forms.email.fields.currentPassword.value, '');
});

test('password confirmation prevents mismatched submissions and failures clear only the current password', async () => {
  const ui = await mount(true), form = ui.forms.password;
  form.fields.currentPassword.value = 'test current password'; form.fields.newPassword.value = 'a test new password'; form.fields.confirmPassword.value = 'does not match';
  await form.handlers.submit({ preventDefault() {} });
  assert.equal(ui.writes.length, 0); assert.match(form.fields.confirmPassword.error, /do not match/);
  form.fields.confirmPassword.value = form.fields.newPassword.value;
  await form.handlers.submit({ preventDefault() {} });
  assert.match(ui.elements['account-password-feedback'].textContent, /incorrect/);
  assert.equal(form.fields.currentPassword.value, ''); assert.equal(form.fields.newPassword.value, 'a test new password');
  assert.equal(form.button.disabled, false); assert.equal(ui.redirects.length, 0);
});
