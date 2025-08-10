import { IProductRepository } from '@domain/repositories/IProductRepository';

export interface DeleteProductRequest {
  id: string;
}

export class DeleteProductUseCase {
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  async execute(request: DeleteProductRequest): Promise<void> {
    if (!request.id) {
      throw new Error('Product ID is required');
    }

    // Verificar que el producto existe
    const existingProduct = await this.productRepository.findById(request.id);
    if (!existingProduct) {
      throw new Error('Product not found');
    }

    // Verificar que el producto no tiene órdenes asociadas
    // Esta validación se implementaría cuando tengamos el repositorio de órdenes
    // const ordersWithProduct = await this.orderRepository.findByProductId(request.id);
    // if (ordersWithProduct.length > 0) {
    //   throw new Error('Cannot delete product with associated orders');
    // }

    await this.productRepository.delete(request.id);
  }
} 