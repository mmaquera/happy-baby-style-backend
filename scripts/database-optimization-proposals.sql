-- =====================================================
-- PROPUESTAS DE OPTIMIZACIÓN - HAPPY BABY STYLE
-- =====================================================
-- Script basado en el análisis de la base de datos
-- 42 tablas, 87 índices, estructura e-commerce completa

-- =====================================================
-- 1. OPTIMIZACIÓN DE ÍNDICES (CRÍTICA)
-- =====================================================

-- Índices faltantes para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON user_favorites(created_at);

-- Índices compuestos para consultas complejas
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_price_active ON products(price, is_active);

-- =====================================================
-- 2. OPTIMIZACIÓN DE CONSULTAS (PARTICIONAMIENTO)
-- =====================================================

-- Particionamiento por fecha para tablas grandes
-- (Implementar cuando las tablas crezcan)

-- Ejemplo para orders (cuando tenga > 1M registros):
/*
CREATE TABLE orders_partitioned (
    LIKE orders INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
*/

-- =====================================================
-- 3. OPTIMIZACIÓN DE CONFIGURACIÓN
-- =====================================================

-- Configuraciones recomendadas para RDS
-- (Ejecutar en pgAdmin4 o configurar en RDS)

/*
-- Memoria compartida (25% de RAM total)
ALTER SYSTEM SET shared_buffers = '256MB';

-- Memoria de trabajo por conexión
ALTER SYSTEM SET work_mem = '4MB';

-- Memoria para mantenimiento
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Estadísticas más precisas
ALTER SYSTEM SET default_statistics_target = 100;

-- Optimización de checkpoints
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- WAL buffers
ALTER SYSTEM SET wal_buffers = '16MB';

-- Costo de página aleatoria (SSD)
ALTER SYSTEM SET random_page_cost = 1.1;

-- Reboot requerido después de cambios
*/

-- =====================================================
-- 4. VISTAS MATERIALIZADAS PARA REPORTES
-- =====================================================

-- Vista materializada para estadísticas de productos
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_stats AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.category_id,
    c.name as category_name,
    p.price,
    p.stock_quantity,
    p.rating,
    p.review_count,
    COUNT(oi.id) as total_sales,
    SUM(oi.quantity) as units_sold,
    SUM(oi.total_price) as revenue,
    COUNT(pr.id) as total_reviews,
    AVG(pr.rating) as avg_rating,
    COUNT(uf.id) as total_favorites
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = true
LEFT JOIN user_favorites uf ON p.id = uf.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.sku, p.category_id, c.name, p.price, p.stock_quantity, p.rating, p.review_count;

-- Vista materializada para estadísticas de usuarios
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_stats AS
SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    up.role,
    COUNT(o.id) as total_orders,
    SUM(o.total_amount) as total_spent,
    AVG(o.total_amount) as avg_order_value,
    COUNT(uf.id) as total_favorites,
    MAX(o.created_at) as last_order_date,
    COUNT(ae.id) as total_app_events
FROM user_profiles up
LEFT JOIN orders o ON up.id = o.user_id
LEFT JOIN user_favorites uf ON up.id = uf.user_id
LEFT JOIN app_events ae ON up.id = ae.user_id
WHERE up.is_active = true
GROUP BY up.id, up.email, up.first_name, up.last_name, up.role;

-- Vista materializada para estadísticas de ventas
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_stats AS
SELECT 
    DATE_TRUNC('day', o.created_at) as sale_date,
    COUNT(o.id) as total_orders,
    COUNT(DISTINCT o.user_id) as unique_customers,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value,
    COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders
FROM orders o
GROUP BY DATE_TRUNC('day', o.created_at)
ORDER BY sale_date DESC;

-- Índices para vistas materializadas
CREATE INDEX IF NOT EXISTS idx_mv_product_stats_category ON mv_product_stats(category_id);
CREATE INDEX IF NOT EXISTS idx_mv_product_stats_price ON mv_product_stats(price);
CREATE INDEX IF NOT EXISTS idx_mv_user_stats_role ON mv_user_stats(role);
CREATE INDEX IF NOT EXISTS idx_mv_sales_stats_date ON mv_sales_stats(sale_date);

-- =====================================================
-- 5. FUNCIONES OPTIMIZADAS
-- =====================================================

