const test = require('node:test');
const assert = require('node:assert');
const { paramsParaLimit } = require('../../db/config');

test('LIMIT y OFFSET numéricos pasan a texto; el resto queda igual', () => {
  const sql = 'SELECT * FROM pedidos WHERE negocio_id = ? AND total > ? ORDER BY id LIMIT ? OFFSET ?';
  assert.deepStrictEqual(paramsParaLimit(sql, [7, 10.5, 50, 0]), [7, 10.5, '50', '0']);
});

test('LIMIT sin OFFSET', () => {
  assert.deepStrictEqual(paramsParaLimit('SELECT 1 LIMIT ?', [20]), ['20']);
});

test('LIMIT ?, ? (forma con coma)', () => {
  assert.deepStrictEqual(paramsParaLimit('SELECT 1 LIMIT ?, ?', [5, 10]), ['5', '10']);
});

test('sin LIMIT no toca nada, y los textos se respetan', () => {
  assert.deepStrictEqual(paramsParaLimit('SELECT * FROM t WHERE id = ?', [3]), [3]);
  assert.deepStrictEqual(paramsParaLimit('SELECT 1 LIMIT ?', ['25']), ['25']);
});
