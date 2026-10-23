
    document.addEventListener('DOMContentLoaded', () => {
      // Mobile Hamburger Toggle
      const mobileMenuBtn = document.getElementById('mobile-menu-btn');
      const mobileMenu = document.getElementById('mobile-menu');

      if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
          mobileMenu.classList.toggle('hidden');
        });

        // Close menu on navigation link click
        mobileMenu.querySelectorAll('a').forEach(link => {
          link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
          });
        });
      }

      // FAQ Accordion Toggle
      const faqToggles = document.querySelectorAll('.faq-toggle');
      faqToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
          const content = toggle.nextElementSibling;
          const icon = toggle.querySelector('.faq-icon i');
          const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

          // Close all items
          faqToggles.forEach(otherToggle => {
            otherToggle.setAttribute('aria-expanded', 'false');
            otherToggle.nextElementSibling.classList.add('hidden');
            const otherIcon = otherToggle.querySelector('.faq-icon i');
            if (otherIcon) {
              otherIcon.className = 'fa-solid fa-plus';
            }
          });

          // Toggle clicked item
          if (!isExpanded) {
            toggle.setAttribute('aria-expanded', 'true');
            content.classList.remove('hidden');
            if (icon) {
              icon.className = 'fa-solid fa-times';
            }
          }
        });
      });
    });
  