-- =====================================================
-- HAPPY BABY STYLE - E-COMMERCE COMPLETE SCHEMA
-- =====================================================
-- Script para crear todas las tablas faltantes para un e-commerce completo
-- Conectando a: happy-baby-style-db.cr0ug6u2oje3.us-east-2.rds.amazonaws.com

-- =====================================================
-- 1. SISTEMA DE PAGOS MÓVIL (CRÍTICO PARA APP)
-- =====================================================

-- Tabla de transacciones de pago
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) DEFAULT 'PEN',
  payment_method VARCHAR(50) NOT NULL, -- 'credit_card', 'debit_card', 'mobile_wallet', 'cash_on_delivery'
  payment_gateway VARCHAR(50), -- 'stripe', 'paypal', 'mercadopago', 'yape'
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
  gateway_response JSONB DEFAULT '{}',
  transaction_id VARCHAR(255),
  gateway_transaction_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de métodos de pago guardados
CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'credit_card', 'debit_card', 'mobile_wallet'
  provider VARCHAR(50), -- 'visa', 'mastercard', 'yape', 'plin'
  last_four VARCHAR(4),
  expiry_month INTEGER CHECK (expiry_month >= 1 AND expiry_month <= 12),
  expiry_year INTEGER CHECK (expiry_year >= 2024),
  card_holder_name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. NOTIFICACIONES PUSH (CRÍTICO PARA APP MÓVIL)
-- =====================================================

-- Tabla de notificaciones push
CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'order_update', 'promotion', 'stock_alert', 'abandoned_cart', 'delivery_update'
  data JSONB DEFAULT '{}', -- Datos adicionales para la app
  fcm_token VARCHAR(500), -- Token de Firebase Cloud Messaging
  device_id VARCHAR(255),
  platform VARCHAR(20) CHECK (platform IN ('android', 'ios', 'web')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  is_sent BOOLEAN DEFAULT false,
  is_delivered BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  error_message TEXT
);

-- Tabla de plantillas de notificaciones
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. CUPONES Y DESCUENTOS (AUMENTA CONVERSIÓN)
-- =====================================================

-- Tabla de cupones
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value >= 0),
  min_order_amount DECIMAL(10,2) DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount_amount DECIMAL(10,2), -- Para cupones de porcentaje
  max_uses INTEGER, -- NULL = ilimitado
  used_count INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_first_time_only BOOLEAN DEFAULT false,
  applicable_categories UUID[], -- IDs de categorías aplicables
  excluded_products UUID[], -- IDs de productos excluidos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de uso de cupones
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_id, user_id, order_id)
);

-- =====================================================
-- 4. RESEÑAS Y VALORACIONES (CONFIANZA DEL USUARIO)
-- =====================================================

-- Tabla de reseñas de productos
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  helpful_votes INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

-- Tabla de fotos de reseñas
CREATE TABLE IF NOT EXISTS review_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES product_reviews(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de votos de reseñas
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- =====================================================
-- 5. SEGUIMIENTO DE PEDIDOS (EXPERIENCIA MÓVIL)
-- =====================================================

-- Tabla de tracking de pedidos
CREATE TABLE IF NOT EXISTS order_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  description TEXT NOT NULL,
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  actual_delivery TIMESTAMP WITH TIME ZONE,
  tracking_number VARCHAR(100),
  carrier VARCHAR(100),
  carrier_tracking_url TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de empresas de transporte
CREATE TABLE IF NOT EXISTS carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  tracking_url_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. INVENTARIO EN TIEMPO REAL
-- =====================================================

-- Tabla de transacciones de inventario
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'restock', 'adjustment', 'return', 'damage', 'transfer')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  reference_id UUID, -- order_id, return_id, etc.
  reference_type VARCHAR(50), -- 'order', 'return', 'manual'
  created_by TEXT REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de alertas de stock
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock')),
  threshold_quantity INTEGER NOT NULL,
  current_quantity INTEGER NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. LOGÍSTICA Y ENVÍOS
-- =====================================================

-- Tabla de zonas de envío
CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  free_shipping_threshold DECIMAL(10,2),
  estimated_delivery_days_min INTEGER,
  estimated_delivery_days_max INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de tarifas de envío
CREATE TABLE IF NOT EXISTS shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES shipping_zones(id) ON DELETE CASCADE,
  weight_min DECIMAL(8,2),
  weight_max DECIMAL(8,2),
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de horarios de entrega
CREATE TABLE IF NOT EXISTS delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = domingo
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_orders_per_slot INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. ANALÍTICAS MÓVILES
-- =====================================================

