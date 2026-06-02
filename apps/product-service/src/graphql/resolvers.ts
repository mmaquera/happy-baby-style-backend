import { GraphQLScalarType, GraphQLError, Kind } from 'graphql';
import { PrismaClient, Prisma } from '../prisma';
import { IProductRepository } from '../domain/repositories/IProductRepository';
import { GetProductsUseCase } from '../application/use-cases/GetProductsUseCase';
import { GetProductByIdUseCase } from '../application/use-cases/GetProductByIdUseCase';
import { CreateProductUseCase } from '../application/use-cases/CreateProductUseCase';
import { UpdateProductUseCase } from '../application/use-cases/UpdateProductUseCase';
import { DeleteProductUseCase } from '../application/use-cases/DeleteProductUseCase';
import { transformProduct, transformVariant } from './transformers/productTransformer';
import { DomainError, ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';
import { requirePermission, Permission } from '@hbs/auth';
import { assertModelAccess, isAdmin } from '@hbs/authz';
import { LoggerFactory } from '@hbs/logging';

/**
 * Maps a PrismaClientKnownRequestError to a GraphQLError with a clean user-facing message,
 * preventing internal schema/table/column names from leaking to GraphQL clients.
 *
 * Throws GraphQLError (not DomainError) so that Apollo Server 4 forwards the correct HTTP
 * status and extension code to the client — non-GraphQLError exceptions are masked as
 * "Internal server error" by Apollo Server 4 unless a formatError hook is present.
 *
 * P2002 — unique constraint violation: the record already exists (e.g. duplicate review).
 * P2003 — foreign key constraint violation: the referenced record does not exist.
 * P2025 — record to update/delete not found.
 *
 * Any other Prisma error is re-thrown as-is so it surfaces as an unexpected internal error.
 */
function mapPrismaReviewError(error: unknown, context: 'review' | 'vote'): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation: for reviews this means the user already reviewed this product.
      const message =
        context === 'review'
          ? 'You have already reviewed this product'
          : 'You have already voted on this review';
      throw new GraphQLError(message, {
        extensions: { code: 'CONFLICT', http: { status: 409 } },
      });
    }
    if (error.code === 'P2003') {
      // FK violation: productId (for review) or reviewId (for vote) does not exist.
      const label = context === 'review' ? 'Product' : 'Review';
      throw new GraphQLError(`${label} not found`, {
        extensions: { code: 'NOT_FOUND', http: { status: 404 } },
      });
    }
    if (error.code === 'P2025') {
      // Record not found during update/delete.
      const label = context === 'review' ? 'Review' : 'Vote';
      throw new GraphQLError(`${label} not found`, {
        extensions: { code: 'NOT_FOUND', http: { status: 404 } },
      });
    }
  }
  // Unknown Prisma or non-Prisma error — let the caller handle it as an internal error.
  throw error;
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

