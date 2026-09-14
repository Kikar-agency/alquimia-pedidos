// ============================================
// PEDIDOS - CRUD y lógica de negocio
// ============================================
let clienteSeleccionado = null;

// ============================================
// NUEVO PEDIDO
// ============================================
function initNuevoPedido() {
    clienteSeleccionado = null;
    document.getElementById('form-nuevo-pedido').reset();
    document.getElementById('cliente-encontrado').style.display = 'none';
    document.getElementById('cliente-nuevo').style.display = 'none';
    document.getElementById('card-comprobante-inicial').style.display = 'none';
    document.getElementById('btn-crear-pedido').style.display = 'none';
    document.getElementById('input-sin-comprobante-nota').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const btnBuscar = document.getElementById('btn-buscar-cliente');
    if (btnBuscar) {
        btnBuscar.addEventListener('click', async () => {
            const dni = document.getElementById('input-dni').value.trim();
            if (!dni) { toast('Ingresá un DNI', 'error'); return; }
            const cliente = await buscarClientePorDNI(dni);
            if (cliente) {
                clienteSeleccionado = cliente;
                document.getElementById('cliente-nuevo').style.display = 'none';
                const frec = cliente.es_frecuente ? '⭐ ' : '';
                const notas = cliente.notas ? `<div class="pedido-nota" style="margin-top:.5rem;"><b>Notas:</b> ${cliente.notas}</div>` : '';
                document.getElementById('cliente-encontrado').innerHTML = `
                    <div class="cliente-card">
                        ${frec}<strong>${cliente.nombre_completo}</strong> (DNI: ${cliente.dni})<br>
                        ${cliente.direccion || ''} - ${cliente.ciudad || ''}, ${cliente.provincia || ''} (CP: ${cliente.cp || '-'})<br>
                        Envío preferido: <strong>${cliente.envio_preferido || '-'}</strong>
                        ${notas}
                    </div>
                `;
                document.getElementById('cliente-encontrado').style.display = 'block';
            } else {
                clienteSeleccionado = null;
                document.getElementById('cliente-encontrado').style.display = 'none';
                document.getElementById('cliente-nuevo').style.display = 'block';
                document.getElementById('nuevo-dni').value = dni;
            }
            document.getElementById('btn-crear-pedido').style.display = 'inline-block';
        });
    }

    // Cambio método de pago → mostrar/ocultar bloque de comprobante
    const metodoPagoSelect = document.getElementById('input-metodo-pago');
    if (metodoPagoSelect) {
        metodoPagoSelect.addEventListener('change', () => {
            const card = document.getElementById('card-comprobante-inicial');
            card.style.display = metodoPagoSelect.value === 'anticipado' ? 'block' : 'none';
        });
    }

    // Sin comprobante toggle
    const sinComprobChk = document.getElementById('input-sin-comprobante');
    if (sinComprobChk) {
        sinComprobChk.addEventListener('change', () => {
            const nota = document.getElementById('input-sin-comprobante-nota');
            const file = document.getElementById('input-comprobante');
            nota.style.display = sinComprobChk.checked ? 'block' : 'none';
            file.disabled = sinComprobChk.checked;
            if (sinComprobChk.checked) file.value = '';
        });
    }

    const form = document.getElementById('form-nuevo-pedido');
    if (form) form.addEventListener('submit', async (e) => { e.preventDefault(); await crearPedido(); });
});

