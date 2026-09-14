-- ============================================
-- MIGRACIÓN V2 — Alquimia Pedidos
-- ============================================
-- ⚠️ ATENCIÓN: BORRA TODOS LOS PEDIDOS Y CLIENTES ACTUALES
-- (los archivos en Storage quedan, hay que limpiarlos manual si querés)
-- ============================================

-- 0. Limpiar data actual
DROP VIEW IF EXISTS pedidos_completos;
TRUNCATE pedidos RESTART IDENTITY CASCADE;
TRUNCATE clientes RESTART IDENTITY CASCADE;

-- 1. Nuevos campos en clientes
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS es_frecuente BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notas TEXT;

-- 2. Nuevos campos en pedidos
ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS metodo_envio_detalle TEXT,
    ADD COLUMN IF NOT EXISTS foto_pedido_url TEXT,
    ADD COLUMN IF NOT EXISTS foto_pedido_filename TEXT,
    ADD COLUMN IF NOT EXISTS preparado_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS preparado_at TIMESTAMPTZ;

-- 3. Cambiar estado default a 'nuevo' (sistema simplificado)
ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'nuevo';

-- 4. Recrear vista con todos los campos nuevos
CREATE OR REPLACE VIEW pedidos_completos AS
SELECT 
    p.*,
    c.dni AS cliente_dni,
    c.nombre_completo AS cliente_nombre,
    c.provincia AS cliente_provincia,
    c.ciudad AS cliente_ciudad,
    c.direccion AS cliente_direccion,
    c.cp AS cliente_cp,
    c.telefono AS cliente_telefono,
    c.es_frecuente AS cliente_es_frecuente,
    u_creado.email AS created_by_email,
    u_preparado.email AS preparado_by_email,
    u_despachado.email AS despachado_by_email,
    u_finalizado.email AS finalizado_by_email
FROM pedidos p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN auth.users u_creado ON p.created_by = u_creado.id
LEFT JOIN auth.users u_preparado ON p.preparado_by = u_preparado.id
LEFT JOIN auth.users u_despachado ON p.despachado_by = u_despachado.id
LEFT JOIN auth.users u_finalizado ON p.finalizado_by = u_finalizado.id;

-- 5. Nueva tabla TRANSPORTES
CREATE TABLE IF NOT EXISTS transportes (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    dias_salida TEXT,     -- "Lun, Mié, Vie" (texto libre)
    destino TEXT,          -- zona/ruta
    horario TEXT,
    telefonos TEXT,
    direccion TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transportes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_transportes" ON transportes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_transportes" ON transportes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_transportes" ON transportes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_transportes" ON transportes FOR DELETE TO authenticated USING (true);

-- 6. Permitir DELETE en clientes y pedidos (por si necesitan borrar)
CREATE POLICY IF NOT EXISTS "auth_delete_clientes" ON clientes FOR DELETE TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "auth_delete_pedidos" ON pedidos FOR DELETE TO authenticated USING (true);

-- ============================================
-- 7. STORAGE: crear bucket "fotos_pedido" manual (PRIVATE)
-- después ejecutar estas 2 políticas:
-- ============================================
CREATE POLICY "auth_upload_fotos_pedido"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'fotos_pedido');

CREATE POLICY "auth_read_fotos_pedido"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'fotos_pedido');

-- ============================================
-- LISTO ✅
-- Estados válidos ahora: nuevo, preparado, despachado, finalizado
-- ============================================
