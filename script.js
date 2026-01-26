// Variables globales
const users = {
    'Gomez': { password: 'qwrt2107', securityQuestion: '¿Cuál es tu color favorito?', securityAnswer: 'vino' },
    'Tuko': { password: '290597', securityQuestion: '¿En qué ciudad naciste?', securityAnswer: 'limon', isAdmin: true },
    'Diana': { password: 'qwrt2107', securityQuestion: '¿Cuál es el nombre de tu mascota?', securityAnswer: 'milo' }
};

let currentUser = null;
let isLoggedIn = false;
let products = JSON.parse(localStorage.getItem('mariscos_products') || '[]');
let invoiceItems = [];
let nextProductId = parseInt(localStorage.getItem('mariscos_next_id') || '1');
let invoiceHistory = JSON.parse(localStorage.getItem('mariscos_invoices') || '[]');

// Variables para paginación
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

// Función para calcular uso de localStorage
function getStorageUsage() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length + key.length;
        }
    }
    return Math.round(total / 1024);
}

// Función para actualizar monitor de almacenamiento
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
        if (maintenanceConfig.autoCleanupEnabled) {
            showStorageWarning();
        }
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
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    const targetContainer = isLoggedIn ? 
        document.querySelector('#mainSystem .container') : 
        document.querySelector('.login-container');
    
    if (targetContainer) {
        if (isLoggedIn) {
            targetContainer.insertBefore(alert, targetContainer.firstChild);
        } else {
            targetContainer.appendChild(alert);
        }
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
}


// FUNCIONES DE RECUPERACIÓN DE CONTRASEÑA

function showPasswordRecovery() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('recoveryForm').style.display = 'block';
}

function cancelRecovery() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('recoveryForm').style.display = 'none';
    document.getElementById('recoveryUsername').value = '';
    document.getElementById('securityAnswer').value = '';
    const questionDiv = document.getElementById('securityQuestionDiv');
    if (questionDiv) questionDiv.remove();
}

function checkRecoveryUser() {
    const username = document.getElementById('recoveryUsername').value.trim();
    
    if (!username) {
        showAlert('⚠️ Por favor ingresa tu nombre de usuario', 'danger');
        return;
    }
    
    if (!users[username]) {
        showAlert('❌ Usuario no encontrado', 'danger');
        return;
    }
    
    const user = users[username];
    const existingDiv = document.getElementById('securityQuestionDiv');
    if (existingDiv) existingDiv.remove();
    
    const questionDiv = document.createElement('div');
    questionDiv.id = 'securityQuestionDiv';
    questionDiv.className = 'form-group';
    questionDiv.innerHTML = `
        <label>Pregunta de seguridad:</label>
        <p style="font-style: italic; color: #555;">${user.securityQuestion}</p>
        <input type="text" id="securityAnswer" placeholder="Tu respuesta" required>
        <button type="button" class="btn" onclick="verifySecurityAnswer()">Verificar</button>
    `;
    
    document.getElementById('recoveryForm').appendChild(questionDiv);
}

function verifySecurityAnswer() {
    const username = document.getElementById('recoveryUsername').value.trim();
    const answer = document.getElementById('securityAnswer').value.trim().toLowerCase();
    
    if (!answer) {
        showAlert('⚠️ Por favor ingresa tu respuesta', 'danger');
        return;
    }
    
    const user = users[username];
    
    if (answer === user.securityAnswer.toLowerCase()) {
        showAlert(`✅ Tu contraseña es: ${user.password}`, 'success');
        setTimeout(() => {
            cancelRecovery();
        }, 5000);
    } else {
        showAlert('❌ Respuesta incorrecta', 'danger');
    }
}

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (users[username] && users[username].password === password) {
        currentUser = username;
        isLoggedIn = true;
        localStorage.setItem('current_user', currentUser);
        
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainSystem').classList.remove('hidden');
        document.getElementById('currentUser').textContent = username;
        
        const maintenanceTab = document.querySelector('[data-tab="maintenance"]');
        if (maintenanceTab) {
            if (users[username].isAdmin) {
                maintenanceTab.style.display = 'block';
            } else {
                maintenanceTab.style.display = 'none';
            }
        }
        
        showAlert('✅ Inicio de sesión exitoso', 'success');
        initializeSystem();
    } else {
        showAlert('❌ Usuario o contraseña incorrectos', 'danger');
    }
}

function handleLogout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        currentUser = null;
        isLoggedIn = false;
        localStorage.removeItem('current_user');
        
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainSystem').classList.add('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        
        clearInvoice();
    }
}

