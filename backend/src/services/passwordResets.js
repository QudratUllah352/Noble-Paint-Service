import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from './passwords.js';

const tokenHash = token => createHash('sha256').update(token).digest('hex');

export function createPasswordResetService(Admin, sendEmail, { logger = console, now = () => new Date() } = {}) {
  return {
    async request(email) {
      const admin = await Admin.findOne({ email }).select('_id').lean();
      if (!admin) return;

      const token = randomBytes(32).toString('hex');
      const hashedToken = tokenHash(token);
      const expiresAt = new Date(now().getTime() + 30 * 60 * 1000);
      await Admin.updateOne({ _id: admin._id }, {
        $set: { passwordResetTokenHash: hashedToken, passwordResetExpiresAt: expiresAt }
      });
      try {
        await sendEmail(email, token);
      } catch (error) {
        await Admin.updateOne({ _id: admin._id, passwordResetTokenHash: hashedToken }, {
          $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 }
        });
        logger.error('Password reset email failed.');
      }
    },
    async reset(token, password) {
      if (typeof token !== 'string' || !/^[a-f\d]{64}$/i.test(token)) return false;
      const passwordHash = await hashPassword(password);
      const result = await Admin.findOneAndUpdate({
        passwordResetTokenHash: tokenHash(token),
        passwordResetExpiresAt: { $gt: now() }
      }, {
        $set: { passwordHash, sessionVersion: randomUUID() },
        $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 }
      });
      return Boolean(result);
    }
  };
}
