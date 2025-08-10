import { CreateProductUseCase } from '@application/use-cases/product/CreateProductUseCase';
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

describe('CreateProductUseCase', () => {
  let createProductUseCase: CreateProductUseCase;

  beforeEach(() => {
    createProductUseCase = new CreateProductUseCase(mockProductRepository);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validProductData = {
      categoryId: 'cat-1',
      name: 'Test Product',
      description: 'Test Description',
      price: 29.99,
      salePrice: 24.99,
      sku: 'TEST-001',
      images: ['image1.jpg'],
      attributes: { color: 'red', size: 'M' },
      isActive: true,
      stockQuantity: 10,
      tags: ['test', 'product']
    };

    it('should create a product successfully when valid data is provided', async () => {
      // Arrange
      const expectedProduct = new ProductEntity(
        'prod-1',
        validProductData.categoryId,
        validProductData.name,
        validProductData.description,
        validProductData.price,
        validProductData.salePrice,
        validProductData.sku,
        validProductData.images,
        validProductData.attributes,
        validProductData.isActive,
        validProductData.stockQuantity,
        validProductData.tags,
        0,
        0,
        new Date(),
        new Date()
      );

      mockProductRepository.create.mockResolvedValue(expectedProduct);

      // Act
      const result = await createProductUseCase.execute(validProductData);

      // Assert
      expect(mockProductRepository.create).toHaveBeenCalledTimes(1);
      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: validProductData.categoryId,
          name: validProductData.name,
          description: validProductData.description,
          price: validProductData.price,
          salePrice: validProductData.salePrice,
          sku: validProductData.sku,
          images: validProductData.images,
          attributes: validProductData.attributes,
          isActive: validProductData.isActive,
          stockQuantity: validProductData.stockQuantity,
          tags: validProductData.tags
        })
      );
      expect(result).toEqual(expectedProduct);
    });

    it('should throw error when name is empty', async () => {
      // Arrange
      const invalidData = { ...validProductData, name: '' };

      // Act & Assert
      await expect(createProductUseCase.execute(invalidData))
        .rejects
        .toThrow('name is required');

      expect(mockProductRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when price is negative', async () => {
      // Arrange
      const invalidData = { ...validProductData, price: -10 };

      // Act & Assert
      await expect(createProductUseCase.execute(invalidData))
        .rejects
        .toThrow('price must be at least');

      expect(mockProductRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when SKU is empty', async () => {
      // Arrange
      const invalidData = { ...validProductData, sku: '' };

      // Act & Assert
      await expect(createProductUseCase.execute(invalidData))
        .rejects
        .toThrow('sku is required');

      expect(mockProductRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when stockQuantity is negative', async () => {
      // Arrange
      const invalidData = { ...validProductData, stockQuantity: -5 };

      // Act & Assert
      await expect(createProductUseCase.execute(invalidData))
        .rejects
        .toThrow('stockQuantity must be at least');

      expect(mockProductRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockProductRepository.create.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(createProductUseCase.execute(validProductData))
        .rejects
        .toThrow('Database operation failed: create product');

      expect(mockProductRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should use default values when optional fields are not provided', async () => {
      // Arrange
      const minimalData = {
        categoryId: 'cat-1',
        name: 'Minimal Product',
        description: 'Minimal Description',
        price: 19.99,
        sku: 'MIN-001'
      };

      const expectedProduct = new ProductEntity(
        'prod-1',
        minimalData.categoryId,
        minimalData.name,
        minimalData.description,
        minimalData.price,
        undefined,
        minimalData.sku,
        [],
        {},
        true,
        0,
        [],
        0,
        0,
        new Date(),
        new Date()
      );

      mockProductRepository.create.mockResolvedValue(expectedProduct);

      // Act
      const result = await createProductUseCase.execute(minimalData);

      // Assert
      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [],
          attributes: {},
          isActive: true,
          stockQuantity: 0,
          tags: undefined // tags can be undefined when not provided
        })
      );
      expect(result).toEqual(expectedProduct);
    });
  });
});