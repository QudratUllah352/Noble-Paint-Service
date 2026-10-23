
    document.addEventListener('DOMContentLoaded', () => {
      const form = document.getElementById('appointment-form');
      const feedback = document.getElementById('form-feedback');

      if (form && feedback) {
        const button = form.querySelector('button[type="submit"]');
        const fields = { fullName: 'contact-name', emailAddr: 'contact-email', phoneNumber: 'contact-phone', projectDetails: 'contact-message' };
        function message(text, success = false) {
          feedback.textContent = text;
          feedback.className = `text-xs font-semibold p-3 rounded block ${success ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`;
        }
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (button.disabled || !validateDemoForm(form)) return;
          const payload = Object.fromEntries(Object.entries(fields).map(([key, id]) => [key, document.getElementById(id).value.trim()]));
          button.disabled = true;
          button.setAttribute('aria-busy', 'true');
          message('Sending your enquiry…');
          try {
            const response = await fetch('/api/enquiries', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)
            });
            const result = await response.json();
            if (!response.ok) {
              for (const [key, error] of Object.entries(result.errors || {})) {
                if (fields[key]) document.getElementById(fields[key]).setCustomValidity(error);
              }
              form.reportValidity();
              throw new Error(result.message || 'Unable to send your enquiry. Please try again.');
            }
            form.reset();
            message(result.message, true);
          } catch (error) {
            message(error.name === 'TimeoutError'
              ? 'The response timed out. Your enquiry may have been received; please call before submitting again.'
              : error.name === 'TypeError' || error instanceof SyntaxError
                ? 'Unable to reach the service. Your entries are kept here. Please try again or call us.'
                : error.message);
          } finally {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          }
        });
      }
    });
  