function showTab(tabName) {
    document.querySelectorAll('.content').forEach(content => {
        content.classList.add('hidden');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.remove('hidden');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    switch(tabName) {
        case 'inventory':
            displayProducts();
            break;
        case 'invoice':
            updateInvoiceProductSelect();
            break;
        case 'reports':
            updateReports();
            break;
        case 'sales-reports':
            displaySalesReports();
            break;
        case 'maintenance':
            updateMaintenanceStats();
            break;
    }
}

function saveProducts() {
    localStorage.setItem('mariscos_products', JSON.stringify(products));
    localStorage.setItem('mariscos_next_id', nextProductId.toString());
    updateStorageMonitor();
}

function saveInvoices() {
    localStorage.setItem('mariscos_invoices', JSON.stringify(invoiceHistory));
    updateStorageMonitor();
}

function displayProducts() {
    const grid = document.getElementById('productGrid');
    const searchTerm = document.getElementById('searchProducts').value.toLowerCase();
    
    let filteredProducts = products;
    if (searchTerm) {
        filteredProducts = products.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm)
        );
    }

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentProductPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);

    grid.innerHTML = '';
    
    if (pageProducts.length === 0) {
        grid.innerHTML = '<div class="product-card"><h3>📦 No hay productos</h3><p>Agrega productos usando la pestaña "Agregar Producto".</p></div>';
        document.getElementById('productsPagination').style.display = 'none';
        return;
    }
    
    pageProducts.forEach(product => {
        const stockClass = product.stock < 10 ? 'stock-low' : 'stock-ok';
        const stockIcon = product.stock < 10 ? '⚠️' : '✅';
        
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-name">${product.name}</div>
            <div class="product-info">📂 Categoría: ${product.category}</div>
            <div class="product-info">💰 Precio: ₡${product.price.toLocaleString('es-CR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / ${product.unit}</div>
            <div class="product-info ${stockClass}">${stockIcon} Stock: ${product.stock} ${product.unit}</div>
            <div class="action-buttons">
                <button class="btn btn-sm" onclick="editProduct(${product.id})">✏️ Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">🗑️ Eliminar</button>
            </div>
        `;
        grid.appendChild(productCard);
    });

    if (totalPages > 1) {
        document.getElementById('productsPagination').style.display = 'flex';
        document.getElementById('productPageInfo').textContent = `Página ${currentProductPage} de ${totalPages}`;
        
        const prevBtn = document.querySelector('#productsPagination button:first-child');
        const nextBtn = document.querySelector('#productsPagination button:last-child');
        
        prevBtn.disabled = currentProductPage === 1;
        nextBtn.disabled = currentProductPage === totalPages;
    } else {
        document.getElementById('productsPagination').style.display = 'none';
    }
}

function changeProductPage(direction) {
    const searchTerm = document.getElementById('searchProducts').value.toLowerCase();
    let filteredProducts = products;
    if (searchTerm) {
        filteredProducts = products.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm)
        );
    }
    
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    currentProductPage += direction;
    if (currentProductPage < 1) currentProductPage = 1;
    if (currentProductPage > totalPages) currentProductPage = totalPages;
    
    displayProducts();
}

function searchProducts() {
    currentProductPage = 1;
    displayProducts();
}

function handleAddProduct(event) {
    event.preventDefault();
    
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const stock = parseInt(document.getElementById('productStock').value);
    const unit = document.getElementById('productUnit').value;
    
    if (!name || !category || !price || !stock || !unit) {
        showAlert('⚠️ Por favor completa todos los campos', 'danger');
        return;
    }
    
    if (products.length >= 1000) {
        showAlert('⚠️ Límite de productos alcanzado. Considera usar la función de mantenimiento.', 'warning');
        return;
    }
    
    const newProduct = {
        id: nextProductId++,
        name,
        category,
        price,
        stock,
        unit,
        createdAt: new Date().toISOString()
    };
    
    products.push(newProduct);
    saveProducts();
    
    document.getElementById('addProductForm').reset();
    showAlert('✅ Producto agregado exitosamente', 'success');
    showTab('inventory');
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    const newPrice = prompt(`💰 Nuevo precio para ${product.name}:`, product.price);
    const newStock = prompt(`📦 Nuevo stock para ${product.name}:`, product.stock);
    
    if (newPrice !== null && newStock !== null) {
        product.price = parseFloat(newPrice) || product.price;
        product.stock = parseInt(newStock) || product.stock;
        product.updatedAt = new Date().toISOString();
        saveProducts();
        displayProducts();
        showAlert('✅ Producto actualizado exitosamente', 'success');
    }
}

function deleteProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    if (confirm(`¿Estás seguro de que quieres eliminar "${product.name}"?\n\nEsta acción no se puede deshacer.`)) {
        products = products.filter(p => p.id !== id);
        saveProducts();
        displayProducts();
        showAlert('🗑️ Producto eliminado exitosamente', 'success');
    }
}

function updateInvoiceProductSelect() {
    const select = document.getElementById('invoiceProduct');
    select.innerHTML = '<option value="">Seleccionar producto</option>';
    
    products.forEach(product => {
        if (product.stock > 0) {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} - ₡${product.price.toLocaleString('es-CR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / ${product.unit} (Stock: ${product.stock})`;
            select.appendChild(option);
        }
    });
}

