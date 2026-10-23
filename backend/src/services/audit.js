export const auditActions = ['enquiry.status', 'enquiry.notes', 'appointment.save', 'appointment.email',
  'team.create', 'team.update', 'project.save', 'service.create', 'service.update',
  'account.email', 'account.password', 'recovery.unlock', 'recovery.received', 'recovery.retry'];
export const auditOutcomes = ['Pending', 'Completed', 'No record', 'Error'];

export function createAuditService(AuditEvent) {
  return {
    async run(actor, action, target, fields, task) {
      // Never persist request bodies, passwords, notes, customer details or raw errors.
      const event = await AuditEvent.create({ actor: actor.id, actorEmail: actor.email || '', action,
        target, fields, outcome: 'Pending' });
      let result;
      try { result = await task(); }
      catch (error) {
        try { await AuditEvent.updateOne({ _id: event._id }, { $set: { outcome: 'Error', finishedAt: new Date() } }); }
        catch { console.error('Audit outcome could not be recorded; inspect Pending events.'); }
        throw error;
      }
      // A crash between the business write and this update leaves a visible Pending event.
      try {
        const recorded = await AuditEvent.updateOne({ _id: event._id }, { $set: {
          outcome: result === null ? 'No record' : 'Completed', finishedAt: new Date(),
          ...(result?._id && target === 'new' ? { target: String(result._id) } : {})
        } });
        if (recorded.matchedCount !== 1) throw new Error('Audit event missing');
      } catch {
        throw Object.assign(new Error('The action may have completed, but its audit outcome could not be recorded. Refresh the record and audit history before retrying.'), { status: 503, auditOutcomeUnknown: true });
      }
      return result;
    },
    async list({ page, action, outcome, search, from, to }) {
      const filter = {};
      if (action) filter.action = action;
      if (outcome) filter.outcome = outcome;
      if (search) {
        const pattern = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
        filter.$or = [{ actorEmail: pattern }, { target: pattern }];
      }
      if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) };
      const [items, total] = await Promise.all([
        AuditEvent.find(filter).select('actor actorEmail action target fields outcome createdAt finishedAt')
          .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).lean(),
        AuditEvent.countDocuments(filter)
      ]);
      return { items, total, page, pageSize: 25 };
    }
  };
}

export function auditAction(req, action, target, fields, task) {
  return req.audit ? req.audit.run({ id: req.session.adminId, email: req.currentAdmin?.email }, action, target, fields, task) : task();
}
