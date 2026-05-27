import { IProductValidationPort, ProductInfo } from '../../domain/ports/IProductValidationPort';
import { LoggerFactory, ILogger } from '@hbs/logging';

const PRODUCT_QUERY = `
  query GetProductForValidation($id: ID!) {
    product(id: $id) {
      id
      name
      isActive
      price
      stockQuantity
      variants {
        size
        color
        stockQuantity
        price
        isActive
      }
    }
  }
`;

export class HttpProductValidationAdapter implements IProductValidationPort {
  private readonly logger: ILogger;

  constructor(private readonly productServiceUrl: string) {
    this.logger = LoggerFactory.getInstance().createServiceLogger('HttpProductValidationAdapter');
  }

  async getProductById(productId: string): Promise<ProductInfo | null> {
    try {
      const response = await fetch(this.productServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: PRODUCT_QUERY,
          variables: { id: productId },
        }),
      });

      if (!response.ok) {
        this.logger.warn('product-service HTTP error', { productId, status: response.status });
        return null;
      }

      const json: any = await response.json();

      if (json.errors?.length) {
        this.logger.warn('product-service GraphQL errors', { productId, errors: json.errors });
        return null;
      }

      const product = json.data?.product;
      if (!product) return null;

      return {
        id: product.id,
        name: product.name,
        isActive: product.isActive ?? true,
        price: Number(product.price) || 0,
        stockQuantity: Number(product.stockQuantity) || 0,
        variants: (product.variants || []).map((v: any) => ({
          size: v.size,
          color: v.color,
          stockQuantity: Number(v.stockQuantity) || 0,
          price: Number(v.price) || 0,
          isActive: v.isActive ?? true,
        })),
      };
    } catch (error) {
      this.logger.error(
        'Failed to validate product',
        error instanceof Error ? error : new Error(String(error)),
        { productId },
      );
      return null;
    }
  }
}
