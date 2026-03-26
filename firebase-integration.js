// ============================================================
// firebase-integration.js
// Backend: sincronización con Firebase Firestore en tiempo real.
// ============================================================
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

    let _unsubProducts   = null;
    let _unsubInvoices   = null;
    let _unsubCredits    = null;
    let _initialLoadDone = false;

    // Flag para evitar el ciclo: onSnapshot actualiza local
    // → decorator sube de vuelta lo que se borró en otro dispositivo
    window.__mariscos_syncingFromFirebase = false;

    // ── Carga dinámica de scripts ──────────────────────────────
    function loadScript(src){
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => res();
            s.onerror = () => rej(new Error('Failed to load ' + src));
            document.head.appendChild(s);
        });
    }

    // ── Inicialización ─────────────────────────────────────────
    async function initFirebase(){
        try {
            await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js');
        } catch(e){
            console.warn('No se pudo cargar Firebase scripts:', e);
            window.__mariscos_isFirebaseEnabled = false;
            return;
        }
        try {
            firebase.initializeApp(firebaseConfig);
            window.__mariscos_db = firebase.firestore();
            window.__mariscos_isFirebaseEnabled = true;
            console.log('✅ Firebase inicializado');
            await firebaseLoadAll();
            activateRealtimeListeners();
            _initialLoadDone = true;
        } catch(err){
            console.error('Error inicializando Firebase', err);
            window.__mariscos_isFirebaseEnabled = false;
        }
    }

    // ── Listeners en tiempo real ───────────────────────────────
    function activateRealtimeListeners(){
        const db = window.__mariscos_db;
        if (!db) return;

        // Productos
        _unsubProducts = db.collection('products').onSnapshot(snap => {
            if (!_initialLoadDone) return;
            window.__mariscos_syncingFromFirebase = true;
            const remote = [];
            snap.forEach(d => remote.push(d.data()));
            products = remote;
            if (products.length > 0)
                nextProductId = Math.max(...products.map(p => p.id)) + 1;
            localStorage.setItem('mariscos_products', JSON.stringify(products));
            localStorage.setItem('mariscos_next_id', nextProductId.toString());
            window.__mariscos_syncingFromFirebase = false;
            console.log('🔄 Productos en tiempo real:', products.length);
            if (typeof displayProducts === 'function')            displayProducts();
            if (typeof updateReports === 'function')              updateReports();
            if (typeof updateDashboard === 'function')            updateDashboard();
            if (typeof updateInvoiceProductSelect === 'function') updateInvoiceProductSelect();
            if (typeof updateStorageMonitor === 'function')       updateStorageMonitor();
        }, err => console.error('Error listener productos:', err));

        // Facturas — merge entre local y Firebase
        // Local tiene prioridad para no perder facturas que aun no
        // llegaron a Firestore cuando el snapshot dispara
        _unsubInvoices = db.collection('invoices').onSnapshot(snap => {
            if (!_initialLoadDone) return;
            window.__mariscos_syncingFromFirebase = true;

            const remote = [];
            snap.forEach(d => remote.push(d.data()));

            // Merge: Firebase primero, luego local sobreescribe
            // Asi la factura nueva (que aun no llego a Firebase) no se pierde
            const local = JSON.parse(localStorage.getItem('mariscos_invoices') || '[]');
            const imap  = new Map();
            remote.forEach(i => imap.set(i.number, i));
            local.forEach(i => imap.set(i.number, i));  // local gana en conflicto
            invoiceHistory = Array.from(imap.values());
            localStorage.setItem('mariscos_invoices', JSON.stringify(invoiceHistory));

            window.__mariscos_syncingFromFirebase = false;
            console.log('🔄 Facturas en tiempo real:', invoiceHistory.length);
            if (typeof updateReports === 'function')        updateReports();
            if (typeof updateDashboard === 'function')      updateDashboard();
            if (typeof filterSales === 'function')          filterSales();
            if (typeof updateStorageMonitor === 'function') updateStorageMonitor();
        }, err => console.error('Error listener facturas:', err));

        // Créditos
        _unsubCredits = db.collection('credits').onSnapshot(snap => {
            if (!_initialLoadDone) return;
            window.__mariscos_syncingFromFirebase = true;
            const remote = [];
            snap.forEach(d => remote.push(d.data()));
            creditSales = remote;
            if (creditSales.length > 0)
                nextCreditId = Math.max(...creditSales.map(c => c.id)) + 1;
            localStorage.setItem('mariscos_credits', JSON.stringify(creditSales));
            localStorage.setItem('mariscos_next_credit_id', nextCreditId.toString());
            window.__mariscos_syncingFromFirebase = false;
            console.log('🔄 Créditos en tiempo real:', creditSales.length);
            if (typeof displayCredits === 'function')         displayCredits();
            if (typeof updateDashboard === 'function')        updateDashboard();
            if (typeof updateStorageMonitor === 'function')   updateStorageMonitor();
        }, err => console.error('Error listener créditos:', err));

        console.log('✅ Listeners en tiempo real activados');
    }

    // ── Cancelar listeners al cerrar sesión ───────────────────
    window.detachFirebaseListeners = function(){
        if (_unsubProducts) { _unsubProducts(); _unsubProducts = null; }
        if (_unsubInvoices) { _unsubInvoices(); _unsubInvoices = null; }
        if (_unsubCredits)  { _unsubCredits();  _unsubCredits  = null; }
        _initialLoadDone = false;
        window.__mariscos_syncingFromFirebase = false;
        console.log('🔌 Listeners desconectados');
    };

    // ── Guardar productos (batch por chunks de 499) ────────────
    async function firebaseSaveProducts(){
        try {
            if (!window.__mariscos_db) throw new Error('No firestore');
            const db  = window.__mariscos_db;
            const all = (products || []);
            for (let i = 0; i < all.length; i += 499){
                const batch = db.batch();
                all.slice(i, i + 499).forEach(p => {
                    batch.set(db.collection('products').doc(String(p.id)), p);
                });
                await batch.commit();
            }
            console.log('✅ Productos sincronizados:', all.length);
            return true;
        } catch(e){ console.error('Error firebaseSaveProducts', e); return false; }
    }

    // ── Guardar UNA factura (la más reciente) ──────────────────
    // Usar set individual evita reescribir toda la colección
    // y elimina la carrera que borraba facturas al llegar a 7+
    async function firebaseSaveInvoices(){
        try {
            if (!window.__mariscos_db) throw new Error('No firestore');
            const db  = window.__mariscos_db;
            const all = (invoiceHistory || []);
            if (all.length === 0) return true;
            // Solo guardar la última — las anteriores ya están en Firebase
            const last = all[all.length - 1];
            await db.collection('invoices').doc(String(last.number)).set(last);
            console.log('✅ Factura guardada en Firebase:', last.number);
            return true;
        } catch(e){ console.error('Error firebaseSaveInvoices', e); return false; }
    }

    // ── Guardar TODAS las facturas (para sync y migración) ─────
    async function firebaseSaveAllInvoices(){
        try {
            if (!window.__mariscos_db) throw new Error('No firestore');
            const db  = window.__mariscos_db;
            const all = (invoiceHistory || []);
            for (let i = 0; i < all.length; i += 499){
                const batch = db.batch();
                all.slice(i, i + 499).forEach(inv => {
                    batch.set(db.collection('invoices').doc(String(inv.number)), inv);
                });
                await batch.commit();
            }
            console.log('✅ Todas las facturas sincronizadas:', all.length);
            return true;
        } catch(e){ console.error('Error firebaseSaveAllInvoices', e); return false; }
    }

    // ── Guardar créditos (batch por chunks de 499) ─────────────
    async function firebaseSaveCredits(){
        try {
            if (!window.__mariscos_db) throw new Error('No firestore');
            const db  = window.__mariscos_db;
            const all = (creditSales || []);
            for (let i = 0; i < all.length; i += 499){
                const batch = db.batch();
                all.slice(i, i + 499).forEach(c => {
                    batch.set(db.collection('credits').doc(String(c.id)), c);
                });
                await batch.commit();
            }
            console.log('✅ Créditos sincronizados:', all.length);
            return true;
        } catch(e){ console.error('Error firebaseSaveCredits', e); return false; }
    }

    // ── Carga inicial con merge ────────────────────────────────
    async function firebaseLoadAll(){
        try {
            if (!window.__mariscos_db) return;
            const db = window.__mariscos_db;

            // Productos
            const prodSnap = await db.collection('products').get();
            if (!prodSnap.empty){
                const remote = [];
                prodSnap.forEach(d => remote.push(d.data()));
                const local = JSON.parse(localStorage.getItem('mariscos_products') || '[]');
                const map = new Map();
                local.forEach(p => map.set(p.id, p));
                remote.forEach(p => map.set(p.id, p));
                products = Array.from(map.values());
                if (products.length > 0) nextProductId = Math.max(...products.map(p => p.id)) + 1;
                localStorage.setItem('mariscos_products', JSON.stringify(products));
                console.log('✅ Productos cargados desde Firebase:', products.length);
            }

            // Facturas — sin orderBy para evitar índice compuesto
            const invSnap = await db.collection('invoices').get();
            if (!invSnap.empty){
                const remoteInv = [];
                invSnap.forEach(d => remoteInv.push(d.data()));
                const localInv = JSON.parse(localStorage.getItem('mariscos_invoices') || '[]');
                const imap = new Map();
                localInv.forEach(i => imap.set(i.number, i));
                remoteInv.forEach(i => imap.set(i.number, i));
                invoiceHistory = Array.from(imap.values());
                localStorage.setItem('mariscos_invoices', JSON.stringify(invoiceHistory));
                console.log('✅ Facturas cargadas desde Firebase:', invoiceHistory.length);
            }

            // Créditos
            const credSnap = await db.collection('credits').get();
            if (!credSnap.empty){
                const remoteCredits = [];
                credSnap.forEach(d => remoteCredits.push(d.data()));
                const localCredits = JSON.parse(localStorage.getItem('mariscos_credits') || '[]');
                const cmap = new Map();
                localCredits.forEach(c => cmap.set(c.invoiceNumber, c));
                remoteCredits.forEach(c => cmap.set(c.invoiceNumber, c));
                creditSales = Array.from(cmap.values());
                if (creditSales.length > 0) nextCreditId = Math.max(...creditSales.map(c => c.id)) + 1;
                localStorage.setItem('mariscos_credits', JSON.stringify(creditSales));
                console.log('✅ Créditos cargados desde Firebase:', creditSales.length);
            } else {
                const localCredits = JSON.parse(localStorage.getItem('mariscos_credits') || '[]');
                const cmap = new Map();
                localCredits.forEach(c => cmap.set(c.invoiceNumber, c));
                creditSales = Array.from(cmap.values());
                localStorage.setItem('mariscos_credits', JSON.stringify(creditSales));
            }

            if (typeof displayProducts === 'function')            displayProducts();
            if (typeof updateReports === 'function')              updateReports();
            if (typeof updateDashboard === 'function')            updateDashboard();
            if (typeof updateInvoiceProductSelect === 'function') updateInvoiceProductSelect();
            if (typeof filterSales === 'function')                filterSales();
            if (typeof displayCredits === 'function')             displayCredits();
            if (typeof updateStorageMonitor === 'function')       updateStorageMonitor();

        } catch(e){ console.error('Error firebaseLoadAll', e); }
    }

    // ── Exponer funciones públicas ─────────────────────────────
    window.firebaseSaveProducts = firebaseSaveProducts;
    window.firebaseSaveInvoices = firebaseSaveInvoices;
    window.firebaseSaveCredits  = firebaseSaveCredits;
    window.firebaseLoadAll      = firebaseLoadAll;

    // ── Decorators — no suben si viene de Firebase ─────────────
    if (typeof window.saveProducts === 'function'){
        const orig = window.saveProducts;
        window.saveProducts = function(){
            try { orig(); } catch(e){ console.error('origSaveProducts error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine
                && !window.__mariscos_syncingFromFirebase){
                firebaseSaveProducts();
            }
        };
    }
    if (typeof window.saveInvoices === 'function'){
        const orig = window.saveInvoices;
        window.saveInvoices = function(){
            try { orig(); } catch(e){ console.error('origSaveInvoices error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine
                && !window.__mariscos_syncingFromFirebase){
                firebaseSaveInvoices(); // solo guarda la última
            }
        };
    }
    if (typeof window.saveCredits === 'function'){
        const orig = window.saveCredits;
        window.saveCredits = function(){
            try { orig(); } catch(e){ console.error('origSaveCredits error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine
                && !window.__mariscos_syncingFromFirebase){
                firebaseSaveCredits();
            }
        };
    }

    // ── Sincronización manual (usa sync completo de facturas) ──
    window.syncWithFirebase = async function(){
        try {
            if (!window.__mariscos_isFirebaseEnabled){
                if (typeof showAlert === 'function') showAlert('Firebase no configurado', 'warning'); return;
            }
            if (!navigator.onLine){
                if (typeof showAlert === 'function') showAlert('Sin conexión a internet', 'warning'); return;
            }
            if (typeof showAlert === 'function') showAlert('Iniciando sincronización...', 'info');
            await firebaseSaveProducts();
            await firebaseSaveAllInvoices();
            await firebaseSaveCredits();
            if (typeof showAlert === 'function') showAlert('Sincronización completada', 'success');
        } catch(e){
            console.error('syncWithFirebase error', e);
            if (typeof showAlert === 'function') showAlert('Error sincronizando', 'danger');
        }
    };

    window.migrateToFirebase = async function(){
        try {
            if (!window.__mariscos_isFirebaseEnabled){
                if (typeof showAlert === 'function') showAlert('Firebase no configurado', 'warning'); return;
            }
            if (!navigator.onLine){
                if (typeof showAlert === 'function') showAlert('Sin conexión a internet', 'warning'); return;
            }
            if (!confirm('¿Confirmas migrar los datos locales a Firebase?')) return;
            const ok1 = await firebaseSaveProducts();
            const ok2 = await firebaseSaveAllInvoices();
            const ok3 = await firebaseSaveCredits();
            if (ok1 && ok2 && ok3){
                if (typeof showAlert === 'function') showAlert('Migración completa', 'success');
            } else {
                if (typeof showAlert === 'function') showAlert('Migración parcial, revisa la consola', 'warning');
            }
        } catch(e){
            console.error('migrateToFirebase error', e);
            if (typeof showAlert === 'function') showAlert('Error durante migración', 'danger');
        }
    };

    // ── Limpieza total ─────────────────────────────────────────
    window.clearAllInvoices = async function(){
        if (!confirm('ATENCIÓN: Esto eliminará TODAS las facturas.\n\n¿Confirmas?')) return;
        if (!confirm('¿Estás completamente seguro?')) return;
        if (window.__mariscos_isFirebaseEnabled && navigator.onLine && window.__mariscos_db){
            try {
                const snap = await window.__mariscos_db.collection('invoices').get();
                if (!snap.empty){
                    const batch = window.__mariscos_db.batch();
                    snap.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } catch(e){ console.error('Error borrando facturas', e); }
        }
        invoiceHistory = [];
        localStorage.setItem('mariscos_invoices', '[]');
        if (typeof showAlert === 'function')       showAlert('Todas las facturas eliminadas', 'success');
        if (typeof updateReports === 'function')   updateReports();
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof filterSales === 'function')     filterSales();
    };

    window.clearAllProducts = async function(){
        if (!confirm('ATENCIÓN: Esto eliminará TODOS los productos.\n\n¿Confirmas?')) return;
        if (window.__mariscos_isFirebaseEnabled && navigator.onLine && window.__mariscos_db){
            try {
                const snap = await window.__mariscos_db.collection('products').get();
                if (!snap.empty){
                    const batch = window.__mariscos_db.batch();
                    snap.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } catch(e){ console.error('Error borrando productos', e); }
        }
        products = []; nextProductId = 1;
        localStorage.setItem('mariscos_products', '[]');
        localStorage.setItem('mariscos_next_id', '1');
        if (typeof showAlert === 'function')         showAlert('Todos los productos eliminados', 'success');
        if (typeof displayProducts === 'function')   displayProducts();
        if (typeof updateDashboard === 'function')   updateDashboard();
    };

    window.clearAllCredits = async function(){
        if (!confirm('ATENCIÓN: Esto eliminará TODOS los créditos.\n\n¿Confirmas?')) return;
        if (window.__mariscos_isFirebaseEnabled && navigator.onLine && window.__mariscos_db){
            try {
                const snap = await window.__mariscos_db.collection('credits').get();
                if (!snap.empty){
                    const batch = window.__mariscos_db.batch();
                    snap.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } catch(e){ console.error('Error borrando créditos', e); }
        }
        creditSales = []; nextCreditId = 1;
        localStorage.setItem('mariscos_credits', '[]');
        localStorage.setItem('mariscos_next_credit_id', '1');
        if (typeof showAlert === 'function')        showAlert('Todos los créditos eliminados', 'success');
        if (typeof displayCredits === 'function')   displayCredits();
        if (typeof updateDashboard === 'function')  updateDashboard();
    };

    // ── Helpers individuales ───────────────────────────────────
    async function firebaseDeleteProduct(id){
        try {
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('products').doc(String(id)).delete();
            return true;
        } catch(e){ console.error('firebaseDeleteProduct', e); return false; }
    }
    async function firebaseDeleteInvoice(number){
        try {
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('invoices').doc(String(number)).delete();
            return true;
        } catch(e){ console.error('firebaseDeleteInvoice', e); return false; }
    }
    async function firebaseDeleteCredit(id){
        try {
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('credits').doc(String(id)).delete();
            return true;
        } catch(e){ console.error('firebaseDeleteCredit', e); return false; }
    }
    async function firebaseUpdateProduct(prod){
        try {
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('products').doc(String(prod.id)).set(prod);
            return true;
        } catch(e){ console.error('firebaseUpdateProduct', e); return false; }
    }
    async function firebaseUpdateInvoice(inv){
        try {
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('invoices').doc(String(inv.number)).set(inv);
            return true;
        } catch(e){ console.error('firebaseUpdateInvoice', e); return false; }
    }
    async function firebaseUpdateCredit(credit){
        try {
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('credits').doc(String(credit.id)).set(credit);
            return true;
        } catch(e){ console.error('firebaseUpdateCredit', e); return false; }
    }

    // ── Patches ────────────────────────────────────────────────
    function patch(name, wrapper){
        try {
            if (typeof window[name] === 'function'){
                const orig = window[name];
                window[name] = function(){
                    try { return wrapper.apply(this, [orig].concat(Array.from(arguments))); }
                    catch(e){ console.error('Error in patched ' + name, e); return orig.apply(this, arguments); }
                };
            }
        } catch(e){ console.error('patch error', e); }
    }

    patch('deleteProduct', function(orig, id){
        const res = orig.apply(this, [id]);
        if (window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseDeleteProduct(id);
        return res;
    });
    patch('editProduct', function(orig, id){
        const res = orig.apply(this, [id]);
        setTimeout(() => {
            const prod = (products || []).find(p => p.id === id);
            if (prod && window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseUpdateProduct(prod);
        }, 300);
        return res;
    });
    patch('deleteInvoice', function(orig, invoiceNumber){
        const res = orig.apply(this, [invoiceNumber]);
        if (window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseDeleteInvoice(invoiceNumber);
        return res;
    });
    patch('deleteCredit', function(orig, creditId){
        const res = orig.apply(this, [creditId]);
        if (window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseDeleteCredit(creditId);
        return res;
    });
    patch('generateInvoicePDF', function(orig){
        const res = orig.apply(this, Array.from(arguments).slice(1));
        setTimeout(() => {
            const lastInv = (invoiceHistory || [])[invoiceHistory.length - 1];
            if (lastInv && window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseUpdateInvoice(lastInv);
            const lastCredit = (creditSales || [])[creditSales.length - 1];
            if (lastCredit && window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseUpdateCredit(lastCredit);
        }, 400);
        return res;
    });
    patch('registerPayment', function(orig, creditId){
        const res = orig.apply(this, [creditId]);
        setTimeout(() => {
            const credit = (creditSales || []).find(c => c.id === creditId);
            if (credit && window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseUpdateCredit(credit);
        }, 300);
        return res;
    });

    // ── Auto-sync al recuperar conexión ───────────────────────
    window.addEventListener('online', () => {
        if (window.__mariscos_isFirebaseEnabled){
            console.log('🌐 Conexión recuperada — sincronizando...');
            setTimeout(() => {
                if (typeof syncWithFirebase === 'function') syncWithFirebase();
            }, 1000);
        }
    });

    // ── Desconectar listeners al hacer logout ──────────────────
    const _origLogout = window.handleLogout;
    if (typeof _origLogout === 'function'){
        window.handleLogout = function(){
            if (typeof window.detachFirebaseListeners === 'function') window.detachFirebaseListeners();
            return _origLogout.apply(this, arguments);
        };
    }

    setTimeout(initFirebase, 700);

})();
