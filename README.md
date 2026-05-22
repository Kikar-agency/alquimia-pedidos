# 🧪 Alquimia - Sistema de Pedidos

Sistema interno de gestión de pedidos para Alquimia (químicos).

## 🚀 Stack
- **Frontend:** HTML/CSS/JS puro (sin framework)
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Deploy:** GitHub Pages

## 📋 Setup inicial (hacer una sola vez)

### 1. Configurar Supabase

**a) Crear las tablas:**
1. En Supabase Dashboard → **SQL Editor**
2. Click en **"New query"**
3. Abrir el archivo `schema.sql` de este repo, copiar TODO el contenido
4. Pegarlo en el SQL Editor y click en **"Run"** (o Ctrl+Enter)
5. Debería decir "Success. No rows returned" ✅

**b) Crear buckets de Storage:**
1. En Supabase Dashboard → **Storage**
2. Click en **"New bucket"**
3. Nombre: `facturas` — PRIVATE (NO marcar "Public bucket")
4. Click "Save"
5. Repetir: crear otro bucket llamado `guias` — también PRIVATE

**c) Crear usuarios:**
1. En Supabase Dashboard → **Authentication → Users**
2. Click en **"Add user" → "Create new user"**
3. Email + contraseña para cada miembro del equipo (6 usuarios)
4. Tildar "Auto Confirm User" para que puedan loguear sin verificar email

### 2. Deploy en GitHub Pages

1. Subir todos los archivos de este repo a GitHub
2. En el repo: **Settings → Pages**
3. Source: **Deploy from a branch** → Branch: **main** → **/(root)** → Save
4. Esperar ~1 minuto
5. La URL será: `https://kikar-agency.github.io/alquimia-pedidos/`

## 📂 Estructura

```
alquimia-pedidos/
├── index.html          ← App principal
├── schema.sql          ← Script SQL para Supabase
├── css/
│   └── style.css
├── js/
│   ├── config.js       ← URL y key de Supabase
│   ├── auth.js         ← Login/logout
│   ├── app.js          ← Navegación
│   └── pedidos.js      ← CRUD de pedidos
└── README.md
```

## 🔄 Flujo del sistema

```
Nuevo pedido → Pendiente aprobación → Aprobado → Despachado → Finalizado
                                                              ↳ (si era pago al recibir,
                                                                 queda flag "pago pendiente")
```

**Quién hace qué:**
- **Cualquier usuario** puede crear pedidos, aprobar, despachar y finalizar
- Cada cambio queda registrado con email del usuario y fecha
- En "Aprobados", los **urgentes salen arriba**, después por antigüedad

## 🔧 Mantenimiento

**Agregar/quitar usuarios:** Supabase Dashboard → Authentication → Users

**Ver datos crudos:** Supabase Dashboard → Table Editor

**Backup:** Supabase tiene backups automáticos diarios en el plan free.

## 🛠 Próximas mejoras (Fase 2)

- [ ] Lectura automática de factura desde JSON (cuando la IA de WhatsApp lo provea)
- [ ] Portal del cliente (login externo para ver historial de pedidos)
- [ ] Notificaciones por email al cliente cuando cambia el estado
- [ ] Dashboard con estadísticas

## ❓ Soporte

Si la app tira un error de "Invalid API key" → la publishable key está mal o expiró. Reemplazar en `js/config.js`.

Si no se ve nada al loguear → revisar la consola del navegador (F12) y avisar.
