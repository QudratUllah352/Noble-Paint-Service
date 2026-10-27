export function validatePasswordResetRequest(body) {
  const errors = {};
  if (!body || Array.isArray(body) || typeof body !== 'object' ||
      Object.keys(body).length !== 1 || typeof body.email !== 'string' ||
      body.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  return { errors, value: errors.email ? null : { email: body.email.trim().toLowerCase() } };
}

export function validatePasswordReset(body) {
  const errors = {};
  if (!body || Array.isArray(body) || typeof body !== 'object' ||
      Object.keys(body).length !== 3 ||
      typeof body.token !== 'string' || !/^[a-f\d]{64}$/i.test(body.token)) {
    errors.token = 'This reset link is invalid or has expired.';
  }
  if (typeof body?.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 256) {
    errors.newPassword = 'Use a password between 12 and 256 characters.';
  }
  if (typeof body?.confirmPassword !== 'string' || body.confirmPassword !== body.newPassword) {
    errors.confirmPassword = 'The new passwords do not match.';
  }
  return { errors, value: Object.keys(errors).length ? null : { token: body.token, newPassword: body.newPassword } };
}