-- Función para búsqueda de productos optimizada
CREATE OR REPLACE FUNCTION search_products(
    search_term TEXT,
    category_id TEXT DEFAULT NULL,
    min_price DECIMAL DEFAULT NULL,
    max_price DECIMAL DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    description TEXT,
    price DECIMAL,
    rating DECIMAL,
    review_count INTEGER,
    category_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.rating,
        p.review_count,
        c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
    AND (
        p.name ILIKE '%' || search_term || '%'
        OR p.description ILIKE '%' || search_term || '%'
        OR p.tags::text ILIKE '%' || search_term || '%'
    )
    AND (category_id IS NULL OR p.category_id = category_id)
    AND (min_price IS NULL OR p.price >= min_price)
    AND (max_price IS NULL OR p.price <= max_price)
    ORDER BY 
        CASE WHEN p.name ILIKE search_term THEN 1
             WHEN p.name ILIKE search_term || '%' THEN 2
             WHEN p.name ILIKE '%' || search_term || '%' THEN 3
             ELSE 4
        END,
        p.rating DESC NULLS LAST,
        p.review_count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener productos recomendados
CREATE OR REPLACE FUNCTION get_recommended_products(
    user_id TEXT,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    price DECIMAL,
    rating DECIMAL,
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.id,
        p.name,
        p.price,
        p.rating,
        'Basado en favoritos' as reason
    FROM products p
    INNER JOIN user_favorites uf ON p.id = uf.product_id
    WHERE uf.user_id IN (
        SELECT uf2.user_id 
        FROM user_favorites uf2 
        WHERE uf2.product_id IN (
            SELECT uf3.product_id 
            FROM user_favorites uf3 
            WHERE uf3.user_id = user_id
        )
        AND uf2.user_id != user_id
    )
    AND p.id NOT IN (
        SELECT uf4.product_id 
        FROM user_favorites uf4 
        WHERE uf4.user_id = user_id
    )
    AND p.is_active = true
    ORDER BY p.rating DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. TRIGGERS PARA MANTENIMIENTO AUTOMÁTICO
-- =====================================================

-- Trigger para actualizar estadísticas de productos
CREATE OR REPLACE FUNCTION update_product_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar rating y review_count en products
    UPDATE products 
    SET 
        rating = (
            SELECT AVG(rating) 
            FROM product_reviews 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
            AND is_approved = true
        ),
        review_count = (
            SELECT COUNT(*) 
            FROM product_reviews 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
            AND is_approved = true
        )
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_stats
    AFTER INSERT OR UPDATE OR DELETE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stats();

-- Trigger para limpiar datos antiguos
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Limpiar app_events más antiguos de 90 días
    DELETE FROM app_events 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Limpiar sesiones expiradas
    DELETE FROM user_sessions 
    WHERE expires_at < NOW();
    
    -- Limpiar notificaciones leídas más antiguas de 30 días
    DELETE FROM push_notifications 
    WHERE is_read = true 
    AND read_at < NOW() - INTERVAL '30 days';
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar limpieza diariamente (configurar con cron)
-- SELECT cleanup_old_data();

-- =====================================================
-- 7. OPTIMIZACIÓN DE CONSULTAS FRECUENTES
-- =====================================================

-- Consulta optimizada para dashboard
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT 
    (SELECT COUNT(*) FROM user_profiles WHERE is_active = true) as active_users,
    (SELECT COUNT(*) FROM products WHERE is_active = true) as active_products,
    (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'confirmed', 'processing')) as pending_orders,
    (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE) as today_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= CURRENT_DATE) as today_revenue,
    (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= date_trunc('month', CURRENT_DATE)) as month_revenue,
    (SELECT COUNT(*) FROM app_events WHERE created_at >= CURRENT_DATE) as today_events;

-- Consulta optimizada para productos populares
CREATE OR REPLACE VIEW popular_products AS
SELECT 
    p.id,
    p.name,
    p.price,
    p.rating,
    p.review_count,
    COUNT(oi.id) as sales_count,
    SUM(oi.quantity) as units_sold,
    COUNT(uf.id) as favorites_count
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN user_favorites uf ON p.id = uf.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.price, p.rating, p.review_count
ORDER BY sales_count DESC, favorites_count DESC
LIMIT 20;

-- =====================================================
-- 8. MONITOREO Y ALERTAS
-- =====================================================

-- Función para monitorear el rendimiento
CREATE OR REPLACE FUNCTION monitor_performance()
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Total Tables'::TEXT,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public')::NUMERIC,
        'OK'::TEXT
    UNION ALL
    SELECT 
        'Total Indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public')::NUMERIC,
        'OK'
    UNION ALL
    SELECT 
        'Active Users',
        (SELECT COUNT(*) FROM user_profiles WHERE is_active = true)::NUMERIC,
        CASE 
            WHEN (SELECT COUNT(*) FROM user_profiles WHERE is_active = true) > 100 THEN 'WARNING'
            ELSE 'OK'
        END
    UNION ALL
    SELECT 
        'Pending Orders',
        (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'confirmed'))::NUMERIC,
        CASE 
            WHEN (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'confirmed')) > 50 THEN 'WARNING'
            ELSE 'OK'
        END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. RECOMENDACIONES DE MANTENIMIENTO
-- =====================================================

-- Script para mantenimiento regular
/*
-- 1. Actualizar estadísticas (semanal)
ANALYZE;

-- 2. Refrescar vistas materializadas (diario)
REFRESH MATERIALIZED VIEW mv_product_stats;
REFRESH MATERIALIZED VIEW mv_user_stats;
REFRESH MATERIALIZED VIEW mv_sales_stats;

-- 3. Limpiar datos antiguos (diario)
SELECT cleanup_old_data();

-- 4. Monitorear rendimiento (cada hora)
SELECT * FROM monitor_performance();

-- 5. Vacuum y reindex (semanal)
VACUUM ANALYZE;
REINDEX DATABASE happy_baby_style_db;
*/

-- =====================================================
-- RESUMEN DE OPTIMIZACIONES
-- =====================================================

SELECT '🎯 OPTIMIZACIONES APLICADAS' as status;
SELECT '✅ 15+ índices nuevos creados' as optimization;
SELECT '✅ 3 vistas materializadas para reportes' as views;
SELECT '✅ 2 funciones optimizadas de búsqueda' as functions;
SELECT '✅ Triggers para mantenimiento automático' as triggers;
SELECT '✅ Vistas optimizadas para dashboard' as dashboard;
SELECT '✅ Función de monitoreo de rendimiento' as monitoring;
SELECT '📱 Base de datos optimizada para app Android' as result;

