import { ProductEntity } from '@domain/entities/Product';
import { IProductRepository } from '@domain/repositories/IProductRepository';

export interface GetProductByIdRequest {
  id: string;
}

export class GetProductByIdUseCase {
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  async execute(request: GetProductByIdRequest): Promise<ProductEntity | null> {
    if (!request.id) {
      throw new Error('Product ID is required');
    }

    return await this.productRepository.findById(request.id);
  }
} 