import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/passwords.js';
import { validateTeamMember } from '../src/validators/teamMember.js';
import { teamFilter } from '../src/services/team.js';
import { createAppointmentService } from '../src/services/appointments.js';
import { TeamMember } from '../src/models/TeamMember.js';

const memberId = '1234567890abcdef12345678';
const valid = { name: ' Test Painter ', role: 'Painter', email: 'test@example.com', phone: '+1 704 555 0123', status: 'Active' };

test('team validation checks lengths, contacts, statuses and rejects unknown fields', async () => {
  assert.equal(validateTeamMember(valid).value.name, 'Test Painter');
  assert.deepEqual(validateTeamMember({ name: 'Painter', role: 'Painter', status: 'Active' }).errors, {});
  for (const patch of [{ name: '' }, { role: 'x'.repeat(121) }, { email: 'invalid' }, { phone: '12' }, { status: 'admin' }, { name: {} }]) {
    assert.ok(Object.keys(validateTeamMember({ ...valid, ...patch }).errors).length);
  }
  assert.ok(validateTeamMember({ ...valid, password: 'injected' }).errors.form);
  await new TeamMember(validateTeamMember(valid).value).validate();
  const filter = teamFilter({ status: 'Active', search: '.*' });
  assert.equal(filter.status, 'Active');
  assert.equal(new RegExp(filter.$or[0].name.$regex, 'i').test('Test Painter'), false);
  assert.equal(new RegExp(filter.$or[0].name.$regex, 'i').test('.*'), true);
});

test('team APIs protect staff details and support create, edit, inactive status and validated filters', async () => {
  const passwordHash = await hashPassword('a long test password');
  let record, writes = 0, options;
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000',
    findAdmin: async () => ({ _id: 'admin', passwordHash }),
    team: {
      create: async value => { writes++; record = { ...value, _id: memberId }; return record; },
      update: async (id, value) => { writes++; if (id !== memberId) return null; record = { ...value, _id: id }; return record; },
      get: async id => id === memberId ? record : null,
      list: async value => { options = value; return { items: record ? [record] : [], total: record ? 1 : 0, page: value.page, pageSize: value.limit }; }
    }
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  const save = (body, Cookie, id = '', Origin = headers.Origin) => fetch(`${base}/team${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', headers: { ...headers, Origin, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(`${base}/team`)).status, 401);
    assert.equal((await save(valid)).status, 401);
    assert.equal(writes, 0);
    const login = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'admin@example.com', password: 'a long test password' }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await save(valid, Cookie, '', 'https://evil.example')).status, 403);
    assert.equal((await save({ ...valid, status: 'invalid' }, Cookie)).status, 400);
    assert.equal(writes, 0);
    const created = await save(valid, Cookie);
    assert.equal(created.status, 201);
    assert.equal((await created.json()).member.name, 'Test Painter');
    for (const status of ['On leave', 'Inactive', 'Active']) {
      assert.equal((await save({ ...valid, status }, Cookie, memberId)).status, 200);
      assert.equal(record.status, status);
    }
    const get = await fetch(`${base}/team/${memberId}`, { headers: { Cookie } });
    assert.equal(get.status, 200);
    assert.match(get.headers.get('cache-control'), /no-store/);
    assert.equal((await get.json()).member._id, memberId);
    assert.equal((await fetch(`${base}/team?search=%20Painter%20&status=Active&page=2`, { headers: { Cookie } })).status, 200);
    assert.deepEqual(options, { page: 2, limit: 25, search: 'Painter', status: 'Active' });
    for (const query of ['status=invalid', 'page=-1', 'page=1&page=2', 'search=a&search=b', `search=${'a'.repeat(121)}`]) assert.equal((await fetch(`${base}/team?${query}`, { headers: { Cookie } })).status, 400);
    assert.equal((await save(valid, Cookie, 'invalid-id')).status, 400);
    assert.equal((await save(valid, Cookie, '000000000000000000000000')).status, 404);
    await fetch(`${base}/logout`, { method: 'POST', headers: { ...headers, Cookie }, body: '{}' });
    assert.equal((await fetch(`${base}/team`, { headers: { Cookie } })).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('appointment assignment uses the saved member name and requires active staff for scheduled visits', async () => {
  let member = { name: 'Saved Painter', status: 'Active' }, existingAssignment = false, saved;
  const model = {
    exists: async query => query.assignedMember ? existingAssignment : true,
    findOne: () => ({ select: () => ({ lean: async () => null }) }),
    findOneAndUpdate(filter, update) { saved = update.$set; return { lean: async () => saved }; }
  };
  const service = createAppointmentService(model, { exists: async () => true }, undefined, { findById: () => ({ lean: async () => member }) }, task => task());
  const appointment = { assignedMember: memberId, assignedTo: 'Spoofed name', status: 'Scheduled', startsAt: '2099-06-01T09:00:00.000Z', durationMinutes: 60 };
  await service.save(memberId, appointment);
  assert.equal(saved.assignedTo, 'Saved Painter');
  assert.equal(saved.assignedMember, memberId);
  for (const status of ['On leave', 'Inactive']) {
    member.status = status;
    await assert.rejects(service.save(memberId, appointment), { status: 409 });
    await assert.rejects(service.save(memberId, { ...appointment, status: 'Completed' }), { status: 409 });
    existingAssignment = true;
    await service.save(memberId, { ...appointment, status: 'Completed' });
    assert.equal(saved.status, 'Completed');
    existingAssignment = false;
  }
  member = null;
  await assert.rejects(service.save(memberId, appointment), { status: 409 });
});
