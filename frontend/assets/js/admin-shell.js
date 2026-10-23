'use strict';
(() => {
  const sections = [
    ['overview', 'Overview', '01'], ['enquiries', 'Enquiries', '02'],
    ['appointments', 'Appointments', '03'], ['team', 'Team', '04'],
    ['projects', 'Projects', '05'], ['services', 'Services', '06'],
    ['settings', 'Account settings', '07'], ['recovery', 'Recovery tools', '08'],
    ['audit', 'Audit history', '09']
  ];
  const page = location.pathname.split('/').pop().replace(/\.html$/, '');
  const section = sections.find(([key]) => key === page);
  const main = document.getElementById('main');
  if (!main || !section) return;
  function node(tag, classes, text) {
    const element = document.createElement(tag);
    element.className = classes;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  document.body.classList.add('live-admin');
  const skip = node('a', 'skip-link', 'Skip to main content'); skip.href = '#main';
  const sidebar = node('aside', 'sidebar'); sidebar.id = 'admin-sidebar'; sidebar.setAttribute('aria-label', 'Admin navigation');
  const close = node('button', 'icon-button admin-sidebar-close', 'Close menu'); close.type = 'button'; close.setAttribute('aria-label', 'Close navigation menu');
  const brand = node('a', 'brand'); brand.href = '/admin/overview.html';
  const mark = node('span', 'brand-mark', 'N'); mark.setAttribute('aria-hidden', 'true');
  const name = node('span', '', 'Noble Paint Service'); name.append(node('span', 'brand-subtitle', 'ADMIN WORKSPACE'));
  brand.append(mark, name);
  const nav = node('nav', ''); nav.setAttribute('aria-label', 'Admin sections');
  for (const [key, label, number] of sections) {
    const link = node('a', ''); link.href = `/admin/${key}.html`;
    const icon = node('span', 'admin-nav-number', number); icon.setAttribute('aria-hidden', 'true');
    link.append(icon, node('span', 'admin-nav-label', label));
    if (key === page) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  const bottom = node('div', 'sidebar-bottom');
  bottom.append(node('div', 'workspace-badge', 'NOBLE PAINT SERVICE'), node('p', '', 'Your business, all in one place.'));
  const website = node('a', '', 'Visit website'); website.href = '/'; bottom.append(website);
  sidebar.append(close, brand, node('p', 'nav-label', 'MANAGE'), nav, bottom);
  const scrim = node('button', 'sidebar-scrim'); scrim.type = 'button'; scrim.hidden = true; scrim.tabIndex = -1; scrim.setAttribute('aria-label', 'Close navigation menu');
  const workspace = node('div', 'workspace');
  const topbar = node('header', 'topbar');
  const left = node('div', 'topbar-left'), right = node('div', 'topbar-right');
  const toggle = node('button', 'icon-button mobile-toggle', 'Menu'); toggle.type = 'button'; toggle.setAttribute('aria-controls', sidebar.id); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open navigation menu');
  const breadcrumb = node('span', 'breadcrumb');
  const divider = node('span', 'admin-breadcrumb-divider', '/'); divider.setAttribute('aria-hidden', 'true');
  breadcrumb.append(node('span', 'admin-breadcrumb-root', 'Workspace'), divider, node('strong', '', section[1]));
  left.append(toggle, breadcrumb);
  const view = node('a', 'website-link', 'View website'); view.href = '/'; right.append(view);
  const logout = document.getElementById('admin-logout');
  if (logout) right.append(logout);
  topbar.append(left, right);
  const footer = node('footer', 'workspace-footer'); footer.append(node('span', '', 'Noble Paint Service · Admin workspace'));
  document.body.insertBefore(skip, main);
  document.body.insertBefore(sidebar, main);
  document.body.insertBefore(scrim, main);
  document.body.insertBefore(workspace, main);
  workspace.append(topbar, main, footer);

  const mobile = window.matchMedia('(max-width: 800px)');
  let open = false;
  function setOpen(value, restoreFocus = true) {
    open = value && mobile.matches;
    sidebar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    scrim.hidden = !open;
    workspace.inert = open;
    sidebar.inert = mobile.matches && !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); sidebar.removeAttribute('aria-hidden');
      close.focus();
    } else {
      sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal');
      if (mobile.matches) sidebar.setAttribute('aria-hidden', 'true'); else sidebar.removeAttribute('aria-hidden');
      if (restoreFocus && mobile.matches) toggle.focus();
    }
  }
  toggle.addEventListener('click', () => setOpen(!open));
  close.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  nav.addEventListener('click', event => { if (event.target.closest('a') && mobile.matches) setOpen(false, false); });
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...sidebar.querySelectorAll('a, button')].filter(element => !element.disabled);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (!sidebar.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  mobile.addEventListener('change', () => {
    const focusInSidebar = sidebar.contains(document.activeElement);
    setOpen(false, false);
    if (focusInSidebar) {
      if (mobile.matches) toggle.focus();
      else nav.querySelector('[aria-current="page"]')?.focus();
    }
  });
  setOpen(false, false);
})();
