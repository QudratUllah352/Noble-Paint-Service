import { enquiryStatuses } from '../validators/enquiryStatus.js';

export function createOverviewReader(model) {
  return async () => {
    const [groups, recent] = await Promise.all([
      model.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      model.find().sort({ createdAt: -1, _id: -1 }).limit(5)
        .select('_id fullName source status createdAt').lean()
    ]);
    const byStatus = Object.fromEntries(enquiryStatuses.map(status => [status, 0]));
    let total = 0;
    for (const group of groups) {
      total += group.count;
      const status = group._id === 'pending' ? 'New' : group._id;
      if (Object.hasOwn(byStatus, status)) byStatus[status] += group.count;
    }
    return { total, byStatus, recent };
  };
}
