// ============================================================
// reports.js — Reportes de ventas y reportes de créditos
// ============================================================

function updateReports() {
    const lowStock   = products.filter(p => p.stock < 10).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const totalSales = invoiceHistory.reduce((sum, inv) => sum + inv.total, 0);

    document.getElementById('totalProductsStat').textContent       = products.length;
    document.getElementById('lowStockProductsStat').textContent    = lowStock;
    document.getElementById('totalInventoryValueStat').textContent = totalValue.toLocaleString('es-CR', { minimumFractionDigits: 0 });
    document.getElementById('totalInvoicesStat').textContent       = invoiceHistory.length;
    document.getElementById('totalSalesStat').textContent          = totalSales.toLocaleString('es-CR', { minimumFractionDigits: 0 });
}

// ── Reportes de ventas ──────────────────────────────────────

function displaySalesReports() {
    const today = new Date();
    const first  = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('startDate').value = first.toISOString().split('T')[0];
    document.getElementById('endDate').value   = today.toISOString().split('T')[0];
    filterSales();
}

function filterSales() {
    currentSalesPage = 1;
    const filtered = getFilteredInvoices();
    updateSalesTable(filtered);
    updatePeriodSummary(filtered);
}

function changeSalesPage(direction) {
    const filtered = getFilteredInvoices();
    const totalPages = Math.ceil(filtered.length / invoicesPerPage);
    currentSalesPage = Math.max(1, Math.min(currentSalesPage + direction, totalPages));
    updateSalesTable(filtered);
    updatePeriodSummary(filtered);
}

function clearDateFilter() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value   = '';
    filterSales();
}

function getFilteredInvoices() {
    const startDate = document.getElementById('startDate').value;
    const endDate   = document.getElementById('endDate').value;
    if (!startDate && !endDate) return [...invoiceHistory].reverse();
    return invoiceHistory.filter(inv => {
        const d     = new Date(inv.fullDateTime || inv.date);
        const start = startDate ? new Date(startDate) : new Date('1900-01-01');
        const end   = endDate   ? new Date(endDate + 'T23:59:59') : new Date('2100-12-31');
        return d >= start && d <= end;
    }).reverse();
}

