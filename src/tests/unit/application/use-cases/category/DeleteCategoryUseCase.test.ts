import { DeleteCategoryUseCase, DeleteCategoryRequest } from '@application/use-cases/category/DeleteCategoryUseCase';
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
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      })
    })
  }
}));

describe('DeleteCategoryUseCase', () => {
  let deleteCategoryUseCase: DeleteCategoryUseCase;
  let mockCategory: CategoryEntity;

  beforeEach(() => {
    deleteCategoryUseCase = new DeleteCategoryUseCase(mockCategoryRepository);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock de categoría existente
    mockCategory = new CategoryEntity(
      'cat-1',
      'Baby Clothing',
      'Comfortable and stylish clothing for babies',
      'baby-clothing',
      'https://example.com/baby-clothing.jpg',
      true,
      1,
      new Date('2025-01-01'),
      new Date('2025-01-01')
    );
  });

  describe('execute', () => {
    it('should perform soft delete by default', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1'
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockResolvedValue(mockCategory);

      // Act
      const result = await deleteCategoryUseCase.execute(request);

      // Assert
      expect(result.softDelete).toBe(true);
      expect(result.id).toBe('cat-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(mockCategoryRepository.update).toHaveBeenCalledWith('cat-1', {
        isActive: false
      });
      expect(mockCategoryRepository.delete).not.toHaveBeenCalled();
    });

    it('should perform hard delete when forceDelete is true', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1',
        forceDelete: true
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.delete.mockResolvedValue();

      // Act
      const result = await deleteCategoryUseCase.execute(request);

      // Assert
      expect(result.softDelete).toBe(false);
      expect(result.id).toBe('cat-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(mockCategoryRepository.delete).toHaveBeenCalledWith('cat-1');
      expect(mockCategoryRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when category does not exist', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'non-existent'
      };

      mockCategoryRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(deleteCategoryUseCase.execute(request))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should handle repository update errors gracefully', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1'
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(deleteCategoryUseCase.execute(request))
        .rejects
        .toThrow('Update failed');
    });

    it('should handle repository delete errors gracefully', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1',
        forceDelete: true
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.delete.mockRejectedValue(new Error('Delete failed'));

      // Act & Assert
      await expect(deleteCategoryUseCase.execute(request))
        .rejects
        .toThrow('Delete failed');
    });

    it('should log appropriate messages for soft delete', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1'
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockResolvedValue(mockCategory);

      // Act
      await deleteCategoryUseCase.execute(request);

      // Assert
      expect(mockCategoryRepository.update).toHaveBeenCalledWith('cat-1', {
        isActive: false
      });
    });

    it('should log appropriate messages for hard delete', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1',
        forceDelete: true
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.delete.mockResolvedValue();

      // Act
      await deleteCategoryUseCase.execute(request);

      // Assert
      expect(mockCategoryRepository.delete).toHaveBeenCalledWith('cat-1');
    });

    it('should return correct result structure for soft delete', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1'
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.update.mockResolvedValue(mockCategory);

      // Act
      const result = await deleteCategoryUseCase.execute(request);

      // Assert
      expect(result).toEqual({
        id: 'cat-1',
        deletedAt: expect.any(Date),
        softDelete: true
      });
    });

    it('should return correct result structure for hard delete', async () => {
      // Arrange
      const request: DeleteCategoryRequest = {
        id: 'cat-1',
        forceDelete: true
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.delete.mockResolvedValue();

      // Act
      const result = await deleteCategoryUseCase.execute(request);

      // Assert
      expect(result).toEqual({
        id: 'cat-1',
        deletedAt: expect.any(Date),
        softDelete: false
      });
    });

    it('should handle multiple delete operations correctly', async () => {
      // Arrange
      const request1: DeleteCategoryRequest = { id: 'cat-1' };
      const request2: DeleteCategoryRequest = { id: 'cat-2', forceDelete: true };

      mockCategoryRepository.findById
        .mockResolvedValueOnce(mockCategory)
        .mockResolvedValueOnce(mockCategory);
      mockCategoryRepository.update.mockResolvedValue(mockCategory);
      mockCategoryRepository.delete.mockResolvedValue();

      // Act
      const result1 = await deleteCategoryUseCase.execute(request1);
      const result2 = await deleteCategoryUseCase.execute(request2);

      // Assert
      expect(result1.softDelete).toBe(true);
      expect(result2.softDelete).toBe(false);
      expect(mockCategoryRepository.update).toHaveBeenCalledTimes(1);
      expect(mockCategoryRepository.delete).toHaveBeenCalledTimes(1);
    });
  });
});
