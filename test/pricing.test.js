import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal, calculateDiscount } from '../src/pricing.js';

const 咖啡 = { name: '挂耳咖啡', price: 9.9, qty: 1 };
const 键盘 = { name: '机械键盘', price: 399, qty: 1 };

test('无优惠券：小计 + 运费', () => {
  const r = calculateTotal([咖啡]);
  assert.equal(r.subtotal, 9.9);
  assert.equal(r.discount, 0);
  assert.equal(r.shipping, 12);
  assert.equal(r.total, 21.9);
});

test('满 99 包邮', () => {
  const r = calculateTotal([键盘]);
  assert.equal(r.shipping, 0);
  assert.equal(r.total, 399);
});

test('SAVE20：满足门槛时减 20', () => {
  const r = calculateTotal([键盘], 'SAVE20');
  assert.equal(r.discount, 20);
  assert.equal(r.total, 379);
});

test('SAVE20：低于 100 不能用券', () => {
  const r = calculateTotal([咖啡], 'SAVE20');
  assert.equal(r.discount, 0);
  assert.equal(r.total, 21.9);
});

test('HALFOFF：五折', () => {
  const r = calculateTotal([键盘], 'HALFOFF');
  assert.equal(r.discount, 199.5);
  assert.equal(r.total, 199.5);
});

test('未知券码不产生优惠', () => {
  assert.equal(calculateDiscount(500, 'NOT_A_COUPON'), 0);
  assert.equal(calculateDiscount(500, undefined), 0);
});

test('多件商品累加', () => {
  const r = calculateTotal([{ ...咖啡, qty: 3 }, 键盘]);
  assert.equal(r.subtotal, 428.7);
});
