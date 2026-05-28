export interface ProductVariantInfo {
  id: string;
  size: string;
  color: string;
  stockQuantity: number;
  price: number;
  isActive: boolean;
}

export interface ProductInfo {
  id: string;
  name: string;
  isActive: boolean;
  price: number;
  stockQuantity: number;
  variants: ProductVariantInfo[];
}

export interface IProductValidationPort {
  getProductById(productId: string): Promise<ProductInfo | null>;
}
