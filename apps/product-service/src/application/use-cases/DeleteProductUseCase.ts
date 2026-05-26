import { IProductRepository } from '../../domain/repositories/IProductRepository';

export class DeleteProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string): Promise<void> {
    if (!id) throw new Error('Product ID is required');
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new Error('Product not found');
    await this.productRepository.delete(id);
  }
}
