import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/passwords.js';
import { validateAppointment } from '../src/validators/appointment.js';
import { Appointment } from '../src/models/Appointment.js';
import { createAppointmentService } from '../src/services/appointments.js';

const id = 'abcdef0123456789abcdef01';
const valid = { startsAt: '2099-06-01T09:00:00.000Z', durationMinutes: 60, timeZone: 'Asia/Karachi', address: '12 Test Street', assignedMember: '1234567890abcdef12345678', status: 'Scheduled' };

test('appointment validation checks dates, timezone, required fields and permitted statuses', async () => {
  assert.deepEqual(validateAppointment(valid).errors, {});
  for (const patch of [{ startsAt: '2099-02-30T09:00:00.000Z' }, { startsAt: '2020-01-01T09:00:00.000Z' }, { startsAt: '2099-06-01T09:00' }, { timeZone: 'invalid-zone' }, { address: '' }, { assignedMember: '' }, { status: 'Won' }, { address: 'x'.repeat(501) }, { assignedMember: {} }]) {
    assert.ok(Object.keys(validateAppointment({ ...valid, ...patch }).errors).length);
  }
  assert.ok(validateAppointment({ ...valid, consultation: id }).errors.form);
  for (const durationMinutes of [undefined, null, '60', 0, 14, 17, 481, 60.5]) assert.ok(validateAppointment({ ...valid, durationMinutes }).errors.durationMinutes);
  assert.ok(validateAppointment(null).errors.form);
  assert.deepEqual(validateAppointment({ ...valid, status: 'Completed', startsAt: '2020-01-01T09:00:00.000Z' }).errors, {});
  await new Appointment({ ...valid, assignedTo: 'Test Painter', consultation: id }).validate();
  assert.ok(Appointment.schema.indexes().some(([fields, options]) => fields.consultation === 1 && options.unique));
});

