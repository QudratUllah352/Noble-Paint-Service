import { readFile } from 'node:fs/promises';
import { validateService } from '../validators/service.js';

export async function seedServices(model) {
  const defaults = JSON.parse(await readFile(new URL('../data/defaultServices.json', import.meta.url), 'utf8'));
  const operations = defaults.map(({ seedKey, ...body }) => {
    const { errors, value } = validateService(body);
    if (Object.keys(errors).length) throw new Error('Invalid starter service data.');
    const now = new Date();
    return { updateOne: { filter: { seedKey }, update: { $setOnInsert: { ...value, seedKey, createdAt: now, updatedAt: now } }, upsert: true, timestamps: false } };
  });
  await model.bulkWrite(operations);
}

export function serviceFilter({ search = '', status = '' }) {
  const filter = status ? { status } : {};
  if (search) filter.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  return filter;
}

export function createCatalogueService(model) {
  return {
    create: value => model.create(value),
    update: (id, value) => model.findByIdAndUpdate(id, { $set: value }, { new: true, runValidators: true }).lean(),
    async list({ page, limit, search, status }) {
      const filter = serviceFilter({ search, status });
      const [items, total] = await Promise.all([
        model.find(filter).sort({ sortOrder: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        model.countDocuments(filter)
      ]);
      return { items, total, page, pageSize: limit };
    },
    publicList: () => model.find({ status: 'Active' }).sort({ sortOrder: 1, _id: 1 })
      .select('_id title description categories features imageUrl imageAlt badge').lean()
  };
}
