import nodemailer from 'nodemailer';
import { emailConfig } from './enquiryEmail.js';

export function configurePasswordResetEmail(env, siteUrl, logger = console) {
  try {
    const config = emailConfig(env);
    if (!config) return undefined;
    const transport = nodemailer.createTransport(config.transport);
    return async (email, token) => {
      const resetUrl = new URL(`/admin/reset-password.html?token=${encodeURIComponent(token)}`, siteUrl);
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: 'Reset your Noble Paint Service admin password',
        text: `A password reset was requested for your admin account.\n\nUse this link within 30 minutes to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`
      });
    };
  } catch (error) {
    logger.error(`Password recovery email disabled: ${error.message}`);
    return undefined;
  }
}
