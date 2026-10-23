import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../../frontend/assets/js/admin-presentation.js', import.meta.url), 'utf8');
function mount() {
  const feedback = { textContent: 'Loading appointments…', dataset: {} };
  const classes = new Set();
  const badge = { textContent: 'Status: Scheduled', dataset: {}, classList: { add: value => classes.add(value) } };
  const table = { attrs: {}, hasAttribute(key) { return key in this.attrs; }, setAttribute(key, value) { this.attrs[key] = value; } };
  let update;
  vm.runInNewContext(script, {
    document: { body: {}, querySelectorAll: selector => selector.startsWith('[role=') ? [feedback] : selector === '.table-wrap' ? [table] : [badge] },
    MutationObserver: class { constructor(fn) { update = fn; } observe() {} },
    queueMicrotask: fn => fn()
  });
  return { feedback, badge, table, update, classes };
}

test('presentation states follow existing feedback without changing text or controls', () => {
  const ui = mount();
  assert.equal(ui.feedback.dataset.adminState, 'loading');
  for (const [text, state] of [
    ['Appointment saved.', 'success'], ['No enquiries match your filters.', 'empty'],
    ['This team member already has an overlapping visit.', 'error'],
    ['An appointment was saved concurrently. Reload before editing.', 'error'],
    ['Email may have been sent, but its outcome could not be recorded.', 'error'],
    ['Saving notes…', 'loading'], ['Notes saved.', 'success'], ['Unsaved changes.', 'info']
  ]) {
    ui.feedback.textContent = text; ui.update();
    assert.equal(ui.feedback.dataset.adminState, state, text);
    assert.equal(ui.feedback.textContent, text);
  }
});

test('presentation distinguishes statuses and makes existing table wrappers keyboard scrollable', () => {
  const ui = mount();
  assert.equal(ui.badge.dataset.adminBadge, 'blue');
  assert.equal(ui.table.tabIndex, 0); assert.equal(ui.table.attrs['aria-label'], 'Scrollable admin table');
  ui.table.attrs['aria-label'] = 'Existing table name';
  ui.badge.textContent = 'Status: Cancelled'; ui.update();
  assert.equal(ui.badge.dataset.adminBadge, 'red'); assert.equal(ui.table.attrs['aria-label'], 'Existing table name');
  assert.ok(ui.classes.has('admin-status-badge'));
  assert.equal(ui.badge.textContent, 'Status: Cancelled');
});
