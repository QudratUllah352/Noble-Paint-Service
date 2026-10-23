import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../frontend/assets/js/contact.js', import.meta.url), 'utf8');

function setup(fetch) {
  const elements = Object.fromEntries(['consultation-form', 'submit-btn', 'consultation-status', 'fullName', 'emailAddr', 'phoneNumber', 'sqft', 'selectedProjectType', 'consultDate', 'consultTime', 'projectDetails', 'preview-contact', 'preview-type', 'preview-sqft', 'confirmation-msg', 'confirmation-modal'].map(id => [id, {
    value: id, textContent: '', disabled: false, shown: false,
    setAttribute() {}, removeAttribute() {}, setCustomValidity() {}, reportValidity() {},
    classList: { remove() { elements[id].shown = true; } }
  }]));
  const context = vm.createContext({ document: { getElementById: id => elements[id], querySelector: () => ({ focus() {} }) }, validateDemoForm: () => true, fetch, AbortSignal });
  vm.runInContext(source, context);
  return { elements, submit: () => context.handleConsultationSubmit() };
}

test('contact UI shows confirmation only after API success', async () => {
  let resolve;
  let calls = 0;
  const { elements, submit } = setup(() => { calls++; return new Promise(done => { resolve = done; }); });
  const pending = submit();
  assert.equal(elements['submit-btn'].disabled, true);
  assert.equal(elements['confirmation-modal'].shown, false);
  await submit();
  assert.equal(calls, 1);
  resolve({ ok: true, json: async () => ({ message: 'Received' }) });
  await pending;
  assert.equal(elements['confirmation-modal'].shown, true);
  assert.equal(elements['confirmation-msg'].textContent, 'Received');
  assert.equal(elements['submit-btn'].disabled, false);
});

test('contact UI preserves entries and keeps confirmation hidden on save failure', async () => {
  const { elements, submit } = setup(async () => ({ ok: false, json: async () => ({ message: 'Please try again later.' }) }));
  await submit();
  assert.equal(elements['confirmation-modal'].shown, false);
  assert.equal(elements.fullName.value, 'fullName');
  assert.equal(elements['consultation-status'].textContent, 'Please try again later.');
  assert.equal(elements['submit-btn'].disabled, false);
});
