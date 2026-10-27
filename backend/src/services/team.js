export function teamFilter({ search = '', status = '' }) {
  const filter = status ? { status } : {};
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'role', 'email', 'phone'].map(field => ({ [field]: { $regex: literal, $options: 'i' } }));
  }
  return filter;
}

export function createTeamService(model) {
  return {
    publicList: () => model.find({ status: 'Active' }).select('name role -_id').sort({ name: 1, _id: 1 }).lean(),
    create: value => model.create(value),
    get: id => model.findById(id).lean(),
    update: (id, value) => model.findByIdAndUpdate(id, { $set: value }, { new: true, runValidators: true }).lean(),
    async list({ page, limit, search, status }) {
      const filter = teamFilter({ search, status });
      const [items, total] = await Promise.all([
        model.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        model.countDocuments(filter)
      ]);
      return { items, total, page, pageSize: limit };
    }
  };
}
