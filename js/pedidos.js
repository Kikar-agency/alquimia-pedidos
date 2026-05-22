// ============================================
// PEDIDOS - CRUD y lógica de negocio
// ============================================

// Estado actual para nuevo pedido
let clienteSeleccionado = null;

// ============================================
// HELPER: Sanitizar nombre de archivo
// ============================================
// Supabase Storage rechaza espacios, acentos, paréntesis, etc.
// Esto deja solo letras, números, puntos, guiones y guiones bajos.
function sanitizeFilename(name) {
    return name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sacar acentos
        .replace(/\s+/g, '_')                              // espacios → guion bajo
        .replace(/[^a-zA-Z0-9._-]/g, '')                   // sacar todo lo raro
        .toLowerCase();
}

// ============================================
// NUEVO PEDIDO
// ============================================
function initNuevoPedido() {
    clienteSeleccionado = null;
    document.getElementById('form-nuevo-pedido').reset();
    document.getElementById('cliente-encontrado').style.display = 'none';
    document.getElementById('cliente-nuevo').style.display = 'none';
    document.getElementById('btn-crear-pedido').style.display = 'none';
}

// Búsqueda de cliente por DNI
document.addEventListener('DOMContentLoaded', () => {
    const btnBuscarCliente = document.getElementById('btn-buscar-cliente');
    if (btnBuscarCliente) {
        btnBuscarCliente.addEventListener('click', async () => {
            const dni = document.getElementById('input-dni').value.trim();
            if (!dni) {
                toast('Ingresá un DNI', 'error');
                return;
            }
            const cliente = await buscarClientePorDNI(dni);
            if (cliente) {
                // Cliente encontrado
                clienteSeleccionado = cliente;
                document.getElementById('cliente-nuevo').style.display = 'none';
                const info = document.getElementById('cliente-encontrado');
                info.innerHTML = `
                    <div class="cliente-card">
                        <strong>${cliente.nombre_completo}</strong> (DNI: ${cliente.dni})<br>
                        ${cliente.direccion || ''} - ${cliente.ciudad || ''}, ${cliente.provincia || ''} (CP: ${cliente.cp || '-'})<br>
                        Envío preferido: <strong>${cliente.envio_preferido || '-'}</strong>
                    </div>
                `;
                info.style.display = 'block';
                document.getElementById('btn-crear-pedido').style.display = 'inline-block';
            } else {
                // Cliente nuevo - mostrar formulario
                clienteSeleccionado = null;
                document.getElementById('cliente-encontrado').style.display = 'none';
                document.getElementById('cliente-nuevo').style.display = 'block';
                document.getElementById('nuevo-dni').value = dni;
                document.getElementById('btn-crear-pedido').style.display = 'inline-block';
            }
        });
    }

    // Crear pedido
    const formNuevoPedido = document.getElementById('form-nuevo-pedido');
    if (formNuevoPedido) {
        formNuevoPedido.addEventListener('submit', async (e) => {
            e.preventDefault();
            await crearPedido();
        });
    }
});

async function crearPedido() {
    const btn = document.getElementById('btn-crear-pedido');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        // 1. Si es cliente nuevo, crearlo primero
        if (!clienteSeleccionado) {
            const nuevoCliente = {
                dni: document.getElementById('nuevo-dni').value.trim(),
                nombre_completo: document.getElementById('nuevo-nombre').value.trim(),
                provincia: document.getElementById('nuevo-provincia').value.trim(),
                ciudad: document.getElementById('nuevo-ciudad').value.trim(),
                direccion: document.getElementById('nuevo-direccion').value.trim(),
                cp: document.getElementById('nuevo-cp').value.trim(),
                envio_preferido: document.getElementById('nuevo-envio').value,
                telefono: document.getElementById('nuevo-telefono').value.trim(),
                email: document.getElementById('nuevo-email').value.trim()
            };
            if (!nuevoCliente.dni || !nuevoCliente.nombre_completo) {
                toast('DNI y nombre son obligatorios', 'error');
                btn.disabled = false;
                btn.textContent = 'Crear pedido';
                return;
            }
            clienteSeleccionado = await crearCliente(nuevoCliente);
            if (!clienteSeleccionado) {
                btn.disabled = false;
                btn.textContent = 'Crear pedido';
                return;
            }
        }

        // 2. Subir archivo de factura
        const fileInput = document.getElementById('input-factura');
        const file = fileInput.files[0];
        if (!file) {
            toast('Subí el archivo de la factura', 'error');
            btn.disabled = false;
            btn.textContent = 'Crear pedido';
            return;
        }

        const filename = `${Date.now()}_${sanitizeFilename(file.name)}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('facturas')
            .upload(filename, file);

        if (uploadError) {
            toast('Error al subir factura: ' + uploadError.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Crear pedido';
            return;
        }

        // 3. Crear el pedido
        const metodoPago = document.getElementById('input-metodo-pago').value;
        const metodoEnvio = document.getElementById('input-metodo-envio').value 
                          || clienteSeleccionado.envio_preferido;

        const pedido = {
            cliente_id: clienteSeleccionado.id,
            factura_url: filename,
            factura_filename: file.name,
            metodo_envio: metodoEnvio,
            metodo_pago: metodoPago,
            nota: document.getElementById('input-nota').value.trim(),
            es_urgente: document.getElementById('input-urgente').checked,
            estado: 'pendiente_aprobacion',
            created_by: currentUser.id
        };

        const { data, error } = await supabaseClient
            .from('pedidos')
            .insert([pedido])
            .select()
            .single();

        if (error) {
            toast('Error al crear pedido: ' + error.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Crear pedido';
            return;
        }

        toast(`✅ Pedido #${data.id} creado`);
        showSection('pendientes');
    } catch (err) {
        console.error(err);
        toast('Error inesperado', 'error');
        btn.disabled = false;
        btn.textContent = 'Crear pedido';
    }
}

