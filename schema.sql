-- ============================================
-- ALQUIMIA - Sistema de Pedidos
-- Schema para Supabase (PostgreSQL)
-- ============================================
-- Pegá este SQL completo en el SQL Editor de Supabase y ejecutá.
-- ============================================

-- 1. TABLA DE CLIENTES
CREATE TABLE clientes (
    id BIGSERIAL PRIMARY KEY,
    dni TEXT UNIQUE NOT NULL,
    nombre_completo TEXT NOT NULL,
    provincia TEXT,
    ciudad TEXT,
    direccion TEXT,
    cp TEXT,
    envio_preferido TEXT, -- VIA CARGO, ANDREANI, COMISIONISTA, BUSPACK, OTRO
    telefono TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_dni ON clientes(dni);
CREATE INDEX idx_clientes_nombre ON clientes(nombre_completo);


-- 2. TABLA DE PEDIDOS
CREATE TABLE pedidos (
    id BIGSERIAL PRIMARY KEY, -- Este es el #ID de pedido
    cliente_id BIGINT REFERENCES clientes(id) ON DELETE RESTRICT,
    
    -- Archivo de factura (URL al Storage)
    factura_url TEXT,
    factura_filename TEXT,
    
    -- Datos del pedido
    metodo_envio TEXT, -- VIA CARGO, ANDREANI, etc
    metodo_pago TEXT DEFAULT 'anticipado', -- 'anticipado' o 'al_recibir'
    nota TEXT,
    es_urgente BOOLEAN DEFAULT FALSE,
    
    -- Estado del pedido
    estado TEXT DEFAULT 'pendiente_aprobacion',
    -- Estados posibles: pendiente_aprobacion, aprobado, despachado, finalizado
    
    -- Pago en retiro (queda pendiente hasta que pague)
    pago_retiro_pendiente BOOLEAN DEFAULT FALSE,
    
    -- Guía de despacho (foto)
    guia_url TEXT,
    guia_filename TEXT,
    
    -- Tracking de cambios de estado (quién hizo qué)
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    aprobado_by UUID REFERENCES auth.users(id),
    aprobado_at TIMESTAMPTZ,
    
    despachado_by UUID REFERENCES auth.users(id),
    despachado_at TIMESTAMPTZ,
    
    finalizado_by UUID REFERENCES auth.users(id),
    finalizado_at TIMESTAMPTZ
);

CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_urgente ON pedidos(es_urgente);
CREATE INDEX idx_pedidos_created ON pedidos(created_at);


-- 3. VISTA AUXILIAR: pedidos con datos de cliente y emails de usuarios
-- Esto facilita las consultas desde el frontend
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
    u_creado.email AS created_by_email,
    u_aprobado.email AS aprobado_by_email,
    u_despachado.email AS despachado_by_email,
    u_finalizado.email AS finalizado_by_email
FROM pedidos p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN auth.users u_creado ON p.created_by = u_creado.id
LEFT JOIN auth.users u_aprobado ON p.aprobado_by = u_aprobado.id
LEFT JOIN auth.users u_despachado ON p.despachado_by = u_despachado.id
LEFT JOIN auth.users u_finalizado ON p.finalizado_by = u_finalizado.id;


-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Activamos RLS y permitimos acceso completo a usuarios autenticados.
-- Como todos los usuarios hacen todo (según definimos), las políticas son simples.

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- CLIENTES: cualquier usuario autenticado puede ver y editar
CREATE POLICY "Usuarios autenticados pueden ver clientes"
    ON clientes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden crear clientes"
    ON clientes FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar clientes"
    ON clientes FOR UPDATE
    TO authenticated
    USING (true);

-- PEDIDOS: cualquier usuario autenticado puede ver y editar
CREATE POLICY "Usuarios autenticados pueden ver pedidos"
    ON pedidos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden crear pedidos"
    ON pedidos FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar pedidos"
    ON pedidos FOR UPDATE
    TO authenticated
    USING (true);


-- ============================================
-- 5. STORAGE: crear buckets para facturas y guías
-- ============================================
-- Esto NO se ejecuta como SQL. Hay que crear los buckets manualmente
-- en Supabase Dashboard → Storage:
--
--   1. Crear bucket llamado "facturas" (PRIVADO)
--   2. Crear bucket llamado "guias" (PRIVADO)
--
-- Luego ejecutar las políticas de abajo en el SQL Editor:

CREATE POLICY "Usuarios autenticados pueden subir facturas"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'facturas');

CREATE POLICY "Usuarios autenticados pueden ver facturas"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'facturas');

CREATE POLICY "Usuarios autenticados pueden subir guias"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'guias');

CREATE POLICY "Usuarios autenticados pueden ver guias"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'guias');


-- ============================================
-- LISTO ✅
-- ============================================