-- Tabla de eventos de la app
CREATE TABLE IF NOT EXISTS app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  event_type VARCHAR(50) NOT NULL, -- 'view_product', 'add_to_cart', 'remove_from_cart', 'purchase', 'search', 'filter'
  event_data JSONB DEFAULT '{}',
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  device_info JSONB DEFAULT '{}',
  location JSONB DEFAULT '{}',
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de sesiones de usuario
CREATE TABLE IF NOT EXISTS user_sessions_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  page_views INTEGER DEFAULT 0,
  products_viewed INTEGER DEFAULT 0,
  cart_additions INTEGER DEFAULT 0,
  device_type VARCHAR(20), -- 'mobile', 'tablet', 'desktop'
  platform VARCHAR(20), -- 'android', 'ios', 'web'
  app_version VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 9. FIDELIZACIÓN Y RECOMPENSAS
-- =====================================================

-- Tabla de programa de fidelización
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  points_per_currency DECIMAL(5,2) DEFAULT 1.0, -- puntos por PEN gastado
  min_points_redemption INTEGER DEFAULT 100,
  points_value DECIMAL(5,2) DEFAULT 0.01, -- valor en PEN por punto
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de puntos de recompensa
CREATE TABLE IF NOT EXISTS reward_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired', 'bonus')),
  source VARCHAR(50), -- 'purchase', 'referral', 'birthday', 'review'
  reference_id UUID, -- order_id, etc.
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. CONFIGURACIÓN Y SETTINGS
-- =====================================================

-- Tabla de configuración de la tienda
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de tasas de impuestos
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  rate DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  country VARCHAR(2) NOT NULL,
  state VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. SEGURIDAD Y AUDITORÍA
-- =====================================================

-- Tabla de logs de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de eventos de seguridad
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'password_change', 'failed_login', 'suspicious_activity'
  ip_address INET,
  user_agent TEXT,
  location JSONB,
  risk_score INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 12. COMUNICACIÓN Y MARKETING
-- =====================================================

-- Tabla de suscripciones a newsletter
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  user_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  source VARCHAR(50), -- 'website', 'app', 'checkout'
  preferences JSONB DEFAULT '{}'
);

-- Tabla de plantillas de email
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  variables JSONB DEFAULT '[]', -- Variables disponibles en la plantilla
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 13. MEJORAS A TABLAS EXISTENTES
-- =====================================================

-- Mejorar tabla user_favorites
ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Mejorar tabla orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Mejorar tabla products
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- 14. ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índices para transacciones
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_type ON push_notifications(type);
CREATE INDEX IF NOT EXISTS idx_push_notifications_sent_at ON push_notifications(sent_at);

-- Índices para cupones
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_until ON coupons(valid_until);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);

-- Índices para reseñas
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_is_approved ON product_reviews(is_approved);

-- Índices para inventario
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at);

-- Índices para analytics
CREATE INDEX IF NOT EXISTS idx_app_events_user_id ON app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_event_type ON app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at);

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =====================================================
-- 15. DATOS INICIALES
-- =====================================================

-- Insertar configuración inicial de la tienda
INSERT INTO store_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('store_name', 'Happy Baby Style', 'string', 'Nombre de la tienda', true),
('store_description', 'Ropa y accesorios para bebés', 'string', 'Descripción de la tienda', true),
('store_email', 'info@happybabystyle.com', 'string', 'Email de contacto', true),
('store_phone', '+51 999 999 999', 'string', 'Teléfono de contacto', true),
('store_address', 'Lima, Perú', 'string', 'Dirección de la tienda', true),
('currency', 'PEN', 'string', 'Moneda principal', true),
('tax_rate', '18', 'number', 'Tasa de impuesto IGV (%)', true),
('free_shipping_threshold', '100', 'number', 'Umbral para envío gratis (PEN)', true),
('min_order_amount', '20', 'number', 'Monto mínimo de pedido (PEN)', true),
('max_delivery_days', '7', 'number', 'Días máximos de entrega', true),
('return_policy_days', '30', 'number', 'Días para devoluciones', true),
('app_version', '1.0.0', 'string', 'Versión actual de la app', true),
('maintenance_mode', 'false', 'boolean', 'Modo mantenimiento', true);

-- Insertar zonas de envío básicas
INSERT INTO shipping_zones (name, description, base_shipping_cost, free_shipping_threshold, estimated_delivery_days_min, estimated_delivery_days_max) VALUES
('Lima Metropolitana', 'Lima y Callao', 5.00, 50.00, 1, 2),
('Lima Provincias', 'Resto de Lima', 8.00, 80.00, 2, 4),
('Costa', 'Ciudades de la costa', 12.00, 120.00, 3, 5),
('Sierra', 'Ciudades de la sierra', 15.00, 150.00, 4, 7),
('Selva', 'Ciudades de la selva', 20.00, 200.00, 5, 10);

