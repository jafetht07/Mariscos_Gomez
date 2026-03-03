// ============================================================
// products.js — CRUD de productos, búsqueda y paginación
// ============================================================

function saveProducts() {
    localStorage.setItem('mariscos_products', JSON.stringify(products));
    localStorage.setItem('mariscos_next_id', nextProductId.toString());
    updateStorageMonitor();
}

// ============================================================
// displayProducts
// Renderiza las tarjetas del inventario.
// Si el usuario es Tuko, muestra precio de costo y margen.
// Para otros usuarios, solo muestra precio de venta.
// ============================================================
function displayProducts() {
    const grid       = document.getElementById('productGrid');
    const searchTerm = document.getElementById('searchProducts').value.toLowerCase();
    const isTuko     = currentUser === 'Tuko';

    let filteredProducts = products;
    if (searchTerm) {
        filteredProducts = products.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm)
        );
    }

    const totalPages  = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex  = (currentProductPage - 1) * itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

    grid.innerHTML = '';

    if (pageProducts.length === 0) {
        grid.innerHTML = '<div class="product-card"><h3>Sin productos</h3><p>Agrega productos usando la sección "Agregar Producto".</p></div>';
        document.getElementById('productsPagination').style.display = 'none';
        return;
    }

    pageProducts.forEach(product => {
        const stockClass = product.stock < 10 ? 'stock-low' : 'stock-ok';
        const stockWarn  = product.stock < 10;
        const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Calcular margen de ganancia si existe precio de costo
        let costHTML   = '';
        let marginHTML = '';
        if (isTuko && product.costPrice) {
            const margin    = product.price - product.costPrice;
            const marginPct = ((margin / product.costPrice) * 100).toFixed(1);
            const marginColor = margin >= 0 ? '#4ade80' : '#fb7185';
            costHTML   = `<div class="product-info" style="color:var(--text-muted);">Costo: ₡${fmt(product.costPrice)} / ${product.unit}</div>`;
            marginHTML = `<div class="product-info" style="color:${marginColor};font-weight:600;">
                            Margen: ₡${fmt(margin)} (${marginPct}%)
                          </div>`;
        }

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-name">${product.name}</div>
            <div class="product-info" style="color:var(--text-muted);font-size:0.73rem;text-transform:uppercase;letter-spacing:0.05em;">${product.category}</div>
            <div class="product-info" style="color:var(--amber-light);font-weight:600;margin-top:6px;">
                Venta: ₡${fmt(product.price)} / ${product.unit}
            </div>
            ${costHTML}
            ${marginHTML}
            <div class="product-info ${stockClass}" style="margin-top:4px;">
                ${stockWarn ? 'Stock bajo' : 'Stock'}: ${product.stock} ${product.unit}
            </div>
            <div class="action-buttons" style="margin-top:12px;">
                <button class="btn btn-sm btn-info" onclick="editProduct(${product.id})">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">Eliminar</button>
            </div>
        `;
        grid.appendChild(card);
    });

    if (totalPages > 1) {
        document.getElementById('productsPagination').style.display = 'flex';
        document.getElementById('productPageInfo').textContent = `Página ${currentProductPage} de ${totalPages}`;
        document.querySelector('#productsPagination button:first-child').disabled = currentProductPage === 1;
        document.querySelector('#productsPagination button:last-child').disabled  = currentProductPage === totalPages;
    } else {
        document.getElementById('productsPagination').style.display = 'none';
    }
}

function changeProductPage(direction) {
    const searchTerm = document.getElementById('searchProducts').value.toLowerCase();
    let filtered = products;
    if (searchTerm) filtered = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm) || p.category.toLowerCase().includes(searchTerm)
    );
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    currentProductPage = Math.max(1, Math.min(currentProductPage + direction, totalPages));
    displayProducts();
}

function searchProducts() {
    currentProductPage = 1;
    displayProducts();
}

// ============================================================
// handleAddProduct
// Guarda nombre, categoría, precio de venta, precio de costo,
// stock y unidad. El precio de costo es opcional.
// ============================================================
function handleAddProduct(event) {
    event.preventDefault();

    const name      = document.getElementById('productName').value.trim();
    const category  = document.getElementById('productCategory').value;
    const price     = parseFloat(document.getElementById('productPrice').value);
    const costPrice = parseFloat(document.getElementById('productCostPrice').value) || 0;
    const stock     = parseInt(document.getElementById('productStock').value);
    const unit      = document.getElementById('productUnit').value;

    if (!name || !category || !price || !stock || !unit) {
        showAlert('Por favor completa todos los campos obligatorios', 'danger');
        return;
    }
    if (price <= 0) {
        showAlert('El precio de venta debe ser mayor a 0', 'danger');
        return;
    }
    if (costPrice > price) {
        showAlert('El precio de costo no puede ser mayor al precio de venta', 'warning');
        return;
    }
    if (products.length >= 1000) {
        showAlert('Límite de productos alcanzado. Usa la sección de Mantenimiento.', 'warning');
        return;
    }

    products.push({
        id: nextProductId++,
        name,
        category,
        price,       // precio de venta (visible para todos)
        costPrice,   // precio de costo (visible solo para Tuko)
        stock,
        unit,
        createdAt: new Date().toISOString()
    });

    saveProducts();
    document.getElementById('addProductForm').reset();
    showAlert('Producto agregado exitosamente', 'success');

    if (typeof updateDashboard === 'function') updateDashboard();
    navigateTo('inventory');
}

// ============================================================
// editProduct
// Modal para editar precio de venta, precio de costo y stock.
// Solo Tuko puede ver/editar el precio de costo.
// ============================================================
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const isTuko = currentUser === 'Tuko';
    const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Construir fila de precio de costo solo para Tuko
    const costRow = isTuko ? `
        <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-size:0.78rem;color:#64748b;text-transform:uppercase;">
                Precio de Costo (₡)
            </label>
            <input type="number" id="editCostPrice" step="0.01" min="0"
                value="${product.costPrice || 0}"
                style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;">
        </div>` : '';

    const overlay = document.createElement('div');
    overlay.id = 'editProductOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;justify-content:center;align-items:center;z-index:10000;';

    overlay.innerHTML = `
        <div style="background:#fff;padding:28px;border-radius:12px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;color:#1e293b;font-size:1.1rem;">Editar Producto</h3>
                <button data-close style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:5px 11px;cursor:pointer;color:#64748b;">Cerrar</button>
            </div>

            <div style="background:#f8fafc;border-radius:8px;padding:12px 14px;margin-bottom:18px;border-left:3px solid #0ea5e9;">
                <div style="font-weight:600;color:#1e293b;">${product.name}</div>
                <div style="font-size:0.82rem;color:#64748b;">${product.category} · ${product.unit}</div>
            </div>

            <div class="form-group">
                <label style="display:block;margin-bottom:6px;font-size:0.78rem;color:#64748b;text-transform:uppercase;">
                    Precio de Venta (₡)
                </label>
                <input type="number" id="editSalePrice" step="0.01" min="0"
                    value="${product.price}"
                    style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;margin-bottom:14px;">
            </div>

            ${costRow}

            <div class="form-group" style="margin-top:${isTuko ? '14px' : '0'};">
                <label style="display:block;margin-bottom:6px;font-size:0.78rem;color:#64748b;text-transform:uppercase;">
                    Stock actual
                </label>
                <input type="number" id="editStock" min="0"
                    value="${product.stock}"
                    style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:0.9rem;">
            </div>

            <div style="display:flex;gap:10px;margin-top:20px;">
                <button data-save style="flex:1;background:linear-gradient(135deg,#0369a1,#0ea5e9);border:none;color:#fff;font-weight:700;padding:10px;border-radius:8px;cursor:pointer;">
                    Guardar Cambios
                </button>
                <button data-close style="flex:1;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:10px;border-radius:8px;cursor:pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
        const el = document.getElementById('editProductOverlay');
        if (el) el.remove();
    };

    overlay.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModal));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    overlay.querySelector('[data-save]').addEventListener('click', () => {
        const newPrice     = parseFloat(document.getElementById('editSalePrice').value);
        const newCostPrice = isTuko ? parseFloat(document.getElementById('editCostPrice').value) || 0 : product.costPrice || 0;
        const newStock     = parseInt(document.getElementById('editStock').value);

        if (!newPrice || newPrice <= 0) { showAlert('El precio de venta debe ser mayor a 0', 'danger'); return; }
        if (newCostPrice > newPrice)    { showAlert('El precio de costo no puede ser mayor al precio de venta', 'warning'); return; }
        if (isNaN(newStock) || newStock < 0) { showAlert('El stock no puede ser negativo', 'danger'); return; }

        product.price     = newPrice;
        product.costPrice = newCostPrice;
        product.stock     = newStock;
        product.updatedAt = new Date().toISOString();

        saveProducts();
        closeModal();
        displayProducts();
        if (typeof updateDashboard === 'function') updateDashboard();
        showAlert('Producto actualizado exitosamente', 'success');
    });
}

function deleteProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    if (confirm(`¿Eliminar "${product.name}"?\n\nEsta acción no se puede deshacer.`)) {
        products = products.filter(p => p.id !== id);
        saveProducts();
        displayProducts();
        if (typeof updateDashboard === 'function') updateDashboard();
        showAlert('Producto eliminado exitosamente', 'success');
    }
}