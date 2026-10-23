export function consultationFilter({ search = '', status = '' }) {
  const filter = {};
  if (status) filter.status = status === 'New' ? { $in: ['New', 'pending'] } : status;
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['fullName', 'emailAddr', 'phoneNumber'].map(field => ({
      [field]: { $regex: literal, $options: 'i' }
    }));
  }
  return filter;
}

export function createConsultationLister(model) {
  return async ({ page, limit, search = '', status = '' }) => {
    const filter = consultationFilter({ search, status });
    const [items, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      model.countDocuments(filter)
    ]);
    return { items, total, page, pageSize: limit };
  };
}
