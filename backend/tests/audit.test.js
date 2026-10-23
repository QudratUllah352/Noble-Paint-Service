import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditService } from '../src/services/audit.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/passwords.js';

function store() {
  const rows = [];
  return { rows,
    async create(value) { const row = { _id: String(rows.length), ...value }; rows.push(row); return row; },
    async updateOne(filter, update) { const row = rows.find(item => item._id === filter._id); if (row) Object.assign(row, update.$set); return { matchedCount: row ? 1 : 0 }; }
  };
}

test('audit records intent before writes, completion targets, and safe errors without copying results', async () => {
  const model = store(), audit = createAuditService(model), actor = { id: 'admin', email: 'admin@example.com' };
  const result = await audit.run(actor, 'team.create', 'new', ['name'], async () => {
    assert.equal(model.rows[0].outcome, 'Pending');
    return { _id: 'member', name: 'private customer data', password: 'secret' };
  });
  assert.equal(result._id, 'member');
  assert.equal(model.rows[0].target, 'member'); assert.equal(model.rows[0].outcome, 'Completed');
  await assert.rejects(audit.run(actor, 'appointment.email', 'enquiry', [], async () => { throw new Error('secret SMTP response'); }), /secret SMTP response/);
  assert.equal(model.rows[1].outcome, 'Error');
  await audit.run(actor, 'enquiry.notes', 'missing', ['adminNotes'], async () => null);
  assert.equal(model.rows[2].outcome, 'No record');
  assert.doesNotMatch(JSON.stringify(model.rows), /private customer data|secret|password/);
});

test('audit outage blocks new writes and incomplete finalization reports uncertainty without replaying writes', async () => {
  let calls = 0;
  const task = async () => { calls++; return {}; };
  await assert.rejects(createAuditService({ create() { throw new Error('offline'); } }).run({ id: 'a' }, 'team.create', 'new', [], task), /offline/);
  assert.equal(calls, 0);
  const model = store();
  model.updateOne = async () => { throw new Error('offline'); };
  await assert.rejects(createAuditService(model).run({ id: 'a' }, 'team.create', 'new', [], task), error => error.status === 503 && error.auditOutcomeUnknown);
  assert.equal(calls, 1); assert.equal(model.rows[0].outcome, 'Pending');
});

test('audit list uses literal search, bounded pages, inclusive UTC date range and matching count filters', async () => {
  let filter, countFilter, skipped, limit;
  const model = {
    find(value) { filter = value; return { select() { return this; }, sort(value) { assert.deepEqual(value, { createdAt: -1, _id: -1 }); return this; }, skip(value) { skipped = value; return this; }, limit(value) { limit = value; return this; }, lean: async () => [] }; },
    async countDocuments(value) { countFilter = value; return 26; }
  };
  const from = new Date('2026-10-01'), to = new Date('2026-10-24');
  const result = await createAuditService(model).list({ page: 2, action: 'team.update', outcome: 'Completed', search: 'a+b@example.com', from, to });
  assert.equal(filter.$or[0].actorEmail.$regex, 'a\\+b@example\\.com');
  assert.deepEqual(filter.createdAt, { $gte: from, $lt: to }); assert.equal(filter.action, 'team.update');
  assert.deepEqual(filter, countFilter); assert.equal(skipped, 25); assert.equal(limit, 25); assert.equal(result.total, 26);
});

