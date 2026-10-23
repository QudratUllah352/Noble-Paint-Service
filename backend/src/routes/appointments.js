import express from 'express';
import { appointmentStatuses, validateAppointment } from '../validators/appointment.js';
import { rateLimit } from 'express-rate-limit';
import { auditAction } from '../services/audit.js';

export function appointmentRouter(service) {
  const router = express.Router();
  router.param('id', (req, res, next, id) => /^[a-f\d]{24}$/i.test(id) ? next() : res.status(400).json({ message: 'Invalid enquiry ID.' }));
  const mailLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many email requests. Try again in 15 minutes.' } });
  router.post('/consultations/:id/appointment/email', mailLimit, async (req, res, next) => {
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.version !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.version)) {
      return res.status(400).json({ message: 'Refresh the appointment before sending email.' });
    }
    try {
      const result = await auditAction(req, 'appointment.email', req.params.id, [], () => service.sendNotice(req.params.id, body.version));
      if (!result) return res.status(404).json({ message: 'Appointment not found.' });
      res.json(result);
    } catch (error) {
      if ([409, 502, 503].includes(error.status)) return res.status(error.status).json({ message: error.message,
        emailState: error.emailState, emailVersion: error.emailVersion, emailHistory: error.emailHistory });
      next(error);
    }
  });
  router.get('/consultations/:id/appointment', async (req, res, next) => {
    try { res.json({ appointment: await service.get(req.params.id) }); }
    catch (error) { next(error); }
  });
  router.put('/consultations/:id/appointment', async (req, res, next) => {
    const { value, errors } = validateAppointment(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check appointment details.', errors });
    try {
      const appointment = await auditAction(req, 'appointment.save', req.params.id, Object.keys(value), () => service.save(req.params.id, value));
      if (!appointment) return res.status(404).json({ message: 'Enquiry not found.' });
      res.json({ appointment });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'An appointment was saved concurrently. Reload before editing.' });
      if (error.status === 409) return res.status(409).json({ message: error.message, errors: error.errors });
      next(error);
    }
  });
  router.get('/appointments', async (req, res, next) => {
    const pageText = req.query.page ?? '1';
    const status = req.query.status ?? '';
    const page = Number(pageText);
    if (typeof pageText !== 'string' || !/^\d+$/.test(pageText) || !Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Invalid page.' });
    if (typeof status !== 'string' || (status && !appointmentStatuses.includes(status))) return res.status(400).json({ message: 'Invalid appointment status.' });
    try { res.json(await service.list({ page, limit: 25, status })); }
    catch (error) { next(error); }
  });
  return router;
}
