export function validateAccountChange(body, type) {
  const fields = type === 'email' ? ['email', 'currentPassword'] : ['currentPassword', 'newPassword', 'confirmPassword'];
  const value = {}, errors = {};
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) return { value, errors: { form: 'Send only account settings fields.' } };
  for (const field of fields) {
    if (typeof body[field] !== 'string') errors[field] = 'Must be text.';
    value[field] = typeof body[field] === 'string' ? body[field] : '';
  }
  if (!value.currentPassword || value.currentPassword.length > 256) errors.currentPassword = 'Enter your current password.';
  if (type === 'email') {
    value.email = value.email.trim().toLowerCase();
    if (value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = 'Enter a valid sign-in email address.';
  } else {
    if (value.newPassword.length < 12 || value.newPassword.length > 256 || !value.newPassword.trim()) errors.newPassword = 'Use a password with 12 to 256 characters.';
    if (value.newPassword === value.currentPassword) errors.newPassword = 'Choose a different password.';
    if (value.confirmPassword !== value.newPassword) errors.confirmPassword = 'The new passwords do not match.';
  }
  return { value, errors };
}
