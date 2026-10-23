import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationFilter, createConsultationLister } from '../src/services/listConsultations.js';

function matches(row, filter) {
  if (filter.status && (typeof filter.status === 'string' ? row.status !== filter.status : !filter.status.$in.includes(row.status))) return false;
  return !filter.$or || filter.$or.some(condition => {
    const [field, regex] = Object.entries(condition)[0];
    return new RegExp(regex.$regex, regex.$options).test(row[field]);
  });
}
const rows = [
  { fullName: 'Ali (Home)', emailAddr: 'ali+home@example.com', phoneNumber: '+1 704 555 0123', status: 'pending' },
  { fullName: 'Alice', emailAddr: 'alice@example.com', phoneNumber: '555-9999', status: 'New' },
  { fullName: 'Sara', emailAddr: 'sara@example.com', phoneNumber: '555-0000', status: 'Won' }
];

test('search finds name, email and phone case-insensitively and combines with status', () => {
  assert.equal(rows.filter(row => matches(row, consultationFilter({ search: 'ALI' }))).length, 2);
  assert.equal(rows.filter(row => matches(row, consultationFilter({ search: 'ali+home@' }))).length, 1);
  assert.equal(rows.filter(row => matches(row, consultationFilter({ search: '555-0000' }))).length, 1);
  assert.equal(rows.filter(row => matches(row, consultationFilter({ search: 'ali', status: 'Won' }))).length, 0);
  assert.equal(rows.filter(row => matches(row, consultationFilter({ status: 'New' }))).length, 2);
  assert.deepEqual(consultationFilter({}), {});
});

test('search treats regex metacharacters literally', () => {
  for (const search of ['.*', '[', '\\', '^$', '(a+)+', '?']) {
    const filter = consultationFilter({ search });
    assert.equal(matches({ fullName: search, emailAddr: '', phoneNumber: '' }, filter), true);
    assert.equal(matches(rows[0], filter), false);
  }
});

test('listing applies the same filters to results and total and preserves pagination', async () => {
  let resultFilter, countFilter, offset, size;
  const chain = {
    sort(order) { assert.deepEqual(order, { createdAt: -1, _id: -1 }); return this; },
    skip(value) { offset = value; return this; },
    limit(value) { size = value; return this; },
    async lean() { return rows.filter(row => matches(row, resultFilter)).slice(offset, offset + size); }
  };
  const list = createConsultationLister({
    find(filter) { resultFilter = filter; return chain; },
    async countDocuments(filter) { countFilter = filter; return rows.filter(row => matches(row, filter)).length; }
  });
  const result = await list({ search: 'ali', status: 'New', page: 2, limit: 1 });
  assert.equal(result.total, 2);
  assert.deepEqual(result.items, [rows[1]]);
  assert.deepEqual(resultFilter, countFilter);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 1);
});
