-- =====================================================
-- VALIDACIÓN DEL SCHEMA ACTUAL - HAPPY BABY STYLE
-- =====================================================
-- Ejecutar este script en pgAdmin4 para validar el estado actual
-- antes de aplicar el schema de e-commerce completo

-- 1. VERIFICAR TABLAS EXISTENTES
SELECT '📋 TABLAS EXISTENTES' as section;
SELECT 
    table_name,
    table_type,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. VERIFICAR TABLAS DEL E-COMMERCE ACTUAL
SELECT '🛒 TABLAS DE E-COMMERCE ACTUAL' as section;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_profiles', 'user_accounts', 'user_sessions', 'user_passwords',
    'user_addresses', 'categories', 'products', 'product_variants',
    'shopping_carts', 'shopping_cart_items', 'user_favorites',
    'orders', 'order_items', 'payment_methods', 'images'
)
ORDER BY table_name;

-- 3. VERIFICAR TABLAS NUEVAS DEL E-COMMERCE COMPLETO
SELECT '🆕 TABLAS NUEVAS A CREAR' as section;
SELECT 'transactions' as table_name, 'Sistema de pagos móvil' as description
UNION ALL SELECT 'saved_payment_methods', 'Métodos de pago guardados'
UNION ALL SELECT 'push_notifications', 'Notificaciones push'
UNION ALL SELECT 'notification_templates', 'Plantillas de notificaciones'
UNION ALL SELECT 'coupons', 'Cupones y descuentos'
UNION ALL SELECT 'coupon_usage', 'Uso de cupones'
UNION ALL SELECT 'product_reviews', 'Reseñas de productos'
UNION ALL SELECT 'review_photos', 'Fotos de reseñas'
UNION ALL SELECT 'review_votes', 'Votos de reseñas'
UNION ALL SELECT 'order_tracking', 'Tracking de pedidos'
UNION ALL SELECT 'carriers', 'Empresas de transporte'
UNION ALL SELECT 'inventory_transactions', 'Transacciones de inventario'
UNION ALL SELECT 'stock_alerts', 'Alertas de stock'
UNION ALL SELECT 'shipping_zones', 'Zonas de envío'
UNION ALL SELECT 'shipping_rates', 'Tarifas de envío'
UNION ALL SELECT 'delivery_slots', 'Horarios de entrega'
UNION ALL SELECT 'app_events', 'Eventos de la app'
UNION ALL SELECT 'user_sessions_analytics', 'Sesiones de usuario'
UNION ALL SELECT 'loyalty_programs', 'Programa de fidelización'
UNION ALL SELECT 'reward_points', 'Puntos de recompensa'
UNION ALL SELECT 'store_settings', 'Configuración de tienda'
UNION ALL SELECT 'tax_rates', 'Tasas de impuestos'
UNION ALL SELECT 'audit_logs', 'Logs de auditoría'
UNION ALL SELECT 'security_events', 'Eventos de seguridad'
UNION ALL SELECT 'newsletter_subscriptions', 'Suscripciones newsletter'
UNION ALL SELECT 'email_templates', 'Plantillas de email'
ORDER BY table_name;

-- 4. VERIFICAR MODIFICACIONES A TABLAS EXISTENTES
SELECT '🔧 MODIFICACIONES A TABLAS EXISTENTES' as section;
SELECT 'user_favorites' as table_name, 'Agregar: notes, priority, added_at' as modifications
UNION ALL SELECT 'orders', 'Agregar: coupon_id, coupon_discount, tracking_number, estimated_delivery, actual_delivery, delivery_notes'
UNION ALL SELECT 'products', 'Agregar: weight, dimensions, is_featured, featured_until'
ORDER BY table_name;

-- 5. VERIFICAR DEPENDENCIAS
SELECT '🔗 VERIFICAR DEPENDENCIAS' as section;
SELECT 
    'orders' as required_table,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') 
         THEN '✅ EXISTE' ELSE '❌ FALTANTE' END as status
UNION ALL SELECT 'user_profiles', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
         THEN '✅ EXISTE' ELSE '❌ FALTANTE' END
UNION ALL SELECT 'products', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') 
         THEN '✅ EXISTE' ELSE '❌ FALTANTE' END
UNION ALL SELECT 'categories', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') 
         THEN '✅ EXISTE' ELSE '❌ FALTANTE' END
UNION ALL SELECT 'product_variants', 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants') 
         THEN '✅ EXISTE' ELSE '❌ FALTANTE' END
ORDER BY required_table;

-- 6. RESUMEN DE VALIDACIÓN
SELECT '📊 RESUMEN DE VALIDACIÓN' as section;
SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_existing_tables,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (
        'user_profiles', 'user_accounts', 'user_sessions', 'user_passwords',
        'user_addresses', 'categories', 'products', 'product_variants',
        'shopping_carts', 'shopping_cart_items', 'user_favorites',
        'orders', 'order_items', 'payment_methods', 'images'
    )) as ecommerce_current_tables,
    25 as new_tables_to_create,
    3 as tables_to_modify;

-- 7. RECOMENDACIONES
SELECT '💡 RECOMENDACIONES' as section;
SELECT '✅ El script usa IF NOT EXISTS - es seguro' as recommendation
UNION ALL SELECT '✅ Las modificaciones usan ADD COLUMN IF NOT EXISTS'
UNION ALL SELECT '✅ Los índices usan IF NOT EXISTS'
UNION ALL SELECT '⚠️  Los datos iniciales pueden fallar si ya existen'
UNION ALL SELECT '🔒 Recomendado: Hacer backup antes de ejecutar'
UNION ALL SELECT '📱 El schema está optimizado para app Android'
UNION ALL SELECT '🛒 Incluye todas las funcionalidades de e-commerce';

-- 8. ESTADO DE PREPARACIÓN
SELECT '🎯 ESTADO DE PREPARACIÓN' as section;
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (
            'user_profiles', 'orders', 'products', 'categories'
        )) = 4 
        THEN '✅ LISTO PARA EJECUTAR'
        ELSE '❌ FALTAN TABLAS BÁSICAS'
    END as preparation_status;

