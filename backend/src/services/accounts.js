import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwords.js';

export function createAccountService(Admin) {
  return {
    get: id => Admin.findById(id).select('email createdAt sessionVersion').lean(),
    async change(id, type, value, expectedVersion) {
      const account = await Admin.findById(id).select('+passwordHash').lean();
      if (!account || (account.sessionVersion || '') !== expectedVersion) throw Object.assign(new Error('Account changed. Sign in again.'), { status: 409 });
      if (!await verifyPassword(value.currentPassword, account.passwordHash)) throw Object.assign(new Error('Current password is incorrect.'), { status: 403 });
      if (type === 'email' && value.email === account.email) throw Object.assign(new Error('This is already your sign-in email.'), { status: 400 });
      const change = { sessionVersion: randomUUID() };
      if (type === 'email') change.email = value.email;
      else change.passwordHash = await hashPassword(value.newPassword);
      try {
        const updated = await Admin.findOneAndUpdate({
          _id: id, passwordHash: account.passwordHash, sessionVersion: account.sessionVersion ?? null
        }, { $set: change }, { new: true, runValidators: true }).select('email').lean();
        if (!updated) throw Object.assign(new Error('Account changed while saving. Sign in again.'), { status: 409 });
        return { email: updated.email };
      } catch (error) {
        if (error.code === 11000) throw Object.assign(new Error('That email is already used by another admin account.'), { status: 409 });
        throw error;
      }
    }
  };
}
