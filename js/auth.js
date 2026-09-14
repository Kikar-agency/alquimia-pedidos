let currentUser = null;

async function login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { showError('login-error', 'Email o contraseña incorrectos'); return false; }
    currentUser = data.user;
    showApp();
    return true;
}

async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    showLogin();
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { currentUser = session.user; showApp(); }
    else showLogin();
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    document.getElementById('user-email').textContent = currentUser.email;
    showSection('nuevos');
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 4000); }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login(document.getElementById('login-email').value, document.getElementById('login-password').value);
    });
    document.getElementById('logout-btn').addEventListener('click', logout);
    checkSession();
});