-- Insertar empresas de transporte
INSERT INTO carriers (name, code, tracking_url_template, is_active) VALUES
('Serpost', 'serpost', 'https://www.serpost.com.pe/consulta-envio?codigo={tracking_number}', true),
('Olva Courier', 'olva', 'https://www.olvacourier.com/rastreo?codigo={tracking_number}', true),
('DHL Express', 'dhl', 'https://www.dhl.com/pe-es/home/tracking.html?tracking-id={tracking_number}', true),
('FedEx', 'fedex', 'https://www.fedex.com/fedextrack/?trknbr={tracking_number}', true);

-- Insertar plantillas de notificaciones
INSERT INTO notification_templates (name, title_template, body_template, type, is_active) VALUES
('order_confirmed', '¡Pedido confirmado! #{order_number}', 'Tu pedido #{order_number} ha sido confirmado y está siendo procesado. Te notificaremos cuando esté listo para envío.', 'order_update', true),
('order_shipped', '¡Tu pedido está en camino! #{order_number}', 'Tu pedido #{order_number} ha sido enviado. Número de seguimiento: {tracking_number}', 'order_update', true),
('order_delivered', '¡Pedido entregado! #{order_number}', 'Tu pedido #{order_number} ha sido entregado exitosamente. ¡Gracias por tu compra!', 'order_update', true),
('stock_alert', 'Producto disponible: {product_name}', 'El producto {product_name} que tenías en favoritos ya está disponible nuevamente.', 'stock_alert', true),
('abandoned_cart', '¡No olvides tu carrito!', 'Tienes productos en tu carrito esperando por ti. ¡Completa tu compra ahora!', 'abandoned_cart', true),
('promotion', '¡Oferta especial! {title}', '{description} Válido hasta {expiry_date}', 'promotion', true);

-- Insertar programa de fidelización
INSERT INTO loyalty_programs (name, description, points_per_currency, min_points_redemption, points_value) VALUES
('Happy Baby Rewards', 'Gana puntos en cada compra y canjéalos por descuentos', 1.0, 100, 0.01);

-- Insertar tasas de impuestos
INSERT INTO tax_rates (name, rate, country, state, is_active) VALUES
('IGV Perú', 18.00, 'PE', NULL, true);

-- =====================================================
-- 16. FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_saved_payment_methods_updated_at BEFORE UPDATE ON saved_payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipping_zones_updated_at BEFORE UPDATE ON shipping_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carriers_updated_at BEFORE UPDATE ON carriers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON store_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_rates_updated_at BEFORE UPDATE ON tax_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON loyalty_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular puntos de fidelización
CREATE OR REPLACE FUNCTION calculate_loyalty_points(order_amount DECIMAL)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(order_amount * (SELECT points_per_currency FROM loyalty_programs WHERE is_active = true LIMIT 1));
END;
$$ LANGUAGE plpgsql;

-- Función para verificar cupón válido
CREATE OR REPLACE FUNCTION is_coupon_valid(coupon_code VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM coupons 
    WHERE code = coupon_code 
    AND is_active = true 
    AND valid_from <= NOW() 
    AND valid_until >= NOW()
    AND (max_uses IS NULL OR used_count < max_uses)
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 17. VISTAS ÚTILES
-- =====================================================

-- Vista de estadísticas de productos
CREATE OR REPLACE VIEW product_stats AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.stock_quantity,
  p.rating,
  p.review_count,
  COUNT(oi.id) as total_sales,
  SUM(oi.quantity) as units_sold,
  SUM(oi.total_price) as revenue,
  COUNT(pr.id) as total_reviews,
  AVG(pr.rating) as avg_rating
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN product_reviews pr ON p.id = pr.product_id AND pr.is_approved = true
GROUP BY p.id, p.name, p.sku, p.stock_quantity, p.rating, p.review_count;

-- Vista de estadísticas de pedidos
CREATE OR REPLACE VIEW order_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as order_date,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
  SUM(total_amount) as total_revenue,
  AVG(total_amount) as avg_order_value
FROM orders
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY order_date DESC;

-- Vista de inventario bajo
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.stock_quantity,
  c.name as category_name
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.stock_quantity <= 10 AND p.is_active = true
ORDER BY p.stock_quantity ASC;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

-- Mensaje de confirmación
SELECT '✅ E-commerce schema completado exitosamente!' as status;
SELECT '📊 Tablas creadas: 25+ tablas nuevas' as summary;
SELECT '🔧 Funcionalidades: Pagos, Notificaciones, Cupones, Reseñas, Tracking, Analytics' as features;
SELECT '📱 Optimizado para: App Android e-commerce' as optimization;
