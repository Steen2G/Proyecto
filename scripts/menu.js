/* ============================================================
   CONFIGURACIÓN DE GOOGLE SHEETS
   ============================================================
   1) Abre tu Google Sheet y ve a: Archivo > Compartir > Compartir
      y en "Acceso general" elige "Cualquier persona con el enlace"
      con rol "Lector". (No hace falta publicar en la web).
   2) Copia el ID de la hoja desde la URL:
      https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
   3) Cada categoría del menú corresponde a UNA HOJA (pestaña)
      dentro del mismo documento. Escribe aquí el nombre exacto
      de la pestaña para cada categoría (tal como aparece abajo
      en el documento, respetando mayúsculas/acentos).
   4) Cada hoja debe tener estas columnas en la fila 1 (encabezados),
      en cualquier orden (los nombres no distinguen mayúsculas):
        id | Producto | Precio | Descuento | Stock | Imagen
      - "Precio" debe ser un número (ej. 25 o 25.5), sin el símbolo $.
      - "Descuento" es un PORCENTAJE (ej. 10 = 10% de descuento).
        Déjalo vacío o en 0 si el producto no tiene descuento.
      - "Stock" es la cantidad disponible. Si es 0 (o está vacío),
        el producto se muestra como "Agotado" y no se puede ordenar.
      - "Imagen" debe ser una URL pública de la foto del producto.
============================================================ */
const SHEET_ID = '1BqtHK9TeUdt65qcM9dHWEwGZKJNkK__jtxom8QgJH-E';

const CATEGORY_SHEETS = {
  'bebidas-calientes': 'BebidasCalientes',
  'bebidas-frias': 'BebidasFrias',
  'alimentos': 'Alimentos'
};

// Caché simple para no volver a pedir la misma hoja varias veces
const productsCache = {};

const CART_STORAGE_KEY = 'orbita_cart';

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
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

function findProductByUid(uid) {
  return Object.values(productsCache).flat().find(p => String(p.uid) === String(uid));
}

// Devuelve true si se agregó, false si ya se alcanzó el stock
function addToCart(producto) {
  const cart = loadCart();
  const existing = cart.find(i => i.id === producto.uid);

  if (existing) {
    if (existing.qty >= producto.stock) return false;
    existing.qty += 1;
  } else {
    cart.push({
      id: producto.uid,
      name: producto.nombre,
      price: Math.round(producto.precioFinal * 100) / 100, // ya con descuento
      image: producto.imagen_url,
      qty: 1
    });
  }

  saveCart(cart);
  return true;
}

/**
 * Descarga y transforma los datos de una hoja de Google Sheets
 * usando el endpoint público de Google Visualization (gviz).
 * Devuelve un arreglo de productos ya listos para renderizar.
 */
