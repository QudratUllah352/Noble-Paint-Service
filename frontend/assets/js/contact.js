
        function selectType(button, type) {
          document.querySelectorAll('#project-type-group .type-btn').forEach(btn => {
            btn.classList.remove('bg-primary', 'text-on-primary', 'shadow-xs');
            btn.classList.add('bg-surface-container-low', 'text-on-surface');
          });
          button.classList.remove('bg-surface-container-low', 'text-on-surface');
          button.classList.add('bg-primary', 'text-on-primary', 'shadow-xs');
          document.getElementById('selectedProjectType').value = type;
        }

        async function handleConsultationSubmit() {
          const form = document.getElementById('consultation-form');
          const button = document.getElementById('submit-btn');
          const status = document.getElementById('consultation-status');
          if (button.disabled || !validateDemoForm(form)) return;
          const fields = ['fullName', 'emailAddr', 'phoneNumber', 'sqft', 'selectedProjectType', 'consultDate', 'consultTime', 'projectDetails'];
          const payload = Object.fromEntries(fields.map(id => [id, document.getElementById(id).value.trim()]));
          status.textContent = 'Sending your request...';
          button.disabled = true;
          button.setAttribute('aria-busy', 'true');
          try {
            const response = await fetch('/api/consultations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(20000)
            });
            const result = await response.json();
            if (!response.ok) {
              for (const [id, message] of Object.entries(result.errors || {})) {
                const field = document.getElementById(id);
                if (field && field.type !== 'hidden') field.setCustomValidity(message);
              }
              form.reportValidity();
              throw new Error(result.message || 'Unable to send your request. Please try again.');
            }
            document.getElementById('preview-contact').textContent = payload.fullName;
            document.getElementById('preview-type').textContent = payload.selectedProjectType;
            document.getElementById('preview-sqft').textContent = payload.sqft;
            document.getElementById('confirmation-msg').textContent = result.message;
            document.getElementById('confirmation-modal').classList.remove('hidden');
            document.querySelector('#confirmation-modal button').focus();
            status.textContent = 'Request received. Appointment confirmation is pending.';
          } catch (error) {
            status.textContent = error.name === 'TimeoutError'
              ? 'The response timed out. Your request may have been received; please call us before submitting again.'
              : error instanceof SyntaxError || error.name === 'TypeError'
                ? 'Unable to reach the service. Please try again or call us.'
                : error.message;
          } finally {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          }
        }

        function resetConsultationForm() {
          document.getElementById('confirmation-modal').classList.add('hidden');
          document.getElementById('submit-btn').focus();
        }

        function toggleFaq(button) {
          const content = button.nextElementSibling;
          const icon = button.querySelector('.faq-icon');
          const isHidden = content.classList.contains('hidden');

          // Close all other accordions for clean accordion rhythm
          document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
          document.querySelectorAll('.faq-icon').forEach(i => i.classList.remove('rotate-180'));

          if (isHidden) {
            content.classList.remove('hidden');
            icon.classList.add('rotate-180');
          }
        }
      
