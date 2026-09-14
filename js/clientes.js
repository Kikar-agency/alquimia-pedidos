// ============================================
// CLIENTES - CRUD completo
// ============================================
async function cargarClientes() {
    const lista = document.getElementById('lista-clientes');
    if (!lista) return;
    lista.innerHTML = '<p class="loading">Cargando...</p>';
    const { data, error } = await supabaseClient.from('clientes').select('*').order('nombre_completo');
    if (error) { lista.innerHTML = `<p class="error">${error.message}</p>`; return; }
    if (!data || !data.length) { lista.innerHTML = '<p class="empty">No hay clientes cargados aún.</p>'; return; }

    const filtro = (document.getElementById('filtro-clientes')?.value || '').toLowerCase().trim();
    const filtrados = filtro
        ? data.filter(c => (c.nombre_completo || '').toLowerCase().includes(filtro) || (c.dni || '').includes(filtro))
        : data;

    if (!filtrados.length) { lista.innerHTML = '<p class="empty">Sin coincidencias.</p>'; return; }

    lista.innerHTML = `
        <table class="tabla-clientes">
            <thead>
                <tr><th></th><th>DNI</th><th>Nombre</th><th>Ciudad</th><th>Prov.</th><th>Envío</th><th>Tel</th><th></th></tr>
            </thead>
            <tbody>
                ${filtrados.map(c => `
                    <tr>
                        <td>${c.es_frecuente ? '⭐' : ''}</td>
                        <td>${c.dni}</td>
                        <td>${c.nombre_completo}${c.notas ? ' 📝' : ''}</td>
                        <td>${c.ciudad || '-'}</td>
                        <td>${c.provincia || '-'}</td>
                        <td>${c.envio_preferido || '-'}</td>
                        <td>${c.telefono || '-'}</td>
                        <td><button class="btn btn-link" onclick="editarCliente(${c.id})">Editar</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function editarCliente(id) {
    const { data: c } = await supabaseClient.from('clientes').select('*').eq('id', id).single();
    if (!c) { toast('Cliente no encontrado', 'error'); return; }
    abrirModalCliente(c);
}

function nuevoClienteModal() {
    abrirModalCliente(null);
}

function abrirModalCliente(cliente) {
    const isNew = !cliente;
    const c = cliente || {};
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box modal-wide">
            <h3>${isNew ? '➕ Nuevo cliente' : '✏️ Editar cliente'}</h3>
            <div class="modal-section">
                <input type="text" id="c-dni" placeholder="DNI" value="${c.dni || ''}">
                <input type="text" id="c-nombre" placeholder="Nombre completo" value="${c.nombre_completo || ''}" style="margin-top:.5rem;">
                <div class="row" style="margin-top:.5rem;">
                    <input type="text" id="c-prov" placeholder="Provincia" value="${c.provincia || ''}">
                    <input type="text" id="c-ciudad" placeholder="Ciudad" value="${c.ciudad || ''}">
                </div>
                <input type="text" id="c-dir" placeholder="Dirección" value="${c.direccion || ''}" style="margin-top:.5rem;">
                <div class="row" style="margin-top:.5rem;">
                    <input type="text" id="c-cp" placeholder="CP" value="${c.cp || ''}">
                    <select id="c-envio">
                        <option value="">Envío preferido...</option>
                        ${['VIA CARGO','ANDREANI','COMISIONISTA','BUSPACK','OTRO'].map(o => `<option value="${o}" ${c.envio_preferido===o?'selected':''}>${o}</option>`).join('')}
                    </select>
                </div>
                <div class="row" style="margin-top:.5rem;">
                    <input type="text" id="c-tel" placeholder="Teléfono" value="${c.telefono || ''}">
                    <input type="email" id="c-email" placeholder="Email" value="${c.email || ''}">
                </div>
                <label class="checkbox-label" style="margin-top:.75rem;">
                    <input type="checkbox" id="c-frec" ${c.es_frecuente ? 'checked' : ''}>
                    <span>⭐ Cliente frecuente</span>
                </label>
                <textarea id="c-notas" placeholder="Notas / observaciones" rows="3" style="margin-top:.5rem;">${c.notas || ''}</textarea>
            </div>
            <div class="modal-acciones">
                ${isNew ? '' : `<button class="btn btn-secondary" id="c-del" style="margin-right:auto;background:#fee;color:#c00;">🗑 Eliminar</button>`}
                <button class="btn btn-secondary" id="c-cancel">Cancelar</button>
                <button class="btn btn-primary" id="c-ok">${isNew ? 'Crear' : 'Guardar'}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#c-cancel').addEventListener('click', () => modal.remove());

    const delBtn = modal.querySelector('#c-del');
    if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar cliente ${c.nombre_completo}? No se puede eliminar si tiene pedidos.`)) return;
        const { error } = await supabaseClient.from('clientes').delete().eq('id', c.id);
        if (error) { toast('Error: ' + error.message, 'error'); return; }
        toast('Cliente eliminado');
        modal.remove();
        cargarClientes();
    });

    modal.querySelector('#c-ok').addEventListener('click', async () => {
        const data = {
            dni: modal.querySelector('#c-dni').value.trim(),
            nombre_completo: modal.querySelector('#c-nombre').value.trim(),
            provincia: modal.querySelector('#c-prov').value.trim(),
            ciudad: modal.querySelector('#c-ciudad').value.trim(),
            direccion: modal.querySelector('#c-dir').value.trim(),
            cp: modal.querySelector('#c-cp').value.trim(),
            envio_preferido: modal.querySelector('#c-envio').value,
            telefono: modal.querySelector('#c-tel').value.trim(),
            email: modal.querySelector('#c-email').value.trim(),
            es_frecuente: modal.querySelector('#c-frec').checked,
            notas: modal.querySelector('#c-notas').value.trim() || null
        };
        if (!data.dni || !data.nombre_completo) { toast('DNI y nombre son obligatorios', 'error'); return; }

        let error;
        if (isNew) {
            ({ error } = await supabaseClient.from('clientes').insert([data]));
        } else {
            ({ error } = await supabaseClient.from('clientes').update(data).eq('id', c.id));
        }
        if (error) { toast('Error: ' + error.message, 'error'); return; }
        toast(isNew ? 'Cliente creado' : 'Cliente actualizado');
        modal.remove();
        cargarClientes();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const btnNew = document.getElementById('btn-nuevo-cliente');
    if (btnNew) btnNew.addEventListener('click', nuevoClienteModal);
    const f = document.getElementById('filtro-clientes');
    if (f) f.addEventListener('input', cargarClientes);
});
