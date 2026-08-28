import { calculateTotal } from './pricing.js';

const CART = [
  { name: '挂耳咖啡', price: 9.9, qty: 1 },
  { name: '机械键盘', price: 399, qty: 0 },
];

const yuan = (n) => `${n < 0 ? '-' : ''}¥${Math.abs(n).toFixed(2)}`;
const $ = (id) => document.getElementById(id);

function renderCart() {
  $('cart').innerHTML = CART.map((it, i) => `
    <div class="row">
      <div class="name">${it.name}<div class="price">${yuan(it.price)}</div></div>
      <div class="qty">
        <button data-i="${i}" data-d="-1" aria-label="减少">−</button>
        <span id="q${i}">${it.qty}</span>
        <button data-i="${i}" data-d="1" aria-label="增加">+</button>
      </div>
    </div>`).join('');

  $('cart').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.i;
      CART[i].qty = Math.max(0, CART[i].qty + +b.dataset.d);
      $(`q${i}`).textContent = CART[i].qty;
      render();
    };
  });
}

function render() {
  const r = calculateTotal(CART, $('coupon').value);

  $('subtotal').textContent = yuan(r.subtotal);
  $('discount').textContent = r.discount ? `-${yuan(r.discount)}` : yuan(0);
  $('shipping').textContent = r.shipping ? yuan(r.shipping) : '包邮';
  $('total').textContent = yuan(r.total);
  $('total').classList.toggle('bad', r.total < 0);

  // 线上兜底自检：钱算得离谱时直接在页面上喊出来，
  // 这样手机上瞄一眼就知道出事了，不用去翻日志。
  const problems = [];
  if (r.discount > r.subtotal) {
    problems.push(`优惠 ${yuan(r.discount)} 超过了商品小计 ${yuan(r.subtotal)}`);
  }
  if (r.total < 0) {
    problems.push('应付金额为负数——这单我们要倒贴钱');
  }
  const alert = $('alert');
  alert.classList.toggle('show', problems.length > 0);
  alert.innerHTML = problems.length
    ? `<b>⚠️ 计价异常</b><br>${problems.join('<br>')}`
    : '';
}

$('coupon').onchange = render;
renderCart();
render();

// 部署时由 CI 把提交号写进来，用来确认手机上看到的到底是不是新版本
fetch('./version.json', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((v) => { if (v) document.getElementById('build').textContent = v.sha; })
  .catch(() => {});
