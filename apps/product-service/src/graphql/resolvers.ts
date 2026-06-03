import { GraphQLScalarType, GraphQLError, Kind } from 'graphql';
import { PrismaClient, Prisma } from '../prisma';
import { IProductRepository } from '../domain/repositories/IProductRepository';
import { IProductReviewRepository } from '../domain/repositories/IProductReviewRepository';
import { IInventoryTransactionRepository } from '../domain/repositories/IInventoryTransactionRepository';
import { IStockAlertRepository } from '../domain/repositories/IStockAlertRepository';
import { GetProductsUseCase } from '../application/use-cases/GetProductsUseCase';
import { GetProductByIdUseCase } from '../application/use-cases/GetProductByIdUseCase';
import { CreateProductUseCase } from '../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../application/use-cases/DeleteProductUseCase';
import { CreateProductReviewUseCase } from '../application/use-cases/CreateProductReviewUseCase';
import { UpdateProductReviewUseCase } from '../application/use-cases/UpdateProductReviewUseCase';
import { DeleteProductReviewUseCase } from '../application/use-cases/DeleteProductReviewUseCase';
import { ApproveReviewUseCase } from '../application/use-cases/ApproveReviewUseCase';
import { RejectReviewUseCase } from '../application/use-cases/RejectReviewUseCase';
import { CreateInventoryTransactionUseCase } from '../application/use-cases/CreateInventoryTransactionUseCase';
import { GetInventoryTransactionsUseCase } from '../application/use-cases/GetInventoryTransactionsUseCase';
import { CreateStockAlertUseCase } from '../application/use-cases/CreateStockAlertUseCase';
import { UpdateStockAlertUseCase } from '../application/use-cases/UpdateStockAlertUseCase';
import { DeleteStockAlertUseCase } from '../application/use-cases/DeleteStockAlertUseCase';
import { GetStockAlertsUseCase } from '../application/use-cases/GetStockAlertsUseCase';
import { transformProduct, transformVariant } from './transformers/productTransformer';
import { DomainError, ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';
import { requirePermission, Permission } from '@hbs/auth';
import { assertModelAccess } from '@hbs/authz';
import { LoggerFactory } from '@hbs/logging';

/**
 * Maps a PrismaClientKnownRequestError to a GraphQLError with a clean user-facing message,
 * preventing internal schema/table/column names from leaking to GraphQL clients.
 *
 * P2002 — unique constraint violation (e.g. duplicate review).
 * P2003 — foreign key constraint violation (referenced record does not exist).
 * P2025 — record to update/delete not found.
 */
function mapPrismaReviewError(error: unknown, context: 'review' | 'vote'): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const message =
        context === 'review'
          ? 'You have already reviewed this product'
          : 'You have already voted on this review';
      throw new GraphQLError(message, {
        extensions: { code: 'CONFLICT', http: { status: 409 } },
      });
    }
    if (error.code === 'P2003') {
      const label = context === 'review' ? 'Product' : 'Review';
      throw new GraphQLError(`${label} not found`, {
        extensions: { code: 'NOT_FOUND', http: { status: 404 } },
      });
    }
    if (error.code === 'P2025') {
      const label = context === 'review' ? 'Review' : 'Vote';
      throw new GraphQLError(`${label} not found`, {
        extensions: { code: 'NOT_FOUND', http: { status: 404 } },
      });
    }
  }
  throw error;
}

/** Maps a ProductReviewEntity (or plain object with photos/votes) to resolver DTO shape. */
function mapReviewDto(r: any) {
  return {
    ...r,
    product: { __typename: 'Product', id: r.productId },
    user: { __typename: 'UserProfile', id: r.userId },
    photos: (r.photos ?? []).map((p: any) => ({
      ...p,
      review: { __typename: 'ProductReview', id: p.reviewId ?? r.id },
    })),
    votes: (r.votes ?? []).map((v: any) => ({
      ...v,
      review: { __typename: 'ProductReview', id: v.reviewId ?? r.id },
      user: { __typename: 'UserProfile', id: v.userId },
    })),
  };
}

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

