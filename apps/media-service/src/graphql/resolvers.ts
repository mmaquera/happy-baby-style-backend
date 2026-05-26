import { IImageRepository } from '../domain/repositories/IImageRepository';
import { ISvgRepository } from '../domain/repositories/ISvgRepository';
import { IStorageService } from '../domain/interfaces/IStorageService';
import { UploadImageUseCase } from '../application/use-cases/UploadImageUseCase';
import { UploadSvgUseCase } from '../application/use-cases/UploadSvgUseCase';
import { ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';
import { ImageEntityType } from '../domain/entities/Image';
import { SvgEntityType } from '../domain/entities/Svg';

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
    createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt
  };
}

function transformSvg(svg: any) {
  return {
    ...svg,
    url: buildMediaUrl(svg.url),
    createdAt: svg.createdAt instanceof Date ? svg.createdAt.toISOString() : svg.createdAt
  };
}

export function createResolvers(
  imageRepository: IImageRepository,
  svgRepository: ISvgRepository,
  storageService: IStorageService
) {
  const uploadImageUseCase = new UploadImageUseCase(imageRepository, storageService);
  const uploadSvgUseCase = new UploadSvgUseCase(svgRepository, storageService);

  return {
    Query: {
      image: async (_: any, { id }: { id: string }) => {
        const image = await imageRepository.findById(id);
        if (!image) return null;
        return transformImage(image);
      },

      imagesByEntity: async (_: any, { entityId, entityType }: { entityId: string; entityType: ImageEntityType }) => {
        const images = await imageRepository.findByEntityId(entityId, entityType);
        return images.map(transformImage);
      },

      svg: async (_: any, { id }: { id: string }) => {
        const svg = await svgRepository.findById(id);
        if (!svg) return null;
        return transformSvg(svg);
      },

      svgsByEntity: async (_: any, { entityType, entityId }: { entityType: SvgEntityType; entityId: string }) => {
        const svgs = await svgRepository.findByEntity(entityType, entityId);
        return svgs.map(transformSvg);
      },

      svgs: async (_: any, { limit, offset }: { limit?: number; offset?: number }) => {
        const svgs = await svgRepository.findAll(limit, offset);
        return svgs.map(transformSvg);
      },

      svgsCount: async () => {
        return svgRepository.count();
      }
    },

    Mutation: {
      uploadImage: async (_: any, { file, entityType, entityId }: { file: any; entityType: string; entityId: string }, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `upload-image-${Date.now()}-${entityId}`;

        try {
          if (!file) {
            throw new Error('No file uploaded. Please select a file to upload.');
          }

          const fileInfo = {
            filename: file?.file?.filename || file?.filename || 'unknown',
            mimetype: file?.file?.mimetype || file?.mimetype || 'unknown',
            size: file?.file?.size || file?.size || 0
          };

          const result = await uploadImageUseCase.execute({
            file,
            entityType: entityType as ImageEntityType,
            entityId
          });

          const fullUrl = buildMediaUrl(result.url);

          return ResponseFactory.createSuccessResponse(
            { url: fullUrl, filename: result.fileName || result.url, imageId: result.id },
            'Image uploaded successfully',
            RESPONSE_CODES.CREATED,
            { requestId, traceId }
          );
        } catch (error: any) {
          let errorCode: string = RESPONSE_CODES.INTERNAL_ERROR;
          if (error.message?.includes('Invalid file type') || error.message?.includes('File size too large')) {
            errorCode = RESPONSE_CODES.VALIDATION_ERROR;
          } else if (error.message?.includes('Failed to upload')) {
            errorCode = RESPONSE_CODES.SERVICE_UNAVAILABLE;
          }

          return ResponseFactory.createErrorResponse(
            error.message || 'Failed to upload image',
            errorCode,
            { operation: 'uploadImage', entityType, entityId },
            { requestId, traceId }
          );
        }
      },

      uploadSvg: async (_: any, { file, entityType, entityId, optimize = true, sanitize = true }: {
        file: any;
        entityType: string;
        entityId: string;
        optimize?: boolean;
        sanitize?: boolean;
      }, context: any) => {
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
            sanitize
          });

          const fullUrl = buildMediaUrl(result.url);

          return ResponseFactory.createSvgUploadResponse(
            {
              url: fullUrl,
              filename: result.fileName,
              svgId: result.id,
              dimensions: result.dimensions,
              viewBox: result.viewBox,
              optimized: result.optimized
            },
            'SVG uploaded successfully',
            { requestId, traceId }
          );
        } catch (error: any) {
          let errorCode: string = RESPONSE_CODES.SVG_UPLOAD_ERROR;
          if (error.message?.includes('Invalid SVG format') || error.message?.includes('Invalid MIME type')) {
            errorCode = RESPONSE_CODES.INVALID_SVG_FORMAT;
          } else if (error.message?.includes('SVG content') || error.message?.includes('Invalid XML')) {
            errorCode = RESPONSE_CODES.INVALID_SVG_CONTENT;
          } else if (error.message?.includes('File size') || error.message?.includes('too large')) {
            errorCode = RESPONSE_CODES.SVG_SIZE_EXCEEDED;
          } else if (error.message?.includes('security') || error.message?.includes('script') || error.message?.includes('javascript')) {
            errorCode = RESPONSE_CODES.SVG_SECURITY_VIOLATION;
          }

          return ResponseFactory.createSvgErrorResponse(
            error.message || 'Failed to upload SVG',
            errorCode,
            { operation: 'uploadSvg', entityType, entityId, optimize, sanitize },
            { requestId, traceId }
          );
        }
      },

      deleteImage: async (_: any, { id }: { id: string }) => {
        try {
          await imageRepository.delete(id);
          return true;
        } catch {
          return false;
        }
      },

      deleteSvg: async (_: any, { id }: { id: string }) => {
        try {
          return await svgRepository.delete(id);
        } catch {
          return false;
        }
      }
    },

    Image: {
      __resolveReference: async ({ id }: { id: string }) => {
        const image = await imageRepository.findById(id);
        if (!image) return null;
        return transformImage(image);
      }
    },

    Svg: {
      __resolveReference: async ({ id }: { id: string }) => {
        const svg = await svgRepository.findById(id);
        if (!svg) return null;
        return transformSvg(svg);
      }
    }
  };
}
