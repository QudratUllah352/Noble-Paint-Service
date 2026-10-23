'use strict';
(() => {
  const sections = ['overview', 'enquiries', 'appointments', 'team', 'projects', 'services', 'settings', 'recovery', 'audit'];
  const section = location.hash.slice(1).split('?')[0];
  location.replace(`/admin/${sections.includes(section) ? section : 'overview'}.html`);
})();
