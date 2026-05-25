import { CreateCategoryUseCase } from '@application/use-cases/category/CreateCategoryUseCase';
import { ICategoryRepository } from '@domain/repositories/ICategoryRepository';
import { CategoryEntity } from '@domain/entities/Product';
import { 
  ValidationError, 
  DuplicateError, 
  DatabaseError 
} from '@domain/errors/DomainError';

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
  updateSortOrder: jest.fn(),
};

describe('CreateCategoryUseCase', () => {
  let createCategoryUseCase: CreateCategoryUseCase;

  beforeEach(() => {
    createCategoryUseCase = new CreateCategoryUseCase(mockCategoryRepository);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validCategoryData = {
      name: 'Baby Clothing',
      description: 'Comfortable and stylish clothing for babies',
      slug: 'baby-clothing',
      imageUrl: 'https://example.com/baby-clothing.jpg',
      isActive: true,
      sortOrder: 1
    };

    it('should create a category successfully when valid data is provided', async () => {
      // Arrange
      const expectedCategory = new CategoryEntity(
        'cat-1',
        validCategoryData.name,
        validCategoryData.description,
        validCategoryData.slug,
        validCategoryData.imageUrl,
        validCategoryData.isActive,
        validCategoryData.sortOrder,
        new Date(),
        new Date()
      );

      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.findBySlug.mockResolvedValue(null);
      mockCategoryRepository.create.mockResolvedValue(expectedCategory);

      // Act
      const result = await createCategoryUseCase.execute(validCategoryData);

      // Assert
      expect(mockCategoryRepository.findByName).toHaveBeenCalledWith(validCategoryData.name);
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith(validCategoryData.slug);
      expect(mockCategoryRepository.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedCategory);
    });

    it('should generate slug automatically when not provided', async () => {
      // Arrange
      const categoryDataWithoutSlug = {
        name: 'Baby Accessories',
        description: 'Essential accessories for your little one',
        isActive: true,
        sortOrder: 2
      };

      const expectedCategory = new CategoryEntity(
        'cat-2',
        categoryDataWithoutSlug.name,
        categoryDataWithoutSlug.description,
        'baby-accessories', // Generated slug
        undefined,
        categoryDataWithoutSlug.isActive,
        categoryDataWithoutSlug.sortOrder,
        new Date(),
        new Date()
      );

      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.findBySlug.mockResolvedValue(null);
      mockCategoryRepository.create.mockResolvedValue(expectedCategory);

      // Act
      const result = await createCategoryUseCase.execute(categoryDataWithoutSlug);

      // Assert
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('baby-accessories');
      expect(result.slug).toBe('baby-accessories');
    });

    it('should set default values when optional fields are not provided', async () => {
      // Arrange
      const minimalCategoryData = {
        name: 'Feeding & Nursing'
      };

      const expectedCategory = new CategoryEntity(
        'cat-3',
        minimalCategoryData.name,
        undefined,
        'feeding-nursing',
        undefined,
        true, // Default isActive
        0, // Default sortOrder
        new Date(),
        new Date()
      );

      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.findBySlug.mockResolvedValue(null);
      mockCategoryRepository.create.mockResolvedValue(expectedCategory);

      // Act
      const result = await createCategoryUseCase.execute(minimalCategoryData);

      // Assert
      expect(result.isActive).toBe(true);
      expect(result.sortOrder).toBe(0);
      expect(result.description).toBeUndefined();
      expect(result.imageUrl).toBeUndefined();
    });

    it('should throw DuplicateError when category name already exists', async () => {
      // Arrange
      const existingCategory = new CategoryEntity(
        'cat-existing',
        validCategoryData.name,
        validCategoryData.description,
        'existing-slug',
        validCategoryData.imageUrl,
        true,
        0,
        new Date(),
        new Date()
      );

      mockCategoryRepository.findByName.mockResolvedValue(existingCategory);

      // Act & Assert
      await expect(createCategoryUseCase.execute(validCategoryData))
        .rejects
        .toThrow(DuplicateError);

      expect(mockCategoryRepository.findByName).toHaveBeenCalledWith(validCategoryData.name);
      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw DuplicateError when category slug already exists', async () => {
      // Arrange
      const existingCategory = new CategoryEntity(
        'cat-existing',
        'Different Name',
        'Different description',
        validCategoryData.slug,
        validCategoryData.imageUrl,
        true,
        0,
        new Date(),
        new Date()
      );

      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.findBySlug.mockResolvedValue(existingCategory);

      // Act & Assert
      await expect(createCategoryUseCase.execute(validCategoryData))
        .rejects
        .toThrow(DuplicateError);

      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith(validCategoryData.slug);
      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when name is too short', async () => {
      // Arrange
      const invalidCategoryData = {
        name: 'A', // Too short
        description: 'Valid description'
      };

      // Act & Assert
      await expect(createCategoryUseCase.execute(invalidCategoryData))
        .rejects
        .toThrow(ValidationError);

      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when name is too long', async () => {
      // Arrange
      const invalidCategoryData = {
        name: 'A'.repeat(101), // Too long
        description: 'Valid description'
      };

      // Act & Assert
      await expect(createCategoryUseCase.execute(invalidCategoryData))
        .rejects
        .toThrow(ValidationError);

      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when description is too long', async () => {
      // Arrange
      const invalidCategoryData = {
        name: 'Valid Name',
        description: 'A'.repeat(501) // Too long
      };

      // Act & Assert
      await expect(createCategoryUseCase.execute(invalidCategoryData))
        .rejects
        .toThrow(ValidationError);

      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when sortOrder is negative', async () => {
      // Arrange
      const invalidCategoryData = {
        name: 'Valid Name',
        sortOrder: -1
      };

      // Act & Assert
      await expect(createCategoryUseCase.execute(invalidCategoryData))
        .rejects
        .toThrow(ValidationError);

      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when sortOrder is too high', async () => {
      // Arrange
      const invalidCategoryData = {
        name: 'Valid Name',
        sortOrder: 1000
      };

      // Act & Assert
      await expect(createCategoryUseCase.execute(invalidCategoryData))
        .rejects
        .toThrow(ValidationError);

      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError when repository create fails', async () => {
      // Arrange
      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.findBySlug.mockResolvedValue(null);
      mockCategoryRepository.create.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(createCategoryUseCase.execute(validCategoryData))
        .rejects
        .toThrow(DatabaseError);

      expect(mockCategoryRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should handle special characters in name when generating slug', async () => {
      // Arrange
      const categoryDataWithSpecialChars = {
        name: 'Baby & Kids Clothing!',
        description: 'Clothing with special characters'
      };

      const expectedCategory = new CategoryEntity(
        'cat-4',
        categoryDataWithSpecialChars.name,
        categoryDataWithSpecialChars.description,
        'baby-kids-clothing', // Generated slug without special chars
        undefined,
        true,
        0,
        new Date(),
        new Date()
      );

      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.findBySlug.mockResolvedValue(null);
      mockCategoryRepository.create.mockResolvedValue(expectedCategory);

      // Act
      const result = await createCategoryUseCase.execute(categoryDataWithSpecialChars);

      // Assert
      expect(result.slug).toBe('baby-kids-clothing');
      expect(mockCategoryRepository.findBySlug).toHaveBeenCalledWith('baby-kids-clothing');
    });

    it('should trim whitespace from name and description', async () => {
      // Arrange
      const categoryDataWithWhitespace = {
        name: '  Baby Clothing  ',
        description: '  Description with spaces  '
      };

      const expectedCategory = new CategoryEntity(
        'cat-5',
        'Baby Clothing', // Trimmed name
        'Description with spaces', // Trimmed description
        'baby-clothing',
        undefined,
        true,
        0,
        new Date(),
        new Date()
      );

      mockCategoryRepository.findByName.mockResolvedValue(null);
      mockCategoryRepository.findBySlug.mockResolvedValue(null);
      mockCategoryRepository.create.mockResolvedValue(expectedCategory);

      // Act
      const result = await createCategoryUseCase.execute(categoryDataWithWhitespace);

      // Assert
      expect(result.name).toBe('Baby Clothing');
      expect(result.description).toBe('Description with spaces');
      expect(mockCategoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Baby Clothing',
          description: 'Description with spaces'
        })
      );
    });
  });
});
