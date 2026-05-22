// ============================================
// AUTENTICACIÓN
// ============================================

// Estado actual del usuario
let currentUser = null;

// ---------- LOGIN ----------
async function login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showError('login-error', 'Email o contraseña incorrectos');
        return false;
    }

    currentUser = data.user;
    showApp();
    return true;
}

// ---------- LOGOUT ----------
async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    showLogin();
}

// ---------- CHECK SESSION ON LOAD ----------
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        showLogin();
    }
}

// ---------- UI HELPERS ----------
function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    document.getElementById('user-email').textContent = currentUser.email;
    // Cargar la vista por defecto (pendientes)
    showSection('pendientes');
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
}

// ---------- EVENT LISTENERS ----------
document.addEventListener('DOMContentLoaded', () => {
    // Form de login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        await login(email, password);
    });

    // Botón logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Chequear sesión al cargar
    checkSession();
});
