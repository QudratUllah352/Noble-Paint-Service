import express from 'express';
import { teamStatuses, validateTeamMember } from '../validators/teamMember.js';
import { auditAction } from '../services/audit.js';

export function teamRouter(service) {
  const router = express.Router();
  router.param('memberId', (req, res, next, id) => /^[a-f\d]{24}$/i.test(id) ? next() : res.status(400).json({ message: 'Invalid team member ID.' }));
  router.get('/team', async (req, res, next) => {
    const pageText = req.query.page ?? '1';
    const page = Number(pageText), search = req.query.search ?? '', status = req.query.status ?? '';
    if (typeof pageText !== 'string' || !/^\d+$/.test(pageText) || !Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({ message: 'Invalid page.' });
    if (typeof search !== 'string' || search.length > 120) return res.status(400).json({ message: 'Search must be text of up to 120 characters.' });
    if (typeof status !== 'string' || (status && !teamStatuses.includes(status))) return res.status(400).json({ message: 'Invalid team status.' });
    try { res.json(await service.list({ page, limit: 25, search: search.trim(), status })); }
    catch (error) { next(error); }
  });
  router.get('/team/:memberId', async (req, res, next) => {
    try {
      const member = await service.get(req.params.memberId);
      if (!member) return res.status(404).json({ message: 'Team member not found.' });
      res.json({ member });
    } catch (error) { next(error); }
  });
  async function save(req, res, next) {
    const { errors, value } = validateTeamMember(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check team member details.', errors });
    try {
      const member = await auditAction(req, req.params.memberId ? 'team.update' : 'team.create', req.params.memberId || 'new', Object.keys(value),
        () => req.params.memberId ? service.update(req.params.memberId, value) : service.create(value));
      if (!member) return res.status(404).json({ message: 'Team member not found.' });
      res.status(req.params.memberId ? 200 : 201).json({ member });
    } catch (error) { next(error); }
  }
  router.post('/team', save);
  router.put('/team/:memberId', save);
  return router;
}
