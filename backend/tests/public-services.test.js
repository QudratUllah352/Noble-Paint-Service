import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../frontend/assets/js/services.js', import.meta.url), 'utf8');
async function render(items, fail = false) {
  function node() {
    const element = { children: [], attributes: {}, style: {}, classList: { add() {}, remove() {} }, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, setAttribute(name, value) { this.attributes[name] = value; }, getAttribute(name) { return this.attributes[name]; } };
    Object.defineProperty(element, 'innerHTML', { set() { throw new Error('Raw HTML must not be used for service content'); } });
    return element;
  }
  const grid = node(), status = node(), all = node(), residential = node(), commercial = node();
  grid.hidden = true;
  const context = vm.createContext({
    document: {
      createElement: node, getElementById: id => id === 'services-grid' ? grid : status,
      querySelector: () => all,
      querySelectorAll: selector => selector === '.service-tab-btn' ? [all, residential, commercial] : grid.children
    }, AbortSignal,
    fetch: async () => { if (fail) throw new Error('offline'); return { ok: true, json: async () => ({ items }) }; }
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { grid, status, filter: category => context.filterServices(category, category === 'commercial' ? commercial : residential) };
}
const item = { title: '<script>alert(1)</script>', description: 'Paint details', categories: ['residential'], features: ['Prep'], imageUrl: '', imageAlt: '', badge: '' };

test('public services render text safely and preserve category filtering', async () => {
  const ui = await render([item, { ...item, title: 'Commercial', categories: ['commercial'] }]);
  assert.equal(ui.grid.hidden, false);
  assert.equal(ui.grid.children.length, 2);
  assert.equal(ui.grid.children[0].children[1].children[0].textContent, item.title);
  ui.filter('commercial');
  assert.equal(ui.grid.children[0].style.display, 'none'); assert.equal(ui.grid.children[1].style.display, 'flex');
  ui.filter('specialty');
  assert.match(ui.status.textContent, /No services currently available/);
});

test('empty and unavailable catalogues never restore hidden static cards', async () => {
  const empty = await render([]);
  assert.equal(empty.grid.children.length, 0); assert.match(empty.status.textContent, /No services currently available/);
  const failed = await render([], true);
  assert.equal(failed.grid.hidden, true); assert.match(failed.status.textContent, /temporarily unavailable/);
});
