import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const valid = { fullName: 'Test Customer', emailAddr: 'test@example.com', phoneNumber: '+1 704 555 0123', sqft: 'Under 800 sq ft', selectedProjectType: 'Interior', consultTime: 'Morning (8:00 AM - 11:30 AM)', consultDate: '', projectDetails: 'Walls' };

async function withApi(save, run) {
  const server = createApp({ saveConsultation: save }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { await new Promise(resolve => server.close(resolve)); }
}
const post = (base, value) => fetch(`${base}/api/consultations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

test('saves trimmed, allowlisted fields before returning success', async () => {
  let saved;
  await withApi(async value => { saved = value; return { _id: 'test-id' }; }, async base => {
    const response = await post(base, { ...valid, fullName: '  Test Customer  ', status: 'approved' });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).id, 'test-id');
    assert.equal(saved.fullName, 'Test Customer');
    assert.equal(saved.status, undefined);
    assert.equal((await fetch(`${base}/contact/`)).status, 200);
  });
});

test('rejects invalid contact fields, dates, enums and object injection without saving', async () => {
  await withApi(() => { throw new Error('must not save'); }, async base => {
    for (const patch of [{ fullName: '' }, { emailAddr: 'invalid' }, { phoneNumber: '12' }, { selectedProjectType: 'invalid' }, { consultDate: '2026-02-30' }, { sqft: {} }, { consultTime: 'invalid' }, { projectDetails: 'x'.repeat(5001) }]) {
      assert.equal((await post(base, { ...valid, ...patch })).status, 400);
    }
    assert.equal((await post(base, null)).status, 400);
    assert.equal((await fetch(`${base}/api/consultations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
  });
});

test('storage failures return a safe error and customer records are not publicly readable', async () => {
  await withApi(async () => { throw new Error('private database information'); }, async base => {
    const response = await post(base, valid);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private database/);
    assert.equal((await fetch(`${base}/api/consultations`)).status, 404);
  });
});
