// ============================================================
// state.js — Variables globales compartidas entre todos los módulos
// ============================================================

const users = {
    'Gomez': 'qwrt2107',
    'Tuko': '290597',
    'Diana': 'qwrt2107'
};

let currentUser = null;
let isLoggedIn = false;

let products = JSON.parse(localStorage.getItem('mariscos_products') || '[]');
let invoiceItems = [];
let nextProductId = parseInt(localStorage.getItem('mariscos_next_id') || '1');
let invoiceHistory = JSON.parse(localStorage.getItem('mariscos_invoices') || '[]');
let creditSales = JSON.parse(localStorage.getItem('mariscos_credits') || '[]');
let nextCreditId = parseInt(localStorage.getItem('mariscos_next_credit_id') || '1');

// Paginación
let currentProductPage = 1;
let currentSalesPage = 1;
const itemsPerPage = 12;
const invoicesPerPage = 20;

// Configuración de mantenimiento
let maintenanceConfig = JSON.parse(localStorage.getItem('mariscos_maintenance_config') || JSON.stringify({
    maxInvoices: 1000,
    autoCleanupEnabled: true,
    lastCleanup: null
}));

const maintenanceAllowedUsers = ['Tuko'];