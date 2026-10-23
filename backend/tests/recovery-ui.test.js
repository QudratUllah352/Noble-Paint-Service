import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../../frontend/assets/js/admin-recovery.js', import.meta.url), 'utf8');
async function mount(response) {
  class Element {
    constructor() { this.children = []; this.textContent = ''; this.events = {}; }
    append(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    addEventListener(name, fn) { this.events[name] = fn; }
  }
  const elements = Object.fromEntries(['admin-status', 'recovery-lock', 'recovery-emails', 'recovery-refresh'].map(id => [id, new Element()]));
  let redirect;
  vm.runInNewContext(script, {
    document: { getElementById: id => elements[id], createElement: () => new Element() },
    location: { replace: path => { redirect = path; } },
    fetch: async (path, options) => {
      assert.equal(path, '/api/admin/recovery'); assert.equal(options.cache, 'no-store');
      return { status: response.status || 200, ok: !response.status || response.status === 200, json: async () => response.body };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, redirect };
}
const strings = element => [element.textContent, ...element.children.flatMap(strings)];

test('recovery report renders exact safe commands, treats stored content as text, and refreshes', async () => {
  const id = 'a'.repeat(24);
  const ui = await mount({ body: { lock: { token: 'safe-token', createdAt: '2026-10-23' }, emails: [
    { id, attemptId: 'safe-attempt', startedAt: '2026-10-23' },
    { id, attemptId: '$(unsafe-command)' }
  ], limit: 100 } });
  const commands = strings(ui.elements['recovery-emails']);
  assert.ok(commands.includes(`node --env-file=.env scripts/recovery.js email ${id} safe-attempt received`));
  assert.ok(commands.includes(`node --env-file=.env scripts/recovery.js email ${id} safe-attempt retry`));
  assert.ok(!commands.some(value => value.startsWith('node ') && value.includes('unsafe-command')));
  assert.ok(strings(ui.elements['recovery-lock']).includes('node --env-file=.env scripts/recovery.js unlock safe-token'));
  assert.equal(ui.elements['recovery-refresh'].disabled, false);
  await ui.elements['recovery-refresh'].events.click();
  assert.equal(ui.elements['recovery-emails'].children.length, 2);
});

test('recovery report handles signed-out and unavailable responses without rendering actions', async () => {
  const signedOut = await mount({ status: 401 });
  assert.equal(signedOut.redirect, '/admin/login.html');
  const failed = await mount({ status: 503, body: { message: 'Try again later.' } });
  assert.equal(failed.elements['admin-status'].textContent, 'Try again later.');
  assert.equal(failed.elements['recovery-emails'].children.length, 0);
  assert.equal(failed.elements['recovery-refresh'].disabled, false);
});
