import { randomUUID } from 'node:crypto';

// One database lock serializes appointment writes across server processes, including
// cancellations and reassignments. No expiring lease can lapse during a slow save.
export function createSchedulingGuard(Lock) {
  return async task => {
    const token = randomUUID();
    const _id = 'appointment-scheduling';
    try { await Lock.create({ _id, token }); }
    catch (error) {
      if (error.code !== 11000) throw error;
      throw Object.assign(new Error('Another appointment save is in progress. Please try again.'), { status: 409 });
    }
    try { return await task(); }
    finally { await Lock.deleteOne({ _id, token }); }
  };
}

export function schedulingConflictFilter(consultation, member, startsAt, durationMinutes) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return {
    consultation: { $ne: consultation }, status: 'Scheduled',
    $or: [{ assignedMember: member._id }, { assignedMember: null, assignedTo: member.name }],
    startsAt: { $lt: end },
    $expr: { $gt: [
      { $add: ['$startsAt', { $multiply: [{ $ifNull: ['$durationMinutes', 60] }, 60000] }] }, start
    ] }
  };
}