test('audit API enforces login and filters and audits actual changes using the session actor', async () => {
  const model = store(), audit = createAuditService(model);
  const queries = [];
  audit.list = async value => { queries.push(value); return { items: model.rows, page: value.page, total: model.rows.length, pageSize: 25 }; };
  const passwordHash = await hashPassword('a test-only long password');
  const adminId = 'a'.repeat(24), id = 'b'.repeat(24);
  let writes = 0;
  const server = createApp({ saveConsultation: async () => ({}), admin: {
    secret: 'test-only-secret-with-more-than-32-characters', siteUrl: 'http://localhost:5000', audit,
    findAdmin: async () => ({ _id: adminId, passwordHash }),
    accounts: { get: async () => ({ email: 'admin@example.com' }), change: async () => ({ email: 'admin@example.com' }) },
    team: { create: async () => ({ _id: id }), update: async () => ({ _id: id }) },
    catalogue: { create: async () => ({ _id: id }), update: async () => ({ _id: id }) },
    projects: { save: async () => ({ _id: id }) },
    appointments: { save: async () => ({ _id: id }), sendNotice: async () => ({ message: 'Accepted' }) },
    updateConsultationNotes: async (_id, adminNotes) => { writes++; return { _id, adminNotes }; },
    updateConsultationStatus: async (_id, status) => ({ _id, status })
  } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const headers = { Origin: 'http://localhost:5000', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${base}/audit`)).status, 401);
    const login = await fetch(`${base}/login`, { method: 'POST', headers, body: JSON.stringify({ email: 'admin@example.com', password: 'a test-only long password' }) });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    const patch = (body, Origin = headers.Origin) => fetch(`${base}/consultations/${id}/notes`, { method: 'PATCH', headers: { ...headers, Origin, Cookie }, body: JSON.stringify(body) });
    assert.equal((await patch({ adminNotes: 'Private note', actor: 'spoof' })).status, 400);
    assert.equal((await patch({ adminNotes: 'Private note' }, 'https://other.example')).status, 403);
    assert.equal(model.rows.length, 0); assert.equal(writes, 0);
    assert.equal((await patch({ adminNotes: 'Private note' })).status, 200);
    assert.equal(model.rows[0].actor, adminId); assert.equal(model.rows[0].actorEmail, 'admin@example.com');
    assert.equal(model.rows[0].action, 'enquiry.notes'); assert.doesNotMatch(JSON.stringify(model.rows), /Private note/);
    const response = await fetch(`${base}/audit?from=2026-10-01&to=2026-10-23`, { headers: { Cookie } });
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(queries[0].to.toISOString(), '2026-10-24T00:00:00.000Z');
    for (const query of ['page=0', 'page[]=1', 'action=unknown', 'outcome=unknown', 'from=2026-02-30', 'from=2026-10-24&to=2026-10-23', 'search[]=x']) {
      assert.equal((await fetch(`${base}/audit?${query}`, { headers: { Cookie } })).status, 400, query);
    }
    assert.equal((await fetch(`${base}/audit`, { method: 'POST', headers: { ...headers, Cookie }, body: '{}' })).status, 404);
    const team = { name: 'Painter', role: 'Lead', status: 'Active' };
    const service = { title: 'Painting', description: 'Painting work', categories: ['residential'], features: [], sortOrder: 1, status: 'Active' };
    const cases = [
      ['POST', '/team', team, 'team.create'], ['PUT', `/team/${id}`, team, 'team.update'],
      ['POST', '/services', service, 'service.create'], ['PUT', `/services/${id}`, service, 'service.update'],
      ['PUT', `/consultations/${id}/project`, { title: 'Project', assignedMember: id, status: 'Planned' }, 'project.save'],
      ['PUT', `/consultations/${id}/appointment`, { startsAt: new Date(Date.now() + 86400000).toISOString(), timeZone: 'Asia/Karachi', address: 'Private address', assignedMember: id, status: 'Scheduled', durationMinutes: 60 }, 'appointment.save'],
      ['POST', `/consultations/${id}/appointment/email`, { version: '2026-10-23T00:00:00.000Z' }, 'appointment.email'],
      ['PATCH', `/consultations/${id}/status`, { status: 'Won' }, 'enquiry.status']
    ];
    for (const [method, path, body, action] of cases) {
      const response = await fetch(`${base}${path}`, { method, headers: { ...headers, Cookie }, body: JSON.stringify(body) });
      assert.ok(response.ok, `${action}: ${response.status}`); assert.equal(model.rows.at(-1).action, action);
      assert.equal(model.rows.at(-1).outcome, 'Completed');
    }
    assert.doesNotMatch(JSON.stringify(model.rows), /Private address|Painting work/);
    const original = audit.run;
    audit.run = async (...args) => original.call(audit, ...args);
    model.updateOne = async () => { throw new Error('offline'); };
    const uncertain = await patch({ adminNotes: 'Second note' });
    assert.equal(uncertain.status, 503); assert.match((await uncertain.json()).message, /may have completed/);
    assert.equal(writes, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