async function fetchProductsFromSheet(sheetName) {
  if (productsCache[sheetName]) {
    return productsCache[sheetName];
  }

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo leer la hoja "${sheetName}" (HTTP ${response.status}). Verifica el SHEET_ID y los permisos de acceso.`);
  }

  const rawText = await response.text();

  // La respuesta de gviz viene envuelta así:
  // google.visualization.Query.setResponse({ ... JSON ... });
  // Hay que extraer solo el JSON de en medio.
  const jsonStart = rawText.indexOf('{');
  const jsonEnd = rawText.lastIndexOf('}');
  const data = JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));

  if (!data.table || !data.table.cols) {
    throw new Error(`La hoja "${sheetName}" no tiene el formato esperado.`);
  }

  // Los encabezados pueden venir en "label" o, si la hoja no tiene
  // fila de encabezado reconocida, hay que usar los datos crudos.
  const columnNames = data.table.cols.map(col => (col.label || '').trim().toLowerCase());

  const rows = data.table.rows || [];

  const products = rows
    .map((row, index) => {
      const values = {};
      row.c.forEach((cell, i) => {
        values[columnNames[i]] = cell ? cell.v : '';
      });

      const precioBase = parseFloat(values['precio']) || 0;
      const descuentoPorcentaje = parseFloat(values['descuento']) || 0;
      const precioFinal = descuentoPorcentaje > 0
        ? precioBase - (precioBase * descuentoPorcentaje / 100)
        : precioBase;
      const stock = parseFloat(values['stock']) || 0;

      return {
        uid: `${sheetName}-${values['id'] !== undefined && values['id'] !== '' ? values['id'] : index}`,
        id: values['id'] !== undefined && values['id'] !== '' ? values['id'] : index,
        nombre: values['producto'] || '',
        precioBase: precioBase,
        precioFinal: precioFinal,
        tieneDescuento: descuentoPorcentaje > 0,
        imagen_url: values['imagen'] || '',
        stock: stock,
        agotado: stock <= 0
      };
    })
    .filter(producto => producto.nombre);

  productsCache[sheetName] = products;
  return products;
}

/**
 * Pinta la lista de productos dentro del grid, generando el
 * mismo HTML de tarjeta que ya tenías, pero con datos reales.
 */
function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  if (!products.length) {
    grid.innerHTML = '<p class="products__empty">No hay productos disponibles en esta categoría por ahora.</p>';
    return;
  }

  products.forEach(producto => {
    const precioEntero = Math.trunc(producto.precioFinal);
    const precioDecimales = '.' + Math.round((producto.precioFinal - precioEntero) * 100).toString().padStart(2, '0');

    // Precio original tachado, solo si hay descuento aplicado
    const precioOriginalHtml = producto.tieneDescuento
      ? `<span class="product-card__price-original" style="text-decoration: line-through; opacity: 0.6; margin-right: 6px;">$${producto.precioBase.toFixed(2)}</span>`
      : '';

    const article = document.createElement('article');
    article.className = 'product-card' + (producto.agotado ? ' product-card--agotado' : '');
    article.dataset.productId = producto.uid;

    article.innerHTML = `
      <div class="product-card__image" style="position: relative;">
        ${producto.imagen_url ? `<img src="${producto.imagen_url}" height="95" alt="${producto.nombre}">` : ''}
        ${producto.agotado ? '<span class="product-card__badge" style="position:absolute;top:8px;left:8px;background:#333;color:#fff;font-size:12px;padding:2px 8px;border-radius:4px;">Agotado</span>' : ''}
      </div>
      <div class="product-card__info">
        <h2 class="product-card__name">${producto.nombre}</h2>
        <div class="product-card__footer">
          <p class="product-card__price">${precioOriginalHtml}$${precioEntero}<span class="product-card__price-decimals">${precioDecimales}</span></p>
          <button class="product-card__button" data-action="ordenar" data-product-id="${producto.uid}" ${producto.agotado ? 'disabled' : ''}>
            ${producto.agotado ? 'Agotado' : 'Ordenar'}
          </button>
        </div>
      </div>
    `;
    grid.appendChild(article);
  });
}

/**
 * Carga (o toma de caché) los productos de una categoría y los
 * muestra en pantalla, con estados de carga y error visibles.
 */
async function loadCategory(categoria) {
  const grid = document.getElementById('products-grid');
  const sheetName = CATEGORY_SHEETS[categoria];

  if (!sheetName) {
    grid.innerHTML = `<p class="products__error">No hay una hoja configurada para la categoría "${categoria}".</p>`;
    return;
  }

  grid.innerHTML = '<p class="products__loading">Cargando productos...</p>';

  try {
    const products = await fetchProductsFromSheet(sheetName);
    renderProducts(products);
  } catch (error) {
    console.error('Error al cargar productos desde Google Sheets:', error);
    grid.innerHTML = '<p class="products__error">Ocurrió un error al cargar los productos. Intenta de nuevo más tarde.</p>';
  }
}

// Interacción de la nav de categorías: cambia el estilo activo
// y carga los productos reales de la hoja correspondiente.
document.querySelectorAll('.categories__item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.categories__item').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    loadCategory(btn.dataset.category);
  });
});

// Al cargar la página, muestra la categoría marcada como activa
// (o la primera disponible si ninguna lo está).
document.addEventListener('DOMContentLoaded', () => {
  const activeBtn = document.querySelector('.categories__item.is-active');
  const initialCategory = activeBtn ? activeBtn.dataset.category : Object.keys(CATEGORY_SHEETS)[0];
  loadCategory(initialCategory);
});

function showAddedFeedback(btn, added) {
  btn.textContent = added ? '¡Agregado!' : 'Máximo en stock';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = 'Ordenar';
    btn.disabled = false;
  }, 900);
}

document.getElementById('products-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="ordenar"]');
  if (!btn || btn.disabled) return;

  const producto = findProductByUid(btn.dataset.productId);
  if (!producto) return;

  const added = addToCart(producto);
  showAddedFeedback(btn, added);
  updateCartBadge(true); // se define en el paso 6
});