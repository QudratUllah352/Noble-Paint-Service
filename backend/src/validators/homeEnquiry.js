import { validateConsultation, areas, windows } from './consultation.js';

export function validateHomeEnquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { form: 'A form object is required.' }, value: {} };
  const { errors, value } = validateConsultation({
    fullName: body.fullName, emailAddr: body.emailAddr, phoneNumber: body.phoneNumber,
    projectDetails: body.projectDetails, selectedProjectType: 'Other', sqft: areas[0], consultTime: windows[0]
  });
  if (!value.projectDetails) errors.projectDetails = 'Please enter a message.';
  // The homepage does not collect scheduling or area details. Never persist defaults for them.
  delete value.sqft;
  delete value.consultTime;
  delete value.consultDate;
  value.source = 'homepage';
  return { errors, value };
}
