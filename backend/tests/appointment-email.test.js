import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppointmentEmailSender } from '../src/services/appointmentEmail.js';
import { createAppointmentService } from '../src/services/appointments.js';

const visit = { _id: 'appointment-id', consultation: { _id: 'abcdef0123456789abcdef01', emailAddr: 'customer@example.com' }, startsAt: '2099-06-01T09:00:00.000Z', updatedAt: new Date('2026-01-01T00:00:00.000Z'), timeZone: 'Asia/Karachi', status: 'Scheduled', address: '12 Test Street', assignedTo: 'Test Painter', adminNotes: 'PRIVATE NOTE' };
const version = visit.updatedAt.toISOString();

function mailModel(getRecord) {
  return {
    findOne: () => ({ lean: async () => getRecord(), populate: () => ({ lean: async () => getRecord() }) }),
    findOneAndUpdate(filter, update, options) {
      assert.equal(options.timestamps, false, 'History must not change the saved appointment version.');
      const record = getRecord();
      const blocked = !record || record.emailState === 'Sending' ||
        (record.emailState === 'Accepted' && record.emailVersion === filter.$nor[0].emailVersion) ||
        new Date(record.updatedAt).getTime() !== filter.updatedAt.getTime();
      if (!blocked) {
        Object.assign(record, update.$set);
        record.emailHistory = [...(record.emailHistory || []), ...update.$push.emailHistory.$each].slice(-50);
      }
      return { lean: async () => blocked ? null : record };
    },
    async updateOne(filter, update, options) {
      assert.equal(options.timestamps, false);
      const record = getRecord();
      const entry = record.emailHistory.find(item => item.attemptId === filter.emailAttemptId);
      record.emailState = update.$set.emailState;
      Object.assign(entry, { status: update.$set['emailHistory.$.status'], finishedAt: update.$set['emailHistory.$.finishedAt'], errorCode: update.$set['emailHistory.$.errorCode'] });
      return { matchedCount: 1 };
    }
  };
}

test('appointment templates match each status, use saved details and exclude private notes', async () => {
  const messages = [];
  const send = createAppointmentEmailSender({ transport: { sendMail: async mail => { messages.push(mail); return { accepted: [mail.to], rejected: [] }; } }, from: 'sender@example.com', business: 'business@example.com' });
  await send(visit);
  await send({ ...visit, status: 'Cancelled' });
  await send({ ...visit, status: 'Completed' });
  assert.equal(messages[0].to, 'customer@example.com');
  assert.equal(messages[0].replyTo, 'business@example.com');
  assert.match(messages[0].subject, /confirmed/);
  assert.match(messages[0].text, /14:00.*Asia\/Karachi/);
  assert.match(messages[0].text, /12 Test Street/);
  assert.match(messages[0].text, /Test Painter/);
  assert.match(messages[1].subject, /cancelled/);
  assert.match(messages[2].subject, /completed/);
  assert.match(messages[2].text, /marked as completed/);
  assert.doesNotMatch(messages[2].text, /is confirmed|has been cancelled/);
  assert.match(messages[2].text, /14:00.*Asia\/Karachi/);
  assert.match(messages[2].text, /12 Test Street/);
  assert.equal(messages[2].to, 'customer@example.com');
  assert.doesNotMatch(messages.map(message => message.text).join(' '), /PRIVATE NOTE/);
  const reject = createAppointmentEmailSender({ transport: { sendMail: async () => ({ accepted: [], rejected: ['customer@example.com'] }) }, from: 'sender@example.com', business: 'business@example.com' });
  await assert.rejects(reject(visit), /not accepted/);
});

