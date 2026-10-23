import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { verifyPassword } from '../services/passwords.js';
import { enquiryStatuses } from '../validators/enquiryStatus.js';
import { appointmentRouter } from './appointments.js';
import { teamRouter } from './team.js';
import { projectRouter } from './projects.js';
import { catalogueRouter } from './catalogue.js';
import { accountRouter } from './account.js';
import { auditAction } from '../services/audit.js';
import { auditRouter } from './audit.js';

export function adminRouter({ secret, store, secure = false, siteUrl, findAdmin, listConsultations, updateConsultationStatus, updateConsultationNotes, getOverview, appointments, team, projects, catalogue, accounts, recovery, audit }) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const router = express.Router();
  const origin = new URL(siteUrl).origin;
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(session({
    name: 'noble.admin', secret, store, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure, maxAge: 8 * 60 * 60 * 1000 }
  }));
  router.use((req, res, next) => {
    if (req.method !== 'GET' && (req.get('origin') !== origin || !req.is('application/json'))) {
      return res.status(403).json({ message: 'Request origin or content type is not allowed.' });
    }
    next();
  });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' } });
  const dummyHash = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
  router.post('/login', limiter, async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 256) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
      const admin = await findAdmin(email.trim().toLowerCase());
      const matches = await verifyPassword(password, admin?.passwordHash || dummyHash);
      if (!admin || !matches) return res.status(401).json({ message: 'Invalid email or password.' });
      req.session.regenerate(error => {
        if (error) return next(error);
        req.session.adminId = String(admin._id);
        req.session.adminVersion = admin.sessionVersion || '';
        req.session.save(error => error ? next(error) : res.json({ message: 'Signed in.' }));
      });
    } catch (error) { next(error); }
  });
  router.use(async (req, res, next) => {
    if (!req.session.adminId) return res.status(401).json({ message: 'Please sign in.' });
    if (!accounts) return next();
    try {
      const account = await accounts.get(req.session.adminId);
      if (!account || (account.sessionVersion || '') !== (req.session.adminVersion || '')) {
        return req.session.destroy(() => {
          res.clearCookie('noble.admin', { httpOnly: true, sameSite: 'strict', secure });
          res.status(401).json({ message: 'Your session has ended. Please sign in again.' });
        });
      }
      req.currentAdmin = account;
      next();
    } catch (error) { next(error); }
  });
  if (audit) {
    router.use((req, res, next) => { req.audit = audit; next(); });
    router.use(auditRouter(audit));
  }
  if (accounts) router.use(accountRouter(accounts, secure));
  if (appointments) router.use(appointmentRouter(appointments));
  if (team) router.use(teamRouter(team));
  if (projects) router.use(projectRouter(projects));
  if (catalogue) router.use(catalogueRouter(catalogue));
  router.get('/session', (req, res) => res.json({ authenticated: true }));
  if (recovery) router.get('/recovery', async (req, res, next) => {
    try { res.json(await recovery.inspect()); } catch (error) { next(error); }
  });
  router.get('/overview', async (req, res, next) => {
    try { res.json(await getOverview()); }
    catch (error) { next(error); }
  });
  router.patch('/consultations/:id/notes', async (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid enquiry ID.' });
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.adminNotes !== 'string' || body.adminNotes.length > 5000) {
      return res.status(400).json({ message: 'Notes must be text of up to 5,000 characters.' });
    }
    try {
      const item = await auditAction(req, 'enquiry.notes', req.params.id, ['adminNotes'], () => updateConsultationNotes(req.params.id, body.adminNotes.trim()));
      if (!item) return res.status(404).json({ message: 'Enquiry not found.' });
      res.json({ id: String(item._id), adminNotes: item.adminNotes });
    } catch (error) { next(error); }
  });
  router.patch('/consultations/:id/status', async (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid enquiry ID.' });
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || !enquiryStatuses.includes(body.status)) {
      return res.status(400).json({ message: 'Choose a valid enquiry status.' });
    }
    try {
      const item = await auditAction(req, 'enquiry.status', req.params.id, ['status'], () => updateConsultationStatus(req.params.id, body.status));
      if (!item) return res.status(404).json({ message: 'Enquiry not found.' });
      res.json({ id: String(item._id), status: item.status });
    } catch (error) { next(error); }
  });
  router.post('/logout', (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie('noble.admin', { httpOnly: true, sameSite: 'strict', secure });
      res.json({ message: 'Signed out.' });
    });
  });
  router.get('/consultations', async (req, res, next) => {
    try {
      if (req.query.page !== undefined && (typeof req.query.page !== 'string' || !/^\d+$/.test(req.query.page))) return res.status(400).json({ message: 'Invalid page.' });
      const page = Number(req.query.page || 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Invalid page.' });
      const search = req.query.search ?? '';
      const status = req.query.status ?? '';
      if (typeof search !== 'string' || search.length > 120) return res.status(400).json({ message: 'Search must be text of up to 120 characters.' });
      if (typeof status !== 'string' || (status && !enquiryStatuses.includes(status))) return res.status(400).json({ message: 'Choose a valid status filter.' });
      res.json(await listConsultations({ page, limit: 25, search: search.trim(), status }));
    } catch (error) { next(error); }
  });
  router.use((error, req, res, next) => {
    if (error.auditOutcomeUnknown) return res.status(503).json({ message: error.message });
    next(error);
  });
  return router;
}
