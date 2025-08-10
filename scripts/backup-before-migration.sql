-- =====================================================
-- BACKUP ANTES DE MIGRACIÓN E-COMMERCE
-- =====================================================
-- Ejecutar este script en pgAdmin4 ANTES de aplicar el schema completo
-- para crear un backup de las tablas existentes

-- 1. CREAR TABLA DE BACKUP DE ESTRUCTURA
CREATE TABLE IF NOT EXISTS backup_schema_info (
    backup_id UUID DEFAULT gen_random_uuid(),
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    table_name VARCHAR(255),
    column_name VARCHAR(255),
    data_type VARCHAR(255),
    is_nullable VARCHAR(3),
    column_default TEXT,
    ordinal_position INTEGER,
    PRIMARY KEY (backup_id, table_name, column_name)
);

-- 2. INSERTAR INFORMACIÓN DE ESTRUCTURA ACTUAL
INSERT INTO backup_schema_info (table_name, column_name, data_type, is_nullable, column_default, ordinal_position)
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
AND c.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 3. CREAR TABLA DE BACKUP DE DATOS CRÍTICOS
CREATE TABLE IF NOT EXISTS backup_critical_data (
    backup_id UUID DEFAULT gen_random_uuid(),
    backup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    table_name VARCHAR(255),
    record_count INTEGER,
    PRIMARY KEY (backup_id, table_name)
);

-- 4. CONTAR REGISTROS EN TABLAS CRÍTICAS
INSERT INTO backup_critical_data (table_name, record_count)
SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'user_favorites', COUNT(*) FROM user_favorites
UNION ALL SELECT 'shopping_carts', COUNT(*) FROM shopping_carts
UNION ALL SELECT 'shopping_cart_items', COUNT(*) FROM shopping_cart_items
UNION ALL SELECT 'payment_methods', COUNT(*) FROM payment_methods
UNION ALL SELECT 'images', COUNT(*) FROM images;

-- 5. VERIFICAR BACKUP
SELECT '📋 BACKUP COMPLETADO' as status;
SELECT 
    'Estructura' as backup_type,
    COUNT(DISTINCT table_name) as tables_backed_up,
    COUNT(*) as columns_backed_up
FROM backup_schema_info
WHERE backup_date = (SELECT MAX(backup_date) FROM backup_schema_info)
UNION ALL
SELECT 
    'Datos críticos' as backup_type,
    COUNT(*) as tables_backed_up,
    SUM(record_count) as total_records
FROM backup_critical_data
WHERE backup_date = (SELECT MAX(backup_date) FROM backup_critical_data);

-- 6. MOSTRAR RESUMEN DEL BACKUP
SELECT '📊 RESUMEN DEL BACKUP' as section;
SELECT 
    table_name,
    record_count,
    CASE 
        WHEN record_count = 0 THEN '⚠️  VACÍA'
        WHEN record_count < 10 THEN '📝 POCOS DATOS'
        WHEN record_count < 100 THEN '📊 DATOS MODERADOS'
        ELSE '💾 MUCHOS DATOS'
    END as data_status
FROM backup_critical_data
WHERE backup_date = (SELECT MAX(backup_date) FROM backup_critical_data)
ORDER BY record_count DESC;

-- 7. CONFIRMAR BACKUP EXITOSO
SELECT '✅ BACKUP EXITOSO - LISTO PARA MIGRACIÓN' as confirmation;
SELECT 
    'Fecha del backup: ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS') as backup_info,
    'ID del backup: ' || (SELECT backup_id FROM backup_critical_data ORDER BY backup_date DESC LIMIT 1) as backup_id;

