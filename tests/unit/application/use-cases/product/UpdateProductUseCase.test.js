"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UpdateProductUseCase_1 = require("@application/use-cases/product/UpdateProductUseCase");
const Product_1 = require("@domain/entities/Product");
// Mock del repositorio
const mockProductRepository = {
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
describe('UpdateProductUseCase', () => {
    let useCase;
    beforeEach(() => {
        useCase = new UpdateProductUseCase_1.UpdateProductUseCase(mockProductRepository);
        jest.clearAllMocks();
    });
    describe('execute', () => {
        const mockExistingProduct = new Product_1.ProductEntity('1', 'category-1', 'Original Product', 'Original Description', 29.99, undefined, 'SKU-1', [], {}, true, 10, ['original'], 4.5, 5, new Date(), new Date());
        it('should update product successfully with valid data', async () => {
            // Arrange
            const request = {
                id: '1',
                name: 'Updated Product',
                price: 39.99,
                description: 'Updated Description'
            };
            const updatedProduct = new Product_1.ProductEntity('1', 'category-1', 'Updated Product', 'Updated Description', 39.99, undefined, 'SKU-1', [], {}, true, 10, ['original'], 4.5, 5, new Date(), new Date());
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            mockProductRepository.update.mockResolvedValue(updatedProduct);
            // Act
            const result = await useCase.execute(request);
            // Assert
            expect(result).toEqual(updatedProduct);
            expect(mockProductRepository.findById).toHaveBeenCalledWith('1');
            expect(mockProductRepository.update).toHaveBeenCalledWith('1', {
                name: 'Updated Product',
                price: 39.99,
                description: 'Updated Description'
            });
        });
        it('should throw error when product ID is not provided', async () => {
            // Arrange
            const request = {
                id: '',
                name: 'Updated Product'
            };
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Product ID is required');
            expect(mockProductRepository.findById).not.toHaveBeenCalled();
        });
        it('should throw error when product is not found', async () => {
            // Arrange
            const request = {
                id: 'non-existent',
                name: 'Updated Product'
            };
            mockProductRepository.findById.mockResolvedValue(null);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Product not found');
            expect(mockProductRepository.findById).toHaveBeenCalledWith('non-existent');
            expect(mockProductRepository.update).not.toHaveBeenCalled();
        });
        it('should throw error when SKU already exists', async () => {
            // Arrange
            const request = {
                id: '1',
                sku: 'EXISTING-SKU'
            };
            const existingProductWithSku = new Product_1.ProductEntity('2', 'category-1', 'Existing Product', 'Description', 29.99, undefined, 'EXISTING-SKU', [], {}, true, 10, ['test'], 4.5, 5, new Date(), new Date());
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            mockProductRepository.findBySku.mockResolvedValue(existingProductWithSku);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('SKU already exists');
            expect(mockProductRepository.findBySku).toHaveBeenCalledWith('EXISTING-SKU');
        });
        it('should allow updating SKU to same value', async () => {
            // Arrange
            const request = {
                id: '1',
                sku: 'SKU-1' // Same SKU as existing product
            };
            const updatedProduct = new Product_1.ProductEntity('1', 'category-1', 'Original Product', 'Original Description', 29.99, undefined, 'SKU-1', [], {}, true, 10, ['original'], 4.5, 5, new Date(), new Date());
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            mockProductRepository.findBySku.mockResolvedValue(mockExistingProduct); // Same product
            mockProductRepository.update.mockResolvedValue(updatedProduct);
            // Act
            const result = await useCase.execute(request);
            // Assert
            expect(result).toEqual(updatedProduct);
            expect(mockProductRepository.findBySku).toHaveBeenCalledWith('SKU-1');
        });
        it('should throw error when price is negative', async () => {
            // Arrange
            const request = {
                id: '1',
                price: -10
            };
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Price must be non-negative');
        });
        it('should throw error when sale price is negative', async () => {
            // Arrange
            const request = {
                id: '1',
                salePrice: -5
            };
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Sale price must be non-negative');
        });
        it('should throw error when sale price is greater than or equal to regular price', async () => {
            // Arrange
            const request = {
                id: '1',
                price: 30,
                salePrice: 35
            };
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Sale price must be less than regular price');
        });
        it('should throw error when stock quantity is negative', async () => {
            // Arrange
            const request = {
                id: '1',
                stockQuantity: -5
            };
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Stock quantity must be non-negative');
        });
        it('should throw error when rating is out of range', async () => {
            // Arrange
            const request = {
                id: '1',
                rating: 6
            };
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Rating must be between 0 and 5');
        });
        it('should throw error when review count is negative', async () => {
            // Arrange
            const request = {
                id: '1',
                reviewCount: -1
            };
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Review count must be non-negative');
        });
        it('should handle repository errors', async () => {
            // Arrange
            const request = {
                id: '1',
                name: 'Updated Product'
            };
            mockProductRepository.findById.mockResolvedValue(mockExistingProduct);
            const error = new Error('Database error');
            mockProductRepository.update.mockRejectedValue(error);
            // Act & Assert
            await expect(useCase.execute(request)).rejects.toThrow('Database error');
        });
    });
});
