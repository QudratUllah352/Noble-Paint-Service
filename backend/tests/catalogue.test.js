import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/passwords.js';
import { validateService } from '../src/validators/service.js';
import { createCatalogueService, seedServices } from '../src/services/catalogue.js';
import { Service } from '../src/models/Service.js';

const id = '1234567890abcdef12345678';
const valid = { title: ' Interior painting ', description: 'Walls and ceilings.', categories: ['residential'], features: ['Surface preparation'], imageUrl: '', imageAlt: '', badge: 'Interior', sortOrder: 10, status: 'Active' };

test('service validation checks fields, arrays, image URLs and order', async () => {
  assert.equal(validateService(valid).value.title, 'Interior painting');
  for (const patch of [{ title: '' }, { description: '' }, { categories: [] }, { categories: ['invalid'] }, { features: [''] }, { features: Array(9).fill('Feature') }, { features: ['x'.repeat(201)] }, { sortOrder: 1.5 }, { sortOrder: -1 }, { sortOrder: '10' }, { status: 'public' }, { imageUrl: 'javascript:alert(1)' }, { imageUrl: 'data:image/png;base64,abc' }, { imageUrl: 'https://user:secret@example.com/image.jpg' }]) {
    assert.ok(Object.keys(validateService({ ...valid, ...patch }).errors).length);
  }
  for (const imageUrl of ['https://example.com/image.jpg', '/assets/images/paint.jpg']) assert.deepEqual(validateService({ ...valid, imageUrl }).errors, {});
  assert.ok(validateService({ ...valid, seedKey: 'overwrite' }).errors.form);
  await new Service(validateService(valid).value).validate();
});

test('starter services copy all six cards and never overwrite saved edits on restart', async () => {
  const saved = new Map();
  const model = { async bulkWrite(operations) {
    for (const { updateOne } of operations) {
      assert.equal(updateOne.timestamps, false);
      assert.equal(updateOne.update.$set, undefined);
      if (!saved.has(updateOne.filter.seedKey)) saved.set(updateOne.filter.seedKey, { ...updateOne.update.$setOnInsert });
    }
  } };
  await seedServices(model);
  assert.equal(saved.size, 6);
  const original = saved.get('original-service-1');
  original.title = 'Edited title'; original.status = 'Hidden';
  const updated = original.updatedAt;
  await seedServices(model);
  assert.equal(saved.size, 6); assert.equal(original.title, 'Edited title'); assert.equal(original.status, 'Hidden'); assert.equal(original.updatedAt, updated);
});

test('public service reads filter Active and explicitly project public fields', async () => {
  let selected;
  const catalogue = createCatalogueService({ find(filter) {
    assert.deepEqual(filter, { status: 'Active' });
    return {
      sort(order) { assert.deepEqual(order, { sortOrder: 1, _id: 1 }); return this; },
      select(fields) { selected = fields; return this; },
      lean: async () => [{ title: 'Active service' }]
    };
  } });
  assert.equal((await catalogue.publicList()).length, 1);
  assert.doesNotMatch(selected, /seedKey|status|createdAt|updatedAt/);
});

test('catalogue admin routes require login while public API exposes active services only', async () => {
  const passwordHash = await hashPassword('a long test password');
  let record = { ...valid, _id: id }, writes = 0, options;
  const catalogue = {
    create: async value => { writes++; record = { ...value, _id: id }; return record; },
    update: async (key, value) => { writes++; if (key !== id) return null; record = { ...value, _id: key }; return record; },
    list: async value => { options = value; return { items: [record], total: 1, page: value.page, pageSize: value.limit }; },
    publicList: async () => record.status === 'Active' ? [{ title: record.title, description: record.description, categories: record.categories }] : []
  };
  const server = createApp({ saveConsultation: async () => ({}), catalogue, admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000',
    findAdmin: async () => ({ _id: 'admin', passwordHash }), catalogue
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  const save = (body, Cookie, key = '', Origin = headers.Origin) => fetch(`${base}/api/admin/services${key ? '/' + key : ''}`, { method: key ? 'PUT' : 'POST', headers: { ...headers, Origin, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(`${base}/api/admin/services`)).status, 401);
    assert.equal((await save(valid)).status, 401);
    const publicRead = await fetch(`${base}/api/services`);
    assert.equal(publicRead.status, 200); assert.match(publicRead.headers.get('cache-control'), /no-store/);
    const login = await fetch(`${base}/api/admin/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'admin@example.com', password: 'a long test password' }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await save(valid, Cookie, '', 'https://evil.example')).status, 403);
    assert.equal((await save({ ...valid, sortOrder: -1 }, Cookie)).status, 400); assert.equal(writes, 0);
    assert.equal((await save(valid, Cookie)).status, 201);
    assert.equal((await save({ ...valid, status: 'Hidden' }, Cookie, id)).status, 200);
    const hidden = await fetch(`${base}/api/services?status=Hidden`);
    assert.deepEqual((await hidden.json()).items, []);
    assert.equal((await fetch(`${base}/api/admin/services?status=Hidden&search=%20paint%20&page=2`, { headers: { Cookie } })).status, 200);
    assert.deepEqual(options, { page: 2, limit: 25, search: 'paint', status: 'Hidden' });
    for (const query of ['page=0', 'status=invalid', 'search=a&search=b']) assert.equal((await fetch(`${base}/api/admin/services?${query}`, { headers: { Cookie } })).status, 400);
    assert.equal((await save(valid, Cookie, 'invalid')).status, 400);
    assert.equal((await save(valid, Cookie, '000000000000000000000000')).status, 404);
    await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { ...headers, Cookie }, body: '{}' });
    assert.equal((await fetch(`${base}/api/admin/services`, { headers: { Cookie } })).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