test('appointment APIs require authentication, save and edit visits, validate filters, and keep appointment data private', async () => {
  let appointment = null, saves = 0, listOptions, notices = 0;
  const passwordHash = await hashPassword('a long test password');
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000',
    findAdmin: async () => ({ _id: 'admin', passwordHash }),
    appointments: {
      sendNotice: async () => { notices++; return { message: 'Email accepted.' }; },
      get: async () => appointment,
      save: async (enquiryId, value) => {
        saves++;
        if (enquiryId === '222222222222222222222222') throw Object.assign(new Error('Overlapping visit.'), { status: 409, errors: { startsAt: 'Choose another time.' } });
        if (enquiryId === '000000000000000000000000') return null;
        appointment = { ...value, _id: 'appointment-id', consultation: enquiryId }; return appointment;
      },
      list: async options => { listOptions = options; return { items: appointment ? [appointment] : [], total: appointment ? 1 : 0, page: options.page, pageSize: options.limit }; }
    }
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  const put = (body, Cookie, enquiryId = id, Origin = headers.Origin) => fetch(`${base}/consultations/${enquiryId}/appointment`, { method: 'PUT', headers: { ...headers, Origin, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) });
  const notice = (body, Cookie, Origin = headers.Origin) => fetch(`${base}/consultations/${id}/appointment/email`, { method: 'POST', headers: { ...headers, Origin, ...(Cookie ? { Cookie } : {}) }, body: JSON.stringify(body) });
  const emailBody = { version: '2026-01-01T00:00:00.000Z' };
  try {
    assert.equal((await notice(emailBody)).status, 401);
    assert.equal((await put(valid)).status, 401);
    assert.equal((await fetch(`${base}/appointments`)).status, 401);
    assert.equal((await fetch(`${base}/consultations/${id}/appointment`)).status, 401);
    const login = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'admin@example.com', password: 'a long test password' }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await notice(emailBody, Cookie, 'https://evil.example')).status, 403);
    assert.equal((await notice({ ...emailBody, to: 'other@example.com' }, Cookie)).status, 400);
    assert.equal((await notice({}, Cookie)).status, 400);
    assert.equal(notices, 0);
    assert.equal((await notice(emailBody, Cookie)).status, 200);
    assert.equal(notices, 1);
    assert.equal((await put(valid, Cookie, id, 'https://evil.example')).status, 403);
    assert.equal((await put(valid, Cookie, 'invalid')).status, 400);
    assert.equal((await put({ ...valid, status: 'invalid' }, Cookie)).status, 400);
    assert.equal(saves, 0);
    assert.equal((await put(valid, Cookie)).status, 200);
    const conflict = await put(valid, Cookie, '222222222222222222222222');
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).errors.startsAt, 'Choose another time.');
    const saved = await fetch(`${base}/consultations/${id}/appointment`, { headers: { Cookie } });
    assert.equal((await saved.json()).appointment.address, valid.address);
    for (const status of ['Completed', 'Cancelled', 'Scheduled']) {
      const result = await put({ ...valid, status }, Cookie);
      assert.equal(result.status, 200);
      assert.equal((await result.json()).appointment.status, status);
      assert.equal(appointment._id, 'appointment-id');
    }
    const listing = await fetch(`${base}/appointments?status=Scheduled&page=2`, { headers: { Cookie } });
    assert.equal(listing.status, 200);
    assert.match(listing.headers.get('cache-control'), /no-store/);
    assert.deepEqual(listOptions, { status: 'Scheduled', page: 2, limit: 25 });
    for (const query of ['status=invalid', 'page=0', 'page=1&page=2', 'status=Scheduled&status=Cancelled']) {
      assert.equal((await fetch(`${base}/appointments?${query}`, { headers: { Cookie } })).status, 400);
    }
    assert.equal((await put(valid, Cookie, '000000000000000000000000')).status, 404);
    await fetch(`${base}/logout`, { method: 'POST', headers: { ...headers, Cookie }, body: '{}' });
    assert.equal((await put(valid, Cookie)).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('appointment service links enquiries and updates one record without replacing enquiry details', async () => {
  let exists = false, update;
  const service = createAppointmentService({
    exists: async () => exists,
    findOne: () => ({ select: () => ({ lean: async () => null }) }),
    findOneAndUpdate(filter, change, options) {
      update = { filter, change, options };
      exists = true;
      return { lean: async () => ({ ...change.$set, consultation: id }) };
    }
  }, { exists: async () => true }, undefined, { findById: () => ({ lean: async () => ({ name: 'Test Painter', status: 'Active' }) }) }, task => task());
  await assert.rejects(service.save(id, { ...valid, status: 'Completed' }), /Create a scheduled/);
  await service.save(id, valid);
  await service.save(id, { ...valid, status: 'Cancelled' });
  assert.deepEqual(update.filter, { consultation: id, emailState: { $ne: 'Sending' } });
  assert.equal(update.change.$set.status, 'Cancelled');
  assert.equal(update.change.$set.assignedTo, 'Test Painter');
  assert.equal(update.change.$set.assignedMember, valid.assignedMember);
  assert.equal(update.options.upsert, true);
  assert.equal(update.options.runValidators, true);
  const missing = createAppointmentService({}, { exists: async () => false });
  assert.equal(await missing.save(id, valid), null);
});

test('upcoming appointments exclude past and inactive visits and are limited to five', async () => {
  const service = createAppointmentService({ find(filter) {
    assert.equal(filter.status, 'Scheduled');
    assert.ok(filter.startsAt.$gte instanceof Date);
    return {
      sort(order) { assert.deepEqual(order, { startsAt: 1, _id: 1 }); return this; },
      limit(value) { assert.equal(value, 5); return this; },
      populate(path, fields) { assert.equal(path, 'consultation'); assert.equal(fields, 'fullName'); return this; },
      async lean() { return []; }
    };
  } }, {});
  assert.deepEqual(await service.upcoming(), []);
});
