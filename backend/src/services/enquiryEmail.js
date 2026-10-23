import nodemailer from 'nodemailer';

export function emailConfig(env) {
  if (env.EMAIL_ENABLED !== 'true') return null;
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM', 'BUSINESS_NOTIFICATION_EMAIL'];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`Email configuration missing: ${missing.join(', ')}`);
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid port.');
  for (const key of ['MAIL_FROM', 'BUSINESS_NOTIFICATION_EMAIL']) {
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env[key])) throw new Error(`${key} must be a single email address.`);
  }
  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('SMTP_SECURE must be true or false.');
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
  return {
    from: env.MAIL_FROM,
    business: env.BUSINESS_NOTIFICATION_EMAIL,
    transport: {
      host: env.SMTP_HOST, port, secure, requireTLS: !secure,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 4000, greetingTimeout: 4000, socketTimeout: 6000,
      disableFileAccess: true, disableUrlAccess: true
    }
  };
}

export function createEnquiryNotifier({ transport, from, business, logger = console }) {
  return async enquiry => {
    const reference = String(enquiry._id);
    const details = [
      ['Reference', reference], ['Source', enquiry.source === 'homepage' ? 'Homepage' : 'Contact page'],
      ['Name', enquiry.fullName], ['Email', enquiry.emailAddr], ['Phone', enquiry.phoneNumber],
      ['Project type', enquiry.selectedProjectType], ['Area', enquiry.sqft || 'Not specified'],
      ['Preferred date', enquiry.consultDate || 'Not specified'], ['Arrival window', enquiry.consultTime || 'Not specified'],
      ['Message', enquiry.projectDetails || 'Not specified']
    ].map(([label, value]) => `${label}: ${value}`).join('\n');
    const messages = [
      { from, to: business, replyTo: enquiry.emailAddr, subject: 'New enquiry — Noble Paint Service',
        text: `${details}\n\nThis is an enquiry. No appointment has been confirmed.` },
      { from, to: enquiry.emailAddr, replyTo: business, subject: 'We received your enquiry — Noble Paint Service',
        text: `Thank you for contacting Noble Paint Service.\n\nWe have received your enquiry and our team will contact you.\nReference: ${reference}\n\nYour preferred appointment date and time, if provided, are subject to confirmation. No appointment has been booked yet.` }
    ];
    // Attempt both independently: one recipient's failure must not suppress the other.
    const outcomes = await Promise.allSettled(messages.map(message => Promise.resolve().then(() => transport.sendMail(message))));
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'rejected' || outcome.value?.rejected?.length) {
        const error = outcome.status === 'rejected' ? outcome.reason : null;
        const knownCodes = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'EENVELOPE', 'EMESSAGE', 'ESTREAM', 'ETLS'];
        const code = knownCodes.includes(error?.code) ? error.code : 'UNKNOWN';
        const responseCode = Number.isInteger(error?.responseCode) && error.responseCode >= 100 && error.responseCode <= 599 ? ` SMTP=${error.responseCode}` : '';
        logger.error(`Enquiry email failed (${index === 0 ? 'business' : 'customer'}). Code=${code}${responseCode}`);
      }
    });
  };
}

export function configureEnquiryEmail(env, logger = console) {
  try {
    const config = emailConfig(env);
    if (!config) return undefined;
    return createEnquiryNotifier({ transport: nodemailer.createTransport(config.transport), from: config.from, business: config.business, logger });
  } catch (error) {
    logger.error(error.message);
    logger.error('Email notifications disabled. Enquiries will still be saved.');
    return undefined;
  }
}
