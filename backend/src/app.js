import express from 'express';
import { fileURLToPath } from 'node:url';
import { validateConsultation } from './validators/consultation.js';
import { adminRouter } from './routes/admin.js';
import { validateHomeEnquiry } from './validators/homeEnquiry.js';
import { rateLimit } from 'express-rate-limit';

export function createApp({ saveConsultation, admin, notifyEnquiry, catalogue, teamDirectory }) {
  async function sendNotification(saved) {
    if (!notifyEnquiry) return;
    try { await notifyEnquiry(saved); }
    catch { console.error('Enquiry email failed. The enquiry remains saved.'); }
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/services', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!catalogue) return res.status(503).json({ message: 'Services are unavailable right now.' });
    try { res.json({ items: await catalogue.publicList() }); }
    catch (error) { next(error); }
  });
  app.get('/api/team', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!teamDirectory) return res.status(503).json({ message: 'Team information is unavailable right now.' });
    try {
      const members = await teamDirectory.publicList();
      res.json({ items: members.map(({ name, role }) => ({ name, role })) });
    } catch (error) { next(error); }
  });
  if (notifyEnquiry) app.use(['/api/enquiries', '/api/consultations'], rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many enquiries. Please try again in 15 minutes or call us.' }
  }));
  app.use('/api/admin', admin ? adminRouter(admin) : (req, res) => res.status(503).json({ message: 'Admin access is not configured. See backend/SETUP.md.' }));

  app.post('/api/enquiries', async (req, res, next) => {
    if (!req.is('application/json')) return res.status(415).json({ message: 'Send the request as JSON.' });
    const { errors, value } = validateHomeEnquiry(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check your form details.', errors });
    try {
      const saved = await saveConsultation(value);
      await sendNotification(saved);
      res.status(201).json({ id: String(saved._id), message: 'Your enquiry has been received. Our team will contact you. No appointment has been booked yet.' });
    } catch (error) { next(error); }
  });
  app.post('/api/consultations', async (req, res, next) => {
    if (!req.is('application/json')) {
      return res.status(415).json({ message: 'Send the request as JSON.' });
    }
    const { errors, value } = validateConsultation(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Please check your form details.', errors });
    }
    try {
      const saved = await saveConsultation(value);
      await sendNotification(saved);
      res.status(201).json({ id: String(saved._id), message: 'Your consultation request has been received. Our team will contact you to confirm availability.' });
    } catch (error) {
      next(error);
    }
  });
  app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));
  app.use(express.static(fileURLToPath(new URL('../../frontend/', import.meta.url))));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
    console.error('Consultation request failed:', error.name);
    res.status(503).json({ message: 'The service is unavailable right now. Please try again later.' });
  });
  return app;
}
