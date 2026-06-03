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

import { DeleteImageUseCase } from '../DeleteImageUseCase';
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
    overrides.url ?? 'http://localhost:3004/uploads/products/p1/product_p1_123.jpg',
    overrides.bucket ?? 'images',
    overrides.path ?? 'products/p1/product_p1_123.jpg',
    overrides.entityType ?? ImageEntityType.PRODUCT,
    overrides.entityId ?? 'p1',
    overrides.createdAt ?? new Date(),
  );
}

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-admin',
    email: 'admin@test.com',
    permissions: ['manage:system'],
    groups: ['administrators'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeImageRepo(
  found: ImageEntity | null = makeImageEntity(),
): jest.Mocked<IImageRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(found),
    findAll: jest.fn().mockResolvedValue([]),
    findByEntityId: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByEntityId: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IImageRepository>;
}

function makeStorageService(): jest.Mocked<IStorageService> {
  return {
    uploadFile: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn().mockReturnValue(''),
    validateFile: jest.fn().mockReturnValue(true),
    getBucketName: jest.fn().mockReturnValue('local'),
    getSignedUrl: jest.fn().mockResolvedValue('http://localhost/signed'),
  } as jest.Mocked<IStorageService>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeleteImageUseCase', () => {
  let imageRepo: jest.Mocked<IImageRepository>;
  let storageService: jest.Mocked<IStorageService>;
  let useCase: DeleteImageUseCase;

  beforeEach(() => {
    imageRepo = makeImageRepo();
    storageService = makeStorageService();
    useCase = new DeleteImageUseCase(imageRepo, storageService);
  });

  describe('happy path', () => {
    it('deletes the physical file and the DB record', async () => {
      const currentUser = makeUser();

      await useCase.execute({ id: 'img-1', currentUser });

      expect(imageRepo.findById).toHaveBeenCalledWith('img-1');
      expect(storageService.deleteFile).toHaveBeenCalledTimes(1);
      expect(imageRepo.delete).toHaveBeenCalledWith('img-1', currentUser);
    });

    it('passes the fileUrl from the found entity to storageService.deleteFile', async () => {
      const entity = makeImageEntity({
        url: 'http://localhost:3004/uploads/products/p1/img.jpg',
      });
      imageRepo = makeImageRepo(entity);
      useCase = new DeleteImageUseCase(imageRepo, storageService);

      await useCase.execute({ id: 'img-1' });

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'http://localhost:3004/uploads/products/p1/img.jpg',
      );
    });

    it('passes null currentUser to repository when omitted from request', async () => {
      await useCase.execute({ id: 'img-1' });

      expect(imageRepo.delete).toHaveBeenCalledWith('img-1', null);
    });
  });

  describe('not found', () => {
    it('throws NotFoundError when image does not exist', async () => {
      imageRepo = makeImageRepo(null);
      useCase = new DeleteImageUseCase(imageRepo, storageService);

      await expect(useCase.execute({ id: 'img-missing' })).rejects.toBeInstanceOf(NotFoundError);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(imageRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('storage failure — ITEM E coherence', () => {
    it('still deletes the DB record when storage deletion fails, then surfaces the storage error', async () => {
      storageService.deleteFile.mockRejectedValueOnce(new Error('disk full'));

      await expect(useCase.execute({ id: 'img-1' })).rejects.toThrow('disk full');

      // DB record must still have been deleted despite the storage failure
      expect(imageRepo.delete).toHaveBeenCalledWith('img-1', null);
    });
  });

  describe('record-rule write denial', () => {
    it('propagates NotFoundError when repository.delete rejects due to DENY record rule', async () => {
      imageRepo.delete.mockRejectedValueOnce(new NotFoundError('Image', 'img-1'));

      await expect(useCase.execute({ id: 'img-1' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
