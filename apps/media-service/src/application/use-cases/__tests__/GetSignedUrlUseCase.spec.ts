jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
      }),
    },
  }),
  { virtual: true },
);

import { GetSignedUrlUseCase, TTL_MIN, TTL_DEFAULT, TTL_MAX } from '../GetSignedUrlUseCase';
import type { IImageRepository } from '../../../domain/repositories/IImageRepository';
import type { IStorageService } from '../../../domain/interfaces/IStorageService';
import { ImageEntity, ImageEntityType } from '../../../domain/entities/Image';
import { NotFoundError } from '@hbs/shared-kernel';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeImageEntity(overrides: Partial<ImageEntity> = {}): ImageEntity {
  return new ImageEntity(
    overrides.id ?? 'img-1',
    overrides.fileName ?? 'product_p1_123.jpg',
    overrides.originalName ?? 'photo.jpg',
    overrides.mimeType ?? 'image/jpeg',
    overrides.size ?? 50000,
    overrides.url ?? 'http://localhost:9000/media-bucket/products/p1/product_p1_123.jpg',
    overrides.bucket ?? 'media-bucket',
    overrides.path ?? 'products/p1/product_p1_123.jpg',
    overrides.entityType ?? ImageEntityType.PRODUCT,
    overrides.entityId ?? 'p1',
    overrides.createdAt ?? new Date(),
  );
}

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-1',
    email: 'user@test.com',
    permissions: [],
    groups: ['customer'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const PRESIGNED_URL = 'https://s3.example.com/products/p1/product_p1_123.jpg?X-Amz-Signature=abc123';

function makeImageRepo(found: ImageEntity | null = makeImageEntity()): jest.Mocked<IImageRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(found),
    findAll: jest.fn().mockResolvedValue([]),
    findByEntityId: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByEntityId: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IImageRepository>;
}

