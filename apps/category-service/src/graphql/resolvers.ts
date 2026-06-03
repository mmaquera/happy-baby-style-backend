import { ICategoryRepository } from '../domain/repositories/ICategoryRepository';
import { CreateCategoryUseCase } from '../application/use-cases/CreateCategoryUseCase';
import { GetCategoriesUseCase } from '../application/use-cases/GetCategoriesUseCase';
import { GetCategoryByIdUseCase } from '../application/use-cases/GetCategoryByIdUseCase';
import { GetCategoryBySlugUseCase } from '../application/use-cases/GetCategoryBySlugUseCase';
import { UpdateCategoryUseCase } from '../application/use-cases/UpdateCategoryUseCase';
import { DeleteCategoryUseCase } from '../application/use-cases/DeleteCategoryUseCase';
import { transformCategory } from './transformers/categoryTransformer';
import { ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';
import { assertModelAccess } from '@hbs/authz';
import { GraphQLScalarType, Kind } from 'graphql';

const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize(value: any) {
    return value instanceof Date ? value.toISOString() : value;
  },
  parseValue(value: any) {
    return new Date(value as string);
  },
  parseLiteral(ast: any) {
    return ast.kind === Kind.STRING ? new Date(ast.value) : null;
  },
});

function handleError(error: any): { message: string; code: string; details?: any } {
  if (error?.code && typeof error.code === 'string') {
    return { message: error.message, code: error.code, details: error.details };
  }
  return { message: error?.message || 'Internal server error', code: 'INTERNAL_ERROR' };
}

