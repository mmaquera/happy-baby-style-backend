import { GetProductsUseCase, GetProductsRequest } from '@application/use-cases/product/GetProductsUseCase';
import { IProductRepository } from '@domain/repositories/IProductRepository';
import { ProductEntity } from '@domain/entities/Product';

// Mock del repositorio
const mockProductRepository: jest.Mocked<IProductRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
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
  getCategories: jest.fn(),
};

describe('GetProductsUseCase', () => {
  let getProductsUseCase: GetProductsUseCase;

  beforeEach(() => {
    getProductsUseCase = new GetProductsUseCase(mockProductRepository);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const mockProducts = [
      new ProductEntity(
        'prod-1',
        'cat-1',
        'Product 1',
        'Description 1',
        29.99,
        24.99,
        'PROD-001',
        ['image1.jpg'],
        { color: 'red' },
        true,
        10,
        ['tag1'],
        4.5,
        100,
        new Date(),
        new Date()
      ),
      new ProductEntity(
        'prod-2',
        'cat-2',
        'Product 2',
        'Description 2',
        39.99,
        undefined,
        'PROD-002',
        ['image2.jpg'],
        { color: 'blue' },
        true,
        5,
        ['tag2'],
        4.0,
        50,
        new Date(),
        new Date()
      )
    ];

    it('should return products with pagination when no filters are provided', async () => {
      // Arrange
      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      // Act
      const result = await getProductsUseCase.execute();

      // Assert
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
      expect(result.products).toEqual(mockProducts);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const request: GetProductsRequest = {
        filters: {
          category: 'cat-1',
          isActive: true,
          minPrice: 20,
          maxPrice: 50,
          inStock: true,
          search: 'test'
        },
        pagination: {
          limit: 10,
          offset: 0
        }
      };

      mockProductRepository.findAll.mockResolvedValue([mockProducts[0]]);

      // Act
      const result = await getProductsUseCase.execute(request);

      // Assert
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        categoryId: 'cat-1',
        isActive: true,
        minPrice: 20,
        maxPrice: 50,
        inStock: true,
        search: 'test',
        limit: 10,
        offset: 0
      });
      expect(result.products).toEqual([mockProducts[0]]);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination correctly with hasMore = true', async () => {
      // Arrange
      const request: GetProductsRequest = {
        pagination: {
          limit: 1,
          offset: 0
        }
      };

      mockProductRepository.findAll.mockResolvedValue([mockProducts[0]]);

      // Act
      const result = await getProductsUseCase.execute(request);

      // Assert
      expect(result.products).toEqual([mockProducts[0]]);
      expect(result.total).toBe(2); // offset + length + 1
      expect(result.hasMore).toBe(true);
    });

    it('should trim search text', async () => {
      // Arrange
      const request: GetProductsRequest = {
        filters: {
          search: '  trimmed search  '
        }
      };

      mockProductRepository.findAll.mockResolvedValue([]);

      // Act
      await getProductsUseCase.execute(request);

      // Assert
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        categoryId: undefined,
        isActive: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        inStock: undefined,
        search: 'trimmed search',
        limit: 50,
        offset: 0
      });
    });

    it('should handle empty results', async () => {
      // Arrange
      mockProductRepository.findAll.mockResolvedValue([]);

      // Act
      const result = await getProductsUseCase.execute();

      // Assert
      expect(result.products).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle repository errors', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockProductRepository.findAll.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(getProductsUseCase.execute())
        .rejects
        .toThrow('Database connection failed');

      expect(mockProductRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should use default pagination values', async () => {
      // Arrange
      const request: GetProductsRequest = {
        filters: {
          category: 'cat-1'
        }
        // No pagination provided
      };

      mockProductRepository.findAll.mockResolvedValue([]);

      // Act
      await getProductsUseCase.execute(request);

      // Assert
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        categoryId: 'cat-1',
        isActive: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        inStock: undefined,
        search: undefined,
        limit: 50,
        offset: 0
      });
    });
  });
});