import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { validateAccountChange } from '../validators/account.js';
import { auditAction } from '../services/audit.js';

export function accountRouter(accounts, secure) {
  const router = express.Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many account change attempts. Try again in 15 minutes.' } });
  router.get('/account', (req, res) => res.json({ email: req.currentAdmin.email, createdAt: req.currentAdmin.createdAt }));
  function change(type) {
    return async (req, res, next) => {
      const { value, errors } = validateAccountChange(req.body, type);
      if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check your account details.', errors });
      try {
        await auditAction(req, `account.${type}`, req.session.adminId, [type], () => accounts.change(req.session.adminId, type, value, req.currentAdmin.sessionVersion || ''));
        req.session.destroy(error => {
          if (error) console.error('Account updated; session cleanup failed.');
          res.clearCookie('noble.admin', { httpOnly: true, sameSite: 'strict', secure });
          res.json({ message: 'Account updated. Sign in again with your updated details.', signInRequired: true });
        });
      } catch (error) {
        if ([400, 403, 409].includes(error.status)) return res.status(error.status).json({ message: error.message });
        next(error);
      }
    };
  }
  router.patch('/account/email', limiter, change('email'));
  router.patch('/account/password', limiter, change('password'));
  return router;
}