export function createResolvers(
  productRepository: IProductRepository,
  prisma: PrismaClient,
  reviewRepository: IProductReviewRepository,
  inventoryTransactionRepository: IInventoryTransactionRepository,
  stockAlertRepository: IStockAlertRepository,
) {
  const logger = LoggerFactory.getInstance().createServiceLogger('ProductResolvers');

  // ── Product use cases ───────────────────────────────────────────────────────
  const getProductsUseCase = new GetProductsUseCase(productRepository);
  const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
  const createProductUseCase = new CreateProductUseCase(productRepository);
  const updateProductUseCase = new UpdateProductUseCase(productRepository);
  const deleteProductUseCase = new DeleteProductUseCase(productRepository);

  // ── Review use cases ────────────────────────────────────────────────────────
  const createProductReviewUseCase = new CreateProductReviewUseCase(reviewRepository, productRepository);
  const updateProductReviewUseCase = new UpdateProductReviewUseCase(reviewRepository);
  const deleteProductReviewUseCase = new DeleteProductReviewUseCase(reviewRepository);
  const approveReviewUseCase = new ApproveReviewUseCase(reviewRepository);
  const rejectReviewUseCase = new RejectReviewUseCase(reviewRepository);

  // ── Inventory use cases ─────────────────────────────────────────────────────
  const createInventoryTransactionUseCase = new CreateInventoryTransactionUseCase(inventoryTransactionRepository);
  const getInventoryTransactionsUseCase = new GetInventoryTransactionsUseCase(inventoryTransactionRepository);

  // ── Stock alert use cases ───────────────────────────────────────────────────
  const createStockAlertUseCase = new CreateStockAlertUseCase(stockAlertRepository);
  const updateStockAlertUseCase = new UpdateStockAlertUseCase(stockAlertRepository);
  const deleteStockAlertUseCase = new DeleteStockAlertUseCase(stockAlertRepository);
  const getStockAlertsUseCase = new GetStockAlertsUseCase(stockAlertRepository);

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
        return variants.map((v) => transformVariant(v));
      },

      productVariant: async (_: any, { id }: { id: string }) => {
        const variant = await productRepository.findVariantById(id);
        return variant ? transformVariant(variant) : null;
      },

      productStats: async (_: any, __: any, context: any) => {
        requirePermission(context.currentUser, Permission.VIEW_ANALYTICS);
        const [totalProducts, activeProducts, lowStockCount, outOfStockCount] = await Promise.all([
          prisma.product.count(),
          prisma.product.count({ where: { isActive: true } }),
          prisma.product.count({ where: { isActive: true, stockQuantity: { gt: 0, lte: 10 } } }),
          prisma.product.count({ where: { isActive: true, stockQuantity: 0 } }),
        ]);
        return ResponseFactory.createSuccessResponse(
          { totalProducts, activeProducts, lowStockCount, outOfStockCount },
          'Product stats retrieved successfully',
          RESPONSE_CODES.SUCCESS,
        );
      },

      // Task 5: DB-level filter — no full scan
      lowStockProducts: async (_: any, __: any, context: any) => {
        requirePermission(context.currentUser, Permission.VIEW_ANALYTICS);
        const products = await productRepository.findLowStock();
        return products.map(transformProduct);
      },

      outOfStockProducts: async (_: any, __: any, context: any) => {
        requirePermission(context.currentUser, Permission.VIEW_ANALYTICS);
        const products = await productRepository.findOutOfStock();
        return products.map(transformProduct);
      },

      // ── Inventory transactions ─────────────────────────────────────────────

      inventoryTransactions: async (_: any, { productId }: { productId: string }, context: any) => {
        assertModelAccess(context.currentUser, 'InventoryTransaction', 'read');
        const txs = await getInventoryTransactionsUseCase.execute(productId);
        return txs.map((tx) => ({ ...tx, createdAt: tx.createdAt.toISOString() }));
      },

      // ── Stock alerts ───────────────────────────────────────────────────────

      stockAlerts: async (_: any, __: any, context: any) => {
        requirePermission(context.currentUser, Permission.VIEW_ANALYTICS);
        const alerts = await getStockAlertsUseCase.execute();
        return alerts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        }));
      },

      // ── Review queries ─────────────────────────────────────────────────────

      productReviews: async (_: any, { productId, pagination }: any) => {
        const limit = pagination?.limit ?? 10;
        const offset = pagination?.offset ?? 0;
        try {
          const { reviews, total } = await reviewRepository.findByProduct(productId, {
            status: 'approved',
            limit,
            offset,
          });
          return {
            reviews: reviews.map(mapReviewDto),
            total,
            hasMore: offset + limit < total,
          };
        } catch {
          return { reviews: [], total: 0, hasMore: false };
        }
      },

      userReviews: async (_: any, { userId }: any) => {
        try {
          const reviews = await reviewRepository.findByUser(userId);
          return reviews.map(mapReviewDto);
        } catch {
          return [];
        }
      },

      review: async (_: any, { id }: any) => {
        try {
          const r = await reviewRepository.findById(id);
          if (!r) return null;
          return mapReviewDto(r);
        } catch {
          return null;
        }
      },

      reviewVotes: async (_: any, { reviewId }: any) => {
        try {
          const votes = await prisma.reviewVote.findMany({ where: { reviewId } });
          return votes.map((v) => ({
            ...v,
            review: { __typename: 'ProductReview', id: v.reviewId },
            user: { __typename: 'UserProfile', id: v.userId },
          }));
        } catch {
          return [];
        }
      },
    },

    Mutation: {
      createProduct: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Product', 'create');
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
            taxAffectation: input.taxAffectation,
          });
          const transformed = transformProduct(product);
          return ResponseFactory.createSuccessResponse(
            { entity: transformed, id: product.id, createdAt: product.createdAt.toISOString() },
            'Product created successfully',
            RESPONSE_CODES.CREATED,
          );
        } catch (error) {
          if (error instanceof DomainError) {
            return ResponseFactory.createErrorResponse(error.message, RESPONSE_CODES.VALIDATION_ERROR);
          }
          logger.error('createProduct failed', error instanceof Error ? error : new Error(String(error)));
          return ResponseFactory.createErrorResponse('Failed to create product', RESPONSE_CODES.INTERNAL_ERROR);
        }
      },

      updateProduct: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Product', 'write');
        try {
          const product = await updateProductUseCase.execute({ id, ...input, currentUser: context.currentUser });
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
        } catch (error) {
          if (error instanceof DomainError) {
            return ResponseFactory.createErrorResponse(error.message, RESPONSE_CODES.VALIDATION_ERROR);
          }
          logger.error('updateProduct failed', error instanceof Error ? error : new Error(String(error)));
          return ResponseFactory.createErrorResponse('Failed to update product', RESPONSE_CODES.INTERNAL_ERROR);
        }
      },

      deleteProduct: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'Product', 'unlink');
        try {
          await deleteProductUseCase.execute(id, context.currentUser);
          return ResponseFactory.createSuccessResponse(
            { id, deletedAt: new Date().toISOString(), softDelete: false },
            'Product deleted successfully',
            RESPONSE_CODES.SUCCESS,
          );
        } catch (error) {
          if (error instanceof DomainError) {
            return ResponseFactory.createErrorResponse(error.message, RESPONSE_CODES.VALIDATION_ERROR);
          }
          logger.error('deleteProduct failed', error instanceof Error ? error : new Error(String(error)));
          return ResponseFactory.createErrorResponse('Failed to delete product', RESPONSE_CODES.INTERNAL_ERROR);
        }
      },

      createProductVariant: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Product', 'create');
        const variant = await productRepository.createVariant(input, context.currentUser);
        return transformVariant(variant);
      },

      updateProductVariant: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Product', 'write');
        const variant = await productRepository.updateVariant(id, input, context.currentUser);
        return transformVariant(variant);
      },

      deleteProductVariant: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'Product', 'unlink');
        await productRepository.deleteVariant(id, context.currentUser);
        return { success: true, message: 'Product variant deleted successfully' };
      },

      bulkUpdateProducts: async (_: any, { ids, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'Product', 'write');
        const updated = await Promise.all(
          ids.map((id: string) => updateProductUseCase.execute({ id, ...input, currentUser: context.currentUser })),
        );
        return updated.map(transformProduct);
      },

      // ── Inventory transactions ─────────────────────────────────────────────

      createInventoryTransaction: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'InventoryTransaction', 'create');
        const tx = await createInventoryTransactionUseCase.execute({
          productId: input.productId,
          type: input.type,
          quantity: input.quantity,
          reference: input.reference,
          notes: input.notes,
        });
        return { ...tx, createdAt: tx.createdAt.toISOString() };
      },

      // ── Stock alerts ───────────────────────────────────────────────────────

      createStockAlert: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'StockAlert', 'create');
        const alert = await createStockAlertUseCase.execute({
          productId: input.productId,
          type: input.type,
          threshold: input.threshold,
          currentStock: input.currentStock,
          isActive: input.isActive,
        });
        return { ...alert, createdAt: alert.createdAt.toISOString(), updatedAt: alert.updatedAt.toISOString() };
      },

      updateStockAlert: async (_: any, { id, isActive }: any, context: any) => {
        assertModelAccess(context.currentUser, 'StockAlert', 'write');
        const alert = await updateStockAlertUseCase.execute(id, isActive);
        return { ...alert, createdAt: alert.createdAt.toISOString(), updatedAt: alert.updatedAt.toISOString() };
      },

      deleteStockAlert: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'StockAlert', 'unlink');
        await deleteStockAlertUseCase.execute(id);
        return { success: true, message: 'Stock alert deleted successfully' };
      },

      // ── Review mutations ───────────────────────────────────────────────────

      createProductReview: async (_: any, { input }: any, context: any) => {
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }

        try {
          const review = await createProductReviewUseCase.execute({
            productId: input.productId,
            rating: input.rating,
            title: input.title,
            comment: input.comment,
            currentUser: context.currentUser,
          });
          return mapReviewDto(review);
        } catch (error: any) {
          // Map typed domain errors to GraphQLError for correct HTTP semantics
          if (error?.name === 'DuplicateError' || error?.code === 'P2002') {
            throw new GraphQLError('You have already reviewed this product', {
              extensions: { code: 'CONFLICT', http: { status: 409 } },
            });
          }
          if (error?.name === 'NotFoundError') {
            throw new GraphQLError('Product not found', {
              extensions: { code: 'NOT_FOUND', http: { status: 404 } },
            });
          }
          mapPrismaReviewError(error, 'review');
        }
      },

      updateProductReview: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ProductReview', 'write');

        try {
          const review = await updateProductReviewUseCase.execute({
            id,
            rating: input.rating,
            title: input.title,
            comment: input.comment,
            currentUser: context.currentUser!,
          });
          return mapReviewDto(review);
        } catch (error: any) {
          if (error?.name === 'NotFoundError') {
            throw new GraphQLError('Review not found', {
              extensions: { code: 'NOT_FOUND', http: { status: 404 } },
            });
          }
          if (error?.name === 'ValidationError') {
            throw new GraphQLError(error.message, {
              extensions: { code: 'BAD_USER_INPUT', http: { status: 400 } },
            });
          }
          throw error;
        }
      },

      deleteProductReview: async (_: any, { id }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ProductReview', 'unlink');

        try {
          await deleteProductReviewUseCase.execute(id, context.currentUser!);
          return { success: true, message: 'Review deleted' };
        } catch (error: any) {
          if (error?.name === 'NotFoundError') {
            throw new GraphQLError('Review not found', {
              extensions: { code: 'NOT_FOUND', http: { status: 404 } },
            });
          }
          throw error;
        }
      },

      approveReview: async (_: any, { id }: any, context: any) => {
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }

        try {
          const review = await approveReviewUseCase.execute(id, context.currentUser);
          return mapReviewDto(review);
        } catch (error: any) {
          if (error?.name === 'NotFoundError') {
            throw new GraphQLError('Review not found', {
              extensions: { code: 'NOT_FOUND', http: { status: 404 } },
            });
          }
          if (error?.name === 'ForbiddenError') {
            throw new GraphQLError(error.message, {
              extensions: { code: 'FORBIDDEN', http: { status: 403 } },
            });
          }
          if (error?.name === 'BusinessLogicError') {
            throw new GraphQLError(error.message, {
              extensions: { code: 'UNPROCESSABLE', http: { status: 422 } },
            });
          }
          throw error;
        }
      },

      rejectReview: async (_: any, { id }: any, context: any) => {
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }

        try {
          const review = await rejectReviewUseCase.execute(id, context.currentUser);
          return mapReviewDto(review);
        } catch (error: any) {
          if (error?.name === 'NotFoundError') {
            throw new GraphQLError('Review not found', {
              extensions: { code: 'NOT_FOUND', http: { status: 404 } },
            });
          }
          if (error?.name === 'ForbiddenError') {
            throw new GraphQLError(error.message, {
              extensions: { code: 'FORBIDDEN', http: { status: 403 } },
            });
          }
          if (error?.name === 'BusinessLogicError') {
            throw new GraphQLError(error.message, {
              extensions: { code: 'UNPROCESSABLE', http: { status: 422 } },
            });
          }
          throw error;
        }
      },

      createReviewVote: async (_: any, { input }: any, context: any) => {
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        const voterId = context.currentUser.userId;
        try {
          const vote = await prisma.reviewVote.upsert({
            where: { reviewId_userId: { reviewId: input.reviewId, userId: voterId } },
            create: { reviewId: input.reviewId, userId: voterId, isHelpful: input.isHelpful },
            update: { isHelpful: input.isHelpful },
          });
          logger.info('createReviewVote', { voteId: vote.id, reviewId: vote.reviewId, voterId });
          return {
            ...vote,
            review: { __typename: 'ProductReview', id: vote.reviewId },
            user: { __typename: 'UserProfile', id: vote.userId },
          };
        } catch (error) {
          mapPrismaReviewError(error, 'vote');
        }
      },

      deleteReviewVote: async (_: any, { reviewId }: any, context: any) => {
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        const callerId = context.currentUser.userId;

        const existingVote = await prisma.reviewVote.findUnique({
          where: { reviewId_userId: { reviewId, userId: callerId } },
        });

        if (!existingVote) {
          throw new GraphQLError('Vote not found', {
            extensions: { code: 'NOT_FOUND', http: { status: 404 } },
          });
        }

        await prisma.reviewVote.delete({ where: { reviewId_userId: { reviewId, userId: callerId } } });
        logger.info('deleteReviewVote', { reviewId, callerId });
        return { success: true, message: 'Vote deleted' };
      },
    },
  };
}
