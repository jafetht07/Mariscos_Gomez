// ============================================================
// invoice.js — Facturación, generación de PDF y créditos
// ============================================================

function saveInvoices() {
    localStorage.setItem('mariscos_invoices', JSON.stringify(invoiceHistory));
    updateStorageMonitor();
}

function updateInvoiceProductSelect() {
    const select = document.getElementById('invoiceProduct');
    select.innerHTML = '<option value="">Seleccionar producto</option>';
    products.forEach(product => {
        if (product.stock > 0) {
            const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} - ₡${fmt(product.price)} / ${product.unit} (Stock: ${product.stock})`;
            select.appendChild(option);
        }
    });

    const costToggle = document.getElementById('useCostPriceRow');
    if (costToggle) {
        costToggle.style.display = currentUser === 'Tuko' ? 'block' : 'none';
    }
}

function addToInvoice() {
    const productId = parseInt(document.getElementById('invoiceProduct').value);
    const quantity  = parseFloat(document.getElementById('invoiceQuantity').value);

    if (!productId || !quantity || quantity <= 0) {
        showAlert('Por favor selecciona un producto y cantidad válida', 'danger');
        return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (quantity > product.stock) {
        showAlert(`Stock insuficiente. Disponible: ${product.stock} ${product.unit}`, 'danger');
        return;
    }

    const useCostPrice = currentUser === 'Tuko' &&
        document.getElementById('useCostPrice') &&
        document.getElementById('useCostPrice').checked;

    let priceToUse = product.price;
    let priceLabel = 'venta';

    if (useCostPrice) {
        if (!product.costPrice || product.costPrice <= 0) {
            showAlert(`"${product.name}" no tiene precio de costo. Se usará precio de venta.`, 'warning');
        } else {
            priceToUse = product.costPrice;
            priceLabel = 'costo';
        }
    }

    const existing = invoiceItems.find(item => item.productId === productId);
    if (existing) {
        if (existing.quantity + quantity > product.stock) {
            showAlert(`Stock insuficiente. Disponible: ${product.stock} ${product.unit}`, 'danger');
            return;
        }
        existing.quantity += quantity;
        existing.total     = existing.quantity * existing.price;
    } else {
        invoiceItems.push({
            productId,
            name:      product.name,
            price:     priceToUse,
            priceType: priceLabel,
            quantity,
            unit:      product.unit,
            total:     priceToUse * quantity
        });
    }

    document.getElementById('invoiceProduct').value  = '';
    document.getElementById('invoiceQuantity').value = '';
    updateInvoiceDisplay();
}

// ============================================================
// updateInvoiceDisplay
// Renderiza los ítems y calcula subtotal, descuento y total
// final en tiempo real mientras el usuario edita el descuento.
// ============================================================
function updateInvoiceDisplay() {
    const itemsContainer = document.getElementById('invoiceItems');
    const fmt    = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isTuko = currentUser === 'Tuko';

    itemsContainer.innerHTML = '';
    let subtotal = 0;

    invoiceItems.forEach((item, index) => {
        const costBadge = (isTuko && item.priceType === 'costo')
            ? '<span style="background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);border-radius:4px;padding:1px 6px;font-size:0.68rem;font-weight:700;margin-left:6px;">COSTO</span>'
            : '';

        const div = document.createElement('div');
        div.className = 'invoice-item';
        div.innerHTML = `
            <div>
                <strong>${item.name}</strong>${costBadge}<br>
                <span style="font-size:0.82rem;color:#8ba3cc;">
                    ${item.quantity} ${item.unit} × ₡${fmt(item.price)}
                </span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:600;">₡${fmt(item.total)}</span>
                <button class="btn btn-danger btn-sm" onclick="removeFromInvoice(${index})">Quitar</button>
            </div>
        `;
        itemsContainer.appendChild(div);
        subtotal += item.total;
    });

    // Calcular descuento y total final
    const discountInput = document.getElementById('invoiceDiscount');
    const discount      = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
    const finalTotal    = Math.max(0, subtotal - discount);

    // Actualizar resumen visual
    const subtotalEl = document.getElementById('invoiceSubtotal');
    const discountEl = document.getElementById('invoiceDiscountDisplay');
    const totalEl    = document.getElementById('invoiceTotal');

    if (subtotalEl) subtotalEl.textContent = `Subtotal: ₡${fmt(subtotal)}`;
    if (discountEl) discountEl.style.display = discount > 0 ? 'block' : 'none';
    if (discountEl) discountEl.textContent = `Descuento: -₡${fmt(discount)}`;
    if (totalEl)    totalEl.textContent    = `Total: ₡${fmt(finalTotal)}`;
}

function removeFromInvoice(index) {
    if (confirm('¿Quitar este producto de la factura?')) {
        invoiceItems.splice(index, 1);
        updateInvoiceDisplay();
    }
}

function clearInvoice() {
    if (invoiceItems.length > 0 && !confirm('¿Limpiar toda la factura?')) return;
    invoiceItems = [];
    document.getElementById('clientName').value    = '';
    document.getElementById('clientPhone').value   = '';
    document.getElementById('clientAddress').value = '';
    const discountInput = document.getElementById('invoiceDiscount');
    if (discountInput) discountInput.value = '';
    updateInvoiceDisplay();
}

function toggleCreditOptions() {
    const checkbox = document.getElementById('isCreditSale');
    const options  = document.getElementById('creditOptions');
    options.style.display = checkbox.checked ? 'block' : 'none';
}

// ============================================================
// generateInvoiceNumber
// Usa timestamp en milisegundos — nunca colisiona aunque se
// borren facturas previas o varios dispositivos generen al
// mismo tiempo.
// ============================================================
function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const ts   = Date.now();
    return `FAC-${year}-T${ts}`;
}

function generateInvoicePDF() {
    if (invoiceItems.length === 0) {
        showAlert('No hay productos en la factura', 'danger');
        return;
    }
    if (invoiceHistory.length >= maintenanceConfig.maxInvoices) {
        if (confirm('Se ha alcanzado el límite de facturas. ¿Desea continuar?')) {
            showAlert('Sistema cerca del límite. Visite Mantenimiento.', 'warning');
        } else return;
    }

    const clientName    = document.getElementById('clientName').value    || 'Cliente';
    const clientPhone   = document.getElementById('clientPhone').value   || 'N/A';
    const clientAddress = document.getElementById('clientAddress').value || 'N/A';
    const isCreditSale  = document.getElementById('isCreditSale').checked;

    // Leer descuento ingresado (0 si está vacío)
    const discountInput = document.getElementById('invoiceDiscount');
    const discount      = discountInput ? (parseFloat(discountInput.value) || 0) : 0;

    const invoiceNumber = generateInvoiceNumber();
    const now           = new Date();

    // Subtotal antes del descuento
    const subtotal   = invoiceItems.reduce((sum, item) => sum + item.total, 0);
    const finalTotal = Math.max(0, subtotal - discount);

    if (discount > subtotal) {
        showAlert('El descuento no puede ser mayor al subtotal de la factura', 'danger');
        return;
    }

    // Costo total para reportes internos
    const totalCost = invoiceItems.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        return sum + ((product?.costPrice || 0) * item.quantity);
    }, 0);

    // Descontar stock
    invoiceItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) product.stock -= item.quantity;
    });
    saveProducts();

    const invoice = {
        number:       invoiceNumber,
        date:         now.toLocaleDateString('es-CR'),
        time:         now.toLocaleTimeString('es-CR'),
        fullDateTime: now.toISOString(),
        client:       { name: clientName, phone: clientPhone, address: clientAddress },
        items:        [...invoiceItems],
        subtotal,               // total antes del descuento
        discount,               // monto del descuento en colones
        total:        finalTotal, // total final que pagó el cliente
        totalCost,
        user:         currentUser,
        isCredit:     isCreditSale,
        hasCostItems: invoiceItems.some(i => i.priceType === 'costo')
    };

    invoiceHistory.push(invoice);
    saveInvoices();

    // Registrar crédito si aplica — usa el total final con descuento
    if (isCreditSale) {
        const creditDays  = parseInt(document.getElementById('creditDays').value);
        const creditNotes = document.getElementById('creditNotes').value || '';
        const dueDate     = new Date(now);
        dueDate.setDate(dueDate.getDate() + creditDays);

        creditSales.push({
            id:          nextCreditId++,
            invoiceNumber,
            client:      { name: clientName, phone: clientPhone, address: clientAddress },
            totalAmount: finalTotal, // el crédito es por el total ya con descuento
            paidAmount:  0,
            balance:     finalTotal,
            saleDate:    now.toISOString(),
            dueDate:     dueDate.toISOString(),
            status:      'pending',
            notes:       creditNotes,
            payments:    [],
            createdBy:   currentUser
        });
        saveCredits();
        showAlert('Venta a crédito registrada', 'success');
    }

    // Generar PDF con descuento visible
    const doc = generateInvoiceVoucherPDF(invoice);

    if (isCreditSale) {
        const creditDays = parseInt(document.getElementById('creditDays').value);
        const dueDate    = new Date(now);
        dueDate.setDate(dueDate.getDate() + creditDays);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('*** VENTA A CREDITO ***', 40, 190, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`Vence: ${dueDate.toLocaleDateString('es-CR')}`, 40, 196, { align: 'center' });
    }

    doc.save(`voucher_${clientName.replace(/\s+/g, '_')}_${invoiceNumber}.pdf`);
    showAlert('Factura PDF generada exitosamente', 'success');

    document.getElementById('isCreditSale').checked = false;
    if (document.getElementById('useCostPrice')) {
        document.getElementById('useCostPrice').checked = false;
    }
    toggleCreditOptions();
    clearInvoice();
    updateInvoiceProductSelect();
    if (typeof updateDashboard === 'function') updateDashboard();

    if (maintenanceConfig.autoCleanupEnabled && getStorageUsage() > 4096) {
        setTimeout(() => {
            if (confirm('Almacenamiento casi lleno. ¿Realizar limpieza automática?')) optimizeStorage();
        }, 2000);
    }
}

// ============================================================
// generateInvoiceVoucherPDF
// Genera el voucher PDF formato 80mm.
// Si hay descuento lo muestra como línea separada antes del total.
// ============================================================
function generateInvoiceVoucherPDF(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let y = 10;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Mariscos Gomez', 40, y, { align: 'center' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Inventario y Facturacion', 40, y, { align: 'center' });
    y += 8;

    doc.setLineWidth(0.3);
    doc.line(5, y, 75, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(`Factura: ${invoice.number}`, 5, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.text(`Fecha: ${invoice.date}`, 5, y);
    y += 4;
    doc.text(`Hora:  ${invoice.time || 'N/A'}`, 5, y);
    y += 4;
    doc.text(`Atendido por: ${invoice.user || 'N/A'}`, 5, y);
    y += 6;

    doc.line(5, y, 75, y);
    y += 5;

    doc.setFont(undefined, 'bold');
    doc.text('CLIENTE', 5, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.text(`Nombre: ${invoice.client.name}`, 5, y);
    y += 4;
    doc.text(`Tel: ${invoice.client.phone}`, 5, y);
    y += 4;
    doc.text(`Dir: ${invoice.client.address}`, 5, y);
    y += 6;

    doc.line(5, y, 75, y);
    y += 5;

    doc.setFont(undefined, 'bold');
    doc.text('PRODUCTO', 5, y);
    doc.text('CANT',   45, y);
    doc.text('PRECIO', 55, y);
    doc.text('TOTAL',  68, y);
    y += 4;
    doc.line(5, y, 75, y);
    y += 4;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    invoice.items.forEach(item => {
        const nombre = item.name.length > 18 ? item.name.substring(0, 18) + '.' : item.name;
        doc.text(nombre,                5,  y);
        doc.text(String(item.quantity), 45, y);
        doc.text(fmt(item.price),       53, y);
        doc.text(fmt(item.total),       66, y);
        y += 5;
    });

    doc.line(5, y, 75, y);
    y += 5;

    // Mostrar subtotal si hay descuento
    if (invoice.discount && invoice.discount > 0) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text('Subtotal:', 5, y);
        doc.text(`C${fmt(invoice.subtotal)}`, 75, y, { align: 'right' });
        y += 5;

        doc.setFont(undefined, 'bold');
        doc.text('Descuento:', 5, y);
        doc.text(`-C${fmt(invoice.discount)}`, 75, y, { align: 'right' });
        y += 5;

        doc.setLineWidth(0.3);
        doc.line(5, y, 75, y);
        y += 4;
    }

    // Total final
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL:', 5, y);
    doc.text(`C${fmt(invoice.total)}`, 75, y, { align: 'right' });
    y += 8;

    doc.setLineWidth(0.5);
    doc.line(5, y, 75, y);
    y += 6;

    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text('Gracias por su compra!', 40, y, { align: 'center' });
    y += 4;
    doc.text('Mariscos Gomez - Productos frescos', 40, y, { align: 'center' });

    return doc;
}