function addToInvoice() {
    const productId = parseInt(document.getElementById('invoiceProduct').value);
    const quantity = parseFloat(document.getElementById('invoiceQuantity').value);
    
    if (!productId || !quantity || quantity <= 0) {
        showAlert('⚠️ Por favor selecciona un producto y cantidad válida', 'danger');
        return;
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (quantity > product.stock) {
        showAlert(`⚠️ Stock insuficiente. Stock disponible: ${product.stock} ${product.unit}`, 'danger');
        return;
    }
    
    const existingItem = invoiceItems.find(item => item.productId === productId);
    if (existingItem) {
        if (existingItem.quantity + quantity > product.stock) {
            showAlert(`⚠️ Stock insuficiente. Stock disponible: ${product.stock} ${product.unit}`, 'danger');
            return;
        }
        existingItem.quantity += quantity;
        existingItem.total = existingItem.quantity * existingItem.price;
    } else {
        invoiceItems.push({
            productId,
            name: product.name,
            price: product.price,
            quantity,
            unit: product.unit,
            total: product.price * quantity
        });
    }
    
    document.getElementById('invoiceProduct').value = '';
    document.getElementById('invoiceQuantity').value = '';
    
    updateInvoiceDisplay();
}

function updateInvoiceDisplay() {
    const itemsContainer = document.getElementById('invoiceItems');
    const totalContainer = document.getElementById('invoiceTotal');
    
    itemsContainer.innerHTML = '';
    let total = 0;
    
    invoiceItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'invoice-item';
        itemDiv.innerHTML = `
            <div>
                <strong>${item.name}</strong><br>
                ${item.quantity} ${item.unit} × ₡${item.price.toLocaleString('es-CR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <div>
                ₡${item.total.toLocaleString('es-CR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                <button class="btn btn-danger btn-sm" onclick="removeFromInvoice(${index})">❌</button>
            </div>
        `;
        itemsContainer.appendChild(itemDiv);
        total += item.total;
    });
    
    totalContainer.textContent = `Total: ₡${total.toLocaleString('es-CR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function removeFromInvoice(index) {
    if (confirm('¿Eliminar este producto de la factura?')) {
        invoiceItems.splice(index, 1);
        updateInvoiceDisplay();
        showAlert('🗑️ Producto eliminado de la factura', 'success');
    }
}

function clearInvoice() {
    if (invoiceItems.length > 0 && !confirm('¿Estás seguro de que quieres limpiar toda la factura?')) {
        return;
    }
    
    invoiceItems = [];
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientAddress').value = '';
    updateInvoiceDisplay();
    
    if (invoiceItems.length === 0) {
        showAlert('🗑️ Factura limpiada', 'info');
    }
}

// FUNCIÓN PARA GENERAR VOUCHER (FORMATO PROFESIONAL 80MM)
function generateInvoiceVoucherPDF(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        unit: 'mm',
        format: [80, 200]
    });
    
    let yPos = 10;
    const centerX = 40;
    const margin = 5;
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Mariscos Gomez', centerX, yPos, { align: 'center' });
    
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Sistema de Facturacion', centerX, yPos, { align: 'center' });
    
    yPos += 8;
    doc.line(margin, yPos, 80 - margin, yPos);
    
    yPos += 5;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Factura #${invoice.number}`, centerX, yPos, { align: 'center' });
    
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Fecha: ${invoice.date}`, centerX, yPos, { align: 'center' });
    
    yPos += 4;
    doc.text(`Hora: ${invoice.time}`, centerX, yPos, { align: 'center' });
    
    yPos += 6;
    doc.line(margin, yPos, 80 - margin, yPos);
    
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text('CLIENTE:', margin, yPos);
    
    yPos += 4;
    doc.setFont(undefined, 'normal');
    doc.text(`Nombre: ${invoice.client.name}`, margin, yPos);
    
    yPos += 4;
    doc.text(`Tel: ${invoice.client.phone}`, margin, yPos);
    
    yPos += 4;
    const maxWidth = 70;
    const addressLines = doc.splitTextToSize(`Dir: ${invoice.client.address}`, maxWidth);
    addressLines.forEach(line => {
        doc.text(line, margin, yPos);
        yPos += 4;
    });
    
    yPos += 2;
    doc.line(margin, yPos, 80 - margin, yPos);
    
    yPos += 5;
    doc.setFont(undefined, 'bold');
    doc.text('PRODUCTOS:', margin, yPos);
    
    yPos += 5;
    doc.setFont(undefined, 'normal');
    
    invoice.items.forEach(item => {
        const itemNameLines = doc.splitTextToSize(item.name, maxWidth);
        itemNameLines.forEach(line => {
            doc.text(line, margin, yPos);
            yPos += 4;
        });
        
        const precioFormat = item.price.toFixed(2);
        const totalFormat = item.total.toFixed(2);
        
        doc.setFontSize(7);
        doc.text(`  ${item.quantity} ${item.unit} x C${precioFormat}`, margin + 2, yPos);
        doc.text(`C${totalFormat}`, 80 - margin, yPos, { align: 'right' });
        
        yPos += 5;
        doc.setFontSize(8);
    });
    
    yPos += 2;
    doc.line(margin, yPos, 80 - margin, yPos);
    
    yPos += 6;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    const totalFormat = invoice.total.toFixed(2);
    doc.text('TOTAL:', margin, yPos);
    doc.text(`C${totalFormat}`, 80 - margin, yPos, { align: 'right' });
    
    yPos += 8;
    doc.line(margin, yPos, 80 - margin, yPos);
    
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('Gracias por su compra!', centerX, yPos, { align: 'center' });
    
    yPos += 4;
    doc.setFontSize(7);
    doc.text(`Atendido por: ${invoice.user || 'Sistema'}`, centerX, yPos, { align: 'center' });
    
    yPos += 4;
    doc.text(new Date().toLocaleString('es-CR'), centerX, yPos, { align: 'center' });
    
    yPos += 6;
    doc.text('--- FIN DEL COMPROBANTE ---', centerX, yPos, { align: 'center' });
    
    return doc;
}

// FUNCIÓN PARA GENERAR PDF AL CREAR FACTURA
function generateInvoicePDF() {
    if (invoiceItems.length === 0) {
        showAlert('⚠️ No hay productos en la factura', 'danger');
        return;
    }
    
    if (invoiceHistory.length >= maintenanceConfig.maxInvoices) {
        if (confirm('Se ha alcanzado el límite de facturas. ¿Desea continuar? Se recomienda hacer limpieza de datos.')) {
            showAlert('⚠️ Sistema cerca del límite. Visite la sección de Mantenimiento.', 'warning');
        } else {
            return;
        }
    }
    
    const clientName = document.getElementById('clientName').value || 'Cliente';
    const clientPhone = document.getElementById('clientPhone').value || 'N/A';
    const clientAddress = document.getElementById('clientAddress').value || 'N/A';
    
    const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(invoiceHistory.length + 1).padStart(4, '0')}`;
    const now = new Date();
    
    invoiceItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.stock -= item.quantity;
        }
    });
    saveProducts();
    
    const invoice = {
        number: invoiceNumber,
        date: now.toLocaleDateString('es-CR'),
        time: now.toLocaleTimeString('es-CR'),
        fullDateTime: now.toISOString(),
        client: { name: clientName, phone: clientPhone, address: clientAddress },
        items: [...invoiceItems],
        total: invoiceItems.reduce((sum, item) => sum + item.total, 0),
        user: currentUser
    };
    invoiceHistory.push(invoice);
    saveInvoices();
    
    // GENERAR VOUCHER PROFESIONAL
    const doc = generateInvoiceVoucherPDF(invoice);
    doc.save(`voucher_${clientName.replace(/\s+/g, '_')}_${invoiceNumber}.pdf`);
    
    showAlert('📄 Factura PDF generada exitosamente', 'success');
    clearInvoice();
    updateInvoiceProductSelect();
    
    if (maintenanceConfig.autoCleanupEnabled && getStorageUsage() > 4096) {
        setTimeout(() => {
            if (confirm('El sistema ha detectado que el almacenamiento está casi lleno. ¿Desea realizar una limpieza automática?')) {
                optimizeStorage();
            }
        }, 2000);
    }
}

