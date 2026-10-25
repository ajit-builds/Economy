/**
 * ECOnomy - Sustainable Building Materials & Circular E-Commerce
 * Frontend Application Engine & Interactive Controller
 */

// 1. Core Sustainable Product Database (16 Detailed Circular Construction Products)
// 1. Core Sustainable Product Database loaded from products.js

// 2. Global State Management
const STATE = {
  cart: [],
  wishlist: new Set(),
  activeDivision: 'all',
  searchQuery: '',
  maxPrice: Infinity,
  minEcoRating: 0,
  activeCertifications: new Set(),
  inStockOnly: false,
  sortBy: 'featured',
  appliedPromo: null,
  shippingTier: 'standard', // 'standard' (free over ₹150 or ₹14.99), 'express' (₹18.50), 'overnight' (₹32.00)
  paymentMethod: 'qr', // 'qr', 'gpay', 'card'
  checkoutStep: 1,
  completedOrders: []
};

// Shipping Rates Configuration
const SHIPPING_CONFIG = {
  standard: { name: 'Standard Eco-Freight (5-7 Days)', cost: 14.99, freeThreshold: 150.00, carbonExtra: 0 },
  express: { name: 'Low-Carbon Express (2-3 Days)', cost: 18.50, freeThreshold: null, carbonExtra: 2.1 },
  overnight: { name: 'Consolidated Carbon-Neutral Overnight', cost: 32.00, freeThreshold: null, carbonExtra: 0 }
};

// 3. LocalStorage Synchronization
const STORAGE_KEYS = {
  CART: 'economy_cart_v2',
  ORDERS: 'economy_orders_v2',
  WISHLIST: 'economy_wishlist_v2'
};

function loadStoredState() {
  try {
    const savedCart = localStorage.getItem(STORAGE_KEYS.CART) || localStorage.getItem('ecoconstruct_cart_v2');
    if (savedCart) {
      STATE.cart = JSON.parse(savedCart);
    }
    const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS) || localStorage.getItem('ecoconstruct_orders_v2');
    if (savedOrders) {
      STATE.completedOrders = JSON.parse(savedOrders);
    }
    const savedWishlist = localStorage.getItem(STORAGE_KEYS.WISHLIST) || localStorage.getItem('ecoconstruct_wishlist_v2');
    if (savedWishlist) {
      STATE.wishlist = new Set(JSON.parse(savedWishlist));
    }
  } catch (e) {
    console.warn('Failed to load persistent storage:', e);
  }
}

function saveCartState() {
  try {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(STATE.cart));
  } catch (e) {
    console.warn('Failed to persist cart:', e);
  }
}

function saveWishlistState() {
  try {
    localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(Array.from(STATE.wishlist)));
  } catch (e) {
    console.warn('Failed to persist wishlist:', e);
  }
}

// 4. Cart Operations
function addToCart(productId, quantity = 1) {
  const product = PRODUCTS_DATA.find(p => p.id === productId);
  if (!product) return;

  const existingItem = STATE.cart.find(item => item.id === productId);
  if (existingItem) {
    existingItem.qty += quantity;
  } else {
    STATE.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      ecoRating: product.ecoRating,
      carbonOffset: product.carbonOffset,
      image: product.image,
      qty: quantity
    });
  }

  saveCartState();
  updateCartCounters();
  renderCartDrawer();
  showToast(`Added "${product.name}" to cart!`, 'success');

  // Trigger brief badge bounce animation
  const badge = document.getElementById('header-cart-badge');
  if (badge) {
    badge.classList.add('scale-125');
    setTimeout(() => badge.classList.remove('scale-125'), 300);
  }
}

function updateCartItemQuantity(productId, delta) {
  const itemIndex = STATE.cart.findIndex(i => i.id === productId);
  if (itemIndex === -1) return;

  STATE.cart[itemIndex].qty += delta;
  if (STATE.cart[itemIndex].qty <= 0) {
    const removedName = STATE.cart[itemIndex].name;
    STATE.cart.splice(itemIndex, 1);
    showToast(`Removed "${removedName}" from cart`, 'info');
  }

  saveCartState();
  updateCartCounters();
  renderCartDrawer();
}

function removeCartItem(productId) {
  const item = STATE.cart.find(i => i.id === productId);
  if (!item) return;

  STATE.cart = STATE.cart.filter(i => i.id !== productId);
  saveCartState();
  updateCartCounters();
  renderCartDrawer();
  showToast(`Removed "${item.name}" from cart`, 'info');
}

function clearCart() {
  if (STATE.cart.length === 0) return;
  STATE.cart = [];
  saveCartState();
  updateCartCounters();
  renderCartDrawer();
  showToast('Shopping cart cleared', 'info');
}

// 5. Calculations & Sustainability Metrics
function calculateCartTotals() {
  const subtotal = STATE.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  // Shipping calculation
  const shippingTierData = SHIPPING_CONFIG[STATE.shippingTier] || SHIPPING_CONFIG.standard;
  let shippingCost = shippingTierData.cost;
  if (shippingTierData.freeThreshold && subtotal >= shippingTierData.freeThreshold) {
    shippingCost = 0;
  }
  if (subtotal === 0) {
    shippingCost = 0;
  }

  // Promo Code Discount
  let discount = 0;
  if (STATE.appliedPromo) {
    if (STATE.appliedPromo.type === 'zero' || STATE.appliedPromo.type === 'free') {
      discount = subtotal;
      shippingCost = 0;
    } else if (STATE.appliedPromo.type === 'percentage') {
      discount = subtotal * STATE.appliedPromo.value;
      if (STATE.appliedPromo.value >= 1.0) {
        shippingCost = 0;
      }
    } else if (STATE.appliedPromo.type === 'fixed') {
      discount = Math.min(subtotal, STATE.appliedPromo.value);
    }
  }

  // Tax calculation (8.75% sustainable logistics tax)
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * 0.0875;
  let grandTotal = Math.max(0, taxableAmount + shippingCost + tax);
  if (STATE.appliedPromo && (STATE.appliedPromo.type === 'zero' || STATE.appliedPromo.type === 'free' || STATE.appliedPromo.value >= 1.0)) {
    grandTotal = 0;
    shippingCost = 0;
  }

  // Carbon Offset Calculation (kg CO2e)
  const totalCarbonOffset = STATE.cart.reduce((sum, item) => sum + (item.carbonOffset * item.qty), 0);

  return {
    subtotal,
    shippingCost,
    discount,
    tax,
    grandTotal,
    totalCarbonOffset,
    itemCount: STATE.cart.reduce((sum, item) => sum + item.qty, 0)
  };
}

