import { GetProductsUseCase, GetProductsRequest } from '@application/use-cases/product/GetProductsUseCase';
import { IProductRepository, ProductFilters } from '@domain/repositories/IProductRepository';
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

describe('GetProductsUseCase', () => {
  let useCase: GetProductsUseCase;

  beforeEach(() => {
    useCase = new GetProductsUseCase(mockProductRepository);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return products when no filters are provided', async () => {
      // Arrange
      const mockProducts: ProductEntity[] = [
        new ProductEntity(
          '1',
          'category-1',
          'Test Product 1',
          'Description 1',
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
        )
      ];

      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      // Act
      const result = await useCase.execute({});

      // Assert
      expect(result.products).toEqual(mockProducts);
      expect(result.total).toBeGreaterThan(0);
      expect(typeof result.hasMore).toBe('boolean');
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        categoryId: undefined,
        isActive: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        inStock: undefined,
        search: undefined,
        limit: 50,
        offset: 0
      });
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const request: GetProductsRequest = {
        filters: {
          category: 'category-1',
          isActive: true,
          minPrice: 10,
          maxPrice: 50,
          inStock: true,
          search: 'test'
        },
        pagination: {
          limit: 10,
          offset: 5
        }
      };

      const mockProducts: ProductEntity[] = [];
      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.products).toEqual(mockProducts);
      expect(result.total).toBeGreaterThan(0);
      expect(typeof result.hasMore).toBe('boolean');
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        categoryId: 'category-1',
        isActive: true,
        minPrice: 10,
        maxPrice: 50,
        inStock: true,
        search: 'test',
        limit: 10,
        offset: 5
      });
    });

    it('should handle empty search string', async () => {
      // Arrange
      const request: GetProductsRequest = {
        filters: {
          search: '   '
        }
      };

      const mockProducts: ProductEntity[] = [];
      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockProducts);
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        categoryId: undefined,
        isActive: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        inStock: undefined,
        search: undefined,
        limit: 50,
        offset: 0
      });
    });

    it('should use default values when limit and offset are not provided', async () => {
      // Arrange
      const request: GetProductsRequest = {};

      const mockProducts: ProductEntity[] = [];
      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.products).toEqual(mockProducts);
      expect(result.total).toBeGreaterThan(0);
      expect(typeof result.hasMore).toBe('boolean');
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        categoryId: undefined,
        isActive: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        inStock: undefined,
        search: undefined,
        limit: 50,
        offset: 0
      });
    });

    it('should handle repository errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockProductRepository.findAll.mockRejectedValue(error);

      // Act & Assert
      await expect(useCase.execute({})).rejects.toThrow('Database error');
      expect(mockProductRepository.findAll).toHaveBeenCalled();
    });
  });
}); 