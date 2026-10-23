export const teamStatuses = ['Active', 'On leave', 'Inactive'];

export function validateTeamMember(body) {
  const errors = {}, value = {};
  const fields = ['name', 'role', 'email', 'phone', 'status'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) return { errors: { form: 'Send only team member fields.' }, value };
  for (const field of fields) {
    if (typeof body[field] !== 'string' && !(body[field] === undefined && ['email', 'phone'].includes(field))) errors[field] = 'Must be text.';
    value[field] = typeof body[field] === 'string' ? body[field].trim() : '';
  }
  if (!value.name || value.name.length > 120) errors.name = 'Enter a name of up to 120 characters.';
  if (!value.role || value.role.length > 120) errors.role = 'Enter a role of up to 120 characters.';
  if (value.email && (value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) errors.email = 'Enter a valid email address.';
  const digits = value.phone.replace(/\D/g, '');
  if (value.phone && (value.phone.length > 40 || !/^[+\d\s().-]+$/.test(value.phone) || digits.length < 7 || digits.length > 15)) errors.phone = 'Enter a phone number with 7 to 15 digits.';
  if (!teamStatuses.includes(value.status)) errors.status = 'Choose Active, On leave or Inactive.';
  return { errors, value };
}
