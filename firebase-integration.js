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
            return;
        }

        try {
            firebase.initializeApp(firebaseConfig);
            window.__mariscos_db = firebase.firestore();
            window.__mariscos_isFirebaseEnabled = true;
            console.log('✅ Firebase inicializado');
            await firebaseLoadAll();
        } catch(err){
            console.error('Error inicializando Firebase', err);
            window.__mariscos_isFirebaseEnabled = false;
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

    // Save credits to Firestore
    async function firebaseSaveCredits(){
        try {
            if (!window.__mariscos_db) throw new Error('No firestore');
            const db = window.__mariscos_db;
            const batch = db.batch();
            (creditSales || []).forEach(c=>{
                const docRef = db.collection('credits').doc(String(c.id));
                batch.set(docRef, c);
            });
            await batch.commit();
            console.log('✅ Créditos sincronizados a Firebase');
            return true;
        } catch(e){
            console.error('Error firebaseSaveCredits', e);
            return false;
        }
    }

    // Load and merge remote data into localStorage — SIN DUPLICADOS
    async function firebaseLoadAll(){
        try {
            if (!window.__mariscos_db) return;
            const db = window.__mariscos_db;

            // ── Productos ──────────────────────────────────────
            const prodSnap = await db.collection('products').get();
            if (!prodSnap.empty){
                const remote = [];
                prodSnap.forEach(d => remote.push(d.data()));
                const local = JSON.parse(localStorage.getItem('mariscos_products') || '[]');
                const map = new Map();
                local.forEach(p => map.set(p.id, p));
                remote.forEach(p => map.set(p.id, p)); // Firebase tiene prioridad
                products = Array.from(map.values());
                if (products.length > 0) nextProductId = Math.max(...products.map(p => p.id)) + 1;
                localStorage.setItem('mariscos_products', JSON.stringify(products));
                console.log('✅ Productos cargados/mergeados desde Firebase');
            }

            // ── Facturas ───────────────────────────────────────
            const invSnap = await db.collection('invoices').orderBy('fullDateTime','desc').limit(1000).get();
            if (!invSnap.empty){
                const remoteInv = [];
                invSnap.forEach(d => remoteInv.push(d.data()));
                const localInv = JSON.parse(localStorage.getItem('mariscos_invoices') || '[]');
                const imap = new Map();
                localInv.forEach(i => imap.set(i.number, i));
                remoteInv.forEach(i => imap.set(i.number, i)); // Firebase tiene prioridad
                invoiceHistory = Array.from(imap.values());
                localStorage.setItem('mariscos_invoices', JSON.stringify(invoiceHistory));
                console.log('✅ Facturas cargadas/mergeadas desde Firebase');
            }

            // ── Créditos — deduplicar por invoiceNumber ────────
            const credSnap = await db.collection('credits').get();
            if (!credSnap.empty){
                const remoteCredits = [];
                credSnap.forEach(d => remoteCredits.push(d.data()));
                const localCredits = JSON.parse(localStorage.getItem('mariscos_credits') || '[]');
                const cmap = new Map();
                localCredits.forEach(c => cmap.set(c.invoiceNumber, c));
                remoteCredits.forEach(c => cmap.set(c.invoiceNumber, c)); // Firebase tiene prioridad
                creditSales = Array.from(cmap.values());
                if (creditSales.length > 0) nextCreditId = Math.max(...creditSales.map(c => c.id)) + 1;
                localStorage.setItem('mariscos_credits', JSON.stringify(creditSales));
                localStorage.setItem('mariscos_next_credit_id', nextCreditId.toString());
                console.log('✅ Créditos cargados/mergeados desde Firebase');
            } else {
                // Si no hay en Firebase, limpiar duplicados del localStorage
                const localCredits = JSON.parse(localStorage.getItem('mariscos_credits') || '[]');
                const cmap = new Map();
                localCredits.forEach(c => cmap.set(c.invoiceNumber, c));
                creditSales = Array.from(cmap.values());
                localStorage.setItem('mariscos_credits', JSON.stringify(creditSales));
            }

            // Actualizar UI
            if (typeof displayProducts === 'function') displayProducts();
            if (typeof updateReports === 'function') updateReports();
            if (typeof updateInvoiceProductSelect === 'function') updateInvoiceProductSelect();
            if (typeof filterSales === 'function') filterSales();
            if (typeof displayCredits === 'function') displayCredits();
            if (typeof updateStorageMonitor === 'function') updateStorageMonitor();

        } catch(e){
            console.error('Error firebaseLoadAll', e);
        }
    }

    // Expose functions
    window.firebaseSaveProducts = firebaseSaveProducts;
    window.firebaseSaveInvoices = firebaseSaveInvoices;
    window.firebaseSaveCredits  = firebaseSaveCredits;
    window.firebaseLoadAll      = firebaseLoadAll;

    // Override local save functions to also sync automatically
    if (typeof window.saveProducts === 'function'){
        const origSaveProducts = window.saveProducts;
        window.saveProducts = function(){
            try { origSaveProducts(); } catch(e){ console.error('origSaveProducts error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine){
                firebaseSaveProducts();
            }
        };
    }
    if (typeof window.saveInvoices === 'function'){
        const origSaveInvoices = window.saveInvoices;
        window.saveInvoices = function(){
            try { origSaveInvoices(); } catch(e){ console.error('origSaveInvoices error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine){
                firebaseSaveInvoices();
            }
        };
    }
    if (typeof window.saveCredits === 'function'){
        const origSaveCredits = window.saveCredits;
        window.saveCredits = function(){
            try { origSaveCredits(); } catch(e){ console.error('origSaveCredits error', e); }
            if (window.__mariscos_isFirebaseEnabled && navigator.onLine){
                firebaseSaveCredits();
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
            await firebaseSaveCredits();
            if (typeof showAlert==='function') showAlert('✅ Sincronización con Firebase completada','success');
        } catch(e){
            console.error('syncWithFirebase error', e);
            if (typeof showAlert==='function') showAlert('❌ Error sincronizando con Firebase','danger');
        }
    };

    window.migrateToFirebase = async function(){
        try {
            if (!window.__mariscos_isFirebaseEnabled){ if (typeof showAlert==='function') showAlert('⚠️ Firebase no configurado','warning'); return; }
            if (!navigator.onLine){ if (typeof showAlert==='function') showAlert('⚠️ Sin conexión','warning'); return; }
            if (!confirm('¿Confirmas migrar los datos locales a Firebase?')) return;
            const ok1 = await firebaseSaveProducts();
            const ok2 = await firebaseSaveInvoices();
            const ok3 = await firebaseSaveCredits();
            if (ok1 && ok2 && ok3){ if (typeof showAlert==='function') showAlert('📤 Migración completa','success'); }
            else { if (typeof showAlert==='function') showAlert('⚠️ Migración parcial, revisa la consola','warning'); }
        } catch(e){
            console.error('migrateToFirebase error', e);
            if (typeof showAlert==='function') showAlert('❌ Error durante migración','danger');
        }
    };

    // Delete/update helpers
    async function firebaseDeleteProduct(id){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('products').doc(String(id)).delete();
            return true;
        } catch(e){ console.error('firebaseDeleteProduct', e); return false; }
    }
    async function firebaseDeleteInvoice(number){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('invoices').doc(String(number)).delete();
            return true;
        } catch(e){ console.error('firebaseDeleteInvoice', e); return false; }
    }
    async function firebaseDeleteCredit(id){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('credits').doc(String(id)).delete();
            return true;
        } catch(e){ console.error('firebaseDeleteCredit', e); return false; }
    }
    async function firebaseUpdateProduct(prod){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('products').doc(String(prod.id)).set(prod);
            return true;
        } catch(e){ console.error('firebaseUpdateProduct', e); return false; }
    }
    async function firebaseUpdateInvoice(inv){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('invoices').doc(String(inv.number)).set(inv);
            return true;
        } catch(e){ console.error('firebaseUpdateInvoice', e); return false; }
    }
    async function firebaseUpdateCredit(credit){
        try{
            if (!window.__mariscos_isFirebaseEnabled || !window.__mariscos_db) return false;
            await window.__mariscos_db.collection('credits').doc(String(credit.id)).set(credit);
            return true;
        } catch(e){ console.error('firebaseUpdateCredit', e); return false; }
    }

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
        if (window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseDeleteProduct(id);
        return res;
    });

    patch('editProduct', function(orig, id){
        const res = orig.apply(this, [id]);
        setTimeout(()=>{
            const prod = (products||[]).find(p=>p.id===id);
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
        setTimeout(()=>{
            const lastInv = (invoiceHistory||[])[invoiceHistory.length-1];
            if (lastInv && window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseUpdateInvoice(lastInv);
            const lastCredit = (creditSales||[])[creditSales.length-1];
            if (lastCredit && window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseUpdateCredit(lastCredit);
        }, 400);
        return res;
    });

    patch('registerPayment', function(orig, creditId){
        const res = orig.apply(this, [creditId]);
        setTimeout(()=>{
            const credit = (creditSales||[]).find(c=>c.id===creditId);
            if (credit && window.__mariscos_isFirebaseEnabled && navigator.onLine) firebaseUpdateCredit(credit);
        }, 300);
        return res;
    });

    // Auto-sync cuando vuelve la conexión
    window.addEventListener('online', ()=>{
        if (window.__mariscos_isFirebaseEnabled){
            setTimeout(()=>{ if (typeof syncWithFirebase==='function') syncWithFirebase(); }, 1000);
        }
    });

    setTimeout(initFirebase, 700);

})();