// ============================================
// LISTAR PEDIDOS
// ============================================
async function cargarPedidos(estado) {
    const lista = document.getElementById(`lista-${estado === 'pendiente_aprobacion' ? 'pendientes' : estado + 's'}`);
    if (!lista) return;

    lista.innerHTML = '<p class="loading">Cargando...</p>';

    // Query con ordenamiento: urgentes primero, después más viejos arriba
    let query = supabaseClient
        .from('pedidos_completos')
        .select('*')
        .eq('estado', estado);

    if (estado === 'aprobado') {
        // Urgentes primero, después por antigüedad
        query = query.order('es_urgente', { ascending: false })
                     .order('created_at', { ascending: true });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        lista.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        lista.innerHTML = '<p class="empty">No hay pedidos en esta sección.</p>';
        return;
    }

    // Aplicar filtros (si existen)
    const filtros = obtenerFiltros(estado);
    let pedidosFiltrados = data;
    if (filtros.cliente) {
        pedidosFiltrados = pedidosFiltrados.filter(p =>
            (p.cliente_nombre || '').toLowerCase().includes(filtros.cliente.toLowerCase()) ||
            (p.cliente_dni || '').includes(filtros.cliente)
        );
    }
    if (filtros.envio) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.metodo_envio === filtros.envio);
    }
    if (filtros.pagoRetiro && estado === 'finalizado') {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.pago_retiro_pendiente);
    }

    if (pedidosFiltrados.length === 0) {
        lista.innerHTML = '<p class="empty">No hay pedidos que coincidan con los filtros.</p>';
        return;
    }

    lista.innerHTML = pedidosFiltrados.map(p => renderPedidoCard(p, estado)).join('');
}

function obtenerFiltros(estado) {
    const seccion = estado === 'pendiente_aprobacion' ? 'pendientes' : estado + 's';
    return {
        cliente: document.getElementById(`filtro-cliente-${seccion}`)?.value.trim() || '',
        envio: document.getElementById(`filtro-envio-${seccion}`)?.value || '',
        pagoRetiro: document.getElementById(`filtro-pago-retiro`)?.checked || false
    };
}

