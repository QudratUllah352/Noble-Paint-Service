export const projectStatuses = ['Planned', 'In progress', 'Completed', 'Cancelled'];

export function validateProject(body) {
  const errors = {}, value = {};
  const fields = ['title', 'scope', 'assignedMember', 'startDate', 'targetDate', 'status'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) return { errors: { form: 'Send only project fields.' }, value };
  for (const field of fields) {
    if (body[field] !== undefined && typeof body[field] !== 'string') errors[field] = 'Must be text.';
    value[field] = typeof body[field] === 'string' ? body[field].trim() : '';
  }
  if (!value.title || value.title.length > 160) errors.title = 'Enter a title of up to 160 characters.';
  if (value.scope.length > 5000) errors.scope = 'Use up to 5,000 characters.';
  if (!/^[a-f\d]{24}$/i.test(value.assignedMember)) errors.assignedMember = 'Choose a saved team member.';
  for (const field of ['startDate', 'targetDate']) {
    const date = new Date(value[field]);
    if (value[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(value[field]) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value[field])) errors[field] = 'Choose a valid date.';
  }
  if (!errors.startDate && !errors.targetDate && value.startDate && value.targetDate && value.targetDate < value.startDate) errors.targetDate = 'Target date must be on or after the start date.';
  if (!projectStatuses.includes(value.status)) errors.status = 'Choose a valid project status.';
  return { errors, value };
}
