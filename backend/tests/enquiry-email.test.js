import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnquiryNotifier, emailConfig, configureEnquiryEmail } from '../src/services/enquiryEmail.js';
import { createApp } from '../src/app.js';

const enquiry = { _id: 'test-id', source: 'homepage', fullName: 'Test Customer', emailAddr: 'customer@example.com', phoneNumber: '+1 704 555 0123', projectDetails: 'Please paint the kitchen.' };
const settings = { EMAIL_ENABLED: 'true', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASSWORD: 'test-password', MAIL_FROM: 'sender@example.com', BUSINESS_NOTIFICATION_EMAIL: 'business@example.com' };

test('SMTP is opt-in and validates configuration without revealing credentials', () => {
  assert.equal(emailConfig({}), null);
  assert.throws(() => emailConfig({ EMAIL_ENABLED: 'true' }), /SMTP_HOST/);
  const config = emailConfig(settings);
  assert.equal(config.transport.secure, false);
  assert.equal(config.transport.requireTLS, true);
  assert.equal(emailConfig({ ...settings, SMTP_PORT: '465' }).transport.secure, true);
  assert.throws(() => emailConfig({ ...settings, SMTP_PORT: 'invalid' }), /SMTP_PORT/);
  assert.throws(() => emailConfig({ ...settings, MAIL_FROM: 'a@example.com,b@example.com' }), /MAIL_FROM/);
  const logs = [];
  assert.equal(configureEnquiryEmail({ ...settings, SMTP_HOST: '' }, { error: message => logs.push(message) }), undefined);
  assert.doesNotMatch(logs.join(' '), /test-password/);
});

test('business gets submitted details and customer gets a separate acknowledgement', async () => {
  const messages = [];
  const notify = createEnquiryNotifier({ transport: { sendMail: async message => { messages.push(message); } }, from: settings.MAIL_FROM, business: settings.BUSINESS_NOTIFICATION_EMAIL });
  await notify({ ...enquiry, adminNotes: 'PRIVATE INTERNAL NOTE' });
  assert.equal(messages.length, 2);
  assert.doesNotMatch(messages.map(message => message.text).join('\n'), /PRIVATE INTERNAL NOTE/);
  assert.equal(messages[0].to, settings.BUSINESS_NOTIFICATION_EMAIL);
  assert.equal(messages[0].replyTo, enquiry.emailAddr);
  assert.match(messages[0].text, /Please paint the kitchen/);
  assert.match(messages[0].text, /Area: Not specified/);
  assert.equal(messages[1].to, enquiry.emailAddr);
  assert.doesNotMatch(messages[1].text, /Please paint the kitchen/);
  assert.match(messages[1].text, /No appointment has been booked/);
});

test('a failed recipient does not suppress the other notification or expose SMTP errors', async () => {
  let attempts = 0;
  const logs = [];
  await createEnquiryNotifier({
    transport: { sendMail: async () => { attempts++; if (attempts === 1) throw Object.assign(new Error('private SMTP password'), { code: 'EAUTH', responseCode: 535 }); return { rejected: ['customer@example.com'] }; } },
    from: settings.MAIL_FROM, business: settings.BUSINESS_NOTIFICATION_EMAIL, logger: { error: message => logs.push(message) }
  })(enquiry);
  assert.equal(attempts, 2);
  assert.equal(logs.length, 2);
  assert.match(logs[0], /Code=EAUTH SMTP=535/);
  assert.doesNotMatch(logs.join(' '), /password|customer@example/);
});

test('both forms notify only after saving and still return success on email failure', async () => {
  const events = [];
  const server = createApp({ saveConsultation: async value => { events.push('saved'); return { ...value, _id: 'test-id' }; }, notifyEnquiry: async saved => { events.push(`email:${saved._id}`); throw new Error('SMTP failure'); } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const body = { fullName: enquiry.fullName, emailAddr: enquiry.emailAddr, phoneNumber: enquiry.phoneNumber, projectDetails: enquiry.projectDetails };
  try {
    assert.equal((await post('/api/enquiries', body)).status, 201);
    assert.equal((await post('/api/consultations', { ...body, selectedProjectType: 'Interior', sqft: 'Under 800 sq ft', consultTime: 'Morning (8:00 AM - 11:30 AM)' })).status, 201);
    assert.deepEqual(events, ['saved', 'email:test-id', 'saved', 'email:test-id']);
    assert.equal((await post('/api/enquiries', {})).status, 400);
    assert.equal(events.length, 4);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('storage failure never sends email', async () => {
  let emails = 0;
  const server = createApp({ saveConsultation: async () => { throw new Error('storage unavailable'); }, notifyEnquiry: async () => { emails++; } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(enquiry) });
    assert.equal(response.status, 503);
    assert.equal(emails, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
