-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "customer_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "shipping_city" TEXT,
ADD COLUMN     "shipping_country" TEXT DEFAULT 'PE',
ADD COLUMN     "shipping_state" TEXT,
ADD COLUMN     "shipping_street" TEXT,
ADD COLUMN     "shipping_zip_code" TEXT;