async function crearPedido() {
    const btn = document.getElementById('btn-crear-pedido');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        // Cliente nuevo si aplica
        if (!clienteSeleccionado) {
            const nc = {
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
            if (!nc.dni || !nc.nombre_completo) {
                toast('DNI y nombre son obligatorios', 'error');
                return btnReset(btn);
            }
            clienteSeleccionado = await crearCliente(nc);
            if (!clienteSeleccionado) return btnReset(btn);
        }

        // Factura
        const fileFactura = document.getElementById('input-factura').files[0];
        if (!fileFactura) { toast('Subí el archivo de la factura', 'error'); return btnReset(btn); }

        const metodoPago = document.getElementById('input-metodo-pago').value;

        // Validación comprobante si es anticipado
        let comprobanteFile = null;
        let sinComprobante = false;
        let sinComprobNota = '';
        if (metodoPago === 'anticipado') {
            comprobanteFile = document.getElementById('input-comprobante').files[0];
            sinComprobante = document.getElementById('input-sin-comprobante').checked;
            sinComprobNota = document.getElementById('input-sin-comprobante-nota').value.trim();
            if (!comprobanteFile && !sinComprobante) {
                toast('Subí el comprobante o tildá "No tengo comprobante"', 'error');
                return btnReset(btn);
            }
            if (sinComprobante && !sinComprobNota) {
                toast('Si no hay comprobante, explicá por qué', 'error');
                return btnReset(btn);
            }
        }

        // Upload factura
        const factName = `${Date.now()}_${sanitizeFilename(fileFactura.name)}`;
        const { error: e1 } = await supabaseClient.storage.from('facturas').upload(factName, fileFactura);
        if (e1) { toast('Error subiendo factura: ' + e1.message, 'error'); return btnReset(btn); }

        // Upload comprobante si aplica
        let compName = null;
        if (comprobanteFile) {
            compName = `comp_${Date.now()}_${sanitizeFilename(comprobanteFile.name)}`;
            const { error: e2 } = await supabaseClient.storage.from('comprobantes').upload(compName, comprobanteFile);
            if (e2) { toast('Error subiendo comprobante: ' + e2.message, 'error'); return btnReset(btn); }
        }

        const pedido = {
            cliente_id: clienteSeleccionado.id,
            factura_url: factName,
            factura_filename: fileFactura.name,
            metodo_envio: document.getElementById('input-metodo-envio').value || clienteSeleccionado.envio_preferido,
            metodo_envio_detalle: document.getElementById('input-metodo-envio-detalle').value.trim() || null,
            metodo_pago: metodoPago,
            nota: document.getElementById('input-nota').value.trim(),
            es_urgente: document.getElementById('input-urgente').checked,
            estado: 'nuevo',
            created_by: currentUser.id,
            comprobante_pago_url: compName,
            comprobante_pago_filename: comprobanteFile ? comprobanteFile.name : null,
            sin_comprobante: sinComprobante,
            sin_comprobante_nota: sinComprobante ? sinComprobNota : null
        };

        const { data, error } = await supabaseClient.from('pedidos').insert([pedido]).select().single();
        if (error) { toast('Error: ' + error.message, 'error'); return btnReset(btn); }

        toast(`✅ Pedido #${data.id} creado`);
        showSection('nuevos');
    } catch (err) {
        console.error(err);
        toast('Error inesperado', 'error');
        btnReset(btn);
    }
}

function btnReset(btn) {
    btn.disabled = false;
    btn.textContent = 'Crear pedido';
}

// ============================================
// LISTAR PEDIDOS
// ============================================
async function cargarPedidos(estado) {
    const seccion = estado === 'nuevo' ? 'nuevos' : estado + 's';
    const lista = document.getElementById(`lista-${seccion}`);
    if (!lista) return;
    lista.innerHTML = '<p class="loading">Cargando...</p>';

    let query = supabaseClient.from('pedidos_completos').select('*').eq('estado', estado);

    if (estado === 'nuevo' || estado === 'preparado') {
        query = query.order('es_urgente', { ascending: false }).order('created_at', { ascending: true });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) { lista.innerHTML = `<p class="error">Error: ${error.message}</p>`; return; }
    if (!data || !data.length) { lista.innerHTML = '<p class="empty">No hay pedidos en esta sección.</p>'; return; }

    // Filtros
    const f = obtenerFiltros(seccion);
    let filtrados = data;
    if (f.cliente) filtrados = filtrados.filter(p =>
        (p.cliente_nombre || '').toLowerCase().includes(f.cliente.toLowerCase()) ||
        (p.cliente_dni || '').includes(f.cliente));
    if (f.envio) filtrados = filtrados.filter(p => p.metodo_envio === f.envio);
    if (f.pagoRetiro && estado === 'finalizado') filtrados = filtrados.filter(p => p.pago_retiro_pendiente);

    if (!filtrados.length) { lista.innerHTML = '<p class="empty">Sin coincidencias.</p>'; return; }
    lista.innerHTML = filtrados.map(p => renderPedidoCard(p, estado)).join('');
}

function obtenerFiltros(seccion) {
    return {
        cliente: document.getElementById(`filtro-cliente-${seccion}`)?.value.trim() || '',
        envio: document.getElementById(`filtro-envio-${seccion}`)?.value || '',
        pagoRetiro: document.getElementById(`filtro-pago-retiro`)?.checked || false
    };
}

