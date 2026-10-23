import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/passwords.js';
import { validateProject } from '../src/validators/project.js';
import { createProjectService, projectFilter } from '../src/services/projects.js';
import { Project } from '../src/models/Project.js';

const id = '111111111111111111111111', memberId = '1234567890abcdef12345678';
const valid = { title: ' Kitchen repaint ', scope: 'Walls and ceiling', assignedMember: memberId, startDate: '2099-06-01', targetDate: '2099-06-03', status: 'Planned' };

test('project validation checks status, assignment, date ordering and permitted fields', async () => {
  assert.deepEqual(validateProject(valid).errors, {});
  assert.equal(validateProject(valid).value.title, 'Kitchen repaint');
  for (const patch of [{ title: '' }, { title: 'x'.repeat(161) }, { scope: 'x'.repeat(5001) }, { scope: {} }, { assignedMember: 'invalid' }, { status: 'Won' }, { startDate: '2099-02-30' }, { targetDate: '2099-05-01' }]) {
    assert.ok(Object.keys(validateProject({ ...valid, ...patch }).errors).length);
  }
  assert.ok(validateProject({ ...valid, customerName: 'injected' }).errors.form);
  assert.ok(validateProject(null).errors.form);
  assert.deepEqual(validateProject({ ...valid, startDate: '', targetDate: '', scope: '' }).errors, {});
  await new Project({ ...validateProject(valid).value, consultation: id, customerName: 'Customer', assignedTo: 'Painter' }).validate();
  assert.ok(Project.schema.indexes().some(([fields, options]) => fields.consultation === 1 && options.unique));
  const filter = projectFilter({ search: '.*', status: 'Planned' });
  assert.equal(filter.status, 'Planned');
  assert.equal(new RegExp(filter.$or[0].title.$regex).test('Kitchen repaint'), false);
});

test('project service requires a won enquiry, uses saved names, and preserves the project through later enquiry changes', async () => {
  let enquiry = { _id: id, fullName: 'Customer', status: 'New' }, record = null;
  let member = { name: 'Saved Painter', status: 'Active' };
  const chain = value => ({ select() { return this; }, lean: async () => value });
  const model = {
    findOne: () => chain(record),
    findOneAndUpdate(filter, update, options) {
      assert.deepEqual(filter, { consultation: id }); assert.equal(options.runValidators, true);
      record = { ...record, ...update.$set, _id: 'project-id', consultation: id };
      return chain(record);
    }
  };
  const service = createProjectService(model, { findById: () => chain(enquiry) }, { findById: () => chain(member) });
  await assert.rejects(service.save(id, valid), { status: 409 });
  assert.equal(record, null);
  enquiry.status = 'Won';
  await service.save(id, valid);
  assert.equal(record.customerName, 'Customer'); assert.equal(record.assignedTo, 'Saved Painter');
  const originalId = record._id;
  enquiry.status = 'Closed';
  for (const status of ['In progress', 'Completed', 'Cancelled']) {
    await service.save(id, { ...valid, status }); assert.equal(record._id, originalId);
  }
  member.status = 'On leave';
  await assert.rejects(service.save(id, valid), { status: 409 });
  await service.save(id, { ...valid, status: 'Completed' });
  await assert.rejects(service.save(id, { ...valid, assignedMember: 'abcdef1234567890abcdef12', status: 'Completed' }), { status: 409 });
  enquiry = null;
  assert.equal(await service.save(id, valid), null);
});

test('project APIs require admin access, reject invalid input and support filtered pagination', async () => {
  let record = null, writes = 0, options;
  const passwordHash = await hashPassword('a long test password');
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000',
    findAdmin: async () => ({ _id: 'admin', passwordHash }),
    projects: {
      get: async key => key === id ? { enquiry: { fullName: 'Customer', status: 'Won' }, project: record } : null,
      save: async (key, value) => { writes++; if (key !== id) return null; record = { ...value, _id: 'project-id', consultation: id }; return record; },
      list: async value => { options = value; return { items: record ? [record] : [], total: record ? 1 : 0, page: value.page, pageSize: value.limit }; }
    }
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  const save = (body, Cookie, key = id, Origin = headers.Origin) => fetch(`${base}/consultations/${key}/project`, { method: 'PUT', headers: { ...headers, Origin, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(`${base}/projects`)).status, 401);
    assert.equal((await save(valid)).status, 401);
    const login = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'admin@example.com', password: 'a long test password' }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await save(valid, Cookie, id, 'https://evil.example')).status, 403);
    assert.equal((await save({ ...valid, assignedTo: 'injected' }, Cookie)).status, 400);
    assert.equal(writes, 0);
    assert.equal((await save(valid, Cookie)).status, 200);
    const context = await fetch(`${base}/consultations/${id}/project`, { headers: { Cookie } });
    assert.equal(context.status, 200); assert.match(context.headers.get('cache-control'), /no-store/);
    assert.equal((await context.json()).project.title, 'Kitchen repaint');
    assert.equal((await fetch(`${base}/projects?status=In%20progress&search=%20Kitchen%20&page=2`, { headers: { Cookie } })).status, 200);
    assert.deepEqual(options, { page: 2, limit: 25, status: 'In progress', search: 'Kitchen' });
    for (const query of ['status=invalid', 'page=-1', 'page=1&page=2', 'search=a&search=b']) assert.equal((await fetch(`${base}/projects?${query}`, { headers: { Cookie } })).status, 400);
    assert.equal((await save(valid, Cookie, 'invalid')).status, 400);
    assert.equal((await save(valid, Cookie, '000000000000000000000000')).status, 404);
    await fetch(`${base}/logout`, { method: 'POST', headers: { ...headers, Cookie }, body: '{}' });
    assert.equal((await fetch(`${base}/projects`, { headers: { Cookie } })).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('project overview counts include empty statuses', async () => {
  const service = createProjectService({ aggregate: async () => [{ _id: 'Planned', count: 2 }, { _id: 'Completed', count: 1 }] }, {}, {});
  assert.deepEqual(await service.summary(), { total: 3, byStatus: { Planned: 2, 'In progress': 0, Completed: 1, Cancelled: 0 } });
});