test('appointment email requires enabled SMTP, a saved eligible appointment and a current version', async () => {
  let current = { ...visit }, count = 0;
  const model = mailModel(() => current);
  const service = createAppointmentService(model, {}, async () => { count++; });
  await assert.rejects(createAppointmentService(model, {}).sendNotice('id', version), { status: 503 });
  await assert.rejects(service.sendNotice('id', '2025-01-01T00:00:00.000Z'), { status: 409 });
  for (const status of ['invalid']) {
    current = { ...visit, status };
    await assert.rejects(service.sendNotice('id', version), { status: 409 });
  }
  current = { ...visit, startsAt: '2020-01-01T00:00:00.000Z' };
  await assert.rejects(service.sendNotice('id', version), { status: 409 });
  assert.equal(count, 0);
  current = { ...visit };
  await service.sendNotice('id', version);
  current = { ...visit, status: 'Cancelled' };
  await service.sendNotice('id', version);
  current = { ...visit, status: 'Completed', startsAt: '2020-01-01T00:00:00.000Z' };
  await service.sendNotice('id', version);
  assert.equal(count, 3);
  current = null;
  assert.equal(await service.sendNotice('id', version), null);
});

test('concurrent sends are blocked and SMTP failure leaves the appointment intact', async () => {
  let finish;
  let current = { ...visit };
  const model = mailModel(() => current);
  const service = createAppointmentService(model, {}, () => new Promise(resolve => { finish = resolve; }));
  const pending = service.sendNotice('id', version);
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(service.sendNotice('id', version), { status: 409 });
  const otherServer = createAppointmentService(model, {}, async () => { throw new Error('Must not send'); });
  await assert.rejects(otherServer.sendNotice('id', version), { status: 409 });
  finish();
  await pending;
  assert.equal(current.emailHistory[0].status, 'Accepted');
  await assert.rejects(otherServer.sendNotice('id', version), { status: 409 });
  current = { ...visit };
  const failed = createAppointmentService(model, {}, async () => { throw new Error('secret SMTP information'); });
  await assert.rejects(failed.sendNotice('id', version), error => error.status === 502 && !error.message.includes('secret'));
  assert.equal(current.emailHistory[0].status, 'Failed');
  assert.equal(visit.status, 'Scheduled');
  assert.equal(visit.address, '12 Test Street');
});

test('failed attempts persist safe codes and can be retried, while accepted versions stay blocked after reload', async () => {
  const current = { ...visit };
  const model = mailModel(() => current);
  let sends = 0;
  const sender = async () => {
    sends++;
    if (sends === 1) throw Object.assign(new Error('private SMTP details'), { code: 'EDNS' });
  };
  const service = createAppointmentService(model, {}, sender);
  await assert.rejects(service.sendNotice('id', version), error => error.status === 502 && error.emailHistory[0].errorCode === 'EDNS');
  const accepted = await service.sendNotice('id', version);
  assert.equal(accepted.emailHistory.length, 2);
  assert.equal(accepted.emailHistory[0].status, 'Failed');
  assert.equal(accepted.emailHistory[1].status, 'Accepted');
  assert.equal(new Date(current.updatedAt).toISOString(), version);
  const restarted = createAppointmentService(model, {}, sender);
  assert.equal((await restarted.get('id')).emailHistory.length, 2);
  await assert.rejects(restarted.sendNotice('id', version), { status: 409 });
  assert.equal(sends, 2);
  current.updatedAt = new Date('2026-01-02T00:00:00.000Z');
  await restarted.sendNotice('id', current.updatedAt.toISOString());
  assert.equal(sends, 3);
});

test('an unrecorded outcome retains the database lock to avoid a duplicate send', async () => {
  const current = { ...visit };
  const model = mailModel(() => current);
  let sends = 0;
  model.updateOne = async () => { throw new Error('database unavailable'); };
  const service = createAppointmentService(model, {}, async () => { sends++; });
  await assert.rejects(service.sendNotice('id', version), { status: 503 });
  assert.equal(current.emailState, 'Sending');
  assert.equal(current.emailHistory[0].status, 'Sending');
  await assert.rejects(createAppointmentService(model, {}, async () => { sends++; }).sendNotice('id', version), { status: 409 });
  assert.equal(sends, 1);
});
