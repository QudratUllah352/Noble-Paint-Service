import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../frontend/assets/js/admin-audit.js', import.meta.url), 'utf8');
async function mount(statusCode = 200) {
  class Element {
    constructor() { this.children = []; this.textContent = ''; this.handlers = {}; this.button = {}; }
    append(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    querySelector() { return this.button; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
  }
  const nodes = Object.fromEntries(['audit-filters', 'audit-action', 'audit-list', 'admin-status', 'audit-prev', 'audit-next', 'audit-page'].map(id => [id, new Element()]));
  const requests = []; let redirect;
  vm.runInNewContext(source, {
    document: { getElementById: id => nodes[id], createElement: () => new Element() },
    location: { replace: path => { redirect = path; } }, URLSearchParams,
    FormData: class { constructor() { return [['search', 'admin@example.com'], ['outcome', 'Pending']]; } },
    fetch: async (path, options) => {
      requests.push(path); assert.equal(options.cache, 'no-store');
      return { status: statusCode, ok: statusCode === 200, json: async () => statusCode !== 200 ? { message: 'Unavailable' } : {
        items: [{ action: 'enquiry.notes', actor: 'id', actorEmail: '<script>stored text</script>', target: 'record-id', fields: ['adminNotes'], outcome: 'Pending', createdAt: '2026-10-23T00:00:00.000Z' }],
        total: 26, page: Number(new URL(path, 'http://localhost').searchParams.get('page')), pageSize: 25
      } };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, requests, redirect };
}

test('audit history renders stored content as text, applies filters, and preserves them across pages', async () => {
  const { nodes, requests } = await mount();
  assert.equal(nodes['audit-list'].children[0].children[0].textContent, 'Enquiry notes — Pending');
  assert.match(nodes['audit-list'].children[0].children[1].textContent, /<script>stored text<\/script>/);
  assert.equal(nodes['audit-prev'].disabled, true); assert.equal(nodes['audit-next'].disabled, false);
  nodes['audit-filters'].handlers.submit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(requests.at(-1), /search=admin%40example.com/); assert.match(requests.at(-1), /outcome=Pending/);
  nodes['audit-next'].handlers.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(requests.at(-1), /page=2/); assert.match(requests.at(-1), /outcome=Pending/);
  assert.equal(nodes['audit-prev'].disabled, false); assert.equal(nodes['audit-next'].disabled, true);
  assert.equal(nodes['audit-page'].textContent, 'Page 2 of 2');
});

test('audit history redirects expired sessions and shows load failures without stale entries', async () => {
  assert.equal((await mount(401)).redirect, '/admin/login.html');
  const { nodes } = await mount(503);
  assert.equal(nodes['admin-status'].textContent, 'Unavailable');
  assert.equal(nodes['audit-list'].children.length, 0);
  assert.equal(nodes['audit-filters'].button.disabled, false);
});