// FUNCIÓN PARA REIMPRIMIR VOUCHER
function printInvoiceVoucher(invoiceNumber) {
    const invoice = invoiceHistory.find(inv => inv.number === invoiceNumber);
    if (!invoice) {
        showAlert('⚠️ Factura no encontrada', 'danger');
        return;
    }
    
    const doc = generateInvoiceVoucherPDF(invoice);
    doc.save(`voucher_${invoice.number}_${invoice.client.name.replace(/\s+/g, '_')}.pdf`);
    
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) modal.remove();
    
    showAlert('✅ Voucher generado exitosamente', 'success');
}

function updateReports() {
    const totalProductsCount = products.length;
    const lowStockProducts = products.filter(p => p.stock < 10).length;
    const totalValue = products.reduce((sum, product) => sum + (product.price * product.stock), 0);
    const totalInvoicesCount = invoiceHistory.length;
    const totalSales = invoiceHistory.reduce((sum, invoice) => sum + invoice.total, 0);
    
    document.getElementById('totalProductsStat').textContent = totalProductsCount;
    document.getElementById('lowStockProductsStat').textContent = lowStockProducts;
    document.getElementById('totalInventoryValueStat').textContent = totalValue.toLocaleString('es-CR', {minimumFractionDigits: 0});
    document.getElementById('totalInvoicesStat').textContent = totalInvoicesCount;
    document.getElementById('totalSalesStat').textContent = totalSales.toLocaleString('es-CR', {minimumFractionDigits: 0});
}

function displaySalesReports() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('startDate').value = firstDayOfMonth.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
    
    filterSales();
}

function filterSales() {
    currentSalesPage = 1;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    let filteredInvoices = [...invoiceHistory];
    
    if (startDate || endDate) {
        filteredInvoices = invoiceHistory.filter(invoice => {
            const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
            const start = startDate ? new Date(startDate) : new Date('1900-01-01');
            const end = endDate ? new Date(endDate + 'T23:59:59') : new Date('2100-12-31');
            
            return invoiceDate >= start && invoiceDate <= end;
        });
    }
    
    updateSalesTable(filteredInvoices);
    updatePeriodSummary(filteredInvoices);
}

function changeSalesPage(direction) {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    let filteredInvoices = [...invoiceHistory];
    
    if (startDate || endDate) {
        filteredInvoices = invoiceHistory.filter(invoice => {
            const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
            const start = startDate ? new Date(startDate) : new Date('1900-01-01');
            const end = endDate ? new Date(endDate + 'T23:59:59') : new Date('2100-12-31');
            
            return invoiceDate >= start && invoiceDate <= end;
        });
    }
    
    const totalPages = Math.ceil(filteredInvoices.length / invoicesPerPage);
    
    currentSalesPage += direction;
    if (currentSalesPage < 1) currentSalesPage = 1;
    if (currentSalesPage > totalPages) currentSalesPage = totalPages;
    
    updateSalesTable(filteredInvoices);
    updatePeriodSummary(filteredInvoices);
}