function updateSalesTable(invoices) {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';

    if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay ventas en el período seleccionado</td></tr>';
        document.getElementById('salesPagination').style.display = 'none';
        return;
    }

    const totalPages   = Math.ceil(invoices.length / invoicesPerPage);
    const startIndex   = (currentSalesPage - 1) * invoicesPerPage;
    const pageInvoices = invoices.slice(startIndex, startIndex + invoicesPerPage);

    pageInvoices.forEach(invoice => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${invoice.number}</td>
            <td>${invoice.date}</td>
            <td>${invoice.time || 'N/A'}</td>
            <td>${invoice.client.name}</td>
            <td>${invoice.client.phone}</td>
            <td>₡${invoice.total.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
            <td style="white-space:nowrap;">
                <button class="btn btn-sm btn-info"    onclick="showInvoiceDetails('${invoice.number}')" title="Ver detalles">Ver</button>
                <button class="btn btn-sm btn-warning" onclick="reprintInvoicePDF('${invoice.number}')"  title="Reimprimir PDF">Reimprimir</button>
                <button class="btn btn-sm btn-danger"  onclick="deleteInvoice('${invoice.number}')"      title="Eliminar factura">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (totalPages > 1) {
        document.getElementById('salesPagination').style.display = 'flex';
        document.getElementById('salesPageInfo').textContent = `Página ${currentSalesPage} de ${totalPages}`;
        document.querySelector('#salesPagination button:first-child').disabled = currentSalesPage === 1;
        document.querySelector('#salesPagination button:last-child').disabled  = currentSalesPage === totalPages;
    } else {
        document.getElementById('salesPagination').style.display = 'none';
    }
}

function updatePeriodSummary(invoices) {
    const totalSales    = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const averageAmount = invoices.length > 0 ? totalSales / invoices.length : 0;
    document.getElementById('periodTotalSales').textContent     = totalSales.toLocaleString('es-CR', { minimumFractionDigits: 2 });
    document.getElementById('periodInvoiceCount').textContent   = invoices.length;
    document.getElementById('averageInvoiceAmount').textContent = averageAmount.toLocaleString('es-CR', { minimumFractionDigits: 2 });
}

// ============================================================
// showInvoiceDetails
// Modal con detalles completos + botón para reimprimir PDF.
// Visible para todos los usuarios.
// ============================================================
function showInvoiceDetails(invoiceNumber) {
    const invoice = invoiceHistory.find(inv => inv.number === invoiceNumber);
    if (!invoice) return;

    const fmt = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let itemsHTML = '';
    invoice.items.forEach(item => {
        itemsHTML += `
            <tr>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;">${item.name}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${item.quantity} ${item.unit}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">₡${fmt(item.price)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">₡${fmt(item.total)}</td>
            </tr>`;
    });

    const creditBadge = invoice.isCredit
        ? '<span style="background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:4px;padding:2px 8px;font-size:0.8em;margin-left:8px;">Crédito</span>'
        : '';

    const overlay = document.createElement('div');
    overlay.id = 'invoiceDetailOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:10000;backdrop-filter:blur(2px);';

    overlay.innerHTML = `
        <div style="background:#fff;padding:30px;border-radius:12px;max-width:580px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
                <div>
                    <h3 style="margin:0;color:#1e293b;font-size:1.2rem;">Detalle de Factura ${creditBadge}</h3>
                    <div style="font-size:1.4rem;font-weight:700;color:#0ea5e9;margin-top:4px;">${invoice.number}</div>
                </div>
                <button data-close-invoice style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;cursor:pointer;color:#64748b;">Cerrar</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:16px;">
                <div><span style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;">Fecha</span><br><strong>${invoice.date}</strong></div>
                <div><span style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;">Hora</span><br><strong>${invoice.time || 'N/A'}</strong></div>
                <div><span style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;">Atendido por</span><br><strong>${invoice.user || 'N/A'}</strong></div>
                <div><span style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;">Tipo</span><br><strong>${invoice.isCredit ? 'Crédito' : 'Contado'}</strong></div>
            </div>
            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;margin-bottom:16px;">
                <div style="font-size:0.72rem;color:#0369a1;text-transform:uppercase;margin-bottom:8px;font-weight:600;">Cliente</div>
                <div><strong>${invoice.client.name}</strong></div>
                <div style="color:#475569;font-size:0.88rem;">Tel: ${invoice.client.phone}</div>
                <div style="color:#475569;font-size:0.88rem;">Dir: ${invoice.client.address}</div>
            </div>
            <div style="margin-bottom:16px;">
                <div style="font-size:0.72rem;color:#64748b;text-transform:uppercase;margin-bottom:8px;font-weight:600;">Productos</div>
                <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.86rem;">
                        <thead>
                            <tr style="background:#f1f5f9;">
                                <th style="padding:8px 10px;text-align:left;color:#475569;font-size:0.72rem;text-transform:uppercase;">Producto</th>
                                <th style="padding:8px 10px;text-align:center;color:#475569;font-size:0.72rem;text-transform:uppercase;">Cant.</th>
                                <th style="padding:8px 10px;text-align:right;color:#475569;font-size:0.72rem;text-transform:uppercase;">Precio</th>
                                <th style="padding:8px 10px;text-align:right;color:#475569;font-size:0.72rem;text-transform:uppercase;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHTML}</tbody>
                    </table>
                </div>
            </div>
            <div style="text-align:right;padding:12px 0;border-top:2px solid #e2e8f0;margin-bottom:20px;">
                <span style="font-size:0.85rem;color:#64748b;">Total:</span>
                <span style="font-size:1.5rem;font-weight:700;color:#f59e0b;margin-left:10px;">₡${fmt(invoice.total)}</span>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button data-reprint-invoice style="background:linear-gradient(135deg,#d97706,#fbbf24);border:none;color:#0c1020;font-weight:700;padding:10px 20px;border-radius:8px;cursor:pointer;">
                    Reimprimir PDF
                </button>
                <button data-delete-invoice style="background:rgba(244,63,94,0.12);border:1px solid rgba(244,63,94,0.35);color:#fb7185;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;">
                    Eliminar
                </button>
                <button data-close-invoice style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:10px 20px;border-radius:8px;cursor:pointer;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
        const el = document.getElementById('invoiceDetailOverlay');
        if (el) el.remove();
    };

    overlay.querySelectorAll('[data-close-invoice]').forEach(btn => btn.addEventListener('click', closeModal));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    overlay.querySelector('[data-reprint-invoice]').addEventListener('click', () => {
        reprintInvoicePDF(invoiceNumber);
    });

    // Botón eliminar dentro del modal — disponible para todos
    overlay.querySelector('[data-delete-invoice]').addEventListener('click', () => {
        closeModal();
        deleteInvoice(invoiceNumber);
    });
}

// ============================================================
// reprintInvoicePDF
// Regenera el voucher PDF de una factura ya guardada.
// ============================================================
function reprintInvoicePDF(invoiceNumber) {
    const invoice = invoiceHistory.find(inv => inv.number === invoiceNumber);
    if (!invoice) { showAlert('Factura no encontrada', 'danger'); return; }

    const doc = generateInvoiceVoucherPDF(invoice);

    if (invoice.isCredit) {
        const creditInfo = creditSales.find(c => c.invoiceNumber === invoiceNumber);
        if (creditInfo) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('*** VENTA A CREDITO ***', 40, 190, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Vence: ${new Date(creditInfo.dueDate).toLocaleDateString('es-CR')}`, 40, 196, { align: 'center' });
        }
    }

    doc.save(`reimpresion_${invoice.client.name.replace(/\s+/g, '_')}_${invoiceNumber}.pdf`);
    showAlert('PDF de ' + invoiceNumber + ' generado exitosamente', 'success');
}

// ============================================================
// deleteInvoice
// Elimina la factura de localStorage y restaura el stock.
// firebase-integration.js intercepta y borra también de Firebase.
// Disponible para todos los usuarios.
// ============================================================
function deleteInvoice(invoiceNumber) {
    const idx = invoiceHistory.findIndex(inv => inv.number === invoiceNumber);
    if (idx === -1) { showAlert('Factura no encontrada', 'danger'); return; }
    const invoice = invoiceHistory[idx];
    if (!confirm(`ELIMINAR FACTURA\n\nFactura: ${invoice.number}\nCliente: ${invoice.client.name}\nTotal: ₡${invoice.total.toLocaleString('es-CR')}\nFecha: ${invoice.date}\n\n¿Estás seguro?\n\nSe restaurará el stock de los productos.`)) return;

    // Restaurar stock de cada producto de la factura
    invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.stock     += item.quantity;
            product.updatedAt  = new Date().toISOString();
        }
    });

    invoiceHistory.splice(idx, 1);
    saveProducts();
    saveInvoices();
    // firebase-integration.js intercepta saveInvoices y también
    // borra el documento de Firestore vía el patch de deleteInvoice
    showAlert(`Factura ${invoice.number} eliminada. Stock restaurado.`, 'success');
    filterSales();
    updateReports();
    if (typeof updateDashboard === 'function') updateDashboard();
}

// ── Exportación de ventas ───────────────────────────────────

function exportSalesToPDF() {
    const filtered = getFilteredInvoices();
    if (filtered.length === 0) { showAlert('No hay datos para exportar', 'danger'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const startDate = document.getElementById('startDate').value;
    const endDate   = document.getElementById('endDate').value;
    doc.setFontSize(18); doc.text('Mariscos Gómez', 20, 20);
    doc.setFontSize(14); doc.text('Reporte de Ventas', 20, 30);
    doc.setFontSize(10);
    doc.text(startDate && endDate ? `Período: ${startDate} a ${endDate}` : 'Período: Todas las ventas', 20, 40);
    doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 20, 50);
    doc.text(`Por: ${currentUser}`, 20, 60);
    const total = filtered.reduce((sum, inv) => sum + inv.total, 0);
    doc.setFontSize(12);
    doc.text(`Total de Facturas: ${filtered.length}`, 20, 80);
    doc.text(`Total Vendido: ₡${total.toLocaleString('es-CR')}`, 20, 90);
    doc.autoTable({
        head: [['# Factura','Fecha','Hora','Cliente','Total']],
        body: filtered.map(inv => [inv.number, inv.date, inv.time || 'N/A', inv.client.name, `₡${inv.total.toLocaleString('es-CR')}`]),
        startY: 100, theme: 'striped', headStyles: { fillColor: [52, 152, 219] }, styles: { fontSize: 8 }
    });
    doc.save(startDate && endDate ? `reporte_ventas_${startDate}_${endDate}.pdf` : 'reporte_ventas_completo.pdf');
    showAlert('Reporte PDF exportado exitosamente', 'success');
}

function exportSalesToExcel() {
    const filtered = getFilteredInvoices();
    if (filtered.length === 0) { showAlert('No hay datos para exportar', 'danger'); return; }
    const ws = XLSX.utils.json_to_sheet(filtered.map(inv => ({
        'Número de Factura': inv.number, 'Fecha': inv.date, 'Hora': inv.time || 'N/A',
        'Cliente': inv.client.name, 'Teléfono': inv.client.phone, 'Dirección': inv.client.address,
        'Total': inv.total, 'Atendido por': inv.user || 'N/A'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Ventas');
    const totalV = filtered.reduce((s, i) => s + i.total, 0);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['RESUMEN DEL PERÍODO'], [''],
        ['Total de Facturas', filtered.length],
        ['Total Vendido', totalV],
        ['Promedio por Factura', filtered.length > 0 ? totalV / filtered.length : 0],
        [''], ['Generado por', currentUser],
        ['Fecha de generación', new Date().toLocaleString('es-CR')]
    ]), 'Resumen');
    const startDate = document.getElementById('startDate').value;
    const endDate   = document.getElementById('endDate').value;
    XLSX.writeFile(wb, startDate && endDate ? `reporte_ventas_${startDate}_${endDate}.xlsx` : 'reporte_ventas_completo.xlsx');
    showAlert('Reporte Excel exportado exitosamente', 'success');
}

function printSalesReport() {
    if (getFilteredInvoices().length === 0) { showAlert('No hay datos para imprimir', 'danger'); return; }
    window.print();
}

// ── Reportes de créditos ────────────────────────────────────

function displayCreditsReport() {
    const today = new Date();
    const first  = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('creditsReportStartDate').value = first.toISOString().split('T')[0];
    document.getElementById('creditsReportEndDate').value   = today.toISOString().split('T')[0];
    filterCreditsReport();
}

function filterCreditsReport() {
    const filtered = getFilteredCreditsForReport();
    updateCreditStatuses();
    updateCreditsReportStats(filtered);
    updateCreditsReportTable(filtered);
    updateTopDebtors();
    updateCreditsChart();
}

function clearCreditsReportFilter() {
    document.getElementById('creditsReportStartDate').value = '';
    document.getElementById('creditsReportEndDate').value   = '';
    document.getElementById('creditsReportStatus').value    = 'all';
    filterCreditsReport();
}

function getFilteredCreditsForReport() {
    const startDate    = document.getElementById('creditsReportStartDate').value;
    const endDate      = document.getElementById('creditsReportEndDate').value;
    const statusFilter = document.getElementById('creditsReportStatus').value;
    let filtered = [...creditSales];
    if (startDate || endDate) {
        filtered = filtered.filter(c => {
            const d     = new Date(c.saleDate);
            const start = startDate ? new Date(startDate) : new Date('1900-01-01');
            const end   = endDate   ? new Date(endDate + 'T23:59:59') : new Date('2100-12-31');
            return d >= start && d <= end;
        });
    }
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);
    return filtered;
}

function updateCreditsReportStats(filtered) {
    const totalCredits = creditSales.reduce((s, c) => s + c.totalAmount, 0);
    const totalPaid    = creditSales.reduce((s, c) => s + c.paidAmount, 0);
    const totalPending = creditSales.reduce((s, c) => s + c.balance, 0);
    const overdueCount = creditSales.filter(c => c.status === 'overdue').length;
    const recoveryRate = totalCredits > 0 ? Math.round((totalPaid / totalCredits) * 100) : 0;
    const fmt0 = n => n.toLocaleString('es-CR', { minimumFractionDigits: 0 });
    const fmt2 = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2 });
    document.getElementById('reportTotalCredits').textContent  = fmt0(totalCredits);
    document.getElementById('reportTotalPaid').textContent     = fmt0(totalPaid);
    document.getElementById('reportTotalPending').textContent  = fmt0(totalPending);
    document.getElementById('reportOverdueCount').textContent  = overdueCount;
    document.getElementById('reportRecoveryRate').textContent  = recoveryRate + '%';
    const pTotal   = filtered.reduce((s, c) => s + c.totalAmount, 0);
    const pPaid    = filtered.reduce((s, c) => s + c.paidAmount, 0);
    const pPending = filtered.reduce((s, c) => s + c.balance, 0);
    document.getElementById('periodCreditsIssued').textContent    = fmt2(pTotal);
    document.getElementById('periodPaymentsReceived').textContent = fmt2(pPaid);
    document.getElementById('periodBalancePending').textContent   = fmt2(pPending);
    document.getElementById('periodUniqueClients').textContent    = new Set(filtered.map(c => c.client.name)).size;
}

// ============================================================
// updateCreditsReportTable
// Muestra el detalle de créditos con botón Reimprimir para
// todos los usuarios. La columna Acciones es la décima.
// ============================================================
function updateCreditsReportTable(filtered) {
    const tbody = document.getElementById('creditsReportTableBody');
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No hay créditos en el período seleccionado</td></tr>';
        return;
    }
    const fmt   = n => n.toLocaleString('es-CR', { minimumFractionDigits: 2 });
    const today = new Date();
    [...filtered].reverse().forEach(credit => {
        const saleDate  = new Date(credit.saleDate);
        const dueDate   = new Date(credit.dueDate);
        let statusClass = 'credit-pending', statusText = 'Pendiente';
        if (credit.status === 'paid')    { statusClass = 'credit-paid';    statusText = 'Pagado';  }
        if (credit.status === 'overdue') { statusClass = 'credit-overdue'; statusText = 'Vencido'; }
        const daysSinceSale = Math.floor((today - saleDate) / 86400000);
        const daysOverdue   = credit.status === 'overdue' ? Math.floor((today - dueDate) / 86400000) : 0;
        const daysDisplay   = credit.status === 'paid'
            ? `${daysSinceSale}d`
            : (credit.status === 'overdue'
                ? `<span style="color:#e74c3c;">${daysOverdue}d vencido</span>`
                : `${daysSinceSale}d`);
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
            <td>${daysDisplay}</td>
            <td style="white-space:nowrap;">
                <button class="btn btn-sm btn-warning" onclick="reprintInvoicePDF('${credit.invoiceNumber}')" title="Reimprimir factura">Reimprimir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateTopDebtors() {
    const tbody = document.getElementById('topDebtorsTableBody');
    const map = {};
    creditSales.filter(c => c.status !== 'paid').forEach(c => {
        if (!map[c.client.name]) map[c.client.name] = { name: c.client.name, activeCredits: 0, totalDebt: 0, overdueCount: 0 };
        map[c.client.name].activeCredits++;
        map[c.client.name].totalDebt += c.balance;
        if (c.status === 'overdue') map[c.client.name].overdueCount++;
    });
    const sorted = Object.values(map).sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 5);
    tbody.innerHTML = '';
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay deudores activos</td></tr>';
        return;
    }
    sorted.forEach((d, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${i+1}</strong></td>
            <td>${d.name}</td>
            <td>${d.activeCredits}</td>
            <td><strong>₡${d.totalDebt.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</strong></td>
            <td>${d.overdueCount > 0 ? `<span style="color:#e74c3c;">${d.overdueCount}</span>` : '0'}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateCreditsChart() {
    document.getElementById('chartPaidCount').textContent    = creditSales.filter(c => c.status === 'paid').length;
    document.getElementById('chartPendingCount').textContent = creditSales.filter(c => c.status === 'pending').length;
    document.getElementById('chartOverdueCount').textContent = creditSales.filter(c => c.status === 'overdue').length;
}

function exportCreditsReportPDF() {
    const filtered = getFilteredCreditsForReport();
    if (filtered.length === 0) { showAlert('No hay datos para exportar', 'danger'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const startDate = document.getElementById('creditsReportStartDate').value;
    const endDate   = document.getElementById('creditsReportEndDate').value;
    doc.setFontSize(18); doc.text('Mariscos Gómez', 20, 20);
    doc.setFontSize(14); doc.text('Reporte de Créditos', 20, 30);
    doc.setFontSize(10);
    doc.text(startDate && endDate ? `Período: ${startDate} a ${endDate}` : 'Período: Todos los créditos', 20, 40);
    doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 20, 50);
    doc.text(`Por: ${currentUser}`, 20, 60);
    const totalAmount  = filtered.reduce((s, c) => s + c.totalAmount, 0);
    const totalPaid    = filtered.reduce((s, c) => s + c.paidAmount, 0);
    const totalPending = filtered.reduce((s, c) => s + c.balance, 0);
    doc.setFontSize(12);
    doc.text(`Total Créditos: ${filtered.length}`, 20, 80);
    doc.text(`Monto Total: ₡${totalAmount.toLocaleString('es-CR')}`, 20, 90);
    doc.text(`Total Cobrado: ₡${totalPaid.toLocaleString('es-CR')}`, 20, 100);
    doc.text(`Saldo Pendiente: ₡${totalPending.toLocaleString('es-CR')}`, 20, 110);
    doc.autoTable({
        head: [['Factura','Cliente','Fecha','Total','Saldo','Estado']],
        body: filtered.map(c => [
            c.invoiceNumber, c.client.name,
            new Date(c.saleDate).toLocaleDateString('es-CR'),
            `₡${c.totalAmount.toLocaleString('es-CR')}`,
            `₡${c.balance.toLocaleString('es-CR')}`,
            c.status === 'paid' ? 'Pagado' : (c.status === 'overdue' ? 'Vencido' : 'Pendiente')
        ]),
        startY: 120, theme: 'striped', headStyles: { fillColor: [52, 152, 219] }, styles: { fontSize: 8 }
    });
    doc.save(startDate && endDate ? `reporte_creditos_${startDate}_${endDate}.pdf` : 'reporte_creditos_completo.pdf');
    showAlert('Reporte PDF exportado exitosamente', 'success');
}

function exportCreditsReportExcel() {
    const filtered = getFilteredCreditsForReport();
    if (filtered.length === 0) { showAlert('No hay datos para exportar', 'danger'); return; }
    const ws = XLSX.utils.json_to_sheet(filtered.map(c => ({
        'Factura': c.invoiceNumber, 'Cliente': c.client.name, 'Teléfono': c.client.phone,
        'Fecha de Venta': new Date(c.saleDate).toLocaleDateString('es-CR'),
        'Fecha de Vencimiento': new Date(c.dueDate).toLocaleDateString('es-CR'),
        'Monto Total': c.totalAmount, 'Monto Pagado': c.paidAmount, 'Saldo Pendiente': c.balance,
        'Estado': c.status === 'paid' ? 'Pagado' : (c.status === 'overdue' ? 'Vencido' : 'Pendiente'),
        'Notas': c.notes || '', 'Creado por': c.createdBy
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Créditos');
    const tA = filtered.reduce((s,c) => s+c.totalAmount, 0);
    const tP = filtered.reduce((s,c) => s+c.paidAmount, 0);
    const tB = filtered.reduce((s,c) => s+c.balance, 0);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['RESUMEN DE CRÉDITOS'], [''],
        ['Total de Créditos', filtered.length],
        ['Monto Total Otorgado', tA],
        ['Monto Total Cobrado', tP],
        ['Saldo Pendiente', tB],
        ['Tasa de Recuperación', tA > 0 ? `${Math.round((tP/tA)*100)}%` : '0%'],
        [''], ['Generado por', currentUser],
        ['Fecha de generación', new Date().toLocaleString('es-CR')]
    ]), 'Resumen');
    const startDate = document.getElementById('creditsReportStartDate').value;
    const endDate   = document.getElementById('creditsReportEndDate').value;
    XLSX.writeFile(wb, startDate && endDate ? `reporte_creditos_${startDate}_${endDate}.xlsx` : 'reporte_creditos_completo.xlsx');
    showAlert('Reporte Excel exportado exitosamente', 'success');
}

function printCreditsReport() {
    if (getFilteredCreditsForReport().length === 0) { showAlert('No hay datos para imprimir', 'danger'); return; }
    window.print();
}
