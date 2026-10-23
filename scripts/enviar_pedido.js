const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxBf0f6-w7fKRlY-RRiM92ZN0Igi6V_YT6VTbLRHocJ92C0UIgP-Yg1xXgucp_XyW-y/exec';

/**
 * @param {Array}  items - Arreglo del carrito (localStorage).
 * @param {number} total - Pago total del pedido.
 * @returns {Promise<{ok: boolean, no_pedido?: number, error?: string}>}
 */
async function enviarPedidoASheets(items, total) {
  if (!SHEETS_WEB_APP_URL || SHEETS_WEB_APP_URL.startsWith('PEGA_AQUI')) {
    throw new Error('Falta configurar SHEETS_WEB_APP_URL en sheets.js');
  }

  const payload = {
    articulos: items.map((i) => ({
      id: i.id,
      nombre: i.name,
      variante: i.variant || '',
      cantidad: Number(i.qty),
      precio: Number(i.price),
    })),
    pago_total: Number(total),
  };

  const response = await fetch(SHEETS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || 'El servidor rechazó el pedido');
  }

  return result;
}