function clearDateFilter() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    filterSales();
}

function updateSalesTable(invoices) {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';
    
    if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay ventas en el período seleccionado</td></tr>';
        document.getElementById('salesPagination').style.display = 'none';
        return;
    }
    
    const totalPages = Math.ceil(invoices.length / invoicesPerPage);
    const startIndex = (currentSalesPage - 1) * invoicesPerPage;
    const endIndex = startIndex + invoicesPerPage;
    const pageInvoices = invoices.slice(startIndex, endIndex).reverse();
    
    pageInvoices.forEach(invoice => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${invoice.number}</td>
            <td>${invoice.date}</td>
            <td>${invoice.time || 'N/A'}</td>
            <td>${invoice.client.name}</td>
            <td>${invoice.client.phone}</td>
            <td>₡${invoice.total.toLocaleString('es-CR', {minimumFractionDigits: 2})}</td>
            <td>
                <button class="btn btn-sm" onclick="showInvoiceDetails('${invoice.number}')" title="Ver detalles">👁️</button>
                <button class="btn btn-success btn-sm" onclick="printInvoiceVoucher('${invoice.number}')" title="Reimprimir voucher">🖨️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${invoice.number}')" title="Eliminar factura">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (totalPages > 1) {
        document.getElementById('salesPagination').style.display = 'flex';
        document.getElementById('salesPageInfo').textContent = `Página ${currentSalesPage} de ${totalPages}`;
        const prevBtn = document.querySelector('#salesPagination button:first-child');
        const nextBtn = document.querySelector('#salesPagination button:last-child');
        
        prevBtn.disabled = currentSalesPage === 1;
        nextBtn.disabled = currentSalesPage === totalPages;
    } else {
        document.getElementById('salesPagination').style.display = 'none';
    }
}

function updatePeriodSummary(invoices) {
    const totalSales = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const invoiceCount = invoices.length;
    const averageAmount = invoiceCount > 0 ? totalSales / invoiceCount : 0;
    
    document.getElementById('periodTotalSales').textContent = totalSales.toLocaleString('es-CR', {minimumFractionDigits: 2});
    document.getElementById('periodInvoiceCount').textContent = invoiceCount;
    document.getElementById('averageInvoiceAmount').textContent = averageAmount.toLocaleString('es-CR', {minimumFractionDigits: 2});
}