function renderPedidoCard(p, estado) {
    const dias = diasDesde(p.created_at);
    const urgenteBadge = p.es_urgente ? '<span class="badge badge-urgent">🔥 URGENTE</span>' : '';
    const pagoRetiroBadge = p.pago_retiro_pendiente
        ? '<span class="badge badge-warning">💰 Pago pendiente</span>' : '';
    const antiguedadBadge = dias > 3
        ? `<span class="badge badge-old">${dias} días</span>`
        : `<span class="badge">${dias}d</span>`;

    let acciones = '';
    if (estado === 'pendiente_aprobacion') {
        acciones = `
            <button class="btn btn-primary" onclick="aprobarPedido(${p.id})">✅ Aprobar</button>
            <button class="btn btn-secondary" onclick="toggleUrgente(${p.id}, ${!p.es_urgente})">
                ${p.es_urgente ? '⬇ Quitar urgencia' : '🔥 Marcar urgente'}
            </button>
        `;
    } else if (estado === 'aprobado') {
        acciones = `
            <label class="btn btn-primary file-btn">
                📦 Despachar (subir guía)
                <input type="file" accept="image/*,.pdf" hidden onchange="despacharPedido(${p.id}, this)">
            </label>
            <button class="btn btn-secondary" onclick="toggleUrgente(${p.id}, ${!p.es_urgente})">
                ${p.es_urgente ? '⬇ Quitar urgencia' : '🔥 Marcar urgente'}
            </button>
        `;
    } else if (estado === 'despachado') {
        acciones = `
            <button class="btn btn-primary" onclick="finalizarPedido(${p.id})">✅ Marcar finalizado</button>
            <button class="btn btn-secondary" onclick="verArchivo('guias', '${p.guia_url}')">📄 Ver guía</button>
        `;
    } else if (estado === 'finalizado') {
        if (p.pago_retiro_pendiente) {
            acciones = `<button class="btn btn-primary" onclick="confirmarPago(${p.id})">💰 Confirmar pago</button>`;
        }
        if (p.guia_url) {
            acciones += `<button class="btn btn-secondary" onclick="verArchivo('guias', '${p.guia_url}')">📄 Ver guía</button>`;
        }
    }

    // Historial de acciones
    let historial = '';
    if (p.created_by_email) historial += `<div class="hist-item">Creado por <b>${p.created_by_email}</b> · ${formatDate(p.created_at)}</div>`;
    if (p.aprobado_by_email) historial += `<div class="hist-item">Aprobado por <b>${p.aprobado_by_email}</b> · ${formatDate(p.aprobado_at)}</div>`;
    if (p.despachado_by_email) historial += `<div class="hist-item">Despachado por <b>${p.despachado_by_email}</b> · ${formatDate(p.despachado_at)}</div>`;
    if (p.finalizado_by_email) historial += `<div class="hist-item">Finalizado por <b>${p.finalizado_by_email}</b> · ${formatDate(p.finalizado_at)}</div>`;

    return `
        <div class="pedido-card ${p.es_urgente ? 'urgente' : ''}">
            <div class="pedido-header">
                <div>
                    <span class="pedido-id">#${p.id}</span>
                    <strong>${p.cliente_nombre || 'Sin cliente'}</strong>
                    <span class="pedido-dni">DNI: ${p.cliente_dni || '-'}</span>
                </div>
                <div>
                    ${urgenteBadge}
                    ${pagoRetiroBadge}
                    ${antiguedadBadge}
                </div>
            </div>
            <div class="pedido-info">
                <div><b>Envío:</b> ${p.metodo_envio || '-'} | <b>Pago:</b> ${p.metodo_pago === 'anticipado' ? 'Anticipado' : 'Al recibir'}</div>
                <div><b>Dirección:</b> ${p.cliente_direccion || '-'}, ${p.cliente_ciudad || '-'}, ${p.cliente_provincia || '-'} (CP: ${p.cliente_cp || '-'})</div>
                ${p.cliente_telefono ? `<div><b>Tel:</b> ${p.cliente_telefono}</div>` : ''}
                ${p.nota ? `<div class="pedido-nota"><b>Nota:</b> ${p.nota}</div>` : ''}
            </div>
            <div class="pedido-archivo">
                <button class="btn btn-link" onclick="verArchivo('facturas', '${p.factura_url}')">📄 Ver factura: ${p.factura_filename || 'archivo'}</button>
            </div>
            <div class="pedido-historial">${historial}</div>
            <div class="pedido-acciones">${acciones}</div>
        </div>
    `;
}

// ============================================
// ACCIONES SOBRE PEDIDOS
// ============================================
async function aprobarPedido(id) {
    if (!confirm('¿Aprobar pedido #' + id + '?')) return;
    const { error } = await supabaseClient
        .from('pedidos')
        .update({
            estado: 'aprobado',
            aprobado_by: currentUser.id,
            aprobado_at: new Date().toISOString()
        })
        .eq('id', id);
    if (error) {
        toast('Error: ' + error.message, 'error');
        return;
    }
    toast(`✅ Pedido #${id} aprobado`);
    cargarPedidos('pendiente_aprobacion');
}

async function toggleUrgente(id, valor) {
    const { error } = await supabaseClient
        .from('pedidos')
        .update({ es_urgente: valor })
        .eq('id', id);
    if (error) {
        toast('Error: ' + error.message, 'error');
        return;
    }
    toast(valor ? '🔥 Marcado urgente' : 'Urgencia quitada');
    cargarPedidos(currentSection === 'pendientes' ? 'pendiente_aprobacion' : currentSection.replace(/s$/, ''));
}