function renderPedidoCard(p, estado) {
    const dias = diasDesde(p.created_at);
    const urgente = p.es_urgente ? '<span class="badge badge-urgent">🔥 URGENTE</span>' : '';
    const pagoRet = p.pago_retiro_pendiente ? '<span class="badge badge-warning">💰 Pago pendiente</span>' : '';
    const frec = p.cliente_es_frecuente ? '<span class="badge badge-star">⭐ Frecuente</span>' : '';

    // Alerta 48hs hábiles (solo en nuevo/preparado)
    let alerta48 = '';
    if (estado === 'nuevo' || estado === 'preparado') {
        const horasH = horasHabilesDesde(p.created_at);
        if (horasH > 48) {
            alerta48 = `<span class="badge badge-old">⚠️ +48hs hábiles</span>`;
        }
    }
    const antiguedad = `<span class="badge">${dias}d</span>`;

    let acciones = '';
    if (estado === 'nuevo') {
        acciones = `
            <label class="btn btn-primary file-btn">
                📦 Marcar preparado (foto opcional)
                <input type="file" accept="image/*" hidden onchange="marcarPreparado(${p.id}, this)">
            </label>
            <button class="btn btn-secondary" onclick="marcarPreparadoSinFoto(${p.id})">Marcar sin foto</button>
            <button class="btn btn-secondary" onclick="toggleUrgente(${p.id}, ${!p.es_urgente}, 'nuevo')">
                ${p.es_urgente ? '⬇ Quitar urgencia' : '🔥 Urgente'}
            </button>
        `;
    } else if (estado === 'preparado') {
        acciones = `
            <label class="btn btn-primary file-btn">
                🚚 Despachar (subir guía)
                <input type="file" accept="image/*,.pdf" hidden onchange="despacharPedido(${p.id}, this)">
            </label>
            <button class="btn btn-secondary" onclick="toggleUrgente(${p.id}, ${!p.es_urgente}, 'preparado')">
                ${p.es_urgente ? '⬇ Quitar urgencia' : '🔥 Urgente'}
            </button>
        `;
    } else if (estado === 'despachado') {
        acciones = `
            <button class="btn btn-primary" onclick="finalizarPedido(${p.id})">✅ Finalizado</button>
            <button class="btn btn-secondary" onclick="verArchivo('guias', '${p.guia_url}')">📄 Ver guía</button>
        `;
    } else if (estado === 'finalizado') {
        if (p.pago_retiro_pendiente) acciones = `<button class="btn btn-primary" onclick="confirmarPago(${p.id})">💰 Confirmar pago</button>`;
        if (p.guia_url) acciones += `<button class="btn btn-secondary" onclick="verArchivo('guias', '${p.guia_url}')">📄 Ver guía</button>`;
    }

    // Archivos disponibles
    if (p.foto_pedido_url) acciones += `<button class="btn btn-secondary" onclick="verArchivo('fotos_pedido', '${p.foto_pedido_url}')">📸 Ver pedido armado</button>`;
    if (p.comprobante_pago_url) acciones += `<button class="btn btn-secondary" onclick="verArchivo('comprobantes', '${p.comprobante_pago_url}')">💵 Comprobante</button>`;

    let badgeSinComprob = '';
    if (p.sin_comprobante) {
        const tt = (p.sin_comprobante_nota || '').replace(/"/g, '&quot;');
        badgeSinComprob = `<span class="badge badge-warning" title="${tt}">⚠️ Sin comprobante</span>`;
    }

    let hist = '';
    if (p.created_by_email) hist += `<div class="hist-item">Creado por <b>${p.created_by_email}</b> · ${formatDate(p.created_at)}</div>`;
    if (p.preparado_by_email) hist += `<div class="hist-item">Preparado por <b>${p.preparado_by_email}</b> · ${formatDate(p.preparado_at)}</div>`;
    if (p.despachado_by_email) hist += `<div class="hist-item">Despachado por <b>${p.despachado_by_email}</b> · ${formatDate(p.despachado_at)}</div>`;
    if (p.finalizado_by_email) hist += `<div class="hist-item">Finalizado por <b>${p.finalizado_by_email}</b> · ${formatDate(p.finalizado_at)}</div>`;

    const envio = p.metodo_envio || '-';
    const envioDet = p.metodo_envio_detalle ? ` (${p.metodo_envio_detalle})` : '';

    return `
        <div class="pedido-card ${p.es_urgente ? 'urgente' : ''}">
            <div class="pedido-header">
                <div>
                    <span class="pedido-id">#${p.id}</span>
                    <strong>${p.cliente_nombre || 'Sin cliente'}</strong>
                    <span class="pedido-dni">DNI: ${p.cliente_dni || '-'}</span>
                </div>
                <div>${urgente}${frec}${pagoRet}${badgeSinComprob}${alerta48}${antiguedad}</div>
            </div>
            <div class="pedido-info">
                <div><b>Envío:</b> ${envio}${envioDet} | <b>Pago:</b> ${p.metodo_pago === 'anticipado' ? 'Anticipado' : 'Al recibir'}</div>
                <div><b>Dirección:</b> ${p.cliente_direccion || '-'}, ${p.cliente_ciudad || '-'}, ${p.cliente_provincia || '-'} (CP: ${p.cliente_cp || '-'})</div>
                ${p.cliente_telefono ? `<div><b>Tel:</b> ${p.cliente_telefono}</div>` : ''}
                ${p.nota ? `<div class="pedido-nota"><b>Nota:</b> ${p.nota}</div>` : ''}
            </div>
            <div class="pedido-archivo">
                <button class="btn btn-link" onclick="verArchivo('facturas', '${p.factura_url}')">📄 Ver factura: ${p.factura_filename || 'archivo'}</button>
            </div>
            <div class="pedido-historial">${hist}</div>
            <div class="pedido-acciones">${acciones}</div>
        </div>
    `;
}

// ============================================
// ACCIONES
// ============================================
async function marcarPreparado(id, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const fname = `foto_${id}_${Date.now()}_${sanitizeFilename(file.name)}`;
    const { error: e1 } = await supabaseClient.storage.from('fotos_pedido').upload(fname, file);
    if (e1) { toast('Error subiendo foto: ' + e1.message, 'error'); return; }

    const { error } = await supabaseClient.from('pedidos').update({
        estado: 'preparado',
        foto_pedido_url: fname,
        foto_pedido_filename: file.name,
        preparado_by: currentUser.id,
        preparado_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(`📦 Pedido #${id} preparado`);
    cargarPedidos('nuevo');
}

async function marcarPreparadoSinFoto(id) {
    if (!confirm(`¿Marcar pedido #${id} como preparado sin foto?`)) return;
    const { error } = await supabaseClient.from('pedidos').update({
        estado: 'preparado',
        preparado_by: currentUser.id,
        preparado_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(`📦 Pedido #${id} preparado`);
    cargarPedidos('nuevo');
}

async function toggleUrgente(id, valor, estado) {
    const { error } = await supabaseClient.from('pedidos').update({ es_urgente: valor }).eq('id', id);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(valor ? '🔥 Marcado urgente' : 'Urgencia quitada');
    cargarPedidos(estado);
}

async function despacharPedido(id, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const fname = `guia_${id}_${Date.now()}_${sanitizeFilename(file.name)}`;
    const { error: e1 } = await supabaseClient.storage.from('guias').upload(fname, file);
    if (e1) { toast('Error subiendo guía: ' + e1.message, 'error'); return; }

    const { error } = await supabaseClient.from('pedidos').update({
        estado: 'despachado',
        guia_url: fname,
        guia_filename: file.name,
        despachado_by: currentUser.id,
        despachado_at: new Date().toISOString()
    }).eq('id', id);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(`🚚 Pedido #${id} despachado`);
    cargarPedidos('preparado');
}

async function finalizarPedido(id) {
    const { data: p } = await supabaseClient.from('pedidos').select('metodo_pago').eq('id', id).single();
    const pagoRet = p && p.metodo_pago === 'al_recibir';
    const msg = pagoRet
        ? `Finalizar pedido #${id}? Quedará con "pago pendiente" por ser al recibir.`
        : `¿Finalizar pedido #${id}?`;
    if (!confirm(msg)) return;

    const { error } = await supabaseClient.from('pedidos').update({
        estado: 'finalizado',
        finalizado_by: currentUser.id,
        finalizado_at: new Date().toISOString(),
        pago_retiro_pendiente: pagoRet
    }).eq('id', id);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(`✅ Pedido #${id} finalizado`);
    cargarPedidos('despachado');
}

async function confirmarPago(id) {
    // Modal con comprobante opcional
    abrirModalComprobante({
        pedidoId: id,
        titulo: `Confirmar pago - Pedido #${id}`,
        subtitulo: 'Subí el comprobante del pago recibido (o marcá la casilla).',
        onConfirmar: async ({ comprobanteFilename, sinComprobante, sinComprobanteNota }) => {
            const upd = {
                pago_retiro_pendiente: false,
                sin_comprobante: sinComprobante,
                sin_comprobante_nota: sinComprobante ? sinComprobanteNota : null
            };
            if (comprobanteFilename) {
                upd.comprobante_pago_url = comprobanteFilename.url;
                upd.comprobante_pago_filename = comprobanteFilename.original;
            }
            const { error } = await supabaseClient.from('pedidos').update(upd).eq('id', id);
            if (error) { toast('Error: ' + error.message, 'error'); return false; }
            toast('💰 Pago confirmado');
            cargarPedidos('finalizado');
            return true;
        }
    });
}

// ============================================
// MODAL COMPROBANTE (reutilizable)
// ============================================
function abrirModalComprobante({ pedidoId, titulo, subtitulo, onConfirmar }) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box">
            <h3>${titulo}</h3>
            <p class="modal-subtitulo">${subtitulo}</p>
            <div class="modal-section">
                <label class="modal-label">📎 Comprobante (PDF, JPG o PNG):</label>
                <input type="file" id="m-file" accept=".pdf,.jpg,.jpeg,.png">
            </div>
            <div class="modal-divisor"><span>o</span></div>
            <div class="modal-section">
                <label class="checkbox-label">
                    <input type="checkbox" id="m-sin">
                    <span>No tengo comprobante (avanzar igual)</span>
                </label>
                <textarea id="m-nota" placeholder="Explicá por qué..." rows="2" style="margin-top:.5rem;display:none;"></textarea>
            </div>
            <div class="modal-acciones">
                <button class="btn btn-secondary" id="m-cancel">Cancelar</button>
                <button class="btn btn-primary" id="m-ok">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const f = modal.querySelector('#m-file');
    const s = modal.querySelector('#m-sin');
    const n = modal.querySelector('#m-nota');
    const btnOk = modal.querySelector('#m-ok');
    s.addEventListener('change', () => {
        n.style.display = s.checked ? 'block' : 'none';
        f.disabled = s.checked;
        if (s.checked) f.value = '';
    });
    f.addEventListener('change', () => { if (f.files.length) { s.checked = false; n.style.display = 'none'; } });
    modal.querySelector('#m-cancel').addEventListener('click', () => modal.remove());
    btnOk.addEventListener('click', async () => {
        const file = f.files[0];
        const sin = s.checked;
        const nota = n.value.trim();
        if (!file && !sin) { toast('Subí archivo o tildá la casilla', 'error'); return; }
        if (sin && !nota) { toast('Explicá por qué no hay comprobante', 'error'); return; }
        btnOk.disabled = true; btnOk.textContent = 'Procesando...';
        let cf = null;
        if (file) {
            const fn = `comp_${pedidoId}_${Date.now()}_${sanitizeFilename(file.name)}`;
            const { error } = await supabaseClient.storage.from('comprobantes').upload(fn, file);
            if (error) { toast('Error: ' + error.message, 'error'); btnOk.disabled = false; btnOk.textContent = 'Confirmar'; return; }
            cf = { url: fn, original: file.name };
        }
        const ok = await onConfirmar({ comprobanteFilename: cf, sinComprobante: sin, sinComprobanteNota: nota });
        if (ok) modal.remove();
        else { btnOk.disabled = false; btnOk.textContent = 'Confirmar'; }
    });
}

// ============================================
// FILTROS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    ['nuevos', 'preparados', 'despachados', 'finalizados'].forEach(sec => {
        const c = document.getElementById(`filtro-cliente-${sec}`);
        const e = document.getElementById(`filtro-envio-${sec}`);
        const estado = sec === 'nuevos' ? 'nuevo' : sec.replace(/s$/, '');
        if (c) c.addEventListener('input', () => cargarPedidos(estado));
        if (e) e.addEventListener('change', () => cargarPedidos(estado));
    });
    const fp = document.getElementById('filtro-pago-retiro');
    if (fp) fp.addEventListener('change', () => cargarPedidos('finalizado'));
});
