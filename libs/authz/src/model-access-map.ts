/**
 * ACL: ir.model.access — maps each domain model + CRUD operation to the
 * required permission code (verb:noun).
 *
 * Inspired by Odoo's ir.model.access table. The four operations mirror Odoo's
 * perm_create / perm_read / perm_write / perm_unlink columns.
 */

export type ModelOperation = 'create' | 'read' | 'write' | 'unlink';

/**
 * Mapping from PascalCase model name → operation → required permission code.
 *
 * Guidelines:
 * - Order/Product variants use their own verb:noun codes.
 * - System-level models (Category, StoreSettings, Carrier, etc.) gate all
 *   mutating operations behind manage:system.
 * - Media follows product permissions for content access; system-only for delete.
 * - Coupon/Carrier/ShippingZone/ShippingRate/DeliverySlot are config entities
 *   managed by admins, readable by anyone who can read orders.
 */
export const MODEL_ACCESS_MAP: Record<string, Record<ModelOperation, string>> = {
  Order: {
    create: 'create:order',
    read: 'read:order',
    write: 'update:order',
    unlink: 'delete:order',
  },
  Product: {
    create: 'create:product',
    read: 'read:product',
    write: 'update:product',
    unlink: 'delete:product',
  },
  Category: {
    create: 'manage:system',
    read: 'read:product',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  Media: {
    create: 'create:product',
    read: 'read:product',
    write: 'create:product',
    unlink: 'manage:system',
  },
  Coupon: {
    create: 'manage:system',
    read: 'read:order',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  Carrier: {
    create: 'manage:system',
    read: 'read:order',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  ShippingZone: {
    create: 'manage:system',
    read: 'read:order',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  ShippingRate: {
    create: 'manage:system',
    read: 'read:order',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  DeliverySlot: {
    create: 'manage:system',
    read: 'read:order',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  TaxRate: {
    create: 'manage:system',
    read: 'read:order',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  StoreSettings: {
    create: 'manage:system',
    read: 'manage:system',
    write: 'manage:system',
    unlink: 'manage:system',
  },
  InventoryTransaction: {
    create: 'update:product',
    read: 'read:product',
    write: 'update:product',
    unlink: 'delete:product',
  },
  StockAlert: {
    create: 'create:product',
    read: 'read:product',
    write: 'update:product',
    unlink: 'delete:product',
  },
  ProductReview: {
    create: 'create:order',
    read: 'read:product',
    write: 'update:product',
    unlink: 'delete:product',
  },
  User: {
    create: 'create:user',
    read: 'read:user',
    write: 'update:user',
    unlink: 'delete:user',
  },
} as const;
