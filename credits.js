// ============================================================
// credits.js — Gestión de ventas a crédito y pagos
// ============================================================

function saveCredits() {
    localStorage.setItem('mariscos_credits', JSON.stringify(creditSales));
    localStorage.setItem('mariscos_next_credit_id', nextCreditId.toString());
    updateStorageMonitor();
}

function updateCreditStatuses() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    creditSales.forEach(credit => {
        if (credit.status !== 'paid') {
            const dueDate = new Date(credit.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            credit.status = dueDate < today ? 'overdue' : 'pending';
        }
    });
    saveCredits();
}

function updateCreditsStats() {
    const totalAmount  = creditSales.reduce((sum, c) => sum + c.balance, 0);
    const activeCount  = creditSales.filter(c => c.status !== 'paid').length;
    const overdueCount = creditSales.filter(c => c.status === 'overdue').length;
    document.getElementById('totalCreditsAmount').textContent  = totalAmount.toLocaleString('es-CR', { minimumFractionDigits: 0 });
    document.getElementById('activeCreditsCount').textContent  = activeCount;
    document.getElementById('overdueCreditsCount').textContent = overdueCount;
}

function displayCredits() {
    const tbody       = document.getElementById('creditsTableBody');
    const searchTerm  = document.getElementById('searchCredits').value.toLowerCase();
    const statusFilter= document.getElementById('filterCreditStatus').value;
    const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2 });

    let filtered = creditSales;
    if (searchTerm) filtered = filtered.filter(c =>
        c.client.name.toLowerCase().includes(searchTerm) ||
        c.invoiceNumber.toLowerCase().includes(searchTerm)
    );
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No hay créditos registrados</td></tr>';
        updateCreditsStats();
        return;
    }

    updateCreditStatuses();

    [...filtered].reverse().forEach(credit => {
        const saleDate = new Date(credit.saleDate);
        const dueDate  = new Date(credit.dueDate);
        let statusClass = 'credit-pending', statusText = '⏳ Pendiente';
        if (credit.status === 'paid')    { statusClass = 'credit-paid';    statusText = '✅ Pagado'; }
        if (credit.status === 'overdue') { statusClass = 'credit-overdue'; statusText = '⚠️ Vencido'; }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${credit.invoiceNumber}</td>
            <td>${credit.client.name}</td>
            <td>${saleDate.toLocaleDateString('es-CR')}</td>
            <td>${dueDate.toLocaleDateString('es-CR')}</td>
            <td>₡${fmt(credit.totalAmount)}</td>
            <td>₡${fmt(credit.paidAmount)}</td>
            <td><strong>₡${fmt(credit.balance)}</strong></td>
            <td><span class="credit-status ${statusClass}">${statusText}</span></td>
            <td>
                ${credit.status !== 'paid' ? `<button class="btn btn-success btn-sm" onclick="showPaymentModal(${credit.id})" title="Registrar pago">Pago</button>` : ''}
                <button class="btn btn-sm" onclick="showCreditDetails(${credit.id})" title="Ver detalles">Ver</button>
                <button class="btn btn-sm btn-warning" onclick="reprintInvoicePDF('${credit.invoiceNumber}')" title="Reimprimir factura">Reimprimir</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCredit(${credit.id})" title="Eliminar">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateCreditsStats();
}

// ============================================================
// showPaymentModal — Modal para registrar un pago parcial o total
// ============================================================
function showPaymentModal(creditId) {
    const credit = creditSales.find(c => c.id === creditId);
    if (!credit) return;
    const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2 });

    const overlay = document.createElement('div');
    overlay.id = 'paymentModalOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;justify-content:center;align-items:center;z-index:10000;';
    overlay.innerHTML = `
        <div style="background:white;padding:30px;border-radius:10px;max-width:500px;width:90%;">
            <h3 style="text-align:center;color:#2c3e50;margin-top:0;">Registrar Pago</h3>
            <hr style="margin:15px 0;">
            <p><strong>Cliente:</strong> ${credit.client.name}</p>
            <p><strong>Factura:</strong> ${credit.invoiceNumber}</p>
            <p><strong>Saldo Pendiente:</strong> <span style="color:#e74c3c;font-size:1.2em;">₡${fmt(credit.balance)}</span></p>
            <hr style="margin:15px 0;">
            <div class="form-group">
                <label for="paymentAmount">Monto a Pagar:</label>
                <input type="number" id="paymentAmount" step="0.01" max="${credit.balance}" placeholder="0.00"
                    style="width:100%;padding:10px;border:1px solid #ddd;border-radius:5px;">
            </div>
            <div class="form-group">
                <label for="paymentNotes">Notas (opcional):</label>
                <input type="text" id="paymentNotes" placeholder="Ej: Abono #1"
                    style="width:100%;padding:10px;border:1px solid #ddd;border-radius:5px;">
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button data-register-payment style="flex:1;background:rgba(34,197,94,0.14);border:1px solid rgba(34,197,94,0.35);color:#166534;font-weight:600;padding:10px;border-radius:6px;cursor:pointer;">
                    Registrar Pago
                </button>
                <button data-close-modal style="flex:1;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:10px;border-radius:6px;cursor:pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cierre: botón cancelar y clic fuera del panel
    const closeModal = () => {
        const el = document.getElementById('paymentModalOverlay');
        if (el) el.remove();
    };
    overlay.querySelector('[data-close-modal]').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    // Registrar pago al hacer clic en el botón principal
    overlay.querySelector('[data-register-payment]').addEventListener('click', () => {
        registerPayment(creditId);
    });
}

// ============================================================
// registerPayment — Procesa el abono y actualiza el crédito
// ============================================================
function registerPayment(creditId) {
    const credit = creditSales.find(c => c.id === creditId);
    if (!credit) return;

    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const notes  = document.getElementById('paymentNotes').value || '';

    if (!amount || amount <= 0) { showAlert('Por favor ingresa un monto válido', 'danger'); return; }
    if (amount > credit.balance) { showAlert('El monto no puede ser mayor al saldo pendiente', 'danger'); return; }

    credit.payments.push({ amount, date: new Date().toISOString(), notes, registeredBy: currentUser });
    credit.paidAmount += amount;
    credit.balance    -= amount;

    if (credit.balance <= 0.01) {
        credit.balance = 0;
        credit.status  = 'paid';
        showAlert('Crédito pagado completamente', 'success');
    } else {
        showAlert('Pago registrado exitosamente', 'success');
    }

    saveCredits();

    // Cerrar el modal con ID en lugar de selector de estilos
    const el = document.getElementById('paymentModalOverlay');
    if (el) el.remove();

    displayCredits();
    updateDashboard(); // refrescar créditos activos
}

// ============================================================
// showCreditDetails — Modal con el historial completo del crédito
// ============================================================
function showCreditDetails(creditId) {
    const credit = creditSales.find(c => c.id === creditId);
    if (!credit) return;
    const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2 });

    let paymentsHTML = '';
    if (credit.payments.length > 0) {
        paymentsHTML = '<hr style="margin:15px 0;"><h4 style="margin-bottom:10px;">Historial de Pagos</h4><div class="payment-history">';
        credit.payments.forEach((p, i) => {
            paymentsHTML += `
                <div class="payment-item">
                    <strong>Pago #${i+1}</strong> — ${new Date(p.date).toLocaleDateString('es-CR')}<br>
                    Monto: ₡${fmt(p.amount)}${p.notes ? ' — ' + p.notes : ''}<br>
                    Registrado por: ${p.registeredBy}
                </div>`;
        });
        paymentsHTML += '</div>';
    }

    const notesHTML = credit.notes
        ? `<p><strong>Notas:</strong> ${credit.notes}</p>`
        : '';

    const overlay = document.createElement('div');
    overlay.id = 'creditDetailOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:flex;justify-content:center;align-items:center;z-index:10000;';

    overlay.innerHTML = `
        <div style="background:white;padding:30px;border-radius:10px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;color:#2c3e50;">Detalles del Crédito</h3>
                <button data-close-modal style="background:none;border:1px solid #ddd;border-radius:6px;padding:6px 12px;cursor:pointer;color:#666;">Cerrar</button>
            </div>
            <hr style="margin:0 0 15px;">
            <p><strong>Factura:</strong> ${credit.invoiceNumber}</p>
            <p><strong>Cliente:</strong> ${credit.client.name}</p>
            <p><strong>Teléfono:</strong> ${credit.client.phone}</p>
            <p><strong>Fecha de Venta:</strong> ${new Date(credit.saleDate).toLocaleDateString('es-CR')}</p>
            <p><strong>Fecha de Vencimiento:</strong> ${new Date(credit.dueDate).toLocaleDateString('es-CR')}</p>
            <hr style="margin:15px 0;">
            <p><strong>Monto Total:</strong> ₡${fmt(credit.totalAmount)}</p>
            <p><strong>Monto Pagado:</strong> ₡${fmt(credit.paidAmount)}</p>
            <p><strong>Saldo Pendiente:</strong> <span style="color:#e74c3c;font-size:1.2em;">₡${fmt(credit.balance)}</span></p>
            ${notesHTML}
            ${paymentsHTML}
            <div style="text-align:center;margin-top:20px;">
                <button data-close-modal style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:10px 24px;border-radius:6px;cursor:pointer;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cierre robusto con data-attribute — sin selectores de estilo
    const closeModal = () => {
        const el = document.getElementById('creditDetailOverlay');
        if (el) el.remove();
    };
    overlay.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}