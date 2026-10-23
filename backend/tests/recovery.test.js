import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryService } from '../src/services/recovery.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/passwords.js';

test('lock recovery cannot remove a replacement lock and must record its intent first', async () => {
  const events = [];
  let token = 'replacement';
  const service = createRecoveryService({}, { async deleteOne(filter) {
    assert.equal(events.length, 1);
    if (filter._id !== 'appointment-scheduling' || filter.token !== token) return { deletedCount: 0 };
    token = null; return { deletedCount: 1 };
  } }, {
    async create(value) { events.push(value); return { _id: 'audit' }; },
    async updateOne(filter, update) { events.at(-1).outcome = update.$set.outcome; }
  });
  await assert.rejects(service.releaseLock('old-token', 'admin'), /changed/);
  assert.equal(token, 'replacement'); assert.equal(events[0].outcome, 'Unchanged');
  events.length = 0;
  await service.releaseLock('replacement', 'admin');
  assert.equal(token, null); assert.equal(events[0].outcome, 'Applied');
  const brokenAudit = createRecoveryService({}, { deleteOne() { assert.fail('must not unlock without audit'); } }, { create() { throw new Error('audit unavailable'); } });
  await assert.rejects(brokenAudit.releaseLock('token', 'admin'), /audit unavailable/);
});

test('email recovery uses exact unresolved attempt and records a manual outcome without changing appointment version', async () => {
  const id = 'a'.repeat(24);
  for (const [resolution, state] of [['received', 'Accepted'], ['retry', 'Failed']]) {
    let current = 'Sending', calls = 0;
    const service = createRecoveryService({ async updateOne(filter, update, options) {
      calls++;
      assert.equal(filter._id, id); assert.equal(filter.emailAttemptId, 'attempt');
      assert.deepEqual(filter.emailHistory, { $elemMatch: { attemptId: 'attempt', status: 'Sending' } });
      assert.equal(options.timestamps, false); assert.equal(options.runValidators, true);
      assert.equal(update.$set['emailHistory.$.recovery'].resolution, resolution);
      assert.equal(update.$set['emailHistory.$.recovery'].admin, 'admin');
      assert.equal(update.$set['emailHistory.$.status'], state);
      if (current !== filter.emailState) return { matchedCount: 0 };
      current = update.$set.emailState; return { matchedCount: 1 };
    } }, {}, {});
    await service.resolveEmail(id, 'attempt', resolution, 'admin');
    assert.equal(current, state);
    await assert.rejects(service.resolveEmail(id, 'attempt', resolution, 'admin'), /changed/);
    await assert.rejects(service.resolveEmail(id, 'attempt', 'anything', 'admin'), /Provide/);
    assert.equal(calls, 2);
  }
});

test('recovery diagnostics require a session, disable caching, and expose no HTTP mutation', async () => {
  const passwordHash = await hashPassword('test-only-long-password');
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000',
    findAdmin: async () => ({ _id: 'admin', passwordHash }),
    recovery: { inspect: async () => ({ lock: null, emails: [], limit: 100 }) }
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  try {
    assert.equal((await fetch(`${base}/recovery`)).status, 401);
    const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
    const login = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'test@example.com', password: 'test-only-long-password' }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    const response = await fetch(`${base}/recovery`, { headers: { Cookie } });
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.deepEqual(await response.json(), { lock: null, emails: [], limit: 100 });
    assert.equal((await fetch(`${base}/recovery`, { method: 'POST', headers: { ...headers, Cookie }, body: '{}' })).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
