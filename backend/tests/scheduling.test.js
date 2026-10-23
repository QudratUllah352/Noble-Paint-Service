import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchedulingGuard } from '../src/services/scheduling.js';
import { createAppointmentService } from '../src/services/appointments.js';

const memberA = '1234567890abcdef12345678', memberB = 'abcdef1234567890abcdef12';
const id1 = '111111111111111111111111', id2 = '222222222222222222222222';
const base = { startsAt: '2099-06-01T09:00:00.000Z', durationMinutes: 60, assignedMember: memberA, status: 'Scheduled', timeZone: 'Asia/Karachi', address: 'Test address' };

// Evaluate the small Mongo expression subset used by the overlap query so tests
// exercise its generated bounds, legacy fallback and strict comparisons.
function expression(value, record) {
  if (typeof value === 'string' && value.startsWith('$')) return record[value.slice(1)];
  if (!value || value instanceof Date || typeof value !== 'object') return value;
  if (value.$ifNull) return expression(value.$ifNull[0], record) ?? expression(value.$ifNull[1], record);
  if (value.$multiply) return value.$multiply.map(item => expression(item, record)).reduce((a, b) => a * b);
  if (value.$add) return value.$add.map(item => expression(item, record)).reduce((a, b) => Number(a) + Number(b));
  if (value.$gt) return Number(expression(value.$gt[0], record)) > Number(expression(value.$gt[1], record));
  throw new Error('Unsupported expression');
}

function harness() {
  const records = new Map(), locks = new Map();
  const Lock = {
    async create(document) {
      if (locks.has(document._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      locks.set(document._id, document.token);
    },
    async deleteOne(document) { if (locks.get(document._id) === document.token) locks.delete(document._id); }
  };
  const Appointment = {
    async exists(query) { const record = records.get(query.consultation); return !!record && (!query.assignedMember || record.assignedMember === query.assignedMember); },
    findOne(query) {
      const record = [...records.values()].find(item => {
        const member = query.$or.some(condition => condition.assignedMember === null
          ? !item.assignedMember && item.assignedTo === condition.assignedTo : item.assignedMember === condition.assignedMember);
        return item.consultation !== query.consultation.$ne && item.status === query.status && member &&
          new Date(item.startsAt) < query.startsAt.$lt && expression(query.$expr, { ...item, startsAt: new Date(item.startsAt) });
      });
      return { select: () => ({ lean: async () => record || null }) };
    },
    findOneAndUpdate(query, update) {
      const record = { ...records.get(query.consultation), ...update.$set, consultation: query.consultation };
      return { lean: async () => { records.set(query.consultation, record); return record; } };
    }
  };
  const Member = { findById: id => ({ lean: async () => ({ _id: id, name: id === memberA ? 'Painter A' : 'Painter B', status: 'Active' }) }) };
  const createService = () => createAppointmentService(Appointment, { exists: async () => true }, undefined, Member, createSchedulingGuard(Lock));
  return { records, locks, createService, service: createService() };
}

test('same member overlap checks cover identical, partial, contained and enclosing visits', async () => {
  const { service, records, locks } = harness();
  await service.save(id1, base);
  await service.save(id1, base); // Editing itself must be allowed.
  for (const patch of [
    {}, { startsAt: '2099-06-01T09:30:00.000Z' },
    { startsAt: '2099-06-01T08:30:00.000Z' },
    { startsAt: '2099-06-01T09:15:00.000Z', durationMinutes: 15 },
    { startsAt: '2099-06-01T08:00:00.000Z', durationMinutes: 180 },
    { timeZone: 'America/New_York' }
  ]) {
    await assert.rejects(service.save(id2, { ...base, ...patch }), error => error.status === 409 && !!error.errors.startsAt);
    assert.equal(records.has(id2), false);
    assert.equal(locks.size, 0);
  }
});

test('back-to-back and different-member visits are allowed; reassignment and duration changes are checked', async () => {
  const { service, records } = harness();
  await service.save(id1, base);
  await service.save(id2, { ...base, startsAt: '2099-06-01T10:00:00.000Z' });
  await assert.rejects(service.save(id1, { ...base, durationMinutes: 120 }), { status: 409 });
  assert.equal(records.get(id1).durationMinutes, 60);
  await service.save('333333333333333333333333', { ...base, startsAt: '2099-06-01T08:00:00.000Z' });
  await service.save('444444444444444444444444', { ...base, assignedMember: memberB });
  await assert.rejects(service.save('444444444444444444444444', base), { status: 409 });
  assert.equal(records.get('444444444444444444444444').assignedMember, memberB);
});

test('cancelling, completing and rescheduling free the previous time', async () => {
  const { service } = harness();
  await service.save(id1, base);
  await service.save(id1, { ...base, status: 'Cancelled' });
  await service.save(id2, base);
  await assert.rejects(service.save(id1, base), { status: 409 });
  await service.save(id2, { ...base, status: 'Completed' });
  await service.save(id1, base);
  await service.save(id1, { ...base, startsAt: '2099-06-01T12:00:00.000Z' });
  await service.save(id2, base);
});

test('overnight and legacy visits without duration or saved member IDs are checked', async () => {
  const { service, records } = harness();
  records.set(id1, { consultation: id1, startsAt: '2099-06-01T23:30:00.000Z', assignedTo: 'Painter A', status: 'Scheduled' });
  await assert.rejects(service.save(id2, { ...base, startsAt: '2099-06-02T00:00:00.000Z' }), { status: 409 });
  await service.save(id2, { ...base, startsAt: '2099-06-02T00:30:00.000Z' });
});

test('independent services share a database lock and cannot double-book simultaneously', async () => {
  const { service, createService, records, locks } = harness();
  const other = createService();
  const results = await Promise.allSettled([service.save(id1, base), other.save(id2, base)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal(records.size, 1);
  assert.equal(locks.size, 0);
  const missing = records.has(id1) ? id2 : id1;
  await assert.rejects(other.save(missing, base), { status: 409 });
});

test('a failed write releases the scheduling lock for the next attempt', async () => {
  let held = false;
  const guard = createSchedulingGuard({
    async create() { assert.equal(held, false); held = true; },
    async deleteOne() { held = false; }
  });
  await assert.rejects(guard(async () => { throw new Error('write failed'); }), /write failed/);
  assert.equal(held, false);
  assert.equal(await guard(async () => 'saved'), 'saved');
});
