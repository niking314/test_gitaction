// 订单计价 —— 全站唯一的「算钱」真相来源。
// 任何改动都必须同步补 test/pricing.test.js，钱算错了没有第二次机会。

/** 优惠券规则表 */
export const COUPONS = {
  // 满 100 减 20
  SAVE20: { type: 'full_reduction', threshold: 100, amount: 20, label: '满100减20' },
  // 全场五折
  HALFOFF: { type: 'percent', off: 0.5, label: '五折' },
};

/** 满 99 包邮，否则收 12 元运费 */
export const FREE_SHIPPING_THRESHOLD = 99;
export const SHIPPING_FEE = 12;

/**
 * 计算优惠金额。
 * @param {number} subtotal 商品小计
 * @param {string} [couponCode] 优惠券码
 * @returns {number} 应减掉的金额
 */
export function calculateDiscount(subtotal, couponCode) {
  const coupon = COUPONS[couponCode];
  if (!coupon) return 0;

  if (coupon.type === 'full_reduction') {
    return coupon.amount;
  }
  if (coupon.type === 'percent') {
    return subtotal * coupon.off;
  }
  return 0;
}

/**
 * 计算一张订单的最终金额。
 * @param {Array<{name: string, price: number, qty: number}>} items
 * @param {string} [couponCode]
 * @returns {{subtotal: number, discount: number, shipping: number, total: number}}
 */
export function calculateTotal(items, couponCode) {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const discount = calculateDiscount(subtotal, couponCode);
  const afterDiscount = subtotal - discount;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    shipping: round2(shipping),
    total: round2(afterDiscount + shipping),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
