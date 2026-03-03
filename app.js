// ============================================================
// app.js — Inicialización del sistema y event listeners
// ============================================================

function updateDashboard() {
    // Total de productos en catálogo
    document.getElementById('dashTotalProducts').textContent = products.length;

    // Productos con stock crítico (menos de 10 unidades)
    const lowStock = products.filter(p => p.stock < 10).length;
    document.getElementById('dashLowStock').textContent = lowStock;

    // Total de facturas emitidas
    document.getElementById('dashInvoices').textContent = invoiceHistory.length;

    // Suma de todas las ventas
    const totalSales = invoiceHistory.reduce((sum, inv) => sum + inv.total, 0);
    document.getElementById('dashTotalSales').textContent =
        totalSales.toLocaleString('es-CR', { minimumFractionDigits: 0 });

    // Créditos activos (pendientes o vencidos, no pagados)
    const activeCredits = creditSales.filter(c => c.status !== 'paid').length;
    document.getElementById('dashActiveCredits').textContent = activeCredits;
}

// ============================================================
// initializeSystem
// Se ejecuta al iniciar sesión (desde auth.js → handleLogin
// y checkAutoLogin). Carga todos los datos iniciales.
// ============================================================
function initializeSystem() {
    updateStorageMonitor();
    displayProducts();
    updateReports();
    updateDashboard(); // ← actualiza los KPI del panel de control

    if (maintenanceConfig.autoCleanupEnabled && getStorageUsage() > 4096) {
        setTimeout(() => {
            showAlert('Sistema requiere optimización. Visite la sección de Mantenimiento.', 'warning');
        }, 3000);
    }
}

// ============================================================
// DOMContentLoaded — Registra todos los event listeners
// al terminar de cargar el HTML.
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

    // Cargar configuración de mantenimiento desde localStorage
    maintenanceConfig = JSON.parse(
        localStorage.getItem('mariscos_maintenance_config') ||
        JSON.stringify({ maxInvoices: 1000, autoCleanupEnabled: true, lastCleanup: null })
    );

    checkAutoLogin();

    // Login / Logout
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Tabs (sistema legacy, mantener por compatibilidad)
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function () { showTab(this.dataset.tab); });
    });

    // Productos
    document.getElementById('addProductForm').addEventListener('submit', handleAddProduct);
    document.getElementById('searchProducts').addEventListener('keyup', searchProducts);

    // Facturación
    document.getElementById('addToInvoiceBtn').addEventListener('click', addToInvoice);
    document.getElementById('generatePDFBtn').addEventListener('click', generateInvoicePDF);
    document.getElementById('clearInvoiceBtn').addEventListener('click', clearInvoice);

    // Reportes de ventas
    document.getElementById('filterSalesBtn').addEventListener('click', filterSales);
    document.getElementById('clearFilterBtn').addEventListener('click', clearDateFilter);
    document.getElementById('exportPDFBtn').addEventListener('click', exportSalesToPDF);
    document.getElementById('exportExcelBtn').addEventListener('click', exportSalesToExcel);
    document.getElementById('printReportBtn').addEventListener('click', printSalesReport);

    // Actualizar almacenamiento cada 30 segundos
    setInterval(updateStorageMonitor, 30000);

    // Actualizar dashboard cada 60 segundos (por si hay cambios en otra pestaña)
    setInterval(updateDashboard, 60000);
});






















