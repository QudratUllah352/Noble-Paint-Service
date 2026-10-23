import express from 'express';
import { auditActions, auditOutcomes } from '../services/audit.js';

export function auditRouter(audit) {
  const router = express.Router();
  router.get('/audit', async (req, res, next) => {
    const { page = '1', action = '', outcome = '', search = '', from = '', to = '' } = req.query;
    const dateValid = value => typeof value === 'string' && (!value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value));
    if (Object.keys(req.query).some(key => !['page', 'action', 'outcome', 'search', 'from', 'to'].includes(key)) ||
      typeof page !== 'string' || !/^\d+$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) < 1 || Number(page) > 100000 ||
      typeof action !== 'string' || (action && !auditActions.includes(action)) || typeof outcome !== 'string' || (outcome && !auditOutcomes.includes(outcome)) ||
      typeof search !== 'string' || search.length > 120 || !dateValid(from) || !dateValid(to) || (from && to && from > to)) {
      return res.status(400).json({ message: 'Choose valid audit filters. Dates must be YYYY-MM-DD, from no later than to.' });
    }
    try {
      res.json(await audit.list({ page: Number(page), action, outcome, search: search.trim(),
        from: from ? new Date(from) : undefined, to: to ? new Date(Date.parse(to) + 86400000) : undefined }));
    } catch (error) { next(error); }
  });
  return router;
}
