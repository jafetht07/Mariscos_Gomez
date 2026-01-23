// FIREBASE INTEGRATION & MAINTENANCE BUTTONS
(function(){
    if (window.__MARISCOS_FIREBASE_INTEGRATED) return;
    window.__MARISCOS_FIREBASE_INTEGRATED = true;

    const firebaseConfig = {
        apiKey: "AIzaSyDhov5KTrN1Dc3bgpc5_31EpR1ZVUUbOQQ",
        authDomain: "mariscos-gomez.firebaseapp.com",
        projectId: "mariscos-gomez",
        storageBucket: "mariscos-gomez.firebasestorage.app",
        messagingSenderId: "913800613033",
        appId: "1:913800613033:web:513f0d131ee68e0eed2db8",
        measurementId: "G-CYR1V2464Q"
    };

    function loadScript(src){ return new Promise((res, rej)=>{
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => res();
        s.onerror = () => rej(new Error('Failed to load '+src));
        document.head.appendChild(s);
    }); }

    async function initFirebase(){
        try {
            await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js');
        } catch(e){
            console.warn('No se pudo cargar Firebase scripts:', e);
            window.__mariscos_isFirebaseEnabled = false;
            if (typeof showAlert === 'function') showAlert('⚠️ No se pudieron cargar scripts de Firebase. Usando LocalStorage', 'warning');
            return;
        }

        try {
            firebase.initializeApp(firebaseConfig);
            window.__mariscos_db = firebase.firestore();
            window.__mariscos_isFirebaseEnabled = true;
            console.log('✅ Firebase inicializado');
            if (typeof showAlert === 'function') showAlert('☁️ Firebase inicializado', 'info');
            await firebaseLoadAll();
        } catch(err){
            console.error('Error inicializando Firebase', err);
            window.__mariscos_isFirebaseEnabled = false;
            if (typeof showAlert === 'function') showAlert('⚠️ Firebase no disponible. Usando LocalStorage', 'warning');
        }
    }

    // Save products to Firestore
    async function firebaseSaveProducts(){
        try {
            if (!window.__mariscos_db) throw new Error('No firestore');
            const db = window.__mariscos_db;
            const batch = db.batch();
            (products || []).forEach(p=>{
                const docRef = db.collection('products').doc(String(p.id));
                batch.set(docRef, p);
            });
            await batch.commit();
            console.log('✅ Productos sincronizados a Firebase');
            return true;
        } catch(e){
            console.error('Error firebaseSaveProducts', e);
            return false;
        }
    }

    // Save invoices to Firestore (last 500)
    async function firebaseSaveInvoices(){
        try {
            if (!window.__mariscos_db) throw new Error('No firestore');
            const db = window.__mariscos_db;
            const batch = db.batch();
            const toSync = (invoiceHistory || []).slice(-500);
            toSync.forEach(inv => {
                const docRef = db.collection('invoices').doc(String(inv.number));
                batch.set(docRef, inv);
            });
            await batch.commit();
            console.log('✅ Facturas sincronizadas a Firebase');
            return true;
        } catch(e){
            console.error('Error firebaseSaveInvoices', e);
            return false;
        }
    }

    // Load and merge remote data into localStorage
    async function firebaseLoadAll(){
        try {
            if (!window.__mariscos_db) return;
            const db = window.__mariscos_db;
            // products
            const prodSnap = await db.collection('products').get();
            if (!prodSnap.empty){
                const remote = [];
                prodSnap.forEach(d=>remote.push(d.data()));
                const local = JSON.parse(localStorage.getItem('mariscos_products')||'[]');
                const map = new Map();
                local.forEach(p=>map.set(p.id,p));
                remote.forEach(p=>map.set(p.id,p)); // prefer remote
                products = Array.from(map.values());
                if (products.length>0) nextProductId = Math.max(...products.map(p=>p.id))+1;
                localStorage.setItem('mariscos_products', JSON.stringify(products));
                console.log('✅ Productos cargados/mergeados desde Firebase');
            }
            // invoices
            const invSnap = await db.collection('invoices').orderBy('fullDateTime','desc').limit(1000).get();
            if (!invSnap.empty){
                const remoteInv = [];
                invSnap.forEach(d=>remoteInv.push(d.data()));
                const localInv = JSON.parse(localStorage.getItem('mariscos_invoices')||'[]');
                const imap = new Map();
                localInv.forEach(i=>imap.set(i.number,i));
                remoteInv.forEach(i=>imap.set(i.number,i));
                invoiceHistory = Array.from(imap.values());
                localStorage.setItem('mariscos_invoices', JSON.stringify(invoiceHistory));
                console.log('✅ Facturas cargadas/mergeadas desde Firebase');
            }
            // update UI
            if (typeof displayProducts==='function') displayProducts();
            if (typeof updateReports==='function') updateReports();
            if (typeof updateInvoiceProductSelect==='function') updateInvoiceProductSelect();
            if (typeof filterSales==='function') filterSales();
        } catch(e){
            console.error('Error firebaseLoadAll', e);
        }
    }

    // Expose functions
    window.firebaseSaveProducts = firebaseSaveProducts;
    window.firebaseSaveInvoices = firebaseSaveInvoices;
    window.firebaseLoadAll = firebaseLoadAll;

    // Override local save functions to also sync automatically (non-blocking)
    if (typeof window.saveProducts === 'function'){
        const origSaveProducts = window.saveProducts;
        window.saveProducts = function(){
            try { origSaveProducts(); } catch(e){ console.error('origSaveProducts error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine){
                firebaseSaveProducts().then(ok=>{
                    if (ok && typeof showAlert==='function') showAlert('☁️ Productos sincronizados automáticamente','success');
                });
            }
        };
    }
    if (typeof window.saveInvoices === 'function'){
        const origSaveInvoices = window.saveInvoices;
        window.saveInvoices = function(){
            try { origSaveInvoices(); } catch(e){ console.error('origSaveInvoices error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine){
                firebaseSaveInvoices().then(ok=>{
                    if (ok && typeof showAlert==='function') showAlert('☁️ Facturas sincronizadas automáticamente','success');
                });
            }
        };
    }

    // Manual sync & migrate
    window.syncWithFirebase = async function(){
        try {
            if (!window.__mariscos_isFirebaseEnabled){ if (typeof showAlert==='function') showAlert('⚠️ Firebase no configurado','warning'); return; }
            if (!navigator.onLine){ if (typeof showAlert==='function') showAlert('⚠️ Sin conexión','warning'); return; }
            if (typeof showAlert==='function') showAlert('🔄 Iniciando sincronización...','info');
            await firebaseSaveProducts();
            await firebaseSaveInvoices();
            if (typeof showAlert==='function') showAlert('✅ Sincronización con Firebase completada','success');
        } catch(e){ console.error('syncWithFirebase error', e); if (typeof showAlert==='function') showAlert('❌ Error sincronizando con Firebase','danger'); }
    };
    window.migrateToFirebase = async function(){
        try {
            if (!window.__mariscos_isFirebaseEnabled){ if (typeof showAlert==='function') showAlert('⚠️ Firebase no configurado','warning'); return; }
            if (!navigator.onLine){ if (typeof showAlert==='function') showAlert('⚠️ Sin conexión','warning'); return; }
            if (!confirm('¿Confirmas migrar los datos locales a Firebase?')) return;
            const ok1 = await firebaseSaveProducts();
            const ok2 = await firebaseSaveInvoices();
            if (ok1 && ok2){ if (typeof showAlert==='function') showAlert('📤 Migración completa','success'); }
            else { if (typeof showAlert==='function') showAlert('⚠️ Migración parcial, revisa la consola','warning'); }
        } catch(e){ console.error('migrateToFirebase error', e); if (typeof showAlert==='function') showAlert('❌ Error durante migración','danger'); }
    };

    // Delete/update helpers
    async function firebaseDeleteProduct(id){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('products').doc(String(id)).delete();
            console.log('✅ Producto eliminado en Firebase', id);
            return true;
        } catch(e){ console.error('firebaseDeleteProduct', e); return false; }
    }
    async function firebaseDeleteInvoice(number){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('invoices').doc(String(number)).delete();
            console.log('✅ Factura eliminada en Firebase', number);
            return true;
        } catch(e){ console.error('firebaseDeleteInvoice', e); return false; }
    }
    async function firebaseUpdateProduct(prod){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('products').doc(String(prod.id)).set(prod);
            console.log('✅ Producto actualizado en Firebase', prod.id);
            return true;
        } catch(e){ console.error('firebaseUpdateProduct', e); return false; }
    }
    async function firebaseUpdateInvoice(inv){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('invoices').doc(String(inv.number)).set(inv);
            console.log('✅ Factura actualizada en Firebase', inv.number);
            return true;
        } catch(e){ console.error('firebaseUpdateInvoice', e); return false; }
    }

    // Patch functions after page loads to ensure originals exist
    function patch(name, wrapper){
        try {
            if (typeof window[name] === 'function'){
                const orig = window[name];
                window[name] = function(){
                    try { return wrapper.apply(this, [orig].concat(Array.from(arguments))); }
                    catch(e){ console.error('Error in patched '+name, e); return orig.apply(this, arguments); }
                };
            }
        } catch(e){ console.error('patch error', e); }
    }

    patch('deleteProduct', function(orig, id){
        const res = orig.apply(this, [id]);
        try {
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine) {
                firebaseDeleteProduct(id).then(ok=>{ if (ok && typeof showAlert==='function') showAlert('☁️ Producto eliminado en Firebase','success'); });
            } else { console.log('Delete product local only; will sync when online.'); }
        } catch(e){ console.error(e); }
        return res;
    });

    patch('editProduct', function(orig, id){
        const res = orig.apply(this, [id]);
        try {
            setTimeout(()=>{
                const prod = (products||[]).find(p=>p.id===id);
                if (prod && window.__mariscos_isFirebaseEnabled && navigator.onLine) {
                    firebaseUpdateProduct(prod).then(ok=>{ if (ok && typeof showAlert==='function') showAlert('☁️ Producto actualizado en Firebase','success'); });
                } else { console.log('Edit product local only; will sync when online.'); }
            }, 300);
        } catch(e){ console.error(e); }
        return res;
    });

    patch('deleteInvoice', function(orig, invoiceNumber){
        const res = orig.apply(this, [invoiceNumber]);
        try {
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine) {
                firebaseDeleteInvoice(invoiceNumber).then(ok=>{ if (ok && typeof showAlert==='function') showAlert('☁️ Factura eliminada en Firebase','success'); });
            } else { console.log('Delete invoice local only; will sync when online.'); }
        } catch(e){ console.error(e); }
        return res;
    });

    patch('generateInvoicePDF', function(orig){
        const res = orig.apply(this, Array.from(arguments).slice(1));
        try {
            setTimeout(()=>{
                const lastInv = (invoiceHistory||[])[invoiceHistory.length-1];
                if (lastInv && window.__mariscos_isFirebaseEnabled && navigator.onLine) {
                    firebaseUpdateInvoice(lastInv).then(ok=>{ if (ok && typeof showAlert==='function') showAlert('☁️ Factura sincronizada en Firebase','success'); });
                } else { console.log('Invoice created local only; will sync when online.'); }
            }, 400);
        } catch(e){ console.error(e); }
        return res;
    });

    // Auto-sync when back online
    window.addEventListener('online', ()=>{
        if (window.__mariscos_isFirebaseEnabled){
            setTimeout(()=>{ if (typeof syncWithFirebase==='function') syncWithFirebase(); }, 1000);
        }
    });

    // Initialize after small delay to allow page functions to exist
    setTimeout(initFirebase, 700);

})(); // end IIFE