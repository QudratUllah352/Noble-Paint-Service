
      let currentServiceCategory = 'all';
      let currentServiceButton = null;
      let servicesReady = false;
      function filterServices(category, buttonEl) {
        currentServiceCategory = category;
        currentServiceButton = buttonEl;
        const tabs = document.querySelectorAll('.service-tab-btn');
        tabs.forEach(tab => {
          tab.setAttribute('aria-pressed', String(tab === buttonEl));
          tab.classList.remove('bg-primary-container', 'text-on-primary', 'font-bold', 'shadow-sm');
          tab.classList.add('text-on-surface-variant');
        });

        buttonEl.classList.remove('text-on-surface-variant');
        buttonEl.classList.add('bg-primary-container', 'text-on-primary', 'font-bold', 'shadow-sm');

        const cards = document.querySelectorAll('.service-card');
        cards.forEach(card => {
          const cardCategory = card.getAttribute('data-category');
          if (category === 'all' || (cardCategory && cardCategory.split(' ').includes(category))) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
        if (servicesReady) {
          const visible = [...cards].some(card => card.style.display !== 'none');
          document.getElementById('services-status').textContent = visible ? '' : 'No services currently available in this category. Please contact us for assistance.';
        }
      }

      (async () => {
        const grid = document.getElementById('services-grid');
        const status = document.getElementById('services-status');
        if (!grid || !status) return;
        function node(tag, classes, text) {
          const element = document.createElement(tag);
          element.className = classes;
          if (text !== undefined) element.textContent = text;
          return element;
        }
        try {
          const response = await fetch('/api/services', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error('Unavailable');
          const { items } = await response.json();
          if (!Array.isArray(items)) throw new Error('Invalid service data');
          const cards = items.map(item => {
            const card = node('article', 'service-card flex flex-col bg-surface-container-lowest rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl');
            card.setAttribute('data-category', item.categories.join(' '));
            const visual = node('div', 'relative h-56 w-full overflow-hidden bg-surface-container flex items-center justify-center');
            if (item.imageUrl) {
              const image = node('img', 'w-full h-full object-cover');
              image.src = item.imageUrl; image.alt = item.imageAlt || item.title; image.loading = 'lazy';
              visual.append(image);
            } else visual.append(node('span', 'material-symbols-outlined text-primary text-6xl', 'format_paint'));
            if (item.badge) visual.append(node('span', 'absolute top-4 left-4 bg-surface/90 px-3 py-1 rounded-full shadow-sm font-label-sm text-label-sm text-on-surface font-semibold uppercase tracking-wide', item.badge));
            const body = node('div', 'p-6 lg:p-8 flex flex-col flex-1');
            body.append(node('h3', 'font-headline-sm text-headline-sm text-on-surface font-bold mb-3', item.title));
            body.append(node('p', 'font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed', item.description));
            const features = node('div', 'space-y-3 mb-8 flex-1');
            for (const feature of item.features) {
              const row = node('div', 'flex items-center gap-2');
              row.append(node('span', 'material-symbols-outlined text-primary text-[20px]', 'check_circle'), node('span', 'font-body-sm text-body-sm text-on-surface', feature));
              features.append(row);
            }
            body.append(features);
            const footer = node('div', 'pt-4 flex items-center justify-between gap-3');
            const link = node('a', 'inline-flex items-center gap-2 text-primary hover:text-primary-container font-label-lg text-label-lg font-bold', 'Request Service');
            link.href = '../contact/index.html#consultation-form';
            footer.append(link, node('span', 'font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2.5 py-1 rounded capitalize', item.categories.join(' / ')));
            body.append(footer); card.append(visual, body);
            return card;
          });
          grid.replaceChildren(...cards);
          grid.hidden = false;
          servicesReady = true;
          const button = currentServiceButton || document.querySelector('.service-tab-btn');
          if (button) filterServices(currentServiceCategory, button);
          else status.textContent = cards.length ? '' : 'No services currently available. Please contact us for details.';
        } catch {
          grid.hidden = true;
          status.textContent = 'Services are temporarily unavailable. Please contact us for details.';
        }
      })();
    
