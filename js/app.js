// ============================================
// APP - Navegación y lógica principal
// ============================================

let currentSection = 'pendientes';

// ---------- NAVEGACIÓN ENTRE SECCIONES ----------
function showSection(section) {
    currentSection = section;

    // Actualizar nav activo
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.nav-btn[data-section="${section}"]`)?.classList.add('active');

    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(s => {
        s.style.display = 'none';
    });

    // Mostrar la sección seleccionada
    const sectionEl = document.getElementById(`section-${section}`);
    if (sectionEl) sectionEl.style.display = 'block';

    // Cargar datos según sección
    switch (section) {
        case 'nuevo': initNuevoPedido(); break;
        case 'pendientes': cargarPedidos('pendiente_aprobacion'); break;
        case 'aprobados': cargarPedidos('aprobado'); break;
        case 'despachados': cargarPedidos('despachado'); break;
        case 'finalizados': cargarPedidos('finalizado'); break;
        case 'clientes': cargarClientes(); break;
    }
}

// ---------- EVENT LISTENERS DE NAV ----------
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-section');
            showSection(section);
        });
    });
});

// ---------- HELPERS ----------
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR');
}

function diasDesde(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function toast(message, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = message;
    t.className = `toast toast-${type}`;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3500);
}

// ---------- BUSCAR CLIENTE POR DNI ----------
async function buscarClientePorDNI(dni) {
    const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('dni', dni)
        .maybeSingle();

    if (error) {
        console.error(error);
        return null;
    }
    return data;
}

// ---------- CREAR CLIENTE ----------
async function crearCliente(clienteData) {
    const { data, error } = await supabaseClient
        .from('clientes')
        .insert([clienteData])
        .select()
        .single();

    if (error) {
        toast('Error al crear cliente: ' + error.message, 'error');
        return null;
    }
    return data;
}