function showInvoiceDetails(invoiceNumber) {
    const invoice = invoiceHistory.find(inv => inv.number === invoiceNumber);
    if (!invoice) return;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    let details = `<h3 style="text-align: center; color: #2c3e50;">📄 Factura ${invoice.number}</h3>`;
    details += `<hr style="margin: 15px 0;">`;
    details += `<p><strong>📅 Fecha:</strong> ${invoice.date} ${invoice.time || ''}</p>`;
    details += `<p><strong>👤 Cliente:</strong> ${invoice.client.name}</p>`;
    details += `<p><strong>📞 Teléfono:</strong> ${invoice.client.phone}</p>`;
    details += `<p><strong>📍 Dirección:</strong> ${invoice.client.address}</p>`;
    details += `<hr style="margin: 15px 0;">`;
    details += `<p><strong>📦 Productos:</strong></p>`;
    details += `<ul style="list-style: none; padding: 0;">`;
    
    invoice.items.forEach(item => {
        details += `<li style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
            <strong>${item.name}</strong><br>
            ${item.quantity} ${item.unit} × ₡${item.price.toLocaleString('es-CR')} = 
            <strong>₡${item.total.toLocaleString('es-CR')}</strong>
        </li>`;
    });
    
    details += `</ul>`;
    details += `<hr style="margin: 15px 0;">`;
    details += `<p style="font-size: 1.2em; text-align: right;"><strong>💰 Total: ₡${invoice.total.toLocaleString('es-CR')}</strong></p>`;
    
    if (invoice.user) {
        details += `<p style="text-align: center; color: #7f8c8d; font-size: 0.9em;">👤 Atendido por: ${invoice.user}</p>`;
    }
    
    details += `<div style="display: flex; gap: 10px; margin-top: 20px; justify-content: center;">
        <button onclick="printInvoiceVoucher('${invoice.number}')" class="btn btn-success" style="flex: 1;">
            🖨️ Reimprimir Voucher
        </button>
        <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" class="btn btn-warning" style="flex: 1;">
            ❌ Cerrar
        </button>
    </div>`;
    
    modalContent.innerHTML = details;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function deleteInvoice(invoiceNumber) {
    const invoiceIndex = invoiceHistory.findIndex(inv => inv.number === invoiceNumber);
    if (invoiceIndex === -1) {
        showAlert('⚠️ Factura no encontrada', 'danger');
        return;
    }
    
    const invoice = invoiceHistory[invoiceIndex];
    
    const confirmMessage = `⚠️ ELIMINAR FACTURA\n\nFactura: ${invoice.number}\nCliente: ${invoice.client.name}\nTotal: ₡${invoice.total.toLocaleString('es-CR')}\nFecha: ${invoice.date}\n\n¿Estás seguro de eliminar esta factura?\n\nEsta acción restaurará el stock de los productos vendidos y eliminará permanentemente la factura del sistema.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.stock += item.quantity;
            product.updatedAt = new Date().toISOString();
        }
    });
    
    invoiceHistory.splice(invoiceIndex, 1);
    
    saveProducts();
    saveInvoices();
    
    showAlert(`✅ Factura ${invoice.number} eliminada exitosamente. Stock restaurado.`, 'success');
    
    filterSales();
    updateReports();
}

function exportSalesToPDF() {
    const filteredInvoices = getFilteredInvoices();
    
    if (filteredInvoices.length === 0) {
        showAlert('⚠️ No hay datos para exportar', 'danger');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Mariscos Gómez', 20, 20);
    doc.setFontSize(14);
    doc.text('Reporte de Ventas', 20, 30);
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const periodText = startDate && endDate ? 
        `Período: ${startDate} a ${endDate}` : 
        'Período: Todas las ventas';
    
    doc.setFontSize(10);
    doc.text(periodText, 20, 40);
    doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 20, 50);
    doc.text(`Por: ${currentUser}`, 20, 60);
    
    const totalSales = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    doc.setFontSize(12);
    doc.text(`Total de Facturas: ${filteredInvoices.length}`, 20, 80);
    doc.text(`Total Vendido: ₡${totalSales.toLocaleString('es-CR')}`, 20, 90);
    
    const tableData = filteredInvoices.map(invoice => [
        invoice.number,
        invoice.date,
        invoice.time || 'N/A',
        invoice.client.name,
        `₡${invoice.total.toLocaleString('es-CR')}`
    ]);
    
    doc.autoTable({
        head: [['# Factura', 'Fecha', 'Hora', 'Cliente', 'Total']],
        body: tableData,
        startY: 100,
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219] },
        styles: { fontSize: 8 }
    });
    
    const fileName = startDate && endDate ? 
        `reporte_ventas_${startDate}_${endDate}.pdf` : 
        `reporte_ventas_completo.pdf`;
    
    doc.save(fileName);
    showAlert('📄 Reporte PDF exportado exitosamente', 'success');
}

function exportSalesToExcel() {
    const filteredInvoices = getFilteredInvoices();
    
    if (filteredInvoices.length === 0) {
        showAlert('⚠️ No hay datos para exportar', 'danger');
        return;
    }
    
    const excelData = filteredInvoices.map(invoice => ({
        'Número de Factura': invoice.number,
        'Fecha': invoice.date,
        'Hora': invoice.time || 'N/A',
        'Cliente': invoice.client.name,
        'Teléfono': invoice.client.phone,
        'Dirección': invoice.client.address,
        'Total': invoice.total,
        'Atendido por': invoice.user || 'N/A'
    }));
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Ventas');
    
    const summary = [
        ['RESUMEN DEL PERÍODO'],
        [''],
        ['Total de Facturas', filteredInvoices.length],
        ['Total Vendido', filteredInvoices.reduce((sum, inv) => sum + inv.total, 0)],
        ['Promedio por Factura', filteredInvoices.length > 0 ? filteredInvoices.reduce((sum, inv) => sum + inv.total, 0) / filteredInvoices.length : 0],
        [''],
        ['Generado por', currentUser],
        ['Fecha de generación', new Date().toLocaleString('es-CR')]
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const fileName = startDate && endDate ? 
        `reporte_ventas_${startDate}_${endDate}.xlsx` : 
        `reporte_ventas_completo.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    showAlert('📊 Reporte Excel exportado exitosamente', 'success');
}

function printSalesReport() {
    const filteredInvoices = getFilteredInvoices();
    
    if (filteredInvoices.length === 0) {
        showAlert('⚠️ No hay datos para imprimir', 'danger');
        return;
    }
    
    window.print();
}

function getFilteredInvoices() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate && !endDate) {
        return [...invoiceHistory].reverse();
    }
    
    return invoiceHistory.filter(invoice => {
        const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
        const start = startDate ? new Date(startDate) : new Date('1900-01-01');
        const end = endDate ? new Date(endDate + 'T23:59:59') : new Date('2100-12-31');
        
        return invoiceDate >= start && invoiceDate <= end;
    }).reverse();
}

function updateMaintenanceStats() {
    const storageUsage = getStorageUsage();
    const storageLimit = 5120;
    const percentage = Math.round((storageUsage / storageLimit) * 100);
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const oldInvoices = invoiceHistory.filter(invoice => {
        const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
        return invoiceDate < sixMonthsAgo;
    });
    
    let performance = 100;
    if (products.length > 500) performance -= 10;
    if (invoiceHistory.length > 1000) performance -= 15;
    if (storageUsage > 3000) performance -= 20;
    if (storageUsage > 4000) performance -= 30;
    
    document.getElementById('storageUsagePercent').textContent = percentage + '%';
    document.getElementById('oldRecordsCount').textContent = oldInvoices.length;
    document.getElementById('systemPerformance').textContent = Math.max(performance, 0) + '%';
    
    updateSystemAlerts(percentage, oldInvoices.length, performance);
    
    document.getElementById('maxInvoices').value = maintenanceConfig.maxInvoices;
    document.getElementById('autoCleanupEnabled').checked = maintenanceConfig.autoCleanupEnabled;
}

