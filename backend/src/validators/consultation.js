export const projectTypes = ['Interior', 'Exterior', 'Cabinets', 'Commercial', 'Other'];
export const areas = ['Under 800 sq ft', '800 - 1,500 sq ft', '1,500 - 3,000 sq ft', '3,000 - 5,500 sq ft', '5,500+ sq ft Commercial'];
export const windows = ['Morning (8:00 AM - 11:30 AM)', 'Early Afternoon (12:00 PM - 3:00 PM)', 'Late Afternoon (3:30 PM - 6:00 PM)'];

export function validateConsultation(body) {
  const errors = {};
  const value = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: { form: 'A form object is required.' }, value };
  }
  for (const key of ['fullName', 'emailAddr', 'phoneNumber', 'sqft', 'selectedProjectType', 'consultDate', 'consultTime', 'projectDetails']) {
    if (body[key] !== undefined && typeof body[key] !== 'string') errors[key] = 'Must be text.';
    value[key] = typeof body[key] === 'string' ? body[key].trim() : '';
  }
  if (!value.fullName || value.fullName.length > 120) errors.fullName = 'Enter a name of up to 120 characters.';
  if (value.emailAddr.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.emailAddr)) errors.emailAddr = 'Enter a valid email address.';
  const digits = value.phoneNumber.replace(/\D/g, '');
  if (value.phoneNumber.length > 40 || !/^[+\d\s().-]+$/.test(value.phoneNumber) || digits.length < 7 || digits.length > 15) errors.phoneNumber = 'Enter a phone number with 7 to 15 digits.';
  if (!areas.includes(value.sqft)) errors.sqft = 'Choose a listed area.';
  if (!projectTypes.includes(value.selectedProjectType)) errors.selectedProjectType = 'Choose a listed project type.';
  if (!windows.includes(value.consultTime)) errors.consultTime = 'Choose a listed arrival window.';
  if (value.consultDate && (!/^\d{4}-\d{2}-\d{2}$/.test(value.consultDate) || !Number.isFinite(Date.parse(value.consultDate)) || new Date(value.consultDate).toISOString().slice(0, 10) !== value.consultDate)) errors.consultDate = 'Choose a valid date.';
  if (value.projectDetails.length > 5000) errors.projectDetails = 'Use up to 5,000 characters.';
  return { errors, value };
}
