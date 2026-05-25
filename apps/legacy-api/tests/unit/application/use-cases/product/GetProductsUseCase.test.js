"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GetProductsUseCase_1 = require("@application/use-cases/product/GetProductsUseCase");
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
describe('GetProductsUseCase', () => {
    let useCase;
    beforeEach(() => {
        useCase = new GetProductsUseCase_1.GetProductsUseCase(mockProductRepository);
        jest.clearAllMocks();
    });
    describe('execute', () => {
        it('should return products when no filters are provided', async () => {
            // Arrange
            const mockProducts = [
                new Product_1.ProductEntity('1', 'category-1', 'Test Product 1', 'Description 1', 29.99, undefined, 'SKU-1', [], {}, true, 10, ['test'], 4.5, 5, new Date(), new Date())
            ];
            mockProductRepository.findAll.mockResolvedValue(mockProducts);
            // Act
            const result = await useCase.execute({});
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
        it('should apply filters correctly', async () => {
            // Arrange
            const request = {
                category: 'category-1',
                isActive: true,
                minPrice: 10,
                maxPrice: 50,
                inStock: true,
                search: 'test',
                limit: 10,
                offset: 5
            };
            const mockProducts = [];
            mockProductRepository.findAll.mockResolvedValue(mockProducts);
            // Act
            const result = await useCase.execute(request);
            // Assert
            expect(result).toEqual(mockProducts);
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
            const request = {
                search: '   '
            };
            const mockProducts = [];
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
            const request = {};
            const mockProducts = [];
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