function updateSystemAlerts(storagePercent, oldRecordsCount, performance) {
    const alertsContainer = document.getElementById('systemAlerts');
    alertsContainer.innerHTML = '';
    
    const alerts = [];
    
    if (storagePercent > 80) {
        alerts.push({
            type: 'danger',
            message: '⚠️ Almacenamiento crítico (>80%). Se requiere limpieza inmediata.',
            action: 'optimizeStorage'
        });
    } else if (storagePercent > 60) {
        alerts.push({
            type: 'warning',
            message: '⚠️ Almacenamiento alto (>60%). Considera hacer limpieza.',
            action: 'optimizeStorage'
        });
    }
    
    if (oldRecordsCount > 100) {
        alerts.push({
            type: 'info',
            message: `📅 ${oldRecordsCount} facturas antiguas pueden ser archivadas.`,
            action: 'archiveOldData'
        });
    }
    
    if (performance < 70) {
        alerts.push({
            type: 'warning',
            message: '🐌 Rendimiento del sistema reducido. Se recomienda optimización.',
            action: 'optimizeStorage'
        });
    }
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = '<div class="alert alert-success">✅ Sistema funcionando correctamente</div>';
        return;
    }
    
    alerts.forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${alert.type}`;
        alertDiv.innerHTML = `
            ${alert.message}
            <button class="btn btn-sm" onclick="${alert.action}()" style="margin-left: 10px; padding: 5px 10px;">Resolver</button>
        `;
        alertsContainer.appendChild(alertDiv);
    });
}

function archiveOldData() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const oldInvoices = invoiceHistory.filter(invoice => {
        const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
        return invoiceDate < sixMonthsAgo;
    });
    
    if (oldInvoices.length === 0) {
        showAlert('ℹ️ No hay facturas antiguas para archivar', 'info');
        return;
    }
    
    if (!confirm(`¿Desea archivar ${oldInvoices.length} facturas antiguas? Se exportarán a Excel antes de eliminarlas.`)) {
        return;
    }
    
    // Exportar datos antiguos
    const ws = XLSX.utils.json_to_sheet(oldInvoices.map(invoice => ({
        'Número de Factura': invoice.number,
        'Fecha': invoice.date,
        'Hora': invoice.time || 'N/A',
        'Cliente': invoice.client.name,
        'Teléfono': invoice.client.phone,
        'Dirección': invoice.client.address,
        'Total': invoice.total,
        'Atendido por': invoice.user || 'N/A'
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas Archivadas');
    
    const fileName = `archivo_facturas_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    // Remover facturas antiguas
    invoiceHistory = invoiceHistory.filter(invoice => {
        const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
        return invoiceDate >= sixMonthsAgo;
    });
    
    saveInvoices();
    showAlert(`✅ ${oldInvoices.length} facturas archivadas y exportadas exitosamente`, 'success');
    updateMaintenanceStats();
}

