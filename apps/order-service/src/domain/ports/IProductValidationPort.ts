// ── Tax affectation type — local to order-service ─────────────────────────────
// Mirrors the Prisma enum TaxAffectation. Defined locally so order-service never
// imports from product-service source. invoicing-service will have its own copy.
export type TaxAffectation = 'gravado' | 'exonerado' | 'inafecto';

export interface ProductVariantInfo {
  id: string;
  size: string;
  color: string;
  stockQuantity: number;
  price: number;
  isActive: boolean;
  /** Tax affectation snapshot from product-service. Null means product-service hasn't been updated yet. */
  taxAffectation: TaxAffectation | null;
}

export interface ProductInfo {
  id: string;
  name: string;
  isActive: boolean;
  price: number;
  stockQuantity: number;
  variants: ProductVariantInfo[];
  /** Tax affectation at product level. Null means product-service hasn't been updated yet. */
  taxAffectation: TaxAffectation | null;
}

export interface IProductValidationPort {
  getProductById(productId: string): Promise<ProductInfo | null>;
}
