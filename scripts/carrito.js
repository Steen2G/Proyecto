const CART_STORAGE_KEY = 'orbita_cart';
const SHIPPING_COST = 5.00;

const currency = (n) =>
  `$${Number(n).toFixed(2)}`;

/* ---------- Acceso a localStorage ---------- */

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('No se pudo leer el carrito:', err);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error('No se pudo guardar el carrito:', err);
  }
}

/* ---------- Referencias al DOM ---------- */

const listEl = document.getElementById('cart-list');
const emptyEl = document.getElementById('cart-empty');

const totalItemsEl = document.getElementById('cart-total-items');
const subtotalEl = document.getElementById('cart-subtotal');
const shippingEl = document.getElementById('cart-shipping');
const grandTotalEl = document.getElementById('cart-grand-total');

const preorderBtn = document.getElementById('preorder-button');
const preorderMessage = document.getElementById('preorder-message');

let cart = loadCart();

/* ---------- Cálculo y resumen ---------- */

function updateSummary() {
  const totalItems = cart.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0
  );

  const subtotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.price || 0) * Number(item.qty || 0),
    0
  );

  // El envío se cobra únicamente cuando hay productos.
  const shipping = totalItems > 0 ? SHIPPING_COST : 0;
  const grandTotal = subtotal + shipping;

  if (totalItemsEl) {
    totalItemsEl.textContent = totalItems;
  }

  if (subtotalEl) {
    subtotalEl.textContent = currency(subtotal);
  }

  if (shippingEl) {
    shippingEl.textContent = currency(shipping);
  }

  if (grandTotalEl) {
    grandTotalEl.textContent = currency(grandTotal);
  }

  if (preorderBtn) {
    preorderBtn.disabled = totalItems === 0;
  }
}

/* ---------- Render ---------- */

function render() {
  listEl.innerHTML = '';

  if (cart.length === 0) {
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;

    cart.forEach((item) => {
      listEl.appendChild(buildRow(item));
    });
  }

  updateSummary();
}

function buildRow(item) {
  const row = document.createElement('div');
  row.className = 'cart__row';
  row.dataset.id = item.id;

  const lineTotal = Number(item.price) * Number(item.qty);

  row.innerHTML = `
    <div class="col col--product">
      <div class="product__thumb">
        ${
          item.image
            ? `<img src="${item.image}" alt="${item.name}">`
            : '☕'
        }
      </div>
      <div class="product__info">
        <span class="product__name">${item.name}</span>
        ${
          item.variant
            ? `<span class="product__variant">${item.variant}</span>`
            : ''
        }
      </div>
    </div>

    <div class="col col--qty">
      <button
        type="button"
        class="qty-btn qty-btn--minus"
        aria-label="Disminuir cantidad"
      >−</button>

      <span class="qty-value">${item.qty}</span>

      <button
        type="button"
        class="qty-btn qty-btn--plus"
        aria-label="Aumentar cantidad"
      >+</button>
    </div>

    <div class="col col--price">${currency(item.price)}</div>
    <div class="col col--total">${currency(lineTotal)}</div>

    <div class="col col--remove">
      <button
        type="button"
        class="remove-btn"
        aria-label="Eliminar ${item.name}"
      >🗑️</button>
    </div>
  `;

  row.querySelector('.qty-btn--minus')
    .addEventListener('click', () => changeQty(item.id, -1));

  row.querySelector('.qty-btn--plus')
    .addEventListener('click', () => changeQty(item.id, 1));

  row.querySelector('.remove-btn')
    .addEventListener('click', () => removeItem(item.id));

  return row;
}

/* ---------- Acciones sobre el carrito ---------- */

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  item.qty += delta;

  if (item.qty <= 0) {
    cart = cart.filter((i) => i.id !== id);
  }

  saveCart(cart);
  render();
}

function removeItem(id) {
  cart = cart.filter((i) => i.id !== id);

  saveCart(cart);
  render();
}

/* ---------- Preordenar ---------- */

let isSending = false;

if (preorderBtn) {
  preorderBtn.addEventListener('click', async () => {
    if (isSending) return;

    // Leer nuevamente el carrito antes de continuar.
    cart = loadCart();

    const totalItems = cart.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0
    );

    if (totalItems === 0) {
      preorderMessage.textContent =
        'Agrega productos antes de preordenar.';

      render();
      return;
    }

    const subtotal = cart.reduce(
      (sum, item) =>
        sum + Number(item.price || 0) * Number(item.qty || 0),
      0
    );

    const total = subtotal + SHIPPING_COST;

    isSending = true;
    preorderBtn.disabled = true;
    preorderMessage.textContent = 'Enviando tu preorden...';

    try {
      const result = await enviarPedidoASheets(cart, total);

      // Solo se limpia el carrito si el pedido se registró correctamente.
      cart = [];
      saveCart(cart);
      render();

      preorderMessage.textContent =
        `¡Preorden #${result.no_pedido} registrada! ` +
        `${totalItems} artículo(s), total ${currency(total)}. ` +
        'Estado: En proceso.';
    } catch (err) {
      console.error('No se pudo enviar la preorden:', err);

      // El carrito se conserva para que el cliente pueda reintentar.
      preorderMessage.textContent =
        'No pudimos enviar tu preorden. Intenta de nuevo en un momento.';
      preorderBtn.disabled = false;
    } finally {
      isSending = false;
    }
  });
}

/* ---------- Sincronía entre pestañas ---------- */

window.addEventListener('storage', (e) => {
  if (e.key === CART_STORAGE_KEY) {
    cart = loadCart();
    render();
  }
});

/* ---------- Inicialización ---------- */

render();