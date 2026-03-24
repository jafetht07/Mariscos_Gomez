// ============================================================
// maintenance.js — Optimización, backup y configuración
// ============================================================

function updateMaintenanceStats() {
    const used = getStorageUsage();
    const percentage = Math.round((used / 5120) * 100);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const oldInvoices = invoiceHistory.filter(inv => new Date(inv.fullDateTime || inv.date) < sixMonthsAgo);

    let performance = 100;
    if (products.length > 500)      performance -= 10;
    if (invoiceHistory.length > 1000) performance -= 15;
    if (used > 3000)                performance -= 20;
    if (used > 4000)                performance -= 30;

    document.getElementById('storageUsagePercent').textContent = percentage + '%';
    document.getElementById('oldRecordsCount').textContent     = oldInvoices.length;
    document.getElementById('systemPerformance').textContent   = Math.max(performance, 0) + '%';

    updateSystemAlerts(percentage, oldInvoices.length, performance);

    document.getElementById('maxInvoices').value        = maintenanceConfig.maxInvoices;
    document.getElementById('autoCleanupEnabled').checked = maintenanceConfig.autoCleanupEnabled;
}

function updateSystemAlerts(storagePercent, oldRecordsCount, performance) {
    const container = document.getElementById('systemAlerts');
    container.innerHTML = '';
    const alerts = [];

    if (storagePercent > 80) {
        alerts.push({ type: 'danger',  message: '⚠️ Almacenamiento crítico (>80%). Se requiere limpieza inmediata.', action: 'optimizeStorage' });
    } else if (storagePercent > 60) {
        alerts.push({ type: 'warning', message: '⚠️ Almacenamiento alto (>60%). Considera hacer limpieza.',         action: 'optimizeStorage' });
    }
    if (oldRecordsCount > 100) {
        alerts.push({ type: 'info',    message: `📅 ${oldRecordsCount} facturas antiguas pueden ser archivadas.`,   action: 'archiveOldData' });
    }
    if (performance < 70) {
        alerts.push({ type: 'warning', message: '🐌 Rendimiento del sistema reducido. Se recomienda optimización.', action: 'optimizeStorage' });
    }

    if (alerts.length === 0) {
        container.innerHTML = '<div class="alert alert-success">✅ Sistema funcionando correctamente</div>';
        return;
    }
    alerts.forEach(a => {
        const div = document.createElement('div');
        div.className = `alert alert-${a.type}`;
        div.innerHTML = `${a.message} <button class="btn btn-sm" onclick="${a.action}()" style="margin-left:10px;padding:5px 10px;">Resolver</button>`;
        container.appendChild(div);
    });
}

function archiveOldData() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const old = invoiceHistory.filter(inv => new Date(inv.fullDateTime || inv.date) < sixMonthsAgo);

    if (old.length === 0) { showAlert('ℹ️ No hay facturas antiguas para archivar', 'info'); return; }
    if (!confirm(`¿Desea archivar ${old.length} facturas antiguas? Se exportarán a Excel antes de eliminarlas.`)) return;

    const ws = XLSX.utils.json_to_sheet(old.map(inv => ({
        'Número de Factura': inv.number, 'Fecha': inv.date, 'Hora': inv.time || 'N/A',
        'Cliente': inv.client.name, 'Teléfono': inv.client.phone,
        'Dirección': inv.client.address, 'Total': inv.total, 'Atendido por': inv.user || 'N/A'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas Archivadas');
    XLSX.writeFile(wb, `archivo_facturas_${new Date().toISOString().split('T')[0]}.xlsx`);

    invoiceHistory = invoiceHistory.filter(inv => new Date(inv.fullDateTime || inv.date) >= sixMonthsAgo);
    saveInvoices();
    showAlert(`✅ ${old.length} facturas archivadas y exportadas exitosamente`, 'success');
    updateMaintenanceStats();
}

function exportAllData() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), 'Productos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceHistory.map(inv => ({
        'Número': inv.number, 'Fecha': inv.date, 'Hora': inv.time || 'N/A',
        'Cliente': inv.client.name, 'Teléfono': inv.client.phone,
        'Dirección': inv.client.address, 'Total': inv.total, 'Usuario': inv.user || 'N/A'
    }))), 'Facturas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['BACKUP COMPLETO - MARISCOS GÓMEZ'],[''],
        ['Fecha de backup', new Date().toLocaleString('es-CR')],['Usuario', currentUser],[''],
        ['ESTADÍSTICAS'],['Total productos', products.length],['Total facturas', invoiceHistory.length],
        ['Uso de almacenamiento (KB)', getStorageUsage()],[''],
        ['CONFIGURACIÓN'],['Máximo facturas', maintenanceConfig.maxInvoices],
        ['Limpieza automática', maintenanceConfig.autoCleanupEnabled ? 'Habilitada' : 'Deshabilitada']
    ]), 'Información');
    XLSX.writeFile(wb, `backup_completo_${new Date().toISOString().split('T')[0]}.xlsx`);
    showAlert('💾 Backup completo exportado exitosamente', 'success');
}

function optimizeStorage() {
    const initialUsage = getStorageUsage();
    const seen = new Set();
    const uniqueProducts = products.filter(p => {
        const key = `${p.name}-${p.category}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const removedProducts = products.length - uniqueProducts.length;
    products = uniqueProducts;

    invoiceHistory = invoiceHistory.map(inv => ({
        number: inv.number, date: inv.date, time: inv.time, fullDateTime: inv.fullDateTime,
        client: inv.client,
        items: inv.items.map(item => ({
            productId: item.productId, name: item.name, price: item.price,
            quantity: item.quantity, unit: item.unit, total: item.total
        })),
        total: inv.total, user: inv.user
    }));

    saveProducts();
    saveInvoices();
    const saved = initialUsage - getStorageUsage();
    showAlert(`⚡ Optimización completada. Espacio liberado: ${saved}KB. Duplicados removidos: ${removedProducts}`, 'success');
    updateStorageMonitor();
    updateMaintenanceStats();
}

function clearOldInvoices() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const old = invoiceHistory.filter(inv => new Date(inv.fullDateTime || inv.date) < threeMonthsAgo);

    if (old.length === 0) { showAlert('ℹ️ No hay facturas antiguas para eliminar', 'info'); return; }
    if (!confirm(`⚠️ ADVERTENCIA: Se eliminarán permanentemente ${old.length} facturas de más de 3 meses. ¿Continuar?`)) return;

    const totalRemoved = old.reduce((sum, inv) => sum + inv.total, 0);
    invoiceHistory = invoiceHistory.filter(inv => new Date(inv.fullDateTime || inv.date) >= threeMonthsAgo);
    saveInvoices();
    showAlert(`🗑️ ${old.length} facturas eliminadas (₡${totalRemoved.toLocaleString('es-CR')} en ventas)`, 'success');
    updateMaintenanceStats();
}

function saveMaintenanceConfig() {
    const maxInvoices        = parseInt(document.getElementById('maxInvoices').value);
    const autoCleanupEnabled = document.getElementById('autoCleanupEnabled').checked;

    if (maxInvoices < 100 || maxInvoices > 10000) {
        showAlert('⚠️ El límite de facturas debe estar entre 100 y 10,000', 'danger');
        return;
    }
    maintenanceConfig = { maxInvoices, autoCleanupEnabled, lastCleanup: new Date().toISOString() };
    localStorage.setItem('mariscos_maintenance_config', JSON.stringify(maintenanceConfig));
    showAlert('💾 Configuración de mantenimiento guardada', 'success');
    updateMaintenanceStats();
}