async function despacharPedido(id, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const filename = `guia_${id}_${Date.now()}_${sanitizeFilename(file.name)}`;
    const { error: upErr } = await supabaseClient.storage
        .from('guias')
        .upload(filename, file);
    if (upErr) {
        toast('Error al subir guía: ' + upErr.message, 'error');
        return;
    }

    const { error } = await supabaseClient
        .from('pedidos')
        .update({
            estado: 'despachado',
            guia_url: filename,
            guia_filename: file.name,
            despachado_by: currentUser.id,
            despachado_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        toast('Error: ' + error.message, 'error');
        return;
    }
    toast(`📦 Pedido #${id} despachado`);
    cargarPedidos('aprobado');
}

async function finalizarPedido(id) {
    // Si el pedido era "al_recibir" se marca pago_retiro_pendiente=true
    const { data: pedido } = await supabaseClient
        .from('pedidos')
        .select('metodo_pago')
        .eq('id', id)
        .single();

    const pagoRetiroPendiente = pedido && pedido.metodo_pago === 'al_recibir';
    const confirmMsg = pagoRetiroPendiente
        ? `Finalizar pedido #${id}? (Quedará marcado con pago pendiente porque era pago al recibir)`
        : `¿Finalizar pedido #${id}?`;
    if (!confirm(confirmMsg)) return;

    const { error } = await supabaseClient
        .from('pedidos')
        .update({
            estado: 'finalizado',
            finalizado_by: currentUser.id,
            finalizado_at: new Date().toISOString(),
            pago_retiro_pendiente: pagoRetiroPendiente
        })
        .eq('id', id);

    if (error) {
        toast('Error: ' + error.message, 'error');
        return;
    }
    toast(`✅ Pedido #${id} finalizado`);
    cargarPedidos('despachado');
}

async function confirmarPago(id) {
    if (!confirm('¿Confirmar que el pedido #' + id + ' fue pagado?')) return;
    const { error } = await supabaseClient
        .from('pedidos')
        .update({ pago_retiro_pendiente: false })
        .eq('id', id);
    if (error) {
        toast('Error: ' + error.message, 'error');
        return;
    }
    toast('💰 Pago confirmado');
    cargarPedidos('finalizado');
}

// ============================================
// VER ARCHIVOS (factura/guía)
// ============================================
async function verArchivo(bucket, filename) {
    if (!filename) {
        toast('No hay archivo', 'error');
        return;
    }
    // Generar URL firmada por 1 hora
    const { data, error } = await supabaseClient.storage
        .from(bucket)
        .createSignedUrl(filename, 3600);
    if (error) {
        toast('Error al obtener archivo: ' + error.message, 'error');
        return;
    }
    window.open(data.signedUrl, '_blank');
}

// ============================================
// CLIENTES (vista de listado simple)
// ============================================
async function cargarClientes() {
    const lista = document.getElementById('lista-clientes');
    if (!lista) return;
    lista.innerHTML = '<p class="loading">Cargando...</p>';

    const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        lista.innerHTML = `<p class="error">${error.message}</p>`;
        return;
    }
    if (!data || data.length === 0) {
        lista.innerHTML = '<p class="empty">No hay clientes cargados aún.</p>';
        return;
    }

    const filtro = document.getElementById('filtro-clientes')?.value.toLowerCase().trim() || '';
    const filtrados = filtro
        ? data.filter(c =>
            (c.nombre_completo || '').toLowerCase().includes(filtro) ||
            (c.dni || '').includes(filtro))
        : data;

    lista.innerHTML = `
        <table class="tabla-clientes">
            <thead>
                <tr><th>DNI</th><th>Nombre</th><th>Ciudad</th><th>Provincia</th><th>Envío</th><th>Tel</th></tr>
            </thead>
            <tbody>
                ${filtrados.map(c => `
                    <tr>
                        <td>${c.dni}</td>
                        <td>${c.nombre_completo}</td>
                        <td>${c.ciudad || '-'}</td>
                        <td>${c.provincia || '-'}</td>
                        <td>${c.envio_preferido || '-'}</td>
                        <td>${c.telefono || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ============================================
// EVENT LISTENERS DE FILTROS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Filtros de pendientes
    ['pendientes', 'aprobados', 'despachados', 'finalizados'].forEach(seccion => {
        const inputCliente = document.getElementById(`filtro-cliente-${seccion}`);
        const inputEnvio = document.getElementById(`filtro-envio-${seccion}`);
        const estado = seccion === 'pendientes' ? 'pendiente_aprobacion' : seccion.replace(/s$/, '');
        if (inputCliente) inputCliente.addEventListener('input', () => cargarPedidos(estado));
        if (inputEnvio) inputEnvio.addEventListener('change', () => cargarPedidos(estado));
    });

    // Filtro de pago retiro pendiente
    const filtroPago = document.getElementById('filtro-pago-retiro');
    if (filtroPago) filtroPago.addEventListener('change', () => cargarPedidos('finalizado'));

    // Filtro de clientes
    const filtroClientes = document.getElementById('filtro-clientes');
    if (filtroClientes) filtroClientes.addEventListener('input', cargarClientes);
});
