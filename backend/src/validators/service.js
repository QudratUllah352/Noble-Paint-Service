export const serviceCategories = ['residential', 'commercial', 'specialty'];
export const serviceStatuses = ['Active', 'Hidden'];

export function validateService(body) {
  const value = {}, errors = {};
  const text = ['title', 'description', 'imageUrl', 'imageAlt', 'badge', 'status'];
  const allowed = [...text, 'categories', 'features', 'sortOrder'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) return { value, errors: { form: 'Send only service fields.' } };
  for (const field of text) {
    if (body[field] !== undefined && typeof body[field] !== 'string') errors[field] = 'Must be text.';
    value[field] = typeof body[field] === 'string' ? body[field].trim() : '';
  }
  if (!value.title || value.title.length > 160) errors.title = 'Enter a title of up to 160 characters.';
  if (!value.description || value.description.length > 2000) errors.description = 'Enter a description of up to 2,000 characters.';
  if (value.badge.length > 60) errors.badge = 'Use up to 60 characters.';
  if (value.imageAlt.length > 500) errors.imageAlt = 'Use up to 500 characters.';
  if (value.imageUrl) {
    let safe = /^\/assets\/[^\s<>]*$/.test(value.imageUrl);
    try { const url = new URL(value.imageUrl); safe = ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { /* Relative asset paths are handled above. */ }
    if (!safe || value.imageUrl.length > 2048) errors.imageUrl = 'Use an http(s) image URL or a path under /assets/.';
  }
  if (!Array.isArray(body.categories) || !body.categories.length || body.categories.length > 3 || body.categories.some(category => !serviceCategories.includes(category))) errors.categories = 'Choose at least one valid category.';
  else value.categories = [...new Set(body.categories)];
  if (!Array.isArray(body.features) || body.features.length > 8 || body.features.some(feature => typeof feature !== 'string' || !feature.trim() || feature.trim().length > 200)) errors.features = 'Use up to eight nonempty features of up to 200 characters.';
  else value.features = body.features.map(feature => feature.trim());
  if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 10000) errors.sortOrder = 'Use a display order from 0 to 10,000.';
  else value.sortOrder = body.sortOrder;
  if (!serviceStatuses.includes(value.status)) errors.status = 'Choose Active or Hidden.';
  return { value, errors };
}
