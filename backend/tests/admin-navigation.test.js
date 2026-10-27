import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../../frontend/assets/js/admin-shell.js', import.meta.url), 'utf8');
const entry = await readFile(new URL('../../frontend/assets/js/admin-entry.js', import.meta.url), 'utf8');
const sections = ['overview', 'enquiries', 'appointments', 'team', 'projects', 'services', 'settings', 'recovery', 'audit'];

function mount(page, small = false) {
  let document;
  class Element {
    constructor(tag) {
      this.tag = tag; this.children = []; this.attributes = {}; this.style = {}; this.events = {};
      const classes = new Set();
      this.classList = { add: value => classes.add(value), toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value), contains: value => classes.has(value) };
    }
    append(...children) { for (const child of children) { child.parent?.remove(child); child.parent = this; this.children.push(child); } }
    remove(child) { this.children = this.children.filter(item => item !== child); child.parent = null; }
    insertBefore(child, reference) { child.parent?.remove(child); child.parent = this; this.children.splice(this.children.indexOf(reference), 0, child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    contains(child) { return this === child || this.children.some(item => item.contains(child)); }
    all() { return this.children.flatMap(item => [item, ...item.all()]); }
    querySelectorAll(selector) { return this.all().filter(item => selector === 'a, button' ? ['a', 'button'].includes(item.tag) : item.attributes['aria-current'] === 'page'); }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
    closest(tag) { return this.tag === tag ? this : this.parent?.closest(tag); }
    addEventListener(name, handler) { this.events[name] = handler; }
    focus() { document.activeElement = this; }
  }
  document = { body: new Element('body'), activeElement: null, events: {}, createElement: tag => new Element(tag), addEventListener(name, handler) { this.events[name] = handler; }, getElementById(id) { return this.body.all().find(item => item.id === id); } };
  const main = new Element('main'); main.id = 'main';
  const form = new Element('form'); main.append(form);
  const logout = new Element('button'); logout.id = 'admin-logout'; main.append(logout);
  document.body.append(main);
  const media = { matches: small, addEventListener(name, handler) { this.change = handler; } };
  vm.runInNewContext(shell, { document, location: { pathname: `/admin/${page}.html` }, window: { matchMedia: () => media } });
  const sidebar = document.getElementById('admin-sidebar');
  const toggle = document.body.all().find(item => item.attributes['aria-controls'] === 'admin-sidebar');
  return { document, main, form, logout, media, sidebar, toggle };
}

test('all live pages share navigation and retain their existing forms and logout button', () => {
  for (const page of sections) {
    const ui = mount(page);
    const links = ui.sidebar.all().filter(item => item.tag === 'a');
    for (const section of sections) assert.ok(links.some(link => link.href === `/admin/${section}.html`));
    const active = links.filter(link => link.attributes['aria-current'] === 'page');
    assert.equal(active.length, 1); assert.equal(active[0].href, `/admin/${page}.html`);
    assert.equal(ui.main.children[0], ui.form);
    assert.equal(ui.logout.parent.className, 'topbar-right');
    assert.equal(ui.main.parent.className, 'workspace');
    assert.equal(ui.sidebar.inert, false);
    assert.equal(ui.main.parent.inert, false);
  }
});

test('mobile menu supports opening, trapped keyboard focus, Escape and desktop resizing', () => {
  const ui = mount('appointments', true);
  const scrim = ui.document.body.all().find(item => item.className === 'sidebar-scrim');
  assert.equal(ui.sidebar.inert, true);
  ui.toggle.events.click();
  assert.equal(ui.toggle.attributes['aria-expanded'], 'true');
  assert.equal(ui.main.parent.inert, true); assert.equal(scrim.hidden, false);
  assert.equal(ui.sidebar.attributes['aria-modal'], 'true');
  const focusable = ui.sidebar.querySelectorAll('a, button');
  assert.equal(ui.document.activeElement, focusable[0]);
  focusable.at(-1).focus();
  let prevented = false;
  ui.document.events.keydown({ key: 'Tab', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(ui.document.activeElement, focusable[0]);
  ui.document.events.keydown({ key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(ui.document.activeElement, focusable.at(-1));
  ui.document.events.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(ui.main.parent.inert, false); assert.equal(ui.sidebar.inert, true);
  assert.equal(ui.document.activeElement, ui.toggle);
  ui.toggle.events.click();
  ui.media.matches = false; ui.media.change();
  assert.equal(ui.sidebar.inert, false); assert.equal(ui.main.parent.inert, false);
  assert.equal(scrim.hidden, true); assert.equal(ui.sidebar.attributes['aria-modal'], undefined);
  assert.equal(ui.document.activeElement.attributes['aria-current'], 'page');
});

test('live admin entry maps old section links without loading the sample dashboard', async () => {
  for (const hash of ['', '#enquiries', '#projects', '#settings', '#recovery', '#audit', '#unknown']) {
    let target;
    vm.runInNewContext(entry, { location: { hash, replace(value) { target = value; } } });
    assert.equal(target, `/admin/${sections.includes(hash.slice(1)) ? hash.slice(1) : 'overview'}.html`);
  }
  for (const page of sections) {
    const html = await readFile(new URL(`../../frontend/admin/${page}.html`, import.meta.url), 'utf8');
    assert.match(html, /id="main"/);
    assert.ok(html.indexOf('admin-shell.js') < html.indexOf('admin-live.js'));
    assert.doesNotMatch(html, /src="[^\"]*\/admin\.js"/);
  }
  const index = await readFile(new URL('../../frontend/admin/index.html', import.meta.url), 'utf8');
  assert.match(index, /admin-entry\.js/); assert.doesNotMatch(index, /admin\.js/);
});
