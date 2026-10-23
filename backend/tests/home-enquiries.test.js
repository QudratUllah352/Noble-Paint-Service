import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { Consultation } from '../src/models/Consultation.js';

const valid = { fullName: ' Test Customer ', emailAddr: 'test@example.com', phoneNumber: '+1 704 555 0123', projectDetails: 'Please paint my kitchen.' };

test('homepage enquiries validate, save without invented scheduling details, and reject invalid input', async () => {
  const saved = [];
  const server = createApp({ saveConsultation: async value => {
    await new Consultation(value).validate();
    saved.push(value);
    return { _id: 'test-id' };
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${base}/api/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const response = await post({ ...valid, status: 'Won', source: 'contact', consultTime: 'fake' });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).id, 'test-id');
    assert.equal(saved[0].source, 'homepage');
    assert.equal(saved[0].fullName, 'Test Customer');
    assert.equal(saved[0].status, undefined);
    assert.equal(saved[0].sqft, undefined);
    assert.equal(saved[0].consultTime, undefined);
    assert.equal(new Consultation(saved[0]).status, 'New');
    for (const patch of [{ fullName: '' }, { emailAddr: 'invalid' }, { phoneNumber: '12' }, { projectDetails: ' ' }, { projectDetails: 'x'.repeat(5001) }, { fullName: {} }]) {
      assert.equal((await post({ ...valid, ...patch })).status, 400);
    }
    assert.equal((await post(null)).status, 400);
    assert.equal(saved.length, 1);
    assert.equal((await fetch(`${base}/api/enquiries`)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('homepage storage errors do not report success', async () => {
  const server = createApp({ saveConsultation: async () => { throw new Error('private'); } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

const source = await readFile(new URL('../../frontend/assets/js/home-form.js', import.meta.url), 'utf8');
test('homepage UI blocks duplicate submits and clears only after successful persistence', async () => {
  let submit, resolve, resets = 0, calls = 0;
  const button = { disabled: false, setAttribute() {}, removeAttribute() {} };
  const form = { querySelector: () => button, addEventListener: (name, fn) => { submit = fn; }, reset: () => { resets++; }, reportValidity() {} };
  const feedback = {};
  const fields = Object.fromEntries(['contact-name', 'contact-email', 'contact-phone', 'contact-message'].map(id => [id, { value: ' test ', setCustomValidity() {} }]));
  const context = vm.createContext({
    document: { addEventListener: (name, fn) => fn(), getElementById: id => id === 'appointment-form' ? form : id === 'form-feedback' ? feedback : fields[id] },
    validateDemoForm: () => true, AbortSignal,
    fetch: () => { calls++; return new Promise(done => { resolve = done; }); }
  });
  vm.runInContext(source, context);
  const event = { preventDefault() {} };
  const pending = submit(event);
  await submit(event);
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  assert.equal(resets, 0);
  resolve({ ok: false, json: async () => ({ message: 'Try again later' }) });
  await pending;
  assert.equal(resets, 0);
  assert.equal(feedback.textContent, 'Try again later');
  assert.equal(button.disabled, false);
  const success = submit(event);
  resolve({ ok: true, json: async () => ({ message: 'Received' }) });
  await success;
  assert.equal(resets, 1);
  assert.equal(feedback.textContent, 'Received');
});
