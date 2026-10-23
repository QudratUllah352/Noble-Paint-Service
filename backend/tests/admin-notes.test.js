import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/passwords.js';
import { validateHomeEnquiry } from '../src/validators/homeEnquiry.js';
import { validateConsultation } from '../src/validators/consultation.js';

test('private notes require login and same origin, validate input, and preserve other fields', async () => {
  const record = { _id: 'abcdef0123456789abcdef01', fullName: 'Customer', status: 'New', adminNotes: '' };
  let writes = 0;
  const passwordHash = await hashPassword('a long test password');
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000',
    findAdmin: async () => ({ _id: 'admin', passwordHash }),
    listConsultations: async () => ({ items: [record], total: 1, page: 1, pageSize: 25 }),
    updateConsultationNotes: async (id, notes) => {
      writes++;
      if (id === '000000000000000000000000') return null;
      if (id === '111111111111111111111111') throw new Error('private storage information');
      record.adminNotes = notes;
      return record;
    }
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  const patch = (body, Cookie, id = record._id, Origin = headers.Origin) => fetch(`${base}/consultations/${id}/notes`, { method: 'PATCH', headers: { ...headers, Origin, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await patch({ adminNotes: 'private' })).status, 401);
    const login = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'admin@example.com', password: 'a long test password' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await patch({ adminNotes: 'private' }, cookie, record._id, 'https://evil.example')).status, 403);
    for (const body of [null, [], {}, { adminNotes: {} }, { adminNotes: 'x'.repeat(5001) }, { adminNotes: 'valid', status: 'Won' }]) {
      assert.equal((await patch(body, cookie)).status, 400);
    }
    assert.equal((await patch({ adminNotes: 'valid' }, cookie, 'invalid-id')).status, 400);
    assert.equal(writes, 0);
    const response = await patch({ adminNotes: '  Called customer\nEstimate requested.  ' }, cookie);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).adminNotes, 'Called customer\nEstimate requested.');
    const listing = await fetch(`${base}/consultations`, { headers: { Cookie: cookie } });
    assert.equal((await listing.json()).items[0].adminNotes, record.adminNotes);
    assert.equal(record.fullName, 'Customer');
    assert.equal(record.status, 'New');
    assert.equal((await patch({ adminNotes: '' }, cookie)).status, 200);
    assert.equal(record.adminNotes, '');
    assert.equal((await patch({ adminNotes: 'test' }, cookie, '000000000000000000000000')).status, 404);
    const failure = await patch({ adminNotes: 'test' }, cookie, '111111111111111111111111');
    assert.equal(failure.status, 503);
    assert.doesNotMatch(await failure.text(), /private storage/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('public form validators cannot set private notes', () => {
  for (const validate of [validateHomeEnquiry, validateConsultation]) {
    assert.equal(validate({ adminNotes: 'injected note' }).value.adminNotes, undefined);
  }
});
