import express from 'express';
import { projectStatuses, validateProject } from '../validators/project.js';
import { auditAction } from '../services/audit.js';

export function projectRouter(service) {
  const router = express.Router();
  router.param('id', (req, res, next, id) => /^[a-f\d]{24}$/i.test(id) ? next() : res.status(400).json({ message: 'Invalid enquiry ID.' }));
  router.get('/consultations/:id/project', async (req, res, next) => {
    try {
      const data = await service.get(req.params.id);
      if (!data) return res.status(404).json({ message: 'Enquiry not found.' });
      res.json(data);
    } catch (error) { next(error); }
  });
  router.put('/consultations/:id/project', async (req, res, next) => {
    const { value, errors } = validateProject(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check project details.', errors });
    try {
      const project = await auditAction(req, 'project.save', req.params.id, Object.keys(value), () => service.save(req.params.id, value));
      if (!project) return res.status(404).json({ message: 'Enquiry not found.' });
      res.json({ project });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'A project was saved concurrently. Refresh before editing.' });
      if (error.status === 409) return res.status(409).json({ message: error.message });
      next(error);
    }
  });
  router.get('/projects', async (req, res, next) => {
    const pageText = req.query.page ?? '1', search = req.query.search ?? '', status = req.query.status ?? '';
    const page = Number(pageText);
    if (typeof pageText !== 'string' || !/^\d+$/.test(pageText) || !Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Invalid page.' });
    if (typeof search !== 'string' || search.length > 120) return res.status(400).json({ message: 'Search must be text of up to 120 characters.' });
    if (typeof status !== 'string' || (status && !projectStatuses.includes(status))) return res.status(400).json({ message: 'Invalid project status.' });
    try { res.json(await service.list({ page, limit: 25, search: search.trim(), status })); }
    catch (error) { next(error); }
  });
  return router;
}
