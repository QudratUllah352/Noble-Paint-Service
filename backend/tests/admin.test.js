import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/services/passwords.js';

test('password hashes are salted and checked correctly', async () => {
  const hash = await hashPassword('a long test password');
  assert.notEqual(hash, await hashPassword('a long test password'));
  assert.equal(await verifyPassword('a long test password', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('admin authentication, origin checks, pagination, logout and rate limiting', async () => {
  const hash = await hashPassword('a long test password');
  let reads = 0;
  const updates = [];
  let listOptions;
  let overviewReads = 0;
  const app = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-that-is-at-least-32-characters', siteUrl: 'http://localhost:5000',
    findAdmin: async email => email === 'admin@example.com' ? { _id: 'admin-id', passwordHash: hash } : null,
    getOverview: async () => { overviewReads++; return { total: 1, byStatus: { New: 1 }, recent: [] }; },
    updateConsultationStatus: async (id, status) => {
      updates.push({ id, status });
      if (id === '000000000000000000000000') return null;
      if (id === '111111111111111111111111') throw new Error('private database error');
      return { _id: id, status };
    },
    listConsultations: async options => { listOptions = options; reads++; return { items: [{ fullName: 'Private Customer' }], total: 1, page: options.page, pageSize: options.limit }; }
  } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:5000' };
  const credentials = { email: 'ADMIN@example.com', password: 'a long test password' };
  const login = body => fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify(body) });
  const enquiryId = 'abcdef0123456789abcdef01';
  const patch = (body, cookie, id = enquiryId, origin = headers.Origin) => fetch(`${base}/consultations/${id}/status`, {
    method: 'PATCH', headers: { ...headers, Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body)
  });
  try {
    assert.equal((await patch({ status: 'Contacted' })).status, 401);
    assert.equal(updates.length, 0);
    assert.equal((await fetch(`${base}/consultations`)).status, 401);
    assert.equal(reads, 0);
    assert.equal((await fetch(`${base}/overview`)).status, 401);
    assert.equal(overviewReads, 0);
    assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: JSON.stringify(credentials) })).status, 403);
    assert.equal((await login({ ...credentials, password: 'wrong' })).status, 401);
    assert.equal((await login({ email: { $ne: null }, password: 'wrong' })).status, 401);
    const response = await login(credentials);
    assert.equal(response.status, 200);
    const cookieHeader = response.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly/);
    assert.match(cookieHeader, /SameSite=Strict/);
    const Cookie = cookieHeader.split(';')[0];
    const overview = await fetch(`${base}/overview`, { headers: { Cookie } });
    assert.equal(overview.status, 200);
    assert.match(overview.headers.get('cache-control'), /no-store/);
    assert.equal((await overview.json()).total, 1);
    assert.equal(overviewReads, 1);
    assert.equal((await patch({ status: 'Contacted' }, Cookie, enquiryId, 'https://evil.example')).status, 403);
    for (const body of [{ status: 'invalid' }, { status: { $ne: null } }, { status: 'Won', emailAddr: 'overwrite@example.com' }, null, []]) {
      assert.equal((await patch(body, Cookie)).status, 400);
    }
    assert.equal((await patch({ status: 'Won' }, Cookie, 'invalid-id')).status, 400);
    assert.equal(updates.length, 0);
    for (const status of ['New', 'Contacted', 'Quoted', 'Won', 'Closed']) {
      const updated = await patch({ status }, Cookie);
      assert.equal(updated.status, 200);
      assert.deepEqual(await updated.json(), { id: enquiryId, status });
      assert.deepEqual(updates.at(-1), { id: enquiryId, status });
    }
    assert.equal((await patch({ status: 'Closed' }, Cookie, '000000000000000000000000')).status, 404);
    const failure = await patch({ status: 'Closed' }, Cookie, '111111111111111111111111');
    assert.equal(failure.status, 503);
    assert.doesNotMatch(await failure.text(), /private database/);
    const listing = await fetch(`${base}/consultations?page=2`, { headers: { Cookie } });
    assert.equal(listing.status, 200);
    assert.match(listing.headers.get('cache-control'), /no-store/);
    assert.equal((await listing.json()).page, 2);
    const filtered = await fetch(`${base}/consultations?page=3&search=%20Ali%2B%20&status=New`, { headers: { Cookie } });
    assert.equal(filtered.status, 200);
    assert.deepEqual(listOptions, { page: 3, limit: 25, search: 'Ali+', status: 'New' });
    const previousReads = reads;
    for (const query of ['search=a&search=b', `search=${'a'.repeat(121)}`, 'status=invalid', 'status=New&status=Won', 'page=1&page=2', 'page=1.5']) {
      assert.equal((await fetch(`${base}/consultations?${query}`, { headers: { Cookie } })).status, 400);
    }
    assert.equal(reads, previousReads);
    assert.equal((await fetch(`${base}/consultations?page=-1`, { headers: { Cookie } })).status, 400);
    assert.equal((await fetch(`${base}/session`, { headers: { Cookie } })).status, 200);
    assert.equal((await fetch(`${base}/logout`, { method: 'POST', headers: { ...headers, Cookie }, body: '{}' })).status, 200);
    assert.equal((await fetch(`${base}/consultations`, { headers: { Cookie } })).status, 401);
    assert.equal((await fetch(`${base}/overview`, { headers: { Cookie } })).status, 401);
    assert.equal((await patch({ status: 'Won' }, Cookie)).status, 401);
    for (let i = 0; i < 8; i++) await login({ ...credentials, password: 'wrong' });
    assert.equal((await login(credentials)).status, 429);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
