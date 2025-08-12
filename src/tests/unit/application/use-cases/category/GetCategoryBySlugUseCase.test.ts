import { GetCategoryBySlugUseCase, GetCategoryBySlugRequest } from '@application/use-cases/category/GetCategoryBySlugUseCase';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { CategoryEntity } from '@domain/entities/Product';
import { NotFoundError } from '@domain/errors/DomainError';

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

describe('GetCategoryBySlugUseCase', () => {
  let useCase: GetCategoryBySlugUseCase;
  let mockCategory: CategoryEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCategoryBySlugUseCase(mockCategoryRepository);

    // Crear categoría de prueba
    mockCategory = new CategoryEntity(
      'cat-1',
      'Baby Clothing',
      'Comfortable and stylish clothing for babies',
      'baby-clothing',
      'https://example.com/baby-clothing.jpg',
      true,
      1,
      new Date('2024-01-01'),
      new Date('2024-01-01')
    );
  });

  describe('execute', () => {
    it('should return category when found by slug', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: 'baby-clothing' };
      mockCategoryRepository.findBySlug.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('baby-clothing');
    });

    it('should throw NotFoundError when category not found', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: 'non-existent-slug' };
      mockCategoryRepository.findBySlug.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow(NotFoundError);
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('non-existent-slug');
    });

    it('should throw error for empty slug', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: '' };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Category slug is required');
      expect(mockCategoryRepository.findBySlug).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only slug', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: '   ' };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Category slug is required');
      expect(mockCategoryRepository.findBySlug).not.toHaveBeenCalled();
    });

    it('should throw error for null slug', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: null as any };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Category slug is required');
      expect(mockCategoryRepository.findBySlug).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: 'baby-clothing' };
      const error = new Error('Database connection failed');
      mockCategoryRepository.findBySlug.mockRejectedValue(error);

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Database connection failed');
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('baby-clothing');
    });

    it('should handle kebab-case slugs', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: 'baby-accessories-and-toys' };
      mockCategoryRepository.findBySlug.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('baby-accessories-and-toys');
    });

    it('should handle underscore slugs', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: 'baby_accessories' };
      mockCategoryRepository.findBySlug.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('baby_accessories');
    });

    it('should handle numeric slugs', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: 'category-123' };
      mockCategoryRepository.findBySlug.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('category-123');
    });

    it('should handle mixed case slugs', async () => {
      // Arrange
      const request: GetCategoryBySlugRequest = { slug: 'BabyClothing' };
      mockCategoryRepository.findBySlug.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('BabyClothing');
    });
  });
});
