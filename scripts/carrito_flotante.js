function updateCartBadge(animate = false) {
  const total = loadCart().reduce((sum, i) => sum + i.qty, 0);
  const badge = document.getElementById('cart-count');
  badge.textContent = total;
  badge.hidden = total === 0;

  if (animate) {
    const icon = document.getElementById('floating-cart');
    icon.classList.remove('floating-cart--bump');
    void icon.offsetWidth; // reinicia la animación
    icon.classList.add('floating-cart--bump');
  }
}

updateCartBadge();
window.addEventListener('storage', (e) => {
  if (e.key === CART_STORAGE_KEY) updateCartBadge();
});