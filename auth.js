// ============================================================
// auth.js — Login, logout y sesión automática
// ============================================================

function updateMaintenanceVisibility(user) {
    const tab = document.querySelector('[data-tab="maintenance"]');
    if (!tab) return;
    tab.style.display = (user === 'Tuko') ? '' : 'none';
}

function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (users[username] && users[username] === password) {
        currentUser = username;
        isLoggedIn = true;
        localStorage.setItem('current_user', currentUser);

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainSystem').classList.remove('hidden');
        document.getElementById('currentUser').textContent = username;

        updateMaintenanceVisibility(username);
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

function checkAutoLogin() {
    const savedUser = localStorage.getItem('current_user');

    if (savedUser && !users[savedUser]) {
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

        updateMaintenanceVisibility(savedUser);
        initializeSystem();
    }
}