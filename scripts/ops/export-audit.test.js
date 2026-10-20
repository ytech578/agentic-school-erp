const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCheckpoint } = require('./export-audit');
test('audit checkpoint validates opaque bigint/UUID cursors without rounding transaction IDs', () => {
  const checkpoint = { nextTransactionId: '9007199254740999', afterId: '12345678-1234-1234-1234-123456789abc' };
  assert.equal(validateCheckpoint(checkpoint).nextTransactionId, checkpoint.nextTransactionId);
  assert.throws(() => validateCheckpoint({ nextTransactionId: '0;DROP TABLE', afterId: '' }));
  assert.throws(() => validateCheckpoint({ nextTransactionId: '100', afterId: '../escape' }));
});
