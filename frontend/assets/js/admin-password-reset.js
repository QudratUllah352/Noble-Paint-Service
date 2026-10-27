'use strict';
(() => {
  const status = document.getElementById('password-reset-status');
  const forgot = document.getElementById('forgot-password-form');
  const reset = document.getElementById('reset-password-form');

  async function submit(path, body) {
    const response = await fetch(`/api/admin/${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Password recovery failed.');
    return data;
  }

  if (forgot) forgot.addEventListener('submit', async event => {
    event.preventDefault();
    const button = forgot.querySelector('button');
    button.disabled = true;
    status.textContent = 'Requesting reset link…';
    try {
      const result = await submit('forgot-password', Object.fromEntries(new FormData(forgot)));
      status.textContent = result.message;
      forgot.reset();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  if (reset) {
    const token = new URLSearchParams(location.search).get('token') || '';
    if (!/^[a-f\d]{64}$/i.test(token)) {
      status.textContent = 'This reset link is invalid or has expired. Request a new one.';
      reset.querySelector('button').disabled = true;
      return;
    }
    reset.addEventListener('input', event => event.target.setCustomValidity(''));
    reset.addEventListener('submit', async event => {
      event.preventDefault();
      if (!reset.reportValidity()) return;
      const button = reset.querySelector('button');
      button.disabled = true;
      status.textContent = 'Resetting password…';
      try {
        const result = await submit('reset-password', { token, ...Object.fromEntries(new FormData(reset)) });
        status.textContent = result.message;
        reset.reset();
        history.replaceState(null, '', location.pathname);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }
})();
