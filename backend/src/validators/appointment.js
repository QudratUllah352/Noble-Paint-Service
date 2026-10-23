export const appointmentStatuses = ['Scheduled', 'Completed', 'Cancelled'];

export function validateAppointment(body, now = new Date()) {
  const errors = {};
  const keys = ['startsAt', 'timeZone', 'address', 'assignedMember', 'status'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => ![...keys, 'durationMinutes'].includes(key))) {
    return { errors: { form: 'Send only appointment fields.' }, value: {} };
  }
  const value = {};
  for (const key of keys) {
    value[key] = typeof body[key] === 'string' ? body[key].trim() : '';
    if (typeof body[key] !== 'string') errors[key] = 'Must be text.';
  }
  value.durationMinutes = body.durationMinutes;
  if (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 15 || body.durationMinutes > 480 || body.durationMinutes % 15 !== 0) {
    errors.durationMinutes = 'Choose a duration from 15 to 480 minutes in 15-minute steps.';
  }
  const date = new Date(value.startsAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.startsAt) || !Number.isFinite(date.getTime()) || date.toISOString() !== value.startsAt) {
    errors.startsAt = 'Choose a valid date and time.';
  } else if (value.status === 'Scheduled' && date <= now) {
    errors.startsAt = 'Scheduled visits must be in the future.';
  }
  if (!value.timeZone || value.timeZone.length > 100) errors.timeZone = 'Choose a valid time zone.';
  else { try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { errors.timeZone = 'Choose a valid time zone.'; } }
  if (!value.address || value.address.length > 500) errors.address = 'Enter an address of up to 500 characters.';
  if (!/^[a-f\d]{24}$/i.test(value.assignedMember)) errors.assignedMember = 'Choose a saved team member.';
  if (!appointmentStatuses.includes(value.status)) errors.status = 'Choose a valid appointment status.';
  return { errors, value };
}
