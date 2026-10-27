import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../frontend/assets/js/team.js', import.meta.url), 'utf8');

function element() {
  return {
    children: [],
    textContent: '',
    className: '',
    hidden: false,
    attributes: {},
    classList: { remove() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

async function render(fetch) {
  const grid = element(), status = element();
  grid.children.push({ textContent: 'Old hard-coded profile' });
  const context = vm.createContext({
    document: {
      getElementById: id => ({ 'team-grid': grid, 'team-status': status })[id],
      createElement: element
    },
    fetch,
    AbortSignal
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { grid, status };
}

test('public Team page renders dynamic names and roles as safe text', async () => {
  const name = '<script>alert(1)</script>';
  const ui = await render(async () => ({
    ok: true,
    json: async () => ({ items: [{ name, role: 'Painter' }] })
  }));
  assert.equal(ui.grid.hidden, false);
  assert.equal(ui.grid.children.length, 1);
  assert.equal(ui.grid.children[0].children[1].textContent, name);
  assert.equal(ui.grid.children[0].children[2].textContent, 'Painter');
  assert.match(ui.status.textContent, /1 active team member/);
});

test('public Team page handles empty, malformed, and unavailable responses', async () => {
  const empty = await render(async () => ({ ok: true, json: async () => ({ items: [] }) }));
  assert.equal(empty.grid.hidden, true);
  assert.equal(empty.grid.children.length, 0);
  assert.match(empty.status.textContent, /No active team members/);

  const invalid = await render(async () => ({ ok: true, json: async () => ({ items: [{ name: 'Name' }] }) }));
  assert.match(invalid.status.textContent, /temporarily unavailable/);

  const failed = await render(async () => { throw new TypeError('offline'); });
  assert.equal(failed.grid.hidden, true);
  assert.match(failed.status.textContent, /temporarily unavailable/);
});
