// ============================================
// APP - Navegación y helpers
// ============================================
let currentSection = 'nuevos';

function showSection(section) {
    currentSection = section;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.nav-btn[data-section="${section}"]`)?.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const sectionEl = document.getElementById(`section-${section}`);
    if (sectionEl) sectionEl.style.display = 'block';

    switch (section) {
        case 'nuevo': initNuevoPedido(); break;
        case 'nuevos': cargarPedidos('nuevo'); break;
        case 'preparados': cargarPedidos('preparado'); break;
        case 'despachados': cargarPedidos('despachado'); break;
        case 'finalizados': cargarPedidos('finalizado'); break;
        case 'clientes': cargarClientes(); break;
        case 'transportes': cargarTransportes(); break;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.getAttribute('data-section')));
    });
});

// ---------- HELPERS ----------
function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function diasDesde(d) {
    if (!d) return 0;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

// Horas hábiles desde una fecha (lun-vie, sin feriados)
function horasHabilesDesde(fechaStr) {
    if (!fechaStr) return 0;
    const start = new Date(fechaStr);
    const end = new Date();
    if (end <= start) return 0;

    let horas = 0;
    const cursor = new Date(start);
    while (cursor < end) {
        const dow = cursor.getDay(); // 0=dom, 6=sáb
        if (dow !== 0 && dow !== 6) horas++;
        cursor.setTime(cursor.getTime() + 3600000); // +1h
    }
    return horas;
}

function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast toast-${type}`;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3500);
}

function sanitizeFilename(name) {
    return name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .toLowerCase();
}

async function buscarClientePorDNI(dni) {
    const { data } = await supabaseClient.from('clientes').select('*').eq('dni', dni).maybeSingle();
    return data;
}

async function crearCliente(clienteData) {
    const { data, error } = await supabaseClient.from('clientes').insert([clienteData]).select().single();
    if (error) { toast('Error al crear cliente: ' + error.message, 'error'); return null; }
    return data;
}

async function verArchivo(bucket, filename) {
    if (!filename) { toast('No hay archivo', 'error'); return; }
    const nuevaPestana = window.open('', '_blank');
    if (!nuevaPestana) { toast('Habilitá popups para este sitio', 'error'); return; }
    nuevaPestana.document.write('<p style="font-family:sans-serif;padding:2rem;">Cargando...</p>');
    const { data, error } = await supabaseClient.storage.from(bucket).createSignedUrl(filename, 3600);
    if (error) { nuevaPestana.close(); toast('Error: ' + error.message, 'error'); return; }
    nuevaPestana.location.href = data.signedUrl;
}
