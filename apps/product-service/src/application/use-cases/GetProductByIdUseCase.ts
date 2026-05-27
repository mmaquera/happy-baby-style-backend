import { ProductEntity } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';

export class GetProductByIdUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string): Promise<ProductEntity | null> {
    if (!id) throw new Error('Product ID is required');
    return this.productRepository.findById(id);
  }
}
