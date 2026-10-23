'use strict';
(() => {
  const status = document.getElementById('admin-status');
  const forms = { email: document.getElementById('account-email-form'), password: document.getElementById('account-password-form') };
  const buttons = Object.values(forms).map(form => form.querySelector('button'));
  let busy = false, loaded = false;
  async function api(path, body) {
    const response = await fetch(`/api/admin/account${path}`, { credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (response.status === 401) location.replace('/admin/login.html');
    if (!response.ok) throw Object.assign(new Error(data.message || 'Unable to update account settings.'), { errors: data.errors });
    return data;
  }
  for (const [type, form] of Object.entries(forms)) {
    function clearValidation(event) {
      event.target.setCustomValidity?.('');
      if (type === 'password' && event.target.name === 'newPassword') form.elements.namedItem('confirmPassword').setCustomValidity('');
    }
    form.addEventListener('input', clearValidation); form.addEventListener('change', clearValidation);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !loaded || !form.reportValidity()) return;
      const feedback = document.getElementById(`account-${type}-feedback`);
      const body = Object.fromEntries(new FormData(form));
      if (type === 'password' && body.newPassword !== body.confirmPassword) {
        form.elements.namedItem('confirmPassword').setCustomValidity('The new passwords do not match.'); form.reportValidity(); return;
      }
      busy = true; buttons.forEach(button => { button.disabled = true; }); feedback.textContent = 'Saving account settings…';
      try {
        await api(`/${type}`, body);
        for (const other of Object.values(forms)) other.reset();
        feedback.textContent = 'Account updated. Sign in again with your updated details.';
        location.replace('/admin/login.html?accountUpdated=1');
      } catch (error) {
        for (const [name, message] of Object.entries(error.errors || {})) form.elements.namedItem(name)?.setCustomValidity(message);
        form.reportValidity(); feedback.textContent = error.message;
        form.elements.namedItem('currentPassword').value = '';
        busy = false; buttons.forEach(button => { button.disabled = false; });
      }
    });
  }
  (async () => {
    try {
      const account = await api('');
      forms.email.elements.namedItem('email').value = account.email;
      status.textContent = `Signed in as ${account.email}`;
      loaded = true; buttons.forEach(button => { button.disabled = false; });
    } catch (error) { status.textContent = `${error.message} Refresh to try again.`; }
  })();
})();