export function createResolvers(categoryRepository: ICategoryRepository) {
  const createCategoryUseCase = new CreateCategoryUseCase(categoryRepository);
  const getCategoriesUseCase = new GetCategoriesUseCase(categoryRepository);
  const getCategoryByIdUseCase = new GetCategoryByIdUseCase(categoryRepository);
  const getCategoryBySlugUseCase = new GetCategoryBySlugUseCase(categoryRepository);
  const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepository);
  const deleteCategoryUseCase = new DeleteCategoryUseCase(categoryRepository);

  return {
    DateTime: DateTimeScalar,

    Category: {
      __resolveReference: async (ref: { id: string }) => {
        const category = await categoryRepository.findById(ref.id);
        return category ? transformCategory(category) : null;
      },

      /**
       * Lazy field resolver — only invoked when the client requests `parent`.
       * Fetches the parent category by the parentCategoryId carried on the DTO.
       * Returns null for root categories.
       *
       * N+1 note: for typical catalogue trees (depth ≤ 4, low category count)
       * this is acceptable without DataLoader. If the category tree grows or
       * parent is requested inside a list, introduce a DataLoader keyed by category id.
       */
      parent: async (category: { parentCategoryId?: string | null }) => {
        if (!category.parentCategoryId) return null;
        const parent = await categoryRepository.findById(category.parentCategoryId);
        return parent ? transformCategory(parent) : null;
      },

      /**
       * Lazy field resolver — only invoked when the client requests `children`.
       * Fetches direct children of the current category.
       * Returns [] for leaf categories.
       */
      children: async (category: { id: string }) => {
        const children = await categoryRepository.findChildren(category.id);
        return children.map(transformCategory);
      },
    },

    Query: {
      categories: async (_: any, { filters, pagination }: any, context: any) => {
        const startTime = Date.now();
        const traceId = `get-categories-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          const result = await getCategoriesUseCase.execute({
            filters: filters || {},
            pagination: pagination || { limit: 50, offset: 0 },
          });
          const duration = Date.now() - startTime;
          return ResponseFactory.createPaginatedResponse(
            result.categories.map(transformCategory),
            {
              total: result.total,
              limit: pagination?.limit || 50,
              offset: pagination?.offset || 0,
              hasMore: result.hasMore,
              currentPage: Math.floor((pagination?.offset || 0) / (pagination?.limit || 50)) + 1,
              totalPages: Math.ceil(result.total / (pagination?.limit || 50)),
            },
            'Categories retrieved successfully',
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          const err = handleError(error);
          return ResponseFactory.createErrorResponse(
            err.message,
            (err.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
            err.details,
            { requestId, traceId, duration },
          );
        }
      },

      category: async (_: any, { id }: { id: string }, context: any) => {
        const startTime = Date.now();
        const traceId = `get-category-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          const category = await getCategoryByIdUseCase.execute({ id });
          const duration = Date.now() - startTime;
          return ResponseFactory.createSuccessResponse(
            transformCategory(category),
            'Category retrieved successfully',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          const err = handleError(error);
          return ResponseFactory.createErrorResponse(
            err.message,
            (err.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
            err.details,
            { requestId, traceId, duration },
          );
        }
      },

      categoryBySlug: async (_: any, { slug }: { slug: string }, context: any) => {
        const startTime = Date.now();
        const traceId = `get-category-by-slug-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          const category = await getCategoryBySlugUseCase.execute({ slug });
          const duration = Date.now() - startTime;
          return ResponseFactory.createSuccessResponse(
            transformCategory(category),
            'Category retrieved successfully',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          const err = handleError(error);
          return ResponseFactory.createErrorResponse(
            err.message,
            (err.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
            err.details,
            { requestId, traceId, duration },
          );
        }
      },
    },

    Mutation: {
      createCategory: async (_: any, { input }: { input: any }, context: any) => {
        assertModelAccess(context.currentUser, 'Category', 'create');
        const startTime = Date.now();
        const traceId = `create-category-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          const category = await createCategoryUseCase.execute({
            name: input.name,
            description: input.description,
            slug: input.slug,
            imageUrl: input.image,
            isActive: input.isActive !== undefined ? input.isActive : true,
            sortOrder: input.sortOrder || 0,
            parentCategoryId: input.parentCategoryId ?? null,
          });
          const duration = Date.now() - startTime;
          return ResponseFactory.createSuccessResponse(
            {
              entity: transformCategory(category),
              id: category.id,
              createdAt: category.createdAt.toISOString(),
            },
            'Category created successfully',
            RESPONSE_CODES.CREATED,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          const err = handleError(error);
          return ResponseFactory.createErrorResponse(
            err.message,
            (err.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
            err.details,
            { requestId, traceId, duration },
          );
        }
      },

      updateCategory: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
        assertModelAccess(context.currentUser, 'Category', 'write');
        const startTime = Date.now();
        const traceId = `update-category-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          // Build the request without parentCategoryId by default.
          // Only add the key when the client explicitly included it in the input — this
          // lets UpdateCategoryUseCase distinguish "not touching parent" (key absent)
          // from "set parent to null / root" (key present with null value).
          // Using `key in object` on a JS object literal always returns true even for
          // undefined values, so we conditionally spread the key instead.
          const updateRequest: Parameters<typeof updateCategoryUseCase.execute>[0] = {
            id,
            name: input.name,
            description: input.description,
            slug: input.slug,
            imageUrl: input.image,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
            currentUser: context.currentUser ?? null,
          };
          if ('parentCategoryId' in input) {
            updateRequest.parentCategoryId = input.parentCategoryId ?? null;
          }
          const result = await updateCategoryUseCase.execute(updateRequest);
          const duration = Date.now() - startTime;
          return ResponseFactory.createSuccessResponse(
            {
              entity: transformCategory(result.entity),
              id: result.id,
              updatedAt: result.updatedAt.toISOString(),
              changes: result.changes,
            },
            'Category updated successfully',
            RESPONSE_CODES.UPDATED,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          const err = handleError(error);
          return ResponseFactory.createErrorResponse(
            err.message,
            (err.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
            err.details,
            { requestId, traceId, duration },
          );
        }
      },

      deleteCategory: async (_: any, { id }: { id: string }, context: any) => {
        assertModelAccess(context.currentUser, 'Category', 'unlink');
        const startTime = Date.now();
        const traceId = `delete-category-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;

        try {
          const result = await deleteCategoryUseCase.execute({
            id,
            forceDelete: false,
            currentUser: context.currentUser ?? null,
          });
          const duration = Date.now() - startTime;
          return ResponseFactory.createSuccessResponse(
            {
              id: result.id,
              deletedAt: result.deletedAt.toISOString(),
              softDelete: result.softDelete,
            },
            'Category deleted successfully',
            RESPONSE_CODES.DELETED,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          const err = handleError(error);
          return ResponseFactory.createErrorResponse(
            err.message,
            (err.code as any) || RESPONSE_CODES.INTERNAL_ERROR,
            err.details,
            { requestId, traceId, duration },
          );
        }
      },
    },
  };
}
