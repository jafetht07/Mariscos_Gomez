// ============================================================
// ui.js — Alertas, navegación por tabs y monitor de almacenamiento
// ============================================================

function getStorageUsage() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length + key.length;
        }
    }
    return Math.round(total / 1024);
}

function updateStorageMonitor() {
    const used = getStorageUsage();
    const limit = 5120;
    const percentage = Math.round((used / limit) * 100);

    document.getElementById('storageUsed').textContent = used;
    document.getElementById('storageLimit').textContent = limit;
    document.getElementById('storagePercent').textContent = percentage + '%';
    document.getElementById('totalRecords').textContent = products.length + invoiceHistory.length;
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('totalInvoices').textContent = invoiceHistory.length;

    const fill = document.getElementById('storageFill');
    fill.style.width = percentage + '%';
    fill.className = 'storage-fill';

    if (percentage > 80) {
        fill.classList.add('danger');
        if (maintenanceConfig.autoCleanupEnabled) showStorageWarning();
    } else if (percentage > 60) {
        fill.classList.add('warning');
    }
}

function showStorageWarning() {
    if (getStorageUsage() > 4096) {
        showAlert('⚠️ Almacenamiento casi lleno. Se recomienda realizar limpieza automática.', 'warning');
    }
}

function showAlert(message, type) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) existingAlert.remove();

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    const targetContainer = isLoggedIn
        ? document.querySelector('#mainSystem .container')
        : document.querySelector('.login-container');

    if (targetContainer) {
        if (isLoggedIn) {
            targetContainer.insertBefore(alert, targetContainer.firstChild);
        } else {
            targetContainer.appendChild(alert);
        }
        setTimeout(() => alert.remove(), 5000);
    }
}

function showTab(tabName) {
    document.querySelectorAll('.content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

    document.getElementById(tabName).classList.remove('hidden');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    switch (tabName) {
        case 'inventory':      displayProducts();              break;
        case 'invoice':        updateInvoiceProductSelect();   break;
        case 'reports':        updateReports();                break;
        case 'sales-reports':  displaySalesReports();          break;
        case 'maintenance':    updateMaintenanceStats();        break;
        case 'credits':        displayCredits();               break;
        case 'credits-reports':displayCreditsReport();         break;
    }
}

function updateTabVisibility() {
    const maintenanceTab = document.querySelector('[data-tab="maintenance"]');
    if (maintenanceTab) {
        maintenanceTab.style.display = maintenanceAllowedUsers.includes(currentUser) ? '' : 'none';
    }
}