-- CreateIndex: orders.user_id (Order.userId FK)
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex: order_items.order_id (OrderItem.orderId FK)
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex: order_items.product_id (OrderItem.productId — cross-service ref, lookup by product)
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex: order_tracking.order_id (OrderTracking.orderId FK)
CREATE INDEX "order_tracking_order_id_idx" ON "order_tracking"("order_id");

-- CreateIndex: order_tracking.carrier_id (OrderTracking.carrierId FK, nullable)
CREATE INDEX "order_tracking_carrier_id_idx" ON "order_tracking"("carrier_id");

-- CreateIndex: payment_methods.order_id (PaymentMethod.orderId FK)
CREATE INDEX "payment_methods_order_id_idx" ON "payment_methods"("order_id");

-- CreateIndex: transactions.order_id (Transaction.orderId FK)
CREATE INDEX "transactions_order_id_idx" ON "transactions"("order_id");

-- CreateIndex: transactions.user_id (Transaction.userId — cross-service ref)
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex: shipping_rates.zone_id (ShippingRate.zoneId FK, Cascade)
CREATE INDEX "shipping_rates_zone_id_idx" ON "shipping_rates"("zone_id");

-- CreateIndex: coupon_usage.coupon_id (CouponUsage.couponId FK)
CREATE INDEX "coupon_usage_coupon_id_idx" ON "coupon_usage"("coupon_id");

-- CreateIndex: coupon_usage.user_id (CouponUsage.userId — cross-service ref, coupon history per user)
CREATE INDEX "coupon_usage_user_id_idx" ON "coupon_usage"("user_id");

-- CreateIndex: coupon_usage.order_id (CouponUsage.orderId FK)
CREATE INDEX "coupon_usage_order_id_idx" ON "coupon_usage"("order_id");

-- CreateIndex: shopping_carts.user_id (ShoppingCart.userId — cross-service ref, nullable)
CREATE INDEX "shopping_carts_user_id_idx" ON "shopping_carts"("user_id");

-- CreateIndex: shopping_cart_items.cart_id (ShoppingCartItem.cartId FK)
CREATE INDEX "shopping_cart_items_cart_id_idx" ON "shopping_cart_items"("cart_id");

-- CreateIndex: shopping_cart_items.product_id (ShoppingCartItem.productId — cross-service ref)
CREATE INDEX "shopping_cart_items_product_id_idx" ON "shopping_cart_items"("product_id");
