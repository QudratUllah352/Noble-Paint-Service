
        (function () {
          const counters = document.querySelectorAll('.counter');
          if (!window.IntersectionObserver) return;

          const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.getAttribute('data-target'), 10);
                let count = 0;
                const step = Math.max(1, Math.floor(target / 40));
                const timer = setInterval(() => {
                  count += step;
                  if (count >= target) {
                    el.textContent = target >= 1000 ? target.toLocaleString() : target;
                    clearInterval(timer);
                  } else {
                    el.textContent = count >= 1000 ? count.toLocaleString() : count;
                  }
                }, 30);
                obs.unobserve(el);
              }
            });
          }, { threshold: 0.3 });

          counters.forEach(c => observer.observe(c));
        })();
      