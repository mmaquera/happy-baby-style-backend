import { GetCategoryByIdUseCase, GetCategoryByIdRequest } from '@application/use-cases/category/GetCategoryByIdUseCase';
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

describe('GetCategoryByIdUseCase', () => {
  let useCase: GetCategoryByIdUseCase;
  let mockCategory: CategoryEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCategoryByIdUseCase(mockCategoryRepository);

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
    it('should return category when found by ID', async () => {
      // Arrange
      const request: GetCategoryByIdRequest = { id: 'cat-1' };
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findById).toHaveBeenCalledWith('cat-1');
    });

    it('should throw NotFoundError when category not found', async () => {
      // Arrange
      const request: GetCategoryByIdRequest = { id: 'non-existent' };
      mockCategoryRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow(NotFoundError);
      expect(mockCategoryRepository.findById).toHaveBeenCalledWith('non-existent');
    });

    it('should throw error for empty ID', async () => {
      // Arrange
      const request: GetCategoryByIdRequest = { id: '' };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Category ID is required');
      expect(mockCategoryRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only ID', async () => {
      // Arrange
      const request: GetCategoryByIdRequest = { id: '   ' };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Category ID is required');
      expect(mockCategoryRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error for null ID', async () => {
      // Arrange
      const request: GetCategoryByIdRequest = { id: null as any };

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Category ID is required');
      expect(mockCategoryRepository.findById).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      // Arrange
      const request: GetCategoryByIdRequest = { id: 'cat-1' };
      const error = new Error('Database connection failed');
      mockCategoryRepository.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(useCase.execute(request)).rejects.toThrow('Database connection failed');
      expect(mockCategoryRepository.findById).toHaveBeenCalledWith('cat-1');
    });

    it('should handle UUID format IDs', async () => {
      // Arrange
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const request: GetCategoryByIdRequest = { id: uuid };
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findById).toHaveBeenCalledWith(uuid);
    });

    it('should handle numeric string IDs', async () => {
      // Arrange
      const request: GetCategoryByIdRequest = { id: '123' };
      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findById).toHaveBeenCalledWith('123');
    });
  });
});