function makeStorageService(signedUrl: string = PRESIGNED_URL): jest.Mocked<IStorageService> {
  return {
    uploadFile: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn().mockReturnValue(''),
    validateFile: jest.fn().mockReturnValue(true),
    getBucketName: jest.fn().mockReturnValue('media-bucket'),
    getSignedUrl: jest.fn().mockResolvedValue(signedUrl),
  } as jest.Mocked<IStorageService>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GetSignedUrlUseCase', () => {
  let imageRepo: jest.Mocked<IImageRepository>;
  let storageService: jest.Mocked<IStorageService>;
  let useCase: GetSignedUrlUseCase;

  beforeEach(() => {
    imageRepo = makeImageRepo();
    storageService = makeStorageService();
    useCase = new GetSignedUrlUseCase(imageRepo, storageService);
  });

  describe('happy path', () => {
    it('resolves key from DB (path field) and returns a presigned URL', async () => {
      const result = await useCase.execute({ id: 'img-1' });

      // R1 — only findById is called; no key/path passed from caller
      expect(imageRepo.findById).toHaveBeenCalledWith('img-1');
      // R6 — storageService.getSignedUrl called with the path from DB
      expect(storageService.getSignedUrl).toHaveBeenCalledWith(
        'products/p1/product_p1_123.jpg',   // from image.path
        TTL_DEFAULT,                          // R2 — default TTL
        'image/jpeg',                         // R4 — mimeType from image record
      );
      expect(result.signedUrl).toBe(PRESIGNED_URL);
      expect(result.imageId).toBe('img-1');
      expect(result.ttl).toBe(TTL_DEFAULT);
    });

    it('falls back to url field when path is empty', async () => {
      const imageWithEmptyPath = makeImageEntity({ path: '' });
      imageRepo = makeImageRepo(imageWithEmptyPath);
      useCase = new GetSignedUrlUseCase(imageRepo, storageService);

      await useCase.execute({ id: 'img-1' });

      // Should use the url column as the key
      expect(storageService.getSignedUrl).toHaveBeenCalledWith(
        imageWithEmptyPath.url,
        TTL_DEFAULT,
        'image/jpeg',
      );
    });

    it('echoes imageId back in the result', async () => {
      const result = await useCase.execute({ id: 'img-1', currentUser: makeUser() });
      expect(result.imageId).toBe('img-1');
    });

    it('passes mimeType from the image record to the storage driver (R4)', async () => {
      const svgImage = makeImageEntity({ mimeType: 'image/svg+xml', path: 'icons/logo.svg' });
      imageRepo = makeImageRepo(svgImage);
      useCase = new GetSignedUrlUseCase(imageRepo, storageService);

      await useCase.execute({ id: 'img-1' });

      expect(storageService.getSignedUrl).toHaveBeenCalledWith(
        'icons/logo.svg',
        TTL_DEFAULT,
        'image/svg+xml',
      );
    });
  });

  describe('NotFound — R1', () => {
    it('throws NotFoundError when image does not exist in DB', async () => {
      imageRepo = makeImageRepo(null);
      useCase = new GetSignedUrlUseCase(imageRepo, storageService);

      await expect(useCase.execute({ id: 'img-missing' })).rejects.toBeInstanceOf(NotFoundError);
      // storageService must NOT be called — key never leaves the DB boundary
      expect(storageService.getSignedUrl).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when image has neither path nor url', async () => {
      const brokenImage = makeImageEntity({ path: '', url: '' });
      imageRepo = makeImageRepo(brokenImage);
      useCase = new GetSignedUrlUseCase(imageRepo, storageService);

      await expect(useCase.execute({ id: 'img-1' })).rejects.toBeInstanceOf(NotFoundError);
      expect(storageService.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('TTL clamping — R2', () => {
    it('uses TTL_DEFAULT when ttl is omitted', async () => {
      await useCase.execute({ id: 'img-1' });
      const [, calledTtl] = storageService.getSignedUrl.mock.calls[0];
      expect(calledTtl).toBe(TTL_DEFAULT);
    });

    it('clamps ttl above TTL_MAX down to TTL_MAX (3600)', async () => {
      const result = await useCase.execute({ id: 'img-1', ttl: 9999 });
      const [, calledTtl] = storageService.getSignedUrl.mock.calls[0];
      expect(calledTtl).toBe(TTL_MAX);
      expect(result.ttl).toBe(TTL_MAX);
    });

    it('clamps ttl below TTL_MIN up to TTL_MIN (60)', async () => {
      const result = await useCase.execute({ id: 'img-1', ttl: 1 });
      const [, calledTtl] = storageService.getSignedUrl.mock.calls[0];
      expect(calledTtl).toBe(TTL_MIN);
      expect(result.ttl).toBe(TTL_MIN);
    });

    it('accepts a valid ttl within range unchanged', async () => {
      const result = await useCase.execute({ id: 'img-1', ttl: 600 });
      const [, calledTtl] = storageService.getSignedUrl.mock.calls[0];
      expect(calledTtl).toBe(600);
      expect(result.ttl).toBe(600);
    });

    it('clamps ttl of 0 to TTL_MIN', async () => {
      const result = await useCase.execute({ id: 'img-1', ttl: 0 });
      expect(result.ttl).toBe(TTL_MIN);
    });

    it('clamps negative ttl to TTL_MIN', async () => {
      const result = await useCase.execute({ id: 'img-1', ttl: -100 });
      expect(result.ttl).toBe(TTL_MIN);
    });

    it('accepts exact TTL_MIN boundary (60 s)', async () => {
      const result = await useCase.execute({ id: 'img-1', ttl: TTL_MIN });
      expect(result.ttl).toBe(TTL_MIN);
    });

    it('accepts exact TTL_MAX boundary (3600 s)', async () => {
      const result = await useCase.execute({ id: 'img-1', ttl: TTL_MAX });
      expect(result.ttl).toBe(TTL_MAX);
    });

    it('uses TTL_DEFAULT when ttl is NaN (non-finite guard)', async () => {
      // NaN is a number in JS — ?? doesn't catch it — so we guard with Number.isFinite.
      const result = await useCase.execute({ id: 'img-1', ttl: NaN });
      expect(result.ttl).toBe(TTL_DEFAULT);
      const [, calledTtl] = storageService.getSignedUrl.mock.calls[0];
      expect(Number.isFinite(calledTtl)).toBe(true);
    });
  });

  describe('storage error', () => {
    it('propagates storage errors from getSignedUrl', async () => {
      storageService.getSignedUrl.mockRejectedValueOnce(new Error('S3 presign failed'));

      await expect(useCase.execute({ id: 'img-1' })).rejects.toThrow('S3 presign failed');
    });
  });
});
