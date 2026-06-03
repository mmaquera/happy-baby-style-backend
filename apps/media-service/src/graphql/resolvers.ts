import { IImageRepository } from '../domain/repositories/IImageRepository';
import { ISvgRepository } from '../domain/repositories/ISvgRepository';
import { IStorageService } from '../domain/interfaces/IStorageService';
import { UploadImageUseCase } from '../application/use-cases/UploadImageUseCase';
import { UploadSvgUseCase } from '../application/use-cases/UploadSvgUseCase';
import { DeleteImageUseCase } from '../application/use-cases/DeleteImageUseCase';
import { DeleteSvgUseCase } from '../application/use-cases/DeleteSvgUseCase';
import { GetSignedUrlUseCase } from '../application/use-cases/GetSignedUrlUseCase';
import { ResponseFactory, RESPONSE_CODES, DomainError } from '@hbs/shared-kernel';
import { ImageEntityType } from '../domain/entities/Image';
import { SvgEntityType } from '../domain/entities/Svg';
import { type TokenPayload, assertOwnerOrAdmin } from '@hbs/auth';
import { GraphQLError } from 'graphql';

// ── Media management guard ───────────────────────────────────────────────────
// Delete and non-user-entity upload mutations are restricted to administrators.
function requireMediaManagementAccess(currentUser: TokenPayload | null | undefined): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (currentUser.groups?.includes('administrators')) {
    return;
  }
  throw new GraphQLError('Insufficient privileges', {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
}

// ── Owner-or-admin guard ────────────────────────────────────────────────────
// Uses assertOwnerOrAdmin from @hbs/auth (groups-based, Fase A2 final shape).
function requireOwnerOrMediaAdmin(
  currentUser: TokenPayload | null | undefined,
  ownerId: string,
): void {
  // Delegates entirely to the library guard which checks groups='administrators'
  // or userId===ownerId.
  assertOwnerOrAdmin(currentUser, ownerId);
}

// ── JWT guard placeholder (R3) ───────────────────────────────────────────────
// Defined but NOT called while the bucket is public (Fase ②).
// Activate in Fase 4b when the bucket switches to private:
//   1. Call requireJWT(context?.currentUser) at the top of signedImageUrl resolver.
//   2. Remove anonymous MinIO access: `mc anonymous remove <alias>/<bucket>`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function requireJWT(currentUser: TokenPayload | null | undefined): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
}

const STORAGE_BASE_URL = process.env.STORAGE_BASE_URL || 'http://localhost:3001';

function buildMediaUrl(relativePath: string): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  return `${STORAGE_BASE_URL}/${relativePath}`;
}

function transformImage(image: any) {
  return {
    ...image,
    url: buildMediaUrl(image.url),
    createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt,
  };
}

function transformSvg(svg: any) {
  return {
    ...svg,
    url: buildMediaUrl(svg.url),
    createdAt: svg.createdAt instanceof Date ? svg.createdAt.toISOString() : svg.createdAt,
  };
}

export function createResolvers(
  imageRepository: IImageRepository,
  svgRepository: ISvgRepository,
  storageService: IStorageService,
) {
  const uploadImageUseCase = new UploadImageUseCase(imageRepository, storageService);
  const uploadSvgUseCase = new UploadSvgUseCase(svgRepository, storageService);
  // ITEM E — delete use cases coordinate storage + DB deletion (Clean Architecture).
  const deleteImageUseCase = new DeleteImageUseCase(imageRepository, storageService);
  const deleteSvgUseCase = new DeleteSvgUseCase(svgRepository, storageService);
  // Presigned URL use case — R1/R2/R5 enforced inside the use case.
  const getSignedUrlUseCase = new GetSignedUrlUseCase(imageRepository, storageService);

  return {
    Query: {
      image: async (_: any, { id }: { id: string }) => {
        const image = await imageRepository.findById(id);
        if (!image) return null;
        return transformImage(image);
      },

      imagesByEntity: async (
        _: any,
        {
          entityId,
          entityType,
          limit,
          offset,
        }: { entityId: string; entityType: ImageEntityType; limit?: number; offset?: number },
      ) => {
        const resolvedLimit = Math.min(limit ?? 50, 100);
        const resolvedOffset = offset ?? 0;
        const images = await imageRepository.findByEntityId(
          entityId,
          entityType,
          resolvedLimit,
          resolvedOffset,
        );
        return images.map(transformImage);
      },

      svg: async (_: any, { id }: { id: string }) => {
        const svg = await svgRepository.findById(id);
        if (!svg) return null;
        return transformSvg(svg);
      },

      svgsByEntity: async (
        _: any,
        {
          entityType,
          entityId,
          limit,
          offset,
        }: { entityType: SvgEntityType; entityId: string; limit?: number; offset?: number },
      ) => {
        const resolvedLimit = Math.min(limit ?? 50, 100);
        const resolvedOffset = offset ?? 0;
        const svgs = await svgRepository.findByEntity(
          entityType,
          entityId,
          resolvedLimit,
          resolvedOffset,
        );
        return svgs.map(transformSvg);
      },

      svgs: async (_: any, { limit, offset }: { limit?: number; offset?: number }) => {
        const resolvedLimit = Math.min(limit ?? 50, 100);
        const resolvedOffset = offset ?? 0;
        const svgs = await svgRepository.findAll(resolvedLimit, resolvedOffset);
        return svgs.map(transformSvg);
      },

      svgsCount: async () => {
        return svgRepository.count();
      },

      signedImageUrl: async (
        _: any,
        { id, ttl }: { id: string; ttl?: number },
        context: any,
      ) => {
        // R3 — JWT guard placeholder.
        // Activate in Fase 4b when the bucket becomes private (mc anonymous remove):
        //   requireJWT(context?.currentUser)
        // The query is intentionally PUBLIC while the bucket is public (Fase ②).
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `signed-url-${Date.now()}-${id}`;

        try {
          const result = await getSignedUrlUseCase.execute({ id, ttl, currentUser: context?.currentUser ?? null });

          return ResponseFactory.createSuccessResponse(
            { signedUrl: result.signedUrl, ttl: result.ttl, imageId: result.imageId },
            'Presigned URL generated',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId },
          );
        } catch (error: any) {
          if (error instanceof DomainError) throw error;

          return ResponseFactory.createErrorResponse(
            'Failed to generate presigned URL',
            RESPONSE_CODES.INTERNAL_ERROR,
            { operation: 'signedImageUrl', id },
            { requestId, traceId },
          );
        }
      },
    },

    Mutation: {
      uploadImage: async (
        _: any,
        { file, entityType, entityId }: { file: any; entityType: string; entityId: string },
        context: any,
      ) => {
        // R5 — SDL now declares entityType: ImageEntityType! (enum), so GraphQL rejects values
        // not in the enum before this resolver runs (e.g. arbitrary strings, uppercase variants).
        // As a backstop for stale SDL propagation or direct resolver calls in tests, we compare
        // the string value directly against the enum constant (no toLowerCase() normalization).
        // If somehow an unrecognised string arrives, the management guard blocks it.

        // Control 2 — RBAC guard: user uploads are owner-only; all other entity types
        // require media management access.
        if (entityType === ImageEntityType.USER) {
          requireOwnerOrMediaAdmin(context?.currentUser, entityId);
        } else {
          requireMediaManagementAccess(context?.currentUser);
        }

        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `upload-image-${Date.now()}-${entityId}`;

        try {
          if (!file) {
            throw new Error('No file uploaded. Please select a file to upload.');
          }

          const fileInfo = {
            filename: file?.file?.filename || file?.filename || 'unknown',
            mimetype: file?.file?.mimetype || file?.mimetype || 'unknown',
            size: file?.file?.size || file?.size || 0,
          };

          const result = await uploadImageUseCase.execute({
            file,
            entityType: entityType as ImageEntityType,
            entityId,
            currentUser: context?.currentUser ?? null,
          });

          const fullUrl = buildMediaUrl(result.url);

          return ResponseFactory.createSuccessResponse(
            { url: fullUrl, filename: result.fileName || result.url, imageId: result.id },
            'Image uploaded successfully',
            RESPONSE_CODES.CREATED,
            { requestId, traceId },
          );
        } catch (error: any) {
          // DomainError subclasses (NotFoundError from record-rule denial, etc.)
          // must propagate to Apollo so the client receives a proper error response.
          if (error instanceof DomainError) throw error;

          let errorCode: string = RESPONSE_CODES.INTERNAL_ERROR;
          if (
            error.message?.includes('Invalid file type') ||
            error.message?.includes('File size too large')
          ) {
            errorCode = RESPONSE_CODES.VALIDATION_ERROR;
          } else if (error.message?.includes('Failed to upload')) {
            errorCode = RESPONSE_CODES.SERVICE_UNAVAILABLE;
          }

          return ResponseFactory.createErrorResponse(
            'Failed to upload image',
            errorCode,
            { operation: 'uploadImage', entityType, entityId },
            { requestId, traceId },
          );
        }
      },

      uploadSvg: async (
        _: any,
        {
          file,
          entityType,
          entityId,
          optimize = true,
        }: {
          file: any;
          entityType: string;
          entityId: string;
          optimize?: boolean;
          // sanitize is intentionally absent — always server-side (Control 1)
        },
        context: any,
      ) => {
        // R5 — SDL now declares entityType: SvgEntityType! (enum), so GraphQL rejects values
        // not in the enum before this resolver runs. String comparison against enum constant
        // (no toLowerCase()): SDL values are lowercase, enum values are lowercase.

        // Control 2 — RBAC guard: user SVGs (avatars) are owner-only; icons/logos/
        // product/category SVGs require media management access.
        if (entityType === SvgEntityType.USER) {
          requireOwnerOrMediaAdmin(context?.currentUser, entityId);
        } else {
          requireMediaManagementAccess(context?.currentUser);
        }

        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `upload-svg-${Date.now()}-${entityId}`;

        try {
          if (!file) {
            throw new Error('No SVG file uploaded. Please select a file to upload.');
          }

          let resolvedFile;
          if (file && typeof file.then === 'function') {
            resolvedFile = await file;
          } else if (file && file.promise && typeof file.promise.then === 'function') {
            resolvedFile = await file.promise;
          } else {
            resolvedFile = file;
          }

          const result = await uploadSvgUseCase.execute({
            file: resolvedFile,
            entityType: entityType as SvgEntityType,
            entityId,
            optimize,
            currentUser: context?.currentUser ?? null,
          });

          const fullUrl = buildMediaUrl(result.url);

          return ResponseFactory.createSvgUploadResponse(
            {
              url: fullUrl,
              filename: result.fileName,
              svgId: result.id,
              dimensions: result.dimensions,
              viewBox: result.viewBox,
              optimized: result.optimized,
            },
            'SVG uploaded successfully',
            { requestId, traceId },
          );
        } catch (error: any) {
          // DomainError subclasses (NotFoundError from record-rule denial, etc.)
          // must propagate to Apollo so the client receives a proper error response.
          if (error instanceof DomainError) throw error;

          let errorCode: string = RESPONSE_CODES.SVG_UPLOAD_ERROR;
          if (
            error.message?.includes('Invalid SVG format') ||
            error.message?.includes('Invalid MIME type')
          ) {
            errorCode = RESPONSE_CODES.INVALID_SVG_FORMAT;
          } else if (
            error.message?.includes('SVG content') ||
            error.message?.includes('Invalid XML')
          ) {
            errorCode = RESPONSE_CODES.INVALID_SVG_CONTENT;
          } else if (error.message?.includes('File size') || error.message?.includes('too large')) {
            errorCode = RESPONSE_CODES.SVG_SIZE_EXCEEDED;
          } else if (
            error.message?.includes('security') ||
            error.message?.includes('script') ||
            error.message?.includes('javascript')
          ) {
            errorCode = RESPONSE_CODES.SVG_SECURITY_VIOLATION;
          }

          return ResponseFactory.createSvgErrorResponse(
            'Failed to upload SVG',
            errorCode,
            { operation: 'uploadSvg', entityType, entityId, optimize },
            { requestId, traceId },
          );
        }
      },

      // ITEM E — delegates to DeleteImageUseCase which coordinates storage + DB deletion.
      deleteImage: async (_: any, { id }: { id: string }, context: any) => {
        requireMediaManagementAccess(context?.currentUser);
        try {
          await deleteImageUseCase.execute({ id, currentUser: context?.currentUser ?? null });
          return true;
        } catch (error) {
          // DomainError (including NotFoundError from record-rule denial) must propagate.
          if (error instanceof DomainError) throw error;
          // Re-throw all other errors (including storage failures after successful DB delete)
          // so the client receives a proper error response rather than a silent false.
          throw error;
        }
      },

      // ITEM E — delegates to DeleteSvgUseCase which coordinates storage + DB deletion.
      deleteSvg: async (_: any, { id }: { id: string }, context: any) => {
        requireMediaManagementAccess(context?.currentUser);
        try {
          return await deleteSvgUseCase.execute({ id, currentUser: context?.currentUser ?? null });
        } catch (error) {
          // DomainError (including NotFoundError from record-rule denial) must propagate.
          if (error instanceof DomainError) throw error;
          // Re-throw all other errors (including storage failures after successful DB delete)
          // so the client receives a proper error response rather than a silent false.
          throw error;
        }
      },
    },

    Image: {
      __resolveReference: async ({ id }: { id: string }) => {
        const image = await imageRepository.findById(id);
        if (!image) return null;
        return transformImage(image);
      },
    },

    Svg: {
      __resolveReference: async ({ id }: { id: string }) => {
        const svg = await svgRepository.findById(id);
        if (!svg) return null;
        return transformSvg(svg);
      },
    },
  };
}
