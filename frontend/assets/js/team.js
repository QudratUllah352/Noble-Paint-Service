
      function filterTeam(category, buttonElement) {
        // Update button states
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
          btn.classList.remove('bg-primary', 'text-on-primary');
          btn.classList.add('bg-surface-container', 'text-on-surface-variant');
        });
        buttonElement.classList.add('bg-primary', 'text-on-primary');
        buttonElement.classList.remove('bg-surface-container', 'text-on-surface-variant');

        // Filter cards
        const cards = document.querySelectorAll('.team-card');
        cards.forEach(card => {
          const cardCategory = card.getAttribute('data-category');
          if (category === 'all' || cardCategory === category) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      }
    