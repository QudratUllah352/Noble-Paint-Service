// Validate locally without sending or clearing a visitor's details.
function validateDemoForm(form) {
  form.querySelectorAll('input, textarea').forEach(field => {
    field.setCustomValidity('');
    if (field.required && !field.value.trim()) {
      field.setCustomValidity('Please complete this field.');
    } else if (field.type === 'tel' && field.value.trim()) {
      const digits = field.value.replace(/\D/g, '');
      if (!/^[+\d\s().-]+$/.test(field.value) || digits.length < 7 || digits.length > 15) {
        field.setCustomValidity('Enter a phone number with 7 to 15 digits.');
      }
    }
  });
  return form.reportValidity();
}

document.querySelectorAll('#appointment-form, #consultation-form').forEach(form => {
  form.addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') {
      event.target.setCustomValidity('');
    }
  });
});