export function createResolvers(productRepository: IProductRepository, prisma: PrismaClient) {
  const logger = LoggerFactory.getInstance().createServiceLogger('ProductResolvers');
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

      lowStockProducts: async (_: any, __: any, context: any) => {
        requirePermission(context.currentUser, Permission.VIEW_ANALYTICS);
        const result = await getProductsUseCase.execute({
          filters: { isActive: true },
          pagination: { limit: 10000, offset: 0 },
        });
        return result.products
          .filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 10)
          .map(transformProduct);
      },

      outOfStockProducts: async (_: any, __: any, context: any) => {
        requirePermission(context.currentUser, Permission.VIEW_ANALYTICS);
        const result = await getProductsUseCase.execute({
          filters: { isActive: true },
          pagination: { limit: 10000, offset: 0 },
        });
        return result.products.filter((p) => p.stockQuantity === 0).map(transformProduct);
      },

      inventoryTransactions: async (_: any, { productId }: { productId: string }, context: any) => {
        assertModelAccess(context.currentUser, 'InventoryTransaction', 'read');
        const txs = await prisma.inventoryTransaction.findMany({
          where: { productId },
          orderBy: { createdAt: 'desc' },
        });
        return txs.map((tx) => ({ ...tx, createdAt: tx.createdAt.toISOString() }));
      },

      stockAlerts: async (_: any, __: any, context: any) => {
        requirePermission(context.currentUser, Permission.VIEW_ANALYTICS);
        const alerts = await prisma.stockAlert.findMany({ orderBy: { createdAt: 'desc' } });
        return alerts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        }));
      },

      // ── Review queries ───────────────────────────────────────────────────

      productReviews: async (_: any, { productId, pagination }: any) => {
        try {
          const limit = pagination?.limit ?? 10;
          const offset = pagination?.offset ?? 0;
          const [reviews, total] = await Promise.all([
            prisma.productReview.findMany({
              where: { productId, isApproved: true },
              include: { photos: true, votes: true },
              orderBy: { createdAt: 'desc' },
              take: limit,
              skip: offset,
            }),
            prisma.productReview.count({ where: { productId, isApproved: true } }),
          ]);
          return {
            reviews: reviews.map((r) => ({
              ...r,
              product: { __typename: 'Product', id: r.productId },
              user: { __typename: 'UserProfile', id: r.userId },
              photos: r.photos.map((p) => ({ ...p, review: { __typename: 'ProductReview', id: p.reviewId } })),
              votes: r.votes.map((v) => ({ ...v, review: { __typename: 'ProductReview', id: v.reviewId }, user: { __typename: 'UserProfile', id: v.userId } })),
            })),
            total,
            hasMore: offset + limit < total,
          };
        } catch {
          return { reviews: [], total: 0, hasMore: false };
        }
      },

      userReviews: async (_: any, { userId }: any) => {
        try {
          const reviews = await prisma.productReview.findMany({
            where: { userId },
            include: { photos: true, votes: true },
            orderBy: { createdAt: 'desc' },
          });
          return reviews.map((r) => ({
            ...r,
            product: { __typename: 'Product', id: r.productId },
            user: { __typename: 'UserProfile', id: r.userId },
            photos: r.photos.map((p) => ({ ...p, review: { __typename: 'ProductReview', id: p.reviewId } })),
            votes: r.votes.map((v) => ({ ...v, review: { __typename: 'ProductReview', id: v.reviewId }, user: { __typename: 'UserProfile', id: v.userId } })),
          }));
        } catch {
          return [];
        }
      },

      review: async (_: any, { id }: any) => {
        try {
          const r = await prisma.productReview.findUnique({ where: { id }, include: { photos: true, votes: true } });
          if (!r) return null;
          return {
            ...r,
            product: { __typename: 'Product', id: r.productId },
            user: { __typename: 'UserProfile', id: r.userId },
            photos: r.photos.map((p) => ({ ...p, review: { __typename: 'ProductReview', id: p.reviewId } })),
            votes: r.votes.map((v) => ({ ...v, review: { __typename: 'ProductReview', id: v.reviewId }, user: { __typename: 'UserProfile', id: v.userId } })),
          };
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

      // ── Inventory transactions ───────────────────────────────────────────
      createInventoryTransaction: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'InventoryTransaction', 'create');
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
      createStockAlert: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'StockAlert', 'create');
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

      updateStockAlert: async (_: any, { id, isActive }: any, context: any) => {
        assertModelAccess(context.currentUser, 'StockAlert', 'write');
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

      deleteStockAlert: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'StockAlert', 'unlink');
        await prisma.stockAlert.delete({ where: { id } });
        return { success: true, message: 'Stock alert deleted successfully' };
      },

      // ── Review mutations ─────────────────────────────────────────────────

      createProductReview: async (_: any, { input }: any, context: any) => {
        // Second-level auth guard: authPlugin in index.ts blocks unauthenticated mutations at the
        // Apollo layer, but we enforce here as defence-in-depth and for explicit error semantics.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', { extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } } });
        }
        // SECURITY FIX (BOLA): author is ALWAYS the authenticated user from the JWT.
        // We never accept userId from the client input — that would allow identity spoofing.
        // TODO (structural refactor — requires index.ts): extract into CreateProductReviewUseCase
        // that receives currentUser and productId, enforcing domain rules (duplicate review guard,
        // verified purchase check) in the application layer. Blocked by index.ts wiring constraint.
        const authorId = context.currentUser.userId;
        try {
          const review = await prisma.productReview.create({
            data: {
              productId: input.productId,
              userId: authorId,
              rating: input.rating,
              title: input.title,
              comment: input.comment,
            },
            include: { photos: true, votes: true },
          });
          logger.info('createProductReview', { reviewId: review.id, productId: review.productId, authorId });
          return {
            ...review,
            product: { __typename: 'Product', id: review.productId },
            user: { __typename: 'UserProfile', id: review.userId },
            photos: review.photos.map((p) => ({ ...p, review: { __typename: 'ProductReview', id: p.reviewId } })),
            votes: review.votes.map((v) => ({ ...v, review: { __typename: 'ProductReview', id: v.reviewId }, user: { __typename: 'UserProfile', id: v.userId } })),
          };
        } catch (error) {
          mapPrismaReviewError(error, 'review');
        }
      },

      updateProductReview: async (_: any, { id, input }: any, context: any) => {
        // Baseline gate 1 — authentication + permission check.
        // assertModelAccess handles: (a) unauthenticated → 401, (b) admin bypass,
        // (c) requires update:product permission for non-admin staff (inventory-user,
        // sales-user). Kept as-is so the existing permission baseline is preserved.
        //
        // DESIGN NOTE — moderator role (customer-service editing any review without
        // full admin): would require a dedicated `reviews:moderate` permission code
        // added to MODEL_ACCESS_MAP so staff can moderate without the broader
        // `update:product` privilege. That permission design is deferred; do NOT use
        // `update:product` as a proxy for moderation scope.
        assertModelAccess(context.currentUser, 'ProductReview', 'write');

        // Baseline gate 2 — owner-or-admin check (BOLA fix).
        // Load the row BEFORE the update. Using findUnique (not update) so we can
        // inspect ownership without a write side-effect on a record we may deny.
        // Anti-enumeration: a non-owner receives NOT_FOUND regardless of whether the
        // review exists or belongs to someone else — this prevents ID probing.
        const existing = await prisma.productReview.findUnique({ where: { id } });

        const callerId = context.currentUser!.userId;
        const callerIsAdmin = isAdmin(context.currentUser);

        if (!existing || (!callerIsAdmin && existing.userId !== callerId)) {
          // Ambiguous 404 — do not reveal ownership information to the caller.
          logger.info('updateProductReview: denied (BOLA guard)', {
            reviewId: id,
            callerId,
            callerIsAdmin,
            reviewExists: !!existing,
          });
          throw new GraphQLError('Review not found', {
            extensions: { code: 'NOT_FOUND', http: { status: 404 } },
          });
        }

        const review = await prisma.productReview.update({
          where: { id },
          data: {
            rating: input.rating,
            title: input.title,
            comment: input.comment,
            isApproved: input.isApproved,
          },
          include: { photos: true, votes: true },
        });

        logger.info('updateProductReview', {
          reviewId: review.id,
          callerId,
          callerIsAdmin,
        });

        return {
          ...review,
          product: { __typename: 'Product', id: review.productId },
          user: { __typename: 'UserProfile', id: review.userId },
          photos: review.photos.map((p) => ({
            ...p,
            review: { __typename: 'ProductReview', id: p.reviewId },
          })),
          votes: review.votes.map((v) => ({
            ...v,
            review: { __typename: 'ProductReview', id: v.reviewId },
            user: { __typename: 'UserProfile', id: v.userId },
          })),
        };
      },

      deleteProductReview: async (_: any, { id }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ProductReview', 'unlink');
        await prisma.productReview.delete({ where: { id } });
        return { success: true, message: 'Review deleted' };
      },

      approveReview: async (_: any, { id }: any, context: any) => {
        assertModelAccess(context.currentUser, 'ProductReview', 'write');
        const review = await prisma.productReview.update({
          where: { id },
          data: { isApproved: true },
          include: { photos: true, votes: true },
        });
        return {
          ...review,
          product: { __typename: 'Product', id: review.productId },
          user: { __typename: 'UserProfile', id: review.userId },
          photos: review.photos.map((p) => ({ ...p, review: { __typename: 'ProductReview', id: p.reviewId } })),
          votes: [],
        };
      },

      createReviewVote: async (_: any, { input }: any, context: any) => {
        // Second-level auth guard: authPlugin in index.ts blocks unauthenticated mutations at the
        // Apollo layer, but we enforce here as defence-in-depth and for explicit error semantics.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', { extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } } });
        }
        // SECURITY FIX (BOLA): voter is ALWAYS the authenticated user from the JWT.
        // We never accept userId from the client — that would allow vote stuffing or spoofed votes.
        // TODO (structural refactor — requires index.ts): extract into CreateReviewVoteUseCase.
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
        // Second-level auth guard: authPlugin in index.ts blocks unauthenticated mutations at the
        // Apollo layer, but we enforce here as defence-in-depth and for explicit error semantics.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', { extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } } });
        }
        // Ownership enforcement: a caller may only delete their own vote.
        // The caller's identity is derived exclusively from the JWT — never from client input.
        //
        // Anti-enumeration: always NotFound — never "you don't own this" — so an attacker
        // cannot probe which reviewIds have votes that belong to other users.
        //
        // Admin override (delete a vote by arbitrary userId) requires a separate
        // admin-scoped mutation that accepts an explicit targetUserId argument; it cannot
        // be added to this mutation without an SDL change. Deferred intentionally.
        //
        // TODO (structural refactor — requires index.ts): extract into DeleteReviewVoteUseCase.
        const callerId = context.currentUser.userId;

        const existingVote = await prisma.reviewVote.findUnique({
          where: { reviewId_userId: { reviewId, userId: callerId } },
        });

        if (!existingVote) {
          // Anti-enumeration: always NotFound — never "you don't own this"
          throw new GraphQLError('Vote not found', { extensions: { code: 'NOT_FOUND', http: { status: 404 } } });
        }

        await prisma.reviewVote.delete({ where: { reviewId_userId: { reviewId, userId: callerId } } });
        logger.info('deleteReviewVote', { reviewId, callerId });
        return { success: true, message: 'Vote deleted' };
      },
    },
  };
}