function exportAllData() {
    const wb = XLSX.utils.book_new();
    
    // Hoja de productos
    const productsWs = XLSX.utils.json_to_sheet(products);
    XLSX.utils.book_append_sheet(wb, productsWs, 'Productos');
    
    // Hoja de facturas
    const invoicesData = invoiceHistory.map(invoice => ({
        'Número': invoice.number,
        'Fecha': invoice.date,
        'Hora': invoice.time || 'N/A',
        'Cliente': invoice.client.name,
        'Teléfono': invoice.client.phone,
        'Dirección': invoice.client.address,
        'Total': invoice.total,
        'Usuario': invoice.user || 'N/A'
    }));
    const invoicesWs = XLSX.utils.json_to_sheet(invoicesData);
    XLSX.utils.book_append_sheet(wb, invoicesWs, 'Facturas');
    
    // Hoja de resumen
    const summary = [
        ['BACKUP COMPLETO - MARISCOS GÓMEZ'],
        [''],
        ['Fecha de backup', new Date().toLocaleString('es-CR')],
        ['Usuario', currentUser],
        [''],
        ['ESTADÍSTICAS'],
        ['Total productos', products.length],
        ['Total facturas', invoiceHistory.length],
        ['Uso de almacenamiento (KB)', getStorageUsage()],
        [''],
        ['CONFIGURACIÓN'],
        ['Máximo facturas', maintenanceConfig.maxInvoices],
        ['Limpieza automática', maintenanceConfig.autoCleanupEnabled ? 'Habilitada' : 'Deshabilitada']
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Información');
    
    const fileName = `backup_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showAlert('💾 Backup completo exportado exitosamente', 'success');
}

function optimizeStorage() {
    const initialUsage = getStorageUsage();
    
    // Limpiar datos duplicados y optimizar estructura
    const uniqueProducts = [];
    const productNames = new Set();
    
    products.forEach(product => {
        const key = `${product.name}-${product.category}`;
        if (!productNames.has(key)) {
            productNames.add(key);
            uniqueProducts.push(product);
        }
    });
    
    const removedProducts = products.length - uniqueProducts.length;
    products = uniqueProducts;
    
    // Optimizar facturas eliminando campos innecesarios
    invoiceHistory = invoiceHistory.map(invoice => ({
        number: invoice.number,
        date: invoice.date,
        time: invoice.time,
        fullDateTime: invoice.fullDateTime,
        client: invoice.client,
        items: invoice.items.map(item => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            unit: item.unit,
            total: item.total
        })),
        total: invoice.total,
        user: invoice.user
    }));
    
    saveProducts();
    saveInvoices();
    
    const finalUsage = getStorageUsage();
    const saved = initialUsage - finalUsage;
    
    showAlert(`⚡ Optimización completada. Espacio liberado: ${saved}KB. Productos duplicados removidos: ${removedProducts}`, 'success');
    updateStorageMonitor();
    updateMaintenanceStats();
}

function clearOldInvoices() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const oldInvoices = invoiceHistory.filter(invoice => {
        const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
        return invoiceDate < threeMonthsAgo;
    });
    
    if (oldInvoices.length === 0) {
        showAlert('ℹ️ No hay facturas antiguas para eliminar', 'info');
        return;
    }
    
    if (!confirm(`⚠️ ADVERTENCIA: Esta acción eliminará permanentemente ${oldInvoices.length} facturas de más de 3 meses. ¿Continuar?`)) {
        return;
    }
    
    const totalSalesRemoved = oldInvoices.reduce((sum, inv) => sum + inv.total, 0);
    
    invoiceHistory = invoiceHistory.filter(invoice => {
        const invoiceDate = new Date(invoice.fullDateTime || invoice.date);
        return invoiceDate >= threeMonthsAgo;
    });
    
    saveInvoices();
    showAlert(`🗑️ ${oldInvoices.length} facturas eliminadas (₡${totalSalesRemoved.toLocaleString('es-CR')} en ventas)`, 'success');
    updateMaintenanceStats();
}

function saveMaintenanceConfig() {
    const maxInvoices = parseInt(document.getElementById('maxInvoices').value);
    const autoCleanupEnabled = document.getElementById('autoCleanupEnabled').checked;
    
    if (maxInvoices < 100 || maxInvoices > 10000) {
        showAlert('⚠️ El límite de facturas debe estar entre 100 y 10,000', 'danger');
        return;
    }
    
    maintenanceConfig = {
        maxInvoices,
        autoCleanupEnabled,
        lastCleanup: new Date().toISOString()
    };
    
    localStorage.setItem('mariscos_maintenance_config', JSON.stringify(maintenanceConfig));
    showAlert('💾 Configuración de mantenimiento guardada', 'success');
    updateMaintenanceStats();
}

// Función para inicializar el sistema
function initializeSystem() {
    updateStorageMonitor();
    displayProducts();
    updateReports();
    
    // Verificar si es necesaria limpieza automática al inicio
    if (maintenanceConfig.autoCleanupEnabled && getStorageUsage() > 4096) {
        setTimeout(() => {
            showAlert('🔧 Sistema requiere optimización. Visite la sección de Mantenimiento.', 'warning');
        }, 3000);
    }
}

// Función para verificar sesión automática (MODIFICADA)
function checkAutoLogin() {
    const savedUser = localStorage.getItem('current_user');
    
    // Verificar que el usuario aún exista en la lista
    if (savedUser && !users[savedUser]) {
        // El usuario fue eliminado - cerrar sesión
        localStorage.removeItem('current_user');
        showAlert('⚠️ Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 'warning');
        return;
    }
    
    if (savedUser && users[savedUser]) {
        currentUser = savedUser;
        isLoggedIn = true;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainSystem').classList.remove('hidden');
        document.getElementById('currentUser').textContent = savedUser;
        
        // NUEVA FUNCIONALIDAD: Ocultar pestaña de mantenimiento si no es admin
        const maintenanceTab = document.querySelector('[data-tab="maintenance"]');
        if (maintenanceTab) {
            if (users[savedUser].isAdmin) {
                maintenanceTab.style.display = 'block';
            } else {
                maintenanceTab.style.display = 'none';
            }
        }
        
        initializeSystem();
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Cargar configuración de mantenimiento
    maintenanceConfig = JSON.parse(localStorage.getItem('mariscos_maintenance_config') || JSON.stringify({
        maxInvoices: 1000,
        autoCleanupEnabled: true,
        lastCleanup: null
    }));
    
    checkAutoLogin();
    
    // Event listeners para el login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Event listeners para las pestañas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            showTab(this.dataset.tab);
        });
    });
    
    // Event listeners para productos
    document.getElementById('addProductForm').addEventListener('submit', handleAddProduct);
    document.getElementById('searchProducts').addEventListener('keyup', searchProducts);
    
    // Event listeners para facturación
    document.getElementById('addToInvoiceBtn').addEventListener('click', addToInvoice);
    document.getElementById('generatePDFBtn').addEventListener('click', generateInvoicePDF);
    document.getElementById('clearInvoiceBtn').addEventListener('click', clearInvoice);
    
    // Event listeners para reportes de ventas
    document.getElementById('filterSalesBtn').addEventListener('click', filterSales);
    document.getElementById('clearFilterBtn').addEventListener('click', clearDateFilter);
    document.getElementById('exportPDFBtn').addEventListener('click', exportSalesToPDF);
    document.getElementById('exportExcelBtn').addEventListener('click', exportSalesToExcel);
    document.getElementById('printReportBtn').addEventListener('click', printSalesReport);
    
    // Actualizar monitor de almacenamiento cada 30 segundos
    setInterval(updateStorageMonitor, 30000);
});
