import { GetProductByIdUseCase, GetProductByIdRequest } from '@application/use-cases/product/GetProductByIdUseCase';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { ProductEntity } from '@domain/entities/Product';

// Mock del repositorio
const mockProductRepository: jest.Mocked<IProductRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByCategory: jest.fn(),
  findBySku: jest.fn(),
  updateStock: jest.fn(),
  search: jest.fn(),
  createVariant: jest.fn(),
  getProductVariants: jest.fn(),
  updateVariant: jest.fn(),
  deleteVariant: jest.fn(),
  getCategories: jest.fn()
};

describe('GetProductByIdUseCase', () => {
  let useCase: GetProductByIdUseCase;

  beforeEach(() => {
    useCase = new GetProductByIdUseCase(mockProductRepository);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return product when valid ID is provided', async () => {
      // Arrange
      const mockProduct = new ProductEntity(
        '1',
        'category-1',
        'Test Product',
        'Test Description',
        29.99,
        undefined,
        'SKU-1',
        [],
        {},
        true,
        10,
        ['test'],
        4.5,
        5,
        new Date(),
        new Date()
      );

      const request: GetProductByIdRequest = { id: '1' };
      mockProductRepository.findById.mockResolvedValue(mockProduct);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should return null when product is not found', async () => {
      // Arrange
      const request: GetProductByIdRequest = { id: 'non-existent' };
      mockProductRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toBeNull();
      expect(mockProductRepository.findById).toHaveBeenCalledWith('non-existent');
    });

    it('should throw error when ID is empty', async () => {
      // Arrange
      const request: GetProductByIdRequest = { id: '' };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Product ID is required');
      expect(mockProductRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error when ID is not provided', async () => {
      // Arrange
      const request: GetProductByIdRequest = { id: undefined as any };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Product ID is required');
      expect(mockProductRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      // Arrange
      const request: GetProductByIdRequest = { id: '1' };
      const error = new Error('Database error');
      mockProductRepository.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Database error');
      expect(mockProductRepository.findById).toHaveBeenCalledWith('1');
    });
  });
}); 