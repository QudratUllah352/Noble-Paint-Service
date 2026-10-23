import { projectStatuses } from '../validators/project.js';

export function projectFilter({ search = '', status = '' }) {
  const filter = status ? { status } : {};
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['title', 'customerName'].map(field => ({ [field]: { $regex: literal, $options: 'i' } }));
  }
  return filter;
}

export function createProjectService(Project, Consultation, TeamMember) {
  return {
    async get(id) {
      const [enquiry, project] = await Promise.all([
        Consultation.findById(id).select('fullName projectDetails selectedProjectType status').lean(),
        Project.findOne({ consultation: id }).lean()
      ]);
      return enquiry ? { enquiry, project } : null;
    },
    async save(id, value) {
      const enquiry = await Consultation.findById(id).select('fullName status').lean();
      if (!enquiry) return null;
      const existing = await Project.findOne({ consultation: id }).lean();
      if (!existing && enquiry.status !== 'Won') throw Object.assign(new Error('Mark this enquiry Won before creating its project.'), { status: 409 });
      const member = await TeamMember.findById(value.assignedMember).lean();
      if (!member || (member.status !== 'Active' && (['Planned', 'In progress'].includes(value.status) || String(existing?.assignedMember) !== value.assignedMember))) {
        throw Object.assign(new Error('Choose an active team member for this project.'), { status: 409 });
      }
      return Project.findOneAndUpdate({ consultation: id }, {
        $set: { ...value, assignedTo: member.name, customerName: enquiry.fullName }
      }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    },
    async list({ page, limit, search, status }) {
      const filter = projectFilter({ search, status });
      const [items, total] = await Promise.all([
        Project.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Project.countDocuments(filter)
      ]);
      return { items, total, page, pageSize: limit };
    },
    async summary() {
      const groups = await Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
      const byStatus = Object.fromEntries(projectStatuses.map(status => [status, 0]));
      let total = 0;
      for (const group of groups) { total += group.count; if (Object.hasOwn(byStatus, group._id)) byStatus[group._id] += group.count; }
      return { total, byStatus };
    }
  };
}
