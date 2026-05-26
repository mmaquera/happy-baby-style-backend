import { GraphQLScalarType, Kind } from 'graphql';
import { PrismaClient } from '@prisma/client';
import { IProductRepository } from '../domain/repositories/IProductRepository';
import { GetProductsUseCase } from '../application/use-cases/GetProductsUseCase';
import { GetProductByIdUseCase } from '../application/use-cases/GetProductByIdUseCase';
import { CreateProductUseCase } from '../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../application/use-cases/DeleteProductUseCase';
import { transformProduct, transformVariant } from './transformers/productTransformer';
import { ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value: any) => (value instanceof Date ? value.toISOString() : String(value)),
  parseValue: (value: any) => new Date(String(value)),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value) : null),
});

const JsonScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (value: any) => value,
  parseValue: (value: any) => value,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) {
      try {
        return JSON.parse(ast.value);
      } catch {
        return null;
      }
    }
    return null;
  },
});

export function createResolvers(productRepository: IProductRepository, prisma: PrismaClient) {
  const getProductsUseCase = new GetProductsUseCase(productRepository);
  const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
  const createProductUseCase = new CreateProductUseCase(productRepository);
  const updateProductUseCase = new UpdateProductUseCase(productRepository);
  const deleteProductUseCase = new DeleteProductUseCase(productRepository);

  return {
    DateTime: DateTimeScalar,
    JSON: JsonScalar,

    Product: {
      __resolveReference: async (ref: { id: string }) => {
        const product = await productRepository.findById(ref.id);
        return product ? transformProduct(product) : null;
      },
      category: (parent: any) =>
        parent.categoryId ? { __typename: 'Category', id: parent.categoryId } : null,
    },

    ProductVariant: {
      product: async (parent: any) => {
        const product = await productRepository.findById(parent.productId);
        return product ? transformProduct(product) : null;
      },
      isInStock: (parent: any) => parent.stockQuantity > 0,
    },

    Query: {
      products: async (_: any, { filter, pagination }: any) => {
        const limit = pagination?.limit ?? 10;
        const offset = pagination?.offset ?? 0;
        const result = await getProductsUseCase.execute({
          filters: filter,
          pagination: { limit, offset },
        });
        const items = result.products.map(transformProduct);
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(result.total / limit);
        return ResponseFactory.createSuccessResponse(
          {
            items,
            pagination: {
              total: result.total,
              limit,
              offset,
              hasMore: result.hasMore,
              currentPage,
              totalPages,
            },
          },
          'Products retrieved successfully',
          RESPONSE_CODES.SUCCESS,
        );
      },

      product: async (_: any, { id }: { id: string }) => {
        if (!id) {
          return ResponseFactory.createErrorResponse(
            'Product ID is required',
            RESPONSE_CODES.VALIDATION_ERROR,
          );
        }
        const product = await productRepository.findById(id);
        if (!product) {
          return ResponseFactory.createErrorResponse(
            'Product not found',
            RESPONSE_CODES.RESOURCE_NOT_FOUND,
          );
        }
        return ResponseFactory.createSuccessResponse(
          { entity: transformProduct(product) },
          'Product retrieved successfully',
          RESPONSE_CODES.SUCCESS,
        );
      },

      productBySku: async (_: any, { sku }: { sku: string }) => {
        if (!sku) {
          return ResponseFactory.createErrorResponse(
            'SKU is required',
            RESPONSE_CODES.VALIDATION_ERROR,
          );
        }
        const product = await productRepository.findBySku(sku);
        if (!product) {
          return ResponseFactory.createErrorResponse(
            'Product not found',
            RESPONSE_CODES.RESOURCE_NOT_FOUND,
          );
        }
        return ResponseFactory.createSuccessResponse(
          { entity: transformProduct(product) },
          'Product retrieved successfully',
          RESPONSE_CODES.SUCCESS,
        );
      },

      productsByCategory: async (_: any, { categoryId, pagination }: any) => {
        const limit = pagination?.limit ?? 10;
        const offset = pagination?.offset ?? 0;
        const result = await getProductsUseCase.execute({
          filters: { categoryId },
          pagination: { limit, offset },
        });
        return {
          products: result.products.map(transformProduct),
          total: result.total,
          hasMore: result.hasMore,
        };
      },

      searchProducts: async (_: any, { query, filter, pagination }: any) => {
        const limit = pagination?.limit ?? 10;
        const offset = pagination?.offset ?? 0;
        const result = await getProductsUseCase.execute({
          filters: { ...filter, search: query },
          pagination: { limit, offset },
        });
        return {
          products: result.products.map(transformProduct),
          total: result.total,
          hasMore: result.hasMore,
        };
      },

      productVariants: async (_: any, { productId }: { productId: string }) => {
        const variants = await productRepository.getProductVariants(productId);
        return variants.map(transformVariant);
      },

      productVariant: async (_: any, { id }: { id: string }) => {
        const variants = await productRepository.getProductVariants(id);
        return variants.length > 0 ? transformVariant(variants[0]) : null;
      },

      productStats: async () => {
        const result = await getProductsUseCase.execute({
          filters: {},
          pagination: { limit: 10000, offset: 0 },
        });
        const products = result.products;
        const activeProducts = products.filter((p) => p.isActive).length;
        return ResponseFactory.createSuccessResponse(
          { totalProducts: products.length, activeProducts },
          'Product stats retrieved successfully',
          RESPONSE_CODES.SUCCESS,
        );
      },

      lowStockProducts: async () => {
        const result = await getProductsUseCase.execute({
          filters: { isActive: true },
          pagination: { limit: 10000, offset: 0 },
        });
        return result.products
          .filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 10)
          .map(transformProduct);
      },

      outOfStockProducts: async () => {
        const result = await getProductsUseCase.execute({
          filters: { isActive: true },
          pagination: { limit: 10000, offset: 0 },
        });
        return result.products.filter((p) => p.stockQuantity === 0).map(transformProduct);
      },

      inventoryTransactions: async (_: any, { productId }: { productId: string }) => {
        const txs = await prisma.inventoryTransaction.findMany({
          where: { productId },
          orderBy: { createdAt: 'desc' },
        });
        return txs.map((tx) => ({ ...tx, createdAt: tx.createdAt.toISOString() }));
      },

      stockAlerts: async () => {
        const alerts = await prisma.stockAlert.findMany({ orderBy: { createdAt: 'desc' } });
        return alerts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        }));
      },
    },

    Mutation: {
      createProduct: async (_: any, { input }: any) => {
        try {
          const product = await createProductUseCase.execute({
            categoryId: input.categoryId,
            name: input.name,
            description: input.description || '',
            price: input.price,
            salePrice: input.salePrice,
            sku: input.sku,
            images: input.images,
            attributes: input.attributes,
            isActive: input.isActive,
            stockQuantity: input.stockQuantity,
            tags: input.tags,
          });
          const transformed = transformProduct(product);
          return ResponseFactory.createSuccessResponse(
            { entity: transformed, id: product.id, createdAt: product.createdAt.toISOString() },
            'Product created successfully',
            RESPONSE_CODES.CREATED,
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            error.message || 'Failed to create product',
            RESPONSE_CODES.INTERNAL_ERROR,
          );
        }
      },

      updateProduct: async (_: any, { id, input }: any) => {
        try {
          const product = await updateProductUseCase.execute({ id, ...input });
          const transformed = transformProduct(product);
          const changes = Object.keys(input).filter((k) => input[k] !== undefined);
          return ResponseFactory.createSuccessResponse(
            {
              entity: transformed,
              id: product.id,
              updatedAt: product.updatedAt.toISOString(),
              changes,
            },
            'Product updated successfully',
            RESPONSE_CODES.SUCCESS,
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            error.message || 'Failed to update product',
            RESPONSE_CODES.INTERNAL_ERROR,
          );
        }
      },

      deleteProduct: async (_: any, { id }: { id: string }) => {
        try {
          await deleteProductUseCase.execute(id);
          return ResponseFactory.createSuccessResponse(
            { id, deletedAt: new Date().toISOString(), softDelete: false },
            'Product deleted successfully',
            RESPONSE_CODES.SUCCESS,
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            error.message || 'Failed to delete product',
            RESPONSE_CODES.INTERNAL_ERROR,
          );
        }
      },

      createProductVariant: async (_: any, { input }: any) => {
        const variant = await productRepository.createVariant(input);
        return transformVariant(variant);
      },

      updateProductVariant: async (_: any, { id, input }: any) => {
        const variant = await productRepository.updateVariant(id, input);
        return transformVariant(variant);
      },

      deleteProductVariant: async (_: any, { id }: { id: string }) => {
        await productRepository.deleteVariant(id);
        return { success: true, message: 'Product variant deleted successfully' };
      },

      bulkUpdateProducts: async (_: any, { ids, input }: any) => {
        const updated = await Promise.all(
          ids.map((id: string) => updateProductUseCase.execute({ id, ...input })),
        );
        return updated.map(transformProduct);
      },

      // ── Inventory transactions ───────────────────────────────────────────
      createInventoryTransaction: async (_: any, { input }: any) => {
        const tx = await prisma.inventoryTransaction.create({
          data: {
            productId: input.productId,
            type: input.type,
            quantity: input.quantity,
            reference: input.reference,
            notes: input.notes,
          },
        });
        return { ...tx, createdAt: tx.createdAt.toISOString() };
      },

      // ── Stock alerts ─────────────────────────────────────────────────────
      createStockAlert: async (_: any, { input }: any) => {
        const alert = await prisma.stockAlert.create({
          data: {
            productId: input.productId,
            type: input.type,
            threshold: input.threshold,
            currentStock: input.currentStock,
            isActive: input.isActive ?? true,
          },
        });
        return {
          ...alert,
          createdAt: alert.createdAt.toISOString(),
          updatedAt: alert.updatedAt.toISOString(),
        };
      },

      updateStockAlert: async (_: any, { id, isActive }: any) => {
        const alert = await prisma.stockAlert.update({
          where: { id },
          data: { isActive },
        });
        return {
          ...alert,
          createdAt: alert.createdAt.toISOString(),
          updatedAt: alert.updatedAt.toISOString(),
        };
      },

      deleteStockAlert: async (_: any, { id }: { id: string }) => {
        await prisma.stockAlert.delete({ where: { id } });
        return { success: true, message: 'Stock alert deleted successfully' };
      },
    },
  };
}
