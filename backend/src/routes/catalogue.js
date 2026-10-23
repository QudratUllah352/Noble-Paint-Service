import express from 'express';
import { serviceStatuses, validateService } from '../validators/service.js';
import { auditAction } from '../services/audit.js';

export function catalogueRouter(service) {
  const router = express.Router();
  router.get('/services', async (req, res, next) => {
    const pageText = req.query.page ?? '1', search = req.query.search ?? '', status = req.query.status ?? '';
    const page = Number(pageText);
    if (typeof pageText !== 'string' || !/^\d+$/.test(pageText) || !Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Invalid page.' });
    if (typeof search !== 'string' || search.length > 120) return res.status(400).json({ message: 'Search must be text of up to 120 characters.' });
    if (typeof status !== 'string' || (status && !serviceStatuses.includes(status))) return res.status(400).json({ message: 'Invalid service status.' });
    try { res.json(await service.list({ page, limit: 25, search: search.trim(), status })); }
    catch (error) { next(error); }
  });
  async function save(req, res, next) {
    if (req.params.id && !/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid service ID.' });
    const { value, errors } = validateService(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check service details.', errors });
    try {
      const item = await auditAction(req, req.params.id ? 'service.update' : 'service.create', req.params.id || 'new', Object.keys(value),
        () => req.params.id ? service.update(req.params.id, value) : service.create(value));
      if (!item) return res.status(404).json({ message: 'Service not found.' });
      res.status(req.params.id ? 200 : 201).json({ service: item });
    } catch (error) { next(error); }
  }
  router.post('/services', save);
  router.put('/services/:id', save);
  return router;
}
