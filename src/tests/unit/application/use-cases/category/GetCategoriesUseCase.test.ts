import { GetCategoriesUseCase, GetCategoriesRequest, GetCategoriesResponse } from '@application/use-cases/category/GetCategoriesUseCase';
import { ICategoryRepository, CategoryFilters } from '@domain/repositories/ICategoryRepository';
import { CategoryEntity } from '@domain/entities/Product';

// Mock del repositorio
const mockCategoryRepository: jest.Mocked<ICategoryRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByName: jest.fn(),
  findBySlug: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findActive: jest.fn(),
  updateSortOrder: jest.fn()
};

// Mock del logger
jest.mock('@infrastructure/logging/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      })
    })
  }
}));

// Mock del decorador
jest.mock('@infrastructure/logging/LoggingDecorator', () => ({
  LoggingDecorator: {
    logUseCase: jest.fn(() => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => descriptor)
  }
}));

describe('GetCategoriesUseCase', () => {
  let useCase: GetCategoriesUseCase;
  let mockCategories: CategoryEntity[];

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCategoriesUseCase(mockCategoryRepository);

    // Crear categorías de prueba
    mockCategories = [
      new CategoryEntity(
        'cat-1',
        'Baby Clothing',
        'Comfortable and stylish clothing for babies',
        'baby-clothing',
        'https://example.com/baby-clothing.jpg',
        true,
        1,
        new Date('2024-01-01'),
        new Date('2024-01-01')
      ),
      new CategoryEntity(
        'cat-2',
        'Baby Accessories',
        'Essential accessories for your little one',
        'baby-accessories',
        'https://example.com/baby-accessories.jpg',
        true,
        2,
        new Date('2024-01-01'),
        new Date('2024-01-01')
      )
    ];
  });

  describe('execute', () => {
    it('should return categories with default pagination when no request provided', async () => {
      // Arrange
      const request: GetCategoriesRequest = {};
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual({
        categories: mockCategories,
        total: 2,
        hasMore: false
      });
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith({
        isActive: undefined,
        search: undefined,
        limit: 50,
        offset: 0
      });
    });

    it('should return categories with custom pagination', async () => {
      // Arrange
      const request: GetCategoriesRequest = {
        pagination: { limit: 5, offset: 10 }
      };
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual({
        categories: mockCategories,
        total: 12,
        hasMore: false
      });
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith({
        isActive: undefined,
        search: undefined,
        limit: 5,
        offset: 10
      });
    });

    it('should return categories with filters', async () => {
      // Arrange
      const request: GetCategoriesRequest = {
        filters: { isActive: true, search: 'baby' },
        pagination: { limit: 10, offset: 0 }
      };
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual({
        categories: mockCategories,
        total: 2,
        hasMore: false
      });
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith({
        isActive: true,
        search: 'baby',
        limit: 10,
        offset: 0
      });
    });

    it('should handle search filter with trimmed whitespace', async () => {
      // Arrange
      const request: GetCategoriesRequest = {
        filters: { search: '  baby  ' },
        pagination: { limit: 10, offset: 0 }
      };
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith({
        isActive: undefined,
        search: 'baby',
        limit: 10,
        offset: 0
      });
    });

    it('should indicate hasMore when results match limit', async () => {
      // Arrange
      const request: GetCategoriesRequest = {
        pagination: { limit: 2, offset: 0 }
      };
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(3);
    });

    it('should handle empty results', async () => {
      // Arrange
      const request: GetCategoriesRequest = {};
      mockCategoryRepository.findAll.mockResolvedValue([]);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual({
        categories: [],
        total: 0,
        hasMore: false
      });
    });

    it('should propagate repository errors', async () => {
      // Arrange
      const request: GetCategoriesRequest = {};
      const error = new Error('Database connection failed');
      mockCategoryRepository.findAll.mockRejectedValue(error);

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Database connection failed');
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith({
        isActive: undefined,
        search: undefined,
        limit: 50,
        offset: 0
      });
    });

    it('should handle large pagination limits', async () => {
      // Arrange
      const request: GetCategoriesRequest = {
        pagination: { limit: 1000, offset: 0 }
      };
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith({
        isActive: undefined,
        search: undefined,
        limit: 1000,
        offset: 0
      });
    });

    it('should handle negative offset', async () => {
      // Arrange
      const request: GetCategoriesRequest = {
        pagination: { limit: 10, offset: -5 }
      };
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith({
        isActive: undefined,
        search: undefined,
        limit: 10,
        offset: -5
      });
    });
  });
});
