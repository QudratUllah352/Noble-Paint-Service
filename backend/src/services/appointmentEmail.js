import nodemailer from 'nodemailer';
import { emailConfig } from './enquiryEmail.js';

export function createAppointmentEmailSender({ transport, from, business }) {
  return async appointment => {
    const cancelled = appointment.status === 'Cancelled';
    const completed = appointment.status === 'Completed';
    const visit = new Intl.DateTimeFormat('en-GB', {
      timeZone: appointment.timeZone, dateStyle: 'full', timeStyle: 'short'
    }).format(new Date(appointment.startsAt));
    const result = await transport.sendMail({
      from, to: appointment.consultation.emailAddr, replyTo: business,
      subject: completed ? 'Appointment completed — Noble Paint Service' : cancelled ? 'Appointment cancelled — Noble Paint Service' : 'Appointment confirmed — Noble Paint Service',
      text: [
        completed ? 'Your appointment with Noble Paint Service has been marked as completed. Thank you for choosing us.' : cancelled ? 'Your appointment with Noble Paint Service has been cancelled.' : 'Your appointment with Noble Paint Service is confirmed.',
        `Reference: ${appointment._id}`,
        `${cancelled ? 'Cancelled visit' : 'Visit'}: ${visit} (${appointment.timeZone})`,
        `Address: ${appointment.address}`,
        `Duration: ${appointment.durationMinutes || 60} minutes`,
        ...(cancelled ? [] : [`Assigned team member: ${appointment.assignedTo}`]),
        'Please reply to this email if you have any questions.'
      ].join('\n\n')
    });
    if (!result?.accepted?.length || result.rejected?.length) throw Object.assign(new Error('Recipient was not accepted.'), { code: 'EENVELOPE' });
  };
}

export function configureAppointmentEmail(env, logger = console) {
  try {
    const config = emailConfig(env);
    if (!config) return undefined;
    return createAppointmentEmailSender({ transport: nodemailer.createTransport(config.transport), from: config.from, business: config.business });
  } catch {
    logger.error('Appointment email disabled: check SMTP settings.');
    return undefined;
  }
}
