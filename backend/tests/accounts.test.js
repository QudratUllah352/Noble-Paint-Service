import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createAccountService } from '../src/services/accounts.js';
import { validateAccountChange } from '../src/validators/account.js';
import { hashPassword, verifyPassword } from '../src/services/passwords.js';

const password = 'a long current password', replacement = 'a different long password';

async function fixture(run) {
  const record = { _id: 'admin-id', email: 'admin@example.com', passwordHash: await hashPassword(password), createdAt: new Date('2026-01-01T00:00:00.000Z') };
  const chain = value => ({ select() { return this; }, lean: async () => value });
  const model = {
    findById: id => chain(id === record._id ? { ...record } : null),
    findOneAndUpdate(filter, update) {
      if (update.$set.email === 'other@example.com') throw Object.assign(new Error('duplicate'), { code: 11000 });
      if (filter._id !== record._id || filter.passwordHash !== record.passwordHash || filter.sessionVersion !== (record.sessionVersion ?? null)) return chain(null);
      Object.assign(record, update.$set);
      return chain({ email: record.email });
    }
  };
  const accounts = createAccountService(model);
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000', accounts,
    findAdmin: async email => email === record.email ? { ...record } : null,
    getOverview: async () => ({ total: 0 })
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  const login = async (email = record.email, value = password) => {
    const response = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ email, password: value }) });
    return { response, Cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const change = (type, body, Cookie, Origin = headers.Origin) => fetch(`${base}/account/${type}`, { method: 'PATCH', headers: { ...headers, Origin, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) });
  try { await run({ base, record, accounts, login, change }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('account validation checks exact fields, password confirmation and sign-in email', () => {
  assert.equal(validateAccountChange({ email: ' NEW@EXAMPLE.COM ', currentPassword: password }, 'email').value.email, 'new@example.com');
  for (const body of [null, { currentPassword: password, newPassword: 'short', confirmPassword: 'short' }, { currentPassword: password, newPassword: replacement, confirmPassword: 'different' }, { currentPassword: password, newPassword: password, confirmPassword: password }, { currentPassword: {}, newPassword: replacement, confirmPassword: replacement }, { currentPassword: password, newPassword: replacement, confirmPassword: replacement, adminId: 'other' }]) {
    assert.ok(Object.keys(validateAccountChange(body, 'password').errors).length);
  }
  assert.ok(validateAccountChange({ email: 'invalid', currentPassword: password }, 'email').errors.email);
});

test('account profile requires login and never returns password hashes or session versions', async () => fixture(async ({ base, login }) => {
  assert.equal((await fetch(`${base}/account`)).status, 401);
  const { Cookie } = await login();
  const profile = await fetch(`${base}/account`, { headers: { Cookie } });
  assert.equal(profile.status, 200); assert.match(profile.headers.get('cache-control'), /no-store/);
  const data = await profile.json(); assert.equal(data.email, 'admin@example.com');
  assert.deepEqual(Object.keys(data).sort(), ['createdAt', 'email']);
}));

test('password changes require the current password and revoke every existing session', async () => fixture(async ({ base, record, login, change }) => {
  const a = await login(), b = await login();
  const body = { currentPassword: password, newPassword: replacement, confirmPassword: replacement };
  assert.equal((await change('password', body)).status, 401);
  assert.equal((await change('password', body, a.Cookie, 'https://evil.example')).status, 403);
  assert.equal((await change('password', { ...body, currentPassword: 'wrong' }, a.Cookie)).status, 403);
  assert.equal(record.sessionVersion, undefined);
  const response = await change('password', body, a.Cookie);
  assert.equal(response.status, 200); assert.equal((await response.json()).signInRequired, true);
  assert.equal(await verifyPassword(replacement, record.passwordHash), true);
  assert.equal(await verifyPassword(password, record.passwordHash), false);
  for (const Cookie of [a.Cookie, b.Cookie]) assert.equal((await fetch(`${base}/overview`, { headers: { Cookie } })).status, 401);
  assert.equal((await login(record.email, password)).response.status, 401);
  const fresh = await login(record.email, replacement);
  assert.equal(fresh.response.status, 200);
  assert.equal((await fetch(`${base}/account`, { headers: { Cookie: fresh.Cookie } })).status, 200);
}));

test('email changes normalize the sign-in address, reject duplicates and revoke older sessions', async () => fixture(async ({ base, record, login, change }) => {
  const a = await login(), b = await login();
  const originalHash = record.passwordHash;
  assert.equal((await change('email', { email: 'other@example.com', currentPassword: password }, a.Cookie)).status, 409);
  assert.equal(record.email, 'admin@example.com'); assert.equal(record.sessionVersion, undefined);
  assert.equal((await change('email', { email: 'admin@example.com', currentPassword: password }, a.Cookie)).status, 400);
  assert.equal((await change('email', { email: ' NEW@EXAMPLE.COM ', currentPassword: password }, a.Cookie)).status, 200);
  assert.equal(record.email, 'new@example.com'); assert.equal(record.passwordHash, originalHash);
  assert.equal((await fetch(`${base}/account`, { headers: { Cookie: b.Cookie } })).status, 401);
  assert.equal((await login('admin@example.com')).response.status, 401);
  assert.equal((await login('new@example.com')).response.status, 200);
}));

test('stale account versions cannot change credentials and change attempts are rate limited', async () => fixture(async ({ record, accounts, login, change }) => {
  const { Cookie } = await login();
  await assert.rejects(accounts.change(record._id, 'email', { email: 'new@example.com', currentPassword: password }, 'stale-version'), { status: 409 });
  for (let i = 0; i < 10; i++) assert.equal((await change('password', {}, Cookie)).status, 400);
  assert.equal((await change('password', {}, Cookie)).status, 429);
  assert.equal(record.email, 'admin@example.com');
}));
