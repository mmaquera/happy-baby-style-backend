import { UpdateCategoryUseCase, UpdateCategoryRequest } from '@application/use-cases/category/UpdateCategoryUseCase';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { CategoryEntity } from '@domain/entities/Product';
import { NotFoundError, DuplicateError, ValidationError } from '@domain/errors/DomainError';

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

describe('UpdateCategoryUseCase', () => {
  let updateCategoryUseCase: UpdateCategoryUseCase;
  let mockCategory: CategoryEntity;

  beforeEach(() => {
    updateCategoryUseCase = new UpdateCategoryUseCase(mockCategoryRepository);
    
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
    it('should update category name successfully', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        name: 'Updated Baby Clothing'
      };

      const updatedCategory = new CategoryEntity(
        'cat-1',
        'Updated Baby Clothing',
        'Comfortable and stylish clothing for babies',
        'baby-clothing',
        'https://example.com/baby-clothing.jpg',
        true,
        1,
        new Date('2025-01-01'),
        new Date('2025-01-02')
      );

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.update.mockResolvedValue(updatedCategory);

      // Act
      const result = await updateCategoryUseCase.execute(request);

      // Assert
      expect(result.category.name).toBe('Updated Baby Clothing');
      expect(result.changes).toContain('name');
      expect(result.changes).toHaveLength(1);
      expect(mockCategoryRepository.update).toHaveBeenCalledWith('cat-1', { name: 'Updated Baby Clothing' });
    });

    it('should update multiple fields successfully', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        name: 'Updated Baby Clothing',
        description: 'New description',
        sortOrder: 5
      };

      const updatedCategory = new CategoryEntity(
        'cat-1',
        'Updated Baby Clothing',
        'New description',
        'baby-clothing',
        'https://example.com/baby-clothing.jpg',
        true,
        5,
        new Date('2025-01-01'),
        new Date('2025-01-02')
      );

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.update.mockResolvedValue(updatedCategory);

      // Act
      const result = await updateCategoryUseCase.execute(request);

      // Assert
      expect(result.changes).toContain('name');
      expect(result.changes).toContain('description');
      expect(result.changes).toContain('sortOrder');
      expect(result.changes).toHaveLength(3);
    });

    it('should return existing category when no changes are made', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        name: 'Baby Clothing' // Mismo nombre
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act
      const result = await updateCategoryUseCase.execute(request);

      // Assert
      expect(result.category).toBe(mockCategory);
      expect(result.changes).toHaveLength(0);
      expect(mockCategoryRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when category does not exist', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'non-existent',
        name: 'New Name'
      };

      mockCategoryRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw DuplicateError when new name already exists', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        name: 'Existing Category Name'
      };

      const existingCategory = new CategoryEntity(
        'cat-2',
        'Existing Category Name',
        'Another category',
        'existing-category',
        undefined,
        true,
        2,
        new Date('2025-01-01'),
        new Date('2025-01-01')
      );

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.findByName.mockResolvedValue(existingCategory);

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow(DuplicateError);
    });

    it('should throw DuplicateError when new slug already exists', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        slug: 'existing-slug'
      };

      const existingCategory = new CategoryEntity(
        'cat-2',
        'Another Category',
        'Another category',
        'existing-slug',
        undefined,
        true,
        2,
        new Date('2025-01-01'),
        new Date('2025-01-01')
      );

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.findBySlug.mockResolvedValue(existingCategory);

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow(DuplicateError);
    });

    it('should trim whitespace from string fields', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        name: '  Updated Name  ',
        description: '  Updated Description  '
      };

      const updatedCategory = new CategoryEntity(
        'cat-1',
        'Updated Name',
        'Updated Description',
        'baby-clothing',
        'https://example.com/baby-clothing.jpg',
        true,
        1,
        new Date('2025-01-01'),
        new Date('2025-01-02')
      );

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.update.mockResolvedValue(updatedCategory);

      // Act
      const result = await updateCategoryUseCase.execute(request);

      // Assert
      expect(result.changes).toContain('name');
      expect(result.changes).toContain('description');
      expect(mockCategoryRepository.update).toHaveBeenCalledWith('cat-1', {
        name: 'Updated Name',
        description: 'Updated Description'
      });
    });

    it('should validate name length constraints', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        name: 'A' // Muy corto
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow(ValidationError);
    });

    it('should validate slug format', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        slug: 'invalid slug with spaces' // Formato inválido
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow(ValidationError);
    });

    it('should validate image URL format', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        imageUrl: 'not-a-valid-url' // URL inválida
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow(ValidationError);
    });

    it('should validate sort order range', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        sortOrder: 1000 // Fuera del rango
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const request: UpdateCategoryRequest = {
        id: 'cat-1',
        name: 'New Name'
      };

      mockCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.update.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(updateCategoryUseCase.execute(request))
        .rejects
        .toThrow('Database error');
    });
  });
});
