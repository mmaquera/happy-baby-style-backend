-- CreateIndex: products.category_id (Product.categoryId — cross-service ref, filter by category)
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex: product_variants.product_id (ProductVariant.productId FK)
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex: inventory_transactions.product_id (InventoryTransaction.productId FK)
CREATE INDEX "inventory_transactions_product_id_idx" ON "inventory_transactions"("product_id");

-- CreateIndex: stock_alerts.product_id (StockAlert.productId FK)
CREATE INDEX "stock_alerts_product_id_idx" ON "stock_alerts"("product_id");

-- CreateIndex: product_reviews.user_id (ProductReview.userId — cross-service ref, trailing column
-- in @@unique([productId, userId]) does NOT cover WHERE user_id = ? alone; explicit index needed)
CREATE INDEX "product_reviews_user_id_idx" ON "product_reviews"("user_id");

-- CreateIndex: review_photos.review_id (ReviewPhoto.reviewId FK)
CREATE INDEX "review_photos_review_id_idx" ON "review_photos"("review_id");

-- CreateIndex: review_votes.user_id (ReviewVote.userId — cross-service ref, trailing column
-- in @@unique([reviewId, userId]) does NOT cover WHERE user_id = ? alone; explicit index needed)
CREATE INDEX "review_votes_user_id_idx" ON "review_votes"("user_id");

-- NOTE: product_reviews.product_id is intentionally excluded.
-- The @@unique([productId, userId]) constraint creates a composite B-tree index
-- with product_id as the leading column, which covers WHERE product_id = ? lookups.
-- Adding a separate single-column index would be redundant and waste write overhead.

-- NOTE: review_votes.review_id is intentionally excluded.
-- The @@unique([reviewId, userId]) constraint creates a composite B-tree index
-- with review_id as the leading column, which covers WHERE review_id = ? lookups.
-- Adding a separate single-column index would be redundant and waste write overhead.
