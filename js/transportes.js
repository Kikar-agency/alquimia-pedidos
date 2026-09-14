// ============================================
// TRANSPORTES - CRUD
// ============================================
async function cargarTransportes() {
    const lista = document.getElementById('lista-transportes');
    if (!lista) return;
    lista.innerHTML = '<p class="loading">Cargando...</p>';
    const { data, error } = await supabaseClient.from('transportes').select('*').order('nombre');
    if (error) { lista.innerHTML = `<p class="error">${error.message}</p>`; return; }
    if (!data || !data.length) { lista.innerHTML = '<p class="empty">No hay transportes cargados aún.</p>'; return; }

    const filtro = (document.getElementById('filtro-transportes')?.value || '').toLowerCase().trim();
    const filtrados = filtro
        ? data.filter(t => (t.nombre + ' ' + (t.destino||'') + ' ' + (t.notas||'')).toLowerCase().includes(filtro))
        : data;

    if (!filtrados.length) { lista.innerHTML = '<p class="empty">Sin coincidencias.</p>'; return; }

    lista.innerHTML = filtrados.map(t => `
        <div class="pedido-card">
            <div class="pedido-header">
                <div><strong style="font-size:1.1rem;">🚛 ${t.nombre}</strong></div>
                <button class="btn btn-link" onclick="editarTransporte(${t.id})">Editar</button>
            </div>
            <div class="pedido-info">
                ${t.destino ? `<div><b>Destino:</b> ${t.destino}</div>` : ''}
                ${t.dias_salida ? `<div><b>Días:</b> ${t.dias_salida}</div>` : ''}
                ${t.horario ? `<div><b>Horario:</b> ${t.horario}</div>` : ''}
                ${t.telefonos ? `<div><b>Tel:</b> ${t.telefonos}</div>` : ''}
                ${t.direccion ? `<div><b>Dirección:</b> ${t.direccion}</div>` : ''}
                ${t.notas ? `<div class="pedido-nota"><b>Notas:</b> ${t.notas}</div>` : ''}
            </div>
        </div>
    `).join('');
}

async function editarTransporte(id) {
    const { data: t } = await supabaseClient.from('transportes').select('*').eq('id', id).single();
    if (!t) { toast('Transporte no encontrado', 'error'); return; }
    abrirModalTransporte(t);
}

function abrirModalTransporte(transporte) {
    const isNew = !transporte;
    const t = transporte || {};
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box modal-wide">
            <h3>${isNew ? '➕ Nuevo transporte' : '✏️ Editar transporte'}</h3>
            <div class="modal-section">
                <input type="text" id="t-nom" placeholder="Nombre del transporte (ej: Vía Cargo Córdoba)" value="${t.nombre || ''}">
                <input type="text" id="t-dest" placeholder="Destino/zona (ej: CABA + GBA)" value="${t.destino || ''}" style="margin-top:.5rem;">
                <input type="text" id="t-dias" placeholder="Días de salida (ej: Lun, Mié, Vie)" value="${t.dias_salida || ''}" style="margin-top:.5rem;">
                <input type="text" id="t-hor" placeholder="Horario (ej: 8-12 hs)" value="${t.horario || ''}" style="margin-top:.5rem;">
                <textarea id="t-tel" placeholder="Teléfonos de contacto" rows="2" style="margin-top:.5rem;">${t.telefonos || ''}</textarea>
                <input type="text" id="t-dir" placeholder="Dirección (opcional)" value="${t.direccion || ''}" style="margin-top:.5rem;">
                <textarea id="t-notas" placeholder="Notas / observaciones" rows="3" style="margin-top:.5rem;">${t.notas || ''}</textarea>
            </div>
            <div class="modal-acciones">
                ${isNew ? '' : `<button class="btn btn-secondary" id="t-del" style="margin-right:auto;background:#fee;color:#c00;">🗑 Eliminar</button>`}
                <button class="btn btn-secondary" id="t-cancel">Cancelar</button>
                <button class="btn btn-primary" id="t-ok">${isNew ? 'Crear' : 'Guardar'}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#t-cancel').addEventListener('click', () => modal.remove());

    const delBtn = modal.querySelector('#t-del');
    if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar transporte ${t.nombre}?`)) return;
        const { error } = await supabaseClient.from('transportes').delete().eq('id', t.id);
        if (error) { toast('Error: ' + error.message, 'error'); return; }
        toast('Transporte eliminado');
        modal.remove();
        cargarTransportes();
    });

    modal.querySelector('#t-ok').addEventListener('click', async () => {
        const data = {
            nombre: modal.querySelector('#t-nom').value.trim(),
            destino: modal.querySelector('#t-dest').value.trim() || null,
            dias_salida: modal.querySelector('#t-dias').value.trim() || null,
            horario: modal.querySelector('#t-hor').value.trim() || null,
            telefonos: modal.querySelector('#t-tel').value.trim() || null,
            direccion: modal.querySelector('#t-dir').value.trim() || null,
            notas: modal.querySelector('#t-notas').value.trim() || null
        };
        if (!data.nombre) { toast('El nombre es obligatorio', 'error'); return; }

        let error;
        if (isNew) ({ error } = await supabaseClient.from('transportes').insert([data]));
        else ({ error } = await supabaseClient.from('transportes').update(data).eq('id', t.id));
        if (error) { toast('Error: ' + error.message, 'error'); return; }
        toast(isNew ? 'Transporte creado' : 'Transporte actualizado');
        modal.remove();
        cargarTransportes();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const btnNew = document.getElementById('btn-nuevo-transporte');
    if (btnNew) btnNew.addEventListener('click', () => abrirModalTransporte(null));
    const f = document.getElementById('filtro-transportes');
    if (f) f.addEventListener('input', cargarTransportes);
});
