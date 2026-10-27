import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createPasswordResetService } from '../src/services/passwordResets.js';
import { hashPassword, verifyPassword } from '../src/services/passwords.js';

const originalPassword = 'the original admin password';
const newPassword = 'the replacement admin password';

async function fixture(run) {
  const record = {
    _id: 'admin-id',
    email: 'admin@example.com',
    passwordHash: await hashPassword(originalPassword)
  };
  let sentToken;
  let currentTime = new Date();
  const chain = value => ({ select() { return this; }, lean: async () => value });
  const model = {
    findOne: query => chain(query.email === record.email ? { _id: record._id } : null),
    updateOne(filter, update) {
      if (filter._id !== record._id || (filter.passwordResetTokenHash && filter.passwordResetTokenHash !== record.passwordResetTokenHash)) return Promise.resolve({});
      Object.assign(record, update.$set || {});
      for (const key of Object.keys(update.$unset || {})) delete record[key];
      return Promise.resolve({});
    },
    findOneAndUpdate(filter, update) {
      if (filter.passwordResetTokenHash !== record.passwordResetTokenHash ||
          !record.passwordResetExpiresAt || record.passwordResetExpiresAt <= filter.passwordResetExpiresAt.$gt) return null;
      Object.assign(record, update.$set);
      for (const key of Object.keys(update.$unset || {})) delete record[key];
      return record;
    }
  };
  const passwordResets = createPasswordResetService(model, async (email, token) => {
    assert.equal(email, record.email);
    sentToken = token;
  }, { now: () => currentTime });
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters',
    siteUrl: 'http://localhost:5000',
    findAdmin: async email => email === record.email ? { ...record } : null,
    accounts: { get: async id => id === record._id ? { ...record, sessionVersion: record.sessionVersion || '' } : null },
    getOverview: async () => ({ total: 0 }),
    passwordResets
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  const post = (path, body, Cookie) => fetch(`${base}/${path}`, {
    method: 'POST', headers: { ...headers, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body)
  });
  try {
    await run({ base, record, post, getToken: () => sentToken, setTime: value => { currentTime = value; } });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('password reset request does not disclose whether an admin email exists', async () => fixture(async ({ post }) => {
  const existing = await post('forgot-password', { email: ' ADMIN@EXAMPLE.COM ' });
  const unknown = await post('forgot-password', { email: 'unknown@example.com' });
  assert.equal(existing.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(await existing.json(), await unknown.json());
}));

test('reset links are single-use, expire, change the password, and revoke existing sessions', async () => fixture(async ({ base, record, post, getToken, setTime }) => {
  const login = async password => {
    const response = await post('login', { email: record.email, password });
    return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const oldSession = await login(originalPassword);
  assert.equal(oldSession.response.status, 200);
  await post('forgot-password', { email: record.email });
  const token = getToken();
  assert.match(token, /^[a-f\d]{64}$/i);
  assert.notEqual(record.passwordResetTokenHash, token);

  const invalid = await post('reset-password', { token, newPassword, confirmPassword: 'mismatch' });
  assert.equal(invalid.status, 400);
  const reset = await post('reset-password', { token, newPassword, confirmPassword: newPassword });
  assert.equal(reset.status, 200);
  assert.equal(await verifyPassword(newPassword, record.passwordHash), true);
  assert.equal(record.passwordResetTokenHash, undefined);
  assert.equal((await post('reset-password', { token, newPassword, confirmPassword: newPassword })).status, 400);
  assert.equal((await fetch(`${base}/overview`, { headers: { Cookie: oldSession.cookie } })).status, 401);
  assert.equal((await login(newPassword)).response.status, 200);

  await post('forgot-password', { email: record.email });
  const expiredToken = getToken();
  setTime(new Date(Date.now() + 31 * 60 * 1000));
  const expired = await post('reset-password', { token: expiredToken, newPassword, confirmPassword: newPassword });
  assert.equal(expired.status, 400);
  assert.equal(await verifyPassword(newPassword, record.passwordHash), true);
}));

test('password reset rejects malformed email requests and short passwords', async () => fixture(async ({ post }) => {
  assert.equal((await post('forgot-password', { email: 'not-an-email' })).status, 400);
  const malformed = await post('reset-password', {
    token: 'not-a-token', newPassword: 'short', confirmPassword: 'short'
  });
  assert.equal(malformed.status, 400);
}));
