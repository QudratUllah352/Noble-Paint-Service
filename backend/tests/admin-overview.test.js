import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createOverviewReader } from '../src/services/adminOverview.js';

test('overview totals include older pending requests as New and provide only a limited recent list', async () => {
  const recent = [{ _id: 'id', fullName: 'Test Customer', status: 'New' }];
  const model = {
    aggregate: async () => [{ _id: 'pending', count: 2 }, { _id: 'New', count: 3 }, { _id: 'Won', count: 1 }],
    find() { return {
      sort(order) { assert.deepEqual(order, { createdAt: -1, _id: -1 }); return this; },
      limit(value) { assert.equal(value, 5); return this; },
      select(fields) { assert.equal(fields, '_id fullName source status createdAt'); return this; },
      async lean() { return recent; }
    }; }
  };
  const data = await createOverviewReader(model)();
  assert.equal(data.total, 6);
  assert.deepEqual(data.byStatus, { New: 5, Contacted: 0, Quoted: 0, Won: 1, Closed: 0 });
  assert.deepEqual(data.recent, recent);
  model.aggregate = async () => [];
  assert.equal((await createOverviewReader(model)()).total, 0);
});

test('overview renders counts as links to filtered enquiries', async () => {
  const source = await readFile(new URL('../../frontend/assets/js/admin-live.js', import.meta.url), 'utf8');
  function element() {
    return { children: [], append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; }, addEventListener() {} };
  }
  const elements = Object.fromEntries(['admin-status', 'live-overview', 'recent-enquiries', 'admin-logout', 'refresh-overview', 'project-summary'].map(id => [id, element()]));
  const context = vm.createContext({
    document: { getElementById: id => elements[id] || null, createElement: element },
    location: { replace() { throw new Error('Unexpected redirect'); } },
    fetch: async () => ({ ok: true, json: async () => ({ total: 3, byStatus: { New: 2, Won: 1 }, recent: [], projectSummary: { total: 1, byStatus: { Planned: 0, 'In progress': 1 } } }) })
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  const cards = elements['live-overview'].children[0].children;
  assert.equal(cards[0].href, '/admin/enquiries.html');
  assert.equal(cards[1].href, '/admin/enquiries.html?status=New');
  assert.equal(cards[1].children[1].textContent, '2');
  assert.equal(elements['recent-enquiries'].textContent, 'No enquiries yet.');
  assert.equal(elements['refresh-overview'].disabled, false);
  const projectLinks = elements['project-summary'].children.map(row => row.children[0]);
  assert.equal(projectLinks[0].href, '/admin/projects.html');
  assert.equal(projectLinks[2].href, '/admin/projects.html?status=In%20progress');
  assert.equal(projectLinks[2].textContent, 'In progress: 1');
});