// 6. UI Renderers: Cart Drawer & Counters
function updateCartCounters() {
  const count = STATE.cart.reduce((sum, item) => sum + item.qty, 0);
  
  const headerBadge = document.getElementById('header-cart-badge');
  const mobileBadge = document.getElementById('mobile-cart-badge');

  [headerBadge, mobileBadge].forEach(badge => {
    if (!badge) return;
    badge.textContent = count;
    if (count > 0) {
      badge.classList.remove('hidden');
      badge.classList.add('inline-flex');
    } else {
      badge.classList.add('hidden');
      badge.classList.remove('inline-flex');
    }
  });
}

function renderCartDrawer() {
  const drawerItems = document.getElementById('cart-drawer-items');
  const emptyState = document.getElementById('cart-drawer-empty');
  const footerElement = document.getElementById('cart-drawer-footer');
  
  if (!drawerItems || !emptyState || !footerElement) return;

  const totals = calculateCartTotals();

  if (STATE.cart.length === 0) {
    drawerItems.innerHTML = '';
    drawerItems.classList.add('hidden');
    emptyState.classList.remove('hidden');
    footerElement.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  drawerItems.classList.remove('hidden');
  footerElement.classList.remove('hidden');

  // Render items
  drawerItems.innerHTML = STATE.cart.map(item => `
    <div class="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-sm transition hover:border-emerald-300">
      <img src="${item.image}" alt="${item.name}" class="w-16 h-16 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-semibold text-slate-900 truncate" title="${item.name}">${item.name}</h4>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs font-bold text-emerald-700">₹${item.price.toFixed(2)}</span>
          <span class="text-[11px] text-slate-400">/ ${item.unit}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">-${(item.carbonOffset * item.qty).toFixed(1)}kg CO2</span>
        </div>
        <div class="flex items-center justify-between mt-2.5">
          <!-- Quantity Stepper -->
          <div class="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
            <button onclick="updateCartItemQuantity('${item.id}', -1)" aria-label="Decrease quantity" class="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition text-sm font-bold">-</button>
            <span class="w-8 text-center text-xs font-semibold text-slate-800">${item.qty}</span>
            <button onclick="updateCartItemQuantity('${item.id}', 1)" aria-label="Increase quantity" class="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition text-sm font-bold">+</button>
          </div>
          <!-- Item Subtotal & Delete -->
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold text-slate-900">₹${(item.price * item.qty).toFixed(2)}</span>
            <button onclick="removeCartItem('${item.id}')" aria-label="Remove item" class="text-slate-400 hover:text-red-500 transition p-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Update summary breakdown
  const subtotalEl = document.getElementById('cart-subtotal-val');
  const shippingEl = document.getElementById('cart-shipping-val');
  const taxEl = document.getElementById('cart-tax-val');
  const grandTotalEl = document.getElementById('cart-total-val');
  const discountRow = document.getElementById('cart-discount-row');
  const discountValEl = document.getElementById('cart-discount-val');
  const carbonBadgeEl = document.getElementById('cart-carbon-offset-badge');
  const carbonMeterFill = document.getElementById('cart-carbon-meter-fill');

  if (subtotalEl) subtotalEl.textContent = `₹${totals.subtotal.toFixed(2)}`;
  if (shippingEl) {
    shippingEl.textContent = totals.shippingCost === 0 ? 'FREE (Eco-Freight)' : `₹${totals.shippingCost.toFixed(2)}`;
  }
  if (taxEl) taxEl.textContent = `₹${totals.tax.toFixed(2)}`;
  if (grandTotalEl) grandTotalEl.textContent = `₹${totals.grandTotal.toFixed(2)}`;

  if (discountRow && discountValEl) {
    if (totals.discount > 0) {
      discountRow.classList.remove('hidden');
      discountValEl.textContent = `-₹${totals.discount.toFixed(2)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }

  if (carbonBadgeEl) {
    carbonBadgeEl.textContent = `${totals.totalCarbonOffset.toFixed(1)} kg CO2e`;
  }
  if (carbonMeterFill) {
    // scale up to 100kg target
    const pct = Math.min(100, Math.round((totals.totalCarbonOffset / 100) * 100));
    carbonMeterFill.style.width = `${pct}%`;
  }
}

// 7. Catalog Filtering & Search Engine
function filterAndSortProducts() {
  return PRODUCTS_DATA.filter(product => {
    // Division filter
    if (STATE.activeDivision !== 'all' && product.division !== STATE.activeDivision) {
      return false;
    }

    // Keyword search (name, description, specs, certifications)
    if (STATE.searchQuery.trim() !== '') {
      const q = STATE.searchQuery.toLowerCase();
      const searchable = (
        product.name + ' ' +
        product.description + ' ' +
        product.divisionLabel + ' ' +
        product.certifications.join(' ') + ' ' +
        product.specs.origin + ' ' +
        product.specs.leedPoints
      ).toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    // Price Filter
    if (product.price > STATE.maxPrice) {
      return false;
    }

    // Eco Rating Filter
    if (product.ecoRating < STATE.minEcoRating) {
      return false;
    }

    // In Stock Only
    if (STATE.inStockOnly && !product.inStock) {
      return false;
    }

    // Certifications Filter
    if (STATE.activeCertifications.size > 0) {
      const hasMatchingCert = Array.from(STATE.activeCertifications).some(cert => 
        product.certifications.some(c => c.toLowerCase().includes(cert.toLowerCase()))
      );
      if (!hasMatchingCert) return false;
    }

    return true;
  }).sort((a, b) => {
    switch (STATE.sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return b.ecoRating - a.ecoRating;
      case 'carbon':
        return b.carbonOffset - a.carbonOffset;
      case 'featured':
      default:
        return 0; // Natural curated order
    }
  });
}

function renderProductGrid() {
  const gridContainer = document.getElementById('product-grid');
  const countIndicator = document.getElementById('product-count-display');
  const emptyState = document.getElementById('product-empty-state');
  
  if (!gridContainer) return;

  const filtered = filterAndSortProducts();

  if (countIndicator) {
    countIndicator.textContent = `Showing ${filtered.length} verified sustainable ${filtered.length === 1 ? 'material' : 'materials'}`;
  }

  if (filtered.length === 0) {
    gridContainer.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  gridContainer.innerHTML = filtered.map(product => {
    const isWishlisted = STATE.wishlist.has(product.id);
    const starCount = Math.floor(product.ecoRating);
    const starsHtml = '★'.repeat(starCount) + (product.ecoRating % 1 >= 0.5 ? '★' : '');

    return `
      <article class="product-card group flex flex-col bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:border-emerald-400">
        <!-- Card Header & Image Preview -->
        <div class="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
          <img 
            src="${product.image}" 
            alt="${product.name}" 
            loading="lazy" 
            onerror="this.onerror=null; this.src='hero-eco-lifestyle.jpg';"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
          <!-- Division Badge -->
          <div class="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-slate-900/80 backdrop-blur-md text-white shadow-sm">
              ${product.division.toUpperCase()}
            </span>
            ${product.ecoRating >= 4.9 ? `
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-500/90 backdrop-blur-md text-white shadow-sm">
                <svg class="w-3 h-3 text-emerald-100" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                TOP TIER
              </span>
            ` : ''}
          </div>

          <!-- Wishlist Button -->
          <button 
            onclick="toggleWishlist('${product.id}')" 
            aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
            class="touch-target-min absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-600 hover:text-emerald-600 shadow-sm transition transform active:scale-95"
          >
            <svg class="w-5 h-5 ${isWishlisted ? 'text-red-500 fill-current' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          <!-- Carbon Offset Metric Pill -->
          <div class="absolute bottom-3 left-3 z-10">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950/85 backdrop-blur-md text-emerald-300 border border-emerald-500/30">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              -${product.carbonOffset} kg CO2e / ${product.unit}
            </span>
          </div>
        </div>

        <!-- Card Content Body -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <!-- Star Eco Rating & Verified Label -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <span class="text-amber-500 text-sm tracking-tight">${starsHtml}</span>
                <span class="text-xs font-bold text-slate-700">${product.ecoRating.toFixed(1)}/5.0</span>
              </div>
              <span class="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                ${product.inStock ? 'In Stock' : 'Pre-Order'}
              </span>
            </div>

            <!-- Product Title -->
            <h3 class="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition leading-snug mb-1.5 line-clamp-1">
              ${product.name}
            </h3>

            <!-- Short Description -->
            <p class="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
              ${product.description}
            </p>

            <!-- Certification Chips -->
            <div class="flex flex-wrap gap-1 mb-4">
              ${product.certifications.map(cert => `
                <span class="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  ${cert}
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Price & Ergonomic Actions (Thumb-Target >= 48px) -->
          <div class="pt-3 border-t border-slate-100">
            <div class="flex items-baseline justify-between mb-3">
              <div>
                <span class="text-xl font-extrabold text-slate-900">₹${product.price.toFixed(2)}</span>
                <span class="text-xs font-medium text-slate-500">/ ${product.unit}</span>
              </div>
              <span class="text-[11px] text-slate-400 font-mono">ID: ${product.id}</span>
            </div>

            <!-- Action: Clean Ergonomic Full-Width Add to Cart -->
            <div class="mt-2">
              <button 
                onclick="addToCart('${product.id}', 1)"
                class="touch-target-min w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold transition shadow-sm hover:shadow flex items-center justify-center gap-2 active:scale-95"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// 8. Wishlist Toggle
function toggleWishlist(productId) {
  if (STATE.wishlist.has(productId)) {
    STATE.wishlist.delete(productId);
    showToast('Removed from saved project list', 'info');
  } else {
    STATE.wishlist.add(productId);
    showToast('Saved to your project specification list!', 'success');
  }
  saveWishlistState();
  renderProductGrid();
}

// 9. Quick Spec Sheet Modal (Progressive Disclosure)
function openSpecModal(productId) {
  const product = PRODUCTS_DATA.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('spec-modal');
  const container = document.getElementById('spec-modal-container');
  if (!modal || !container) return;

  container.innerHTML = `
    <div class="relative bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
      <!-- Close Button -->
      <button 
        onclick="closeSpecModal()" 
        aria-label="Close modal"
        class="touch-target-min absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      <!-- Modal Header -->
      <div class="flex items-start gap-4 mb-6">
        <img src="${product.image}" alt="${product.name}" class="w-20 h-20 rounded-xl object-cover border border-slate-200" />
        <div>
          <span class="text-xs font-bold text-emerald-700 tracking-wider uppercase">${product.divisionLabel}</span>
          <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">${product.name}</h2>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-lg font-black text-emerald-800">₹${product.price.toFixed(2)} / ${product.unit}</span>
            <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              Eco-Rating ${product.ecoRating}/5.0
            </span>
          </div>
        </div>
      </div>

      <!-- Overview Paragraph -->
      <p class="text-sm text-slate-600 mb-6 leading-relaxed">${product.description}</p>

      <!-- Technical Specifications Table (8px Grid) -->
      <div class="mb-6">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Environmental & Product Specifications</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span class="block text-[11px] font-medium text-slate-500">Dimensions & Package Spec</span>
            <span class="text-xs font-semibold text-slate-900">${product.specs.dimensions}</span>
          </div>
          <div>
            <span class="block text-[11px] font-medium text-slate-500">Plastic Diverted / Carbon Saved</span>
            <span class="text-xs font-semibold text-emerald-700">-${product.carbonOffset} kg CO2e / ${product.unit}</span>
          </div>
          <div>
            <span class="block text-[11px] font-medium text-slate-500">Durability & Thermal / Care</span>
            <span class="text-xs font-semibold text-slate-900">${product.specs.thermalR}</span>
          </div>
          <div>
            <span class="block text-[11px] font-medium text-slate-500">Material Purity & Safety</span>
            <span class="text-xs font-semibold text-slate-900">${product.specs.fireRating}</span>
          </div>
          <div>
            <span class="block text-[11px] font-medium text-slate-500">Toxin & Chemical Freedom</span>
            <span class="text-xs font-semibold text-emerald-700">${product.specs.vocContent}</span>
          </div>
          <div>
            <span class="block text-[11px] font-medium text-slate-500">Circular & Renewable Content</span>
            <span class="text-xs font-semibold text-slate-900">${product.specs.recycledContent}</span>
          </div>
        </div>
      </div>

      <!-- Zero Waste Impact & Sourcing -->
      <div class="mb-6 space-y-3">
        <div class="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
          <span class="block text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Zero-Waste Lifestyle Impact</span>
          <p class="text-xs font-medium text-emerald-900 mt-0.5">${product.specs.leedPoints}</p>
        </div>
        <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <span class="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">Artisan Sourcing & Provenance</span>
          <p class="text-xs text-slate-700 mt-0.5">${product.specs.origin}</p>
        </div>
      </div>

      <!-- Modal Footer Action -->
      <div class="flex items-center justify-between pt-4 border-t border-slate-200">
        <div class="flex items-center gap-2">
          <label for="modal-qty-${product.id}" class="text-xs font-semibold text-slate-700">Qty:</label>
          <input 
            type="number" 
            id="modal-qty-${product.id}" 
            min="1" 
            max="${product.stockQty}" 
            value="1" 
            class="w-16 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-center font-bold text-slate-800" 
          />
        </div>
        <button 
          onclick="handleModalAddToCart('${product.id}')"
          class="touch-target-min py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Add to Project Cart
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function handleModalAddToCart(productId) {
  const qtyInput = document.getElementById(`modal-qty-${productId}`);
  const qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
  addToCart(productId, qty);
  closeSpecModal();
}

function closeSpecModal() {
  const modal = document.getElementById('spec-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

// 10. Slide-out Cart Drawer Open/Close Controls
function openCartDrawer() {
  const backdrop = document.getElementById('cart-drawer-backdrop');
  const panel = document.getElementById('cart-drawer-panel');
  if (!backdrop || !panel) return;

  renderCartDrawer();
  backdrop.classList.remove('pointer-events-none', 'opacity-0');
  backdrop.classList.add('opacity-100');
  panel.classList.remove('translate-x-full');
  document.body.classList.add('overflow-hidden');
}

function closeCartDrawer() {
  const backdrop = document.getElementById('cart-drawer-backdrop');
  const panel = document.getElementById('cart-drawer-panel');
  if (!backdrop || !panel) return;

  backdrop.classList.add('opacity-0', 'pointer-events-none');
  backdrop.classList.remove('opacity-100');
  panel.classList.add('translate-x-full');
  document.body.classList.remove('overflow-hidden');
}

// 11. Promo Code Handling
function applyPromoCode(codeStr) {
  const code = (codeStr || '').trim().toUpperCase();
  const msgEl = document.getElementById('promo-status-msg');

  if (!code) {
    if (msgEl) {
      msgEl.textContent = 'Please enter a coupon code';
      msgEl.className = 'text-xs text-red-500 mt-1';
    }
    return;
  }

  if (code === 'FCRIT100' || code === 'FCRIT' || code === 'ZERO') {
    STATE.appliedPromo = { 
      code: 'FCRIT100', 
      type: 'zero', 
      value: 1.0, 
      label: '100% FCRIT VIP Waiver (₹0 Total)' 
    };
    if (msgEl) {
      msgEl.textContent = '✓ 100% FCRIT100 Coupon Applied! Total is ₹0.00';
      msgEl.className = 'text-xs text-emerald-600 font-bold mt-1';
    }
    showToast('FCRIT100 coupon applied! Bill is ₹0.00', 'success');
  } else if (code === 'GREENBUILD15') {
    STATE.appliedPromo = { code: 'GREENBUILD15', type: 'percentage', value: 0.15, label: '15% Sustainable Discount' };
    if (msgEl) {
      msgEl.textContent = '✓ 15% Green Builder discount applied!';
      msgEl.className = 'text-xs text-emerald-600 font-semibold mt-1';
    }
    showToast('Applied 15% Eco discount voucher!', 'success');
  } else if (code === 'ECOHERO') {
    STATE.appliedPromo = { code: 'ECOHERO', type: 'fixed', value: 25.00, label: '₹25 Environmental Credit' };
    if (msgEl) {
      msgEl.textContent = '✓ ₹25 Environmental Credit applied!';
      msgEl.className = 'text-xs text-emerald-600 font-semibold mt-1';
    }
    showToast('Applied ₹25 Environmental Credit!', 'success');
  } else {
    if (msgEl) {
      msgEl.textContent = 'Invalid promo code. Try "FCRIT100", "GREENBUILD15", or "ECOHERO"';
      msgEl.className = 'text-xs text-amber-600 mt-1';
    }
    return;
  }

  renderCartDrawer();
}

// 12. Strict Billing Validation Constraints
function validateBillingField(fieldId) {
  const el = document.getElementById(fieldId);
  const errEl = document.getElementById(fieldId + '-error');
  if (!el) return true;

  const val = (el.value || '').trim();
  let errorMsg = '';

  switch (fieldId) {
    case 'ship-name':
      if (!val) {
        errorMsg = 'Full Name is required.';
      } else if (/[0-9]/.test(val)) {
        errorMsg = 'Name must not contain numbers/integers.';
      } else if (!/^[a-zA-Z\s'. -]{2,}$/.test(val)) {
        errorMsg = 'Please enter a valid name using alphabets only.';
      }
      break;

    case 'ship-email':
      if (!val) {
        errorMsg = 'Email address is required.';
      } else if (!val.includes('@')) {
        errorMsg = "Email must contain '@' (e.g. alex@domain.com).";
      } else if (val.startsWith('@') || val.endsWith('@')) {
        errorMsg = "Email must have characters before and after '@'.";
      } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)) {
        errorMsg = 'Please enter a complete, valid email with a domain.';
      }
      break;

    case 'ship-phone':
      if (!val) {
        errorMsg = 'Phone number is required.';
      } else if (/[^0-9]/.test(val)) {
        errorMsg = 'Phone must not contain letters or special characters.';
      } else if (val.length !== 10) {
        errorMsg = 'Phone number must be exactly 10 digits.';
      }
      break;

    case 'ship-address':
      if (!val) {
        errorMsg = 'Delivery address is required.';
      } else if (val.length < 5) {
        errorMsg = 'Please provide a complete street address (minimum 5 characters).';
      }
      break;

    case 'ship-city':
      if (!val) {
        errorMsg = 'City is required.';
      } else if (/[0-9]/.test(val)) {
        errorMsg = 'City must not contain numbers/integers.';
      } else if (!/^[a-zA-Z\s'. -]{2,}$/.test(val)) {
        errorMsg = 'City must contain alphabets only.';
      }
      break;

    case 'ship-state':
      if (!val) {
        errorMsg = 'State is required.';
      } else if (/[0-9]/.test(val)) {
        errorMsg = 'State must not contain numbers/integers.';
      } else if (!/^[a-zA-Z\s'. -]{2,}$/.test(val)) {
        errorMsg = 'State must contain alphabets only.';
      }
      break;

    case 'ship-zip':
      if (!val) {
        errorMsg = 'PIN Code is required.';
      } else if (/[a-zA-Z]/.test(val)) {
        errorMsg = 'PIN Code must not contain alphabets/letters.';
      } else if (!/^\d{6}$/.test(val)) {
        errorMsg = 'PIN Code must be exactly 6 numeric digits (e.g. 400703).';
      }
      break;
  }

  if (errEl) {
    if (errorMsg) {
      errEl.textContent = errorMsg;
      errEl.classList.remove('hidden');
      el.classList.add('border-red-400', 'focus:ring-red-400');
      el.classList.remove('border-slate-300', 'focus:ring-emerald-500');
      return false;
    } else {
      errEl.textContent = '';
      errEl.classList.add('hidden');
      el.classList.remove('border-red-400', 'focus:ring-red-400');
      el.classList.add('border-slate-300', 'focus:ring-emerald-500');
      return true;
    }
  }

  return !errorMsg;
}

function validateAllBillingFields() {
  const fields = ['ship-name', 'ship-email', 'ship-phone', 'ship-address', 'ship-city', 'ship-state', 'ship-zip'];
  let firstInvalid = null;
  let allValid = true;

  fields.forEach(fid => {
    const isValid = validateBillingField(fid);
    if (!isValid) {
      allValid = false;
      if (!firstInvalid) firstInvalid = document.getElementById(fid);
    }
  });

  if (!allValid && firstInvalid) {
    firstInvalid.focus();
    showToast('Please fix the highlighted billing errors', 'warning');
  }

  return allValid;
}

// 13. Interactive Payment Method Switching (Pay by QR, GPay & Card)
function switchPaymentTab(method) {
  STATE.paymentMethod = method;
  
  const tabs = {
    qr: document.getElementById('pay-tab-qr'),
    gpay: document.getElementById('pay-tab-gpay'),
    card: document.getElementById('pay-tab-card')
  };
  const panels = {
    qr: document.getElementById('pay-panel-qr'),
    gpay: document.getElementById('pay-panel-gpay'),
    card: document.getElementById('pay-panel-card')
  };

  // Reset all tabs
  Object.keys(tabs).forEach(k => {
    if (!tabs[k]) return;
    tabs[k].className = 'p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white flex items-center justify-center gap-1.5 transition cursor-pointer font-bold shadow-2xs';
  });
  // Active tab
  if (tabs[method]) {
    tabs[method].className = 'p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-800 flex items-center justify-center gap-1.5 transition cursor-pointer font-bold shadow-2xs';
  }

  // Toggle corresponding panel
  Object.keys(panels).forEach(k => {
    if (!panels[k]) return;
    if (k === method) {
      panels[k].classList.remove('hidden');
    } else {
      panels[k].classList.add('hidden');
    }
  });
}

function setGpaySuffix(suffix) {
  const input = document.getElementById('pay-gpay-vpa');
  if (!input) return;
  const current = (input.value || '').split('@')[0] || 'student';
  input.value = current + suffix;
  const err = document.getElementById('pay-gpay-error');
  if (err) err.classList.add('hidden');
  showToast(`Selected GPay handle: ${suffix}`, 'info');
}

// 14. Multi-Step Checkout Flow
function openCheckoutModal() {
  if (STATE.cart.length === 0) {
    showToast('Your cart is empty. Please select products first.', 'warning');
    return;
  }

  closeCartDrawer();
  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  STATE.checkoutStep = 1;
  STATE.paymentMethod = 'qr';
  updateCheckoutStepDisplay();
  renderCheckoutSummary();

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

function updateCheckoutStepDisplay() {
  const step1 = document.getElementById('checkout-step-1');
  const step2 = document.getElementById('checkout-step-2');
  const step3 = document.getElementById('checkout-step-3');
  const progressBadge = document.getElementById('checkout-step-indicator');
  const nextBtn = document.getElementById('checkout-next-btn');
  const backBtn = document.getElementById('checkout-back-btn');
  const zeroBanner = document.getElementById('checkout-zero-banner');
  const totals = calculateCartTotals();

  [step1, step2, step3].forEach((el, index) => {
    if (!el) return;
    if (index + 1 === STATE.checkoutStep) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  if (progressBadge) {
    progressBadge.textContent = `Step ${STATE.checkoutStep} of 3`;
  }

  if (zeroBanner) {
    if (totals.grandTotal === 0 && STATE.checkoutStep === 3) {
      zeroBanner.classList.remove('hidden');
    } else {
      zeroBanner.classList.add('hidden');
    }
  }

  if (backBtn) {
    if (STATE.checkoutStep === 1) {
      backBtn.innerHTML = `<svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg><span>Back to Cart</span>`;
    } else if (STATE.checkoutStep === 2) {
      backBtn.innerHTML = `<svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg><span>Back to Details</span>`;
    } else if (STATE.checkoutStep === 3) {
      backBtn.innerHTML = `<svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg><span>Back to Shipping</span>`;
    }
  }

  if (nextBtn) {
    if (STATE.checkoutStep === 1) {
      nextBtn.innerHTML = `<span>Continue to Shipping</span><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;
    } else if (STATE.checkoutStep === 2) {
      nextBtn.innerHTML = `<span>Continue to Payment</span><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;
    } else if (STATE.checkoutStep === 3) {
      if (totals.grandTotal === 0) {
        nextBtn.innerHTML = `<span>Confirm & Place Free Order (₹0.00)</span><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
      } else {
        nextBtn.innerHTML = `<span>Authorize & Place Order (₹${totals.grandTotal.toFixed(2)})</span><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
      }
    }
  }
}

function renderCheckoutSummary() {
  const container = document.getElementById('checkout-order-summary');
  if (!container) return;

  const totals = calculateCartTotals();
  container.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between text-xs text-slate-600">
        <span>Cart Items (${totals.itemCount}):</span>
        <span class="font-semibold text-slate-900">₹${totals.subtotal.toFixed(2)}</span>
      </div>
      ${totals.discount > 0 ? `
        <div class="flex items-center justify-between text-xs text-emerald-700">
          <span>Eco Discount (${STATE.appliedPromo?.code}):</span>
          <span class="font-bold">-₹${totals.discount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="flex items-center justify-between text-xs text-slate-600">
        <span>Delivery (${SHIPPING_CONFIG[STATE.shippingTier]?.name}):</span>
        <span class="font-semibold text-slate-900">${totals.shippingCost === 0 ? 'FREE' : '₹' + totals.shippingCost.toFixed(2)}</span>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-600">
        <span>Est. Logistics & Environmental Tax (8.75%):</span>
        <span class="font-semibold text-slate-900">₹${totals.tax.toFixed(2)}</span>
      </div>
      <div class="pt-3 border-t border-slate-200 flex items-baseline justify-between">
        <span class="text-sm font-bold text-slate-900">Total Due:</span>
        <span class="text-xl font-extrabold ${totals.grandTotal === 0 ? 'text-emerald-700' : 'text-slate-900'}">₹${totals.grandTotal.toFixed(2)}</span>
      </div>
      <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span class="text-[11px] font-bold text-emerald-800">Verified Carbon Offset: ${totals.totalCarbonOffset.toFixed(1)} kg CO2e</span>
      </div>
    </div>
  `;
}

function handleCheckoutStepNext() {
  if (STATE.checkoutStep === 1) {
    // Validate Step 1 Inputs with Strict Constraints
    const isValid = validateAllBillingFields();
    if (!isValid) return;

    STATE.checkoutStep = 2;
    updateCheckoutStepDisplay();
    renderCheckoutSummary();
  } else if (STATE.checkoutStep === 2) {
    // Save selected shipping
    const selectedRadio = document.querySelector('input[name="shipping_tier"]:checked');
    if (selectedRadio) {
      STATE.shippingTier = selectedRadio.value;
    }
    STATE.checkoutStep = 3;
    updateCheckoutStepDisplay();
    renderCheckoutSummary();
  } else if (STATE.checkoutStep === 3) {
    // Validate Payment (if not zero)
    const totals = calculateCartTotals();
    if (totals.grandTotal > 0) {
      if (STATE.paymentMethod === 'gpay') {
        const vpa = document.getElementById('pay-gpay-vpa')?.value.trim();
        const err = document.getElementById('pay-gpay-error');
        if (!vpa || !vpa.includes('@')) {
          if (err) {
            err.textContent = "Please enter a valid GPay UPI ID containing '@' (e.g. user@oksbi)";
            err.classList.remove('hidden');
          }
          showToast('Please enter a valid GPay UPI ID', 'warning');
          return;
        } else {
          if (err) err.classList.add('hidden');
        }
      } else if (STATE.paymentMethod === 'card') {
        const cardNum = document.getElementById('pay-card')?.value.replace(/\s+/g, '');
        if (!cardNum || cardNum.length < 12) {
          showToast('Please enter a valid 16-digit card number', 'warning');
          return;
        }
      }
    }

    // Submit Order
    completeOrderPlacement();
  }
}

function handleCheckoutStepBack() {
  if (STATE.checkoutStep > 1) {
    STATE.checkoutStep--;
    updateCheckoutStepDisplay();
    renderCheckoutSummary();
  } else {
    // If on Step 1 (Billing Destination), Back closes checkout and returns to cart drawer
    closeCheckoutModal();
    openCartDrawer();
  }
}

function completeOrderPlacement() {
  const totals = calculateCartTotals();
  const orderId = 'ECO-' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date();
  
  // Calculate delivery date (+5 days)
  const deliveryDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  const paymentMethodLabel = totals.grandTotal === 0 && STATE.appliedPromo?.code === 'FCRIT100'
    ? '100% FCRIT100 Waiver (₹0.00)'
    : (STATE.paymentMethod === 'qr' ? 'UPI Pay by QR Code' : (STATE.paymentMethod === 'gpay' ? 'Google Pay (UPI)' : 'Credit/Debit Card'));

  const orderRecord = {
    orderId,
    timestamp: now.toISOString(),
    items: [...STATE.cart],
    totals,
    shippingTier: STATE.shippingTier,
    paymentMethod: paymentMethodLabel,
    shippingName: document.getElementById('ship-name')?.value || 'Valued Builder',
    shippingAddress: `${document.getElementById('ship-address')?.value}, ${document.getElementById('ship-city')?.value}`,
    deliveryDate
  };

  STATE.completedOrders.unshift(orderRecord);
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(STATE.completedOrders));
  } catch (e) {
    console.warn(e);
  }

  // Clear Cart
  STATE.cart = [];
  STATE.appliedPromo = null;
  saveCartState();
  updateCartCounters();
  renderCartDrawer();

  closeCheckoutModal();
  showOrderConfirmationModal(orderRecord);
}

// 13. Order Confirmation Modal
function showOrderConfirmationModal(order) {
  const modal = document.getElementById('order-confirmation-modal');
  const container = document.getElementById('order-confirmation-content');
  if (!modal || !container) return;

  container.innerHTML = `
    <!-- Top Eco Badge -->
    <div class="text-center mb-6">
      <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
        <svg class="w-8 h-8 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
      </div>
      <span class="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
        Order Confirmed & Carbon Verified
      </span>
      <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 font-heading">Thank you for building green!</h2>
      <p class="text-xs text-slate-500 mt-1">Order Ref: <span class="font-mono font-bold text-slate-800">${order.orderId}</span></p>
    </div>

    <!-- Carbon Offset Hero Callout -->
    <div class="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-2xl p-5 mb-6 shadow-md border border-emerald-700 flex items-center justify-between">
      <div>
        <span class="text-xs uppercase font-bold text-emerald-300 tracking-wider">Environmental Impact Diverted</span>
        <h3 class="text-2xl font-black mt-0.5">${order.totals.totalCarbonOffset.toFixed(1)} kg CO2e</h3>
        <p class="text-[11px] text-emerald-200/80 mt-1">Directly offsetting embodied carbon compared to traditional high-emission construction.</p>
      </div>
      <div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
        <svg class="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
    </div>

    <!-- Logistics Tracking Simulation -->
    <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6">
      <div class="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
        <span>Delivery Status</span>
        <span class="text-emerald-700">Estimated Arrival: ${order.deliveryDate}</span>
      </div>
      <div class="relative flex items-center justify-between mt-4 mb-2">
        <div class="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-slate-200 -z-0"></div>
        <div class="relative z-10 flex flex-col items-center">
          <div class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
          <span class="text-[10px] font-semibold text-slate-700 mt-1">Processed</span>
        </div>
        <div class="relative z-10 flex flex-col items-center">
          <div class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
          <span class="text-[10px] font-semibold text-slate-700 mt-1">FSC Inspected</span>
        </div>
        <div class="relative z-10 flex flex-col items-center">
          <div class="w-6 h-6 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[10px] font-bold animate-pulse">●</div>
          <span class="text-[10px] font-semibold text-slate-500 mt-1">Low-Emission Transit</span>
        </div>
        <div class="relative z-10 flex flex-col items-center">
          <div class="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">4</div>
          <span class="text-[10px] font-semibold text-slate-400 mt-1">On Site Delivery</span>
        </div>
      </div>
    </div>

    <!-- Itemized List Summary -->
    <div class="border border-slate-200 rounded-xl p-4 mb-6">
      <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Itemized Circular Spec Manifest</h4>
      <div class="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
        ${order.items.map(item => `
          <div class="py-2.5 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-800">${item.qty}x</span>
              <span class="text-slate-700 truncate max-w-[200px]">${item.name}</span>
            </div>
            <span class="font-semibold text-slate-900">₹${(item.price * item.qty).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div class="pt-3 mt-3 border-t border-slate-200 space-y-1.5">
        <div class="flex justify-between text-xs text-slate-600">
          <span>Recipient / Destination:</span>
          <span class="font-bold text-slate-800">${order.shippingName} (${order.shippingAddress})</span>
        </div>
        <div class="flex justify-between text-xs text-slate-600">
          <span>Payment Gateway:</span>
          <span class="font-bold text-emerald-800">${order.paymentMethod}</span>
        </div>
        <div class="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100">
          <span>Total Paid:</span>
          <span class="text-emerald-700 text-base">₹${order.totals.grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row gap-3">
      <button 
        onclick="window.print()" 
        class="touch-target-min flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition flex items-center justify-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        Print Specification Receipt
      </button>
      <button 
        onclick="closeOrderConfirmationModal()" 
        class="touch-target-min flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
      >
        Continue Sourcing Materials
      </button>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeOrderConfirmationModal() {
  const modal = document.getElementById('order-confirmation-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

// 14. Interactive Project Carbon & LEED Impact Calculator
function calculateProjectImpact() {
  const areaInput = document.getElementById('calc-area');
  const typeSelect = document.getElementById('calc-project-type');
  const resultCarbon = document.getElementById('calc-res-carbon');
  const resultTrees = document.getElementById('calc-res-trees');
  const resultLeed = document.getElementById('calc-res-leed');

  if (!areaInput || !typeSelect || !resultCarbon) return;

  const sqft = parseFloat(areaInput.value) || 0;
  const factor = parseFloat(typeSelect.value) || 3.2; // kg CO2e saved per sq.ft

  const totalCo2Saved = sqft * factor;
  const treesEquiv = Math.round(totalCo2Saved / 21.77); // 1 tree seedling stores approx 21.77 kg CO2 over 10 yrs
  const leedPoints = sqft >= 5000 ? 5 : sqft >= 2000 ? 4 : sqft >= 500 ? 2 : 1;

  resultCarbon.textContent = `${totalCo2Saved.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg`;
  if (resultTrees) resultTrees.textContent = `${treesEquiv.toLocaleString('en-US')} Trees`;
  if (resultLeed) resultLeed.textContent = `+${leedPoints} Points`;
}

// 15. Toast Notification System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const colors = {
    success: 'bg-slate-900 text-white border-emerald-500',
    info: 'bg-slate-900 text-white border-blue-500',
    warning: 'bg-amber-900 text-amber-50 border-amber-500'
  };

  toast.className = `toast-enter flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold shadow-xl transition-all duration-300 ${colors[type] || colors.success}`;
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : type === 'info' ? 'bg-blue-400' : 'bg-amber-400'} flex-shrink-0 animate-pulse"></span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// 16. Event Listeners & Initialization
function initializeEventListeners() {
  // Search Input with debounced filtering
  const searchInput = document.getElementById('catalog-search-input');
  const heroSearchInput = document.getElementById('hero-search-input');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      STATE.searchQuery = e.target.value;
      renderProductGrid();
    });
  }

  if (heroSearchInput) {
    heroSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        STATE.searchQuery = heroSearchInput.value;
        if (searchInput) searchInput.value = STATE.searchQuery;
        document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth' });
        renderProductGrid();
      }
    });
  }

  // Division Filter Chips (Category Bar)
  document.querySelectorAll('[data-division-filter]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-division-filter]').forEach(b => {
        b.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
        b.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
      });

      button.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
      button.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');

      STATE.activeDivision = button.getAttribute('data-division-filter');
      renderProductGrid();
    });
  });

  // Price Range Slider
  const priceSlider = document.getElementById('filter-price-slider');
  const priceDisplay = document.getElementById('filter-price-val');
  if (priceSlider && priceDisplay) {
    priceSlider.addEventListener('input', (e) => {
      STATE.maxPrice = parseFloat(e.target.value);
      priceDisplay.textContent = `$${STATE.maxPrice}`;
      renderProductGrid();
    });
  }

  // In Stock Toggle
  const stockToggle = document.getElementById('filter-stock-toggle');
  if (stockToggle) {
    stockToggle.addEventListener('change', (e) => {
      STATE.inStockOnly = e.target.checked;
      renderProductGrid();
    });
  }

  // Sort Dropdown
  const sortSelect = document.getElementById('catalog-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      STATE.sortBy = e.target.value;
      renderProductGrid();
    });
  }

  // Certification Checkboxes
  document.querySelectorAll('input[name="cert_filter"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        STATE.activeCertifications.add(checkbox.value);
      } else {
        STATE.activeCertifications.delete(checkbox.value);
      }
      renderProductGrid();
    });
  });

  // Eco-Rating Filter Radios
  document.querySelectorAll('input[name="rating_filter"]').forEach(radio => {
    radio.addEventListener('change', () => {
      STATE.minEcoRating = parseFloat(radio.value) || 0;
      renderProductGrid();
    });
  });

  // Reset Filters Button
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      STATE.activeDivision = 'all';
      STATE.searchQuery = '';
      STATE.maxPrice = 200;
      STATE.minEcoRating = 0;
      STATE.activeCertifications.clear();
      STATE.inStockOnly = false;
      STATE.sortBy = 'featured';

      if (searchInput) searchInput.value = '';
      if (priceSlider) priceSlider.value = 200;
      if (priceDisplay) priceDisplay.textContent = '₹200';
      if (stockToggle) stockToggle.checked = false;
      if (sortSelect) sortSelect.value = 'featured';
      document.querySelectorAll('input[name="cert_filter"]').forEach(c => c.checked = false);
      const defaultRatingRadio = document.querySelector('input[name="rating_filter"][value="0"]');
      if (defaultRatingRadio) defaultRatingRadio.checked = true;

      document.querySelectorAll('[data-division-filter]').forEach(b => {
        b.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
        b.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
      });
      document.querySelector('[data-division-filter="all"]')?.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');

      renderProductGrid();
      showToast('Filters cleared', 'info');
    });
  }

  // Calculator Inputs
  const calcArea = document.getElementById('calc-area');
  const calcType = document.getElementById('calc-project-type');
  if (calcArea) calcArea.addEventListener('input', calculateProjectImpact);
  if (calcType) calcType.addEventListener('change', calculateProjectImpact);

  // Keyboard navigation & modal dismissals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSpecModal();
      closeCartDrawer();
      closeCheckoutModal();
      closeOrderConfirmationModal();
    }
  });

  // Initial render calls
  renderProductGrid();
  updateCartCounters();
  calculateProjectImpact();
}

// 17. Catalog Reset & Layout Controls
function resetCatalogView() {
  STATE.activeDivision = 'all';
  STATE.searchQuery = '';
  STATE.sortBy = 'featured';
  const sortSelect = document.getElementById('catalog-sort-select');
  if (sortSelect) sortSelect.value = 'featured';
  document.querySelectorAll('[data-division-filter]').forEach(b => {
    b.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
    b.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
  });
  document.querySelector('[data-division-filter="all"]')?.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');
  renderProductGrid();
  showToast('Showing all sustainable materials', 'info');
}
window.resetCatalogView = resetCatalogView;
window.validateBillingField = validateBillingField;
window.switchPaymentTab = switchPaymentTab;
window.setGpaySuffix = setGpaySuffix;
window.handleCheckoutStepBack = handleCheckoutStepBack;
window.handleCheckoutStepNext = handleCheckoutStepNext;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;

function toggleFilterSidebar() {
  // Graceful no-op retained for backwards compatibility
}

// DOM Ready Bootstrapper
document.addEventListener('DOMContentLoaded', () => {
  loadStoredState();
  initializeEventListeners();
});
