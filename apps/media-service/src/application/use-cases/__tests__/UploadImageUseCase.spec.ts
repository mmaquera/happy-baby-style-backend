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

import { UploadImageUseCase } from '../UploadImageUseCase';
import type { IImageRepository } from '../../../domain/repositories/IImageRepository';
import type { IStorageService } from '../../../domain/interfaces/IStorageService';
import { ImageEntity, ImageEntityType } from '../../../domain/entities/Image';
import { NotFoundError, ValidationError } from '@hbs/shared-kernel';
import { UserRole } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeImageEntity(): ImageEntity {
  return new ImageEntity(
    'img-1',
    'product_p1_123.jpg',
    'photo.jpg',
    'image/jpeg',
    50000,
    '/uploads/products/p1/product_p1_123.jpg',
    'images',
    'products/p1/product_p1_123.jpg',
    ImageEntityType.PRODUCT,
    'p1',
    new Date(),
  );
}

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-admin',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    permissions: ['manage:system'],
    groups: ['administrators'],
    ...overrides,
  };
}

/**
 * Minimal graphql-upload-style file object.
 * UploadImageUseCase reads through the stream; we mock imageRepository.create so
 * the actual bytes don't matter — only the call to create is verified.
 */
function makeUploadFile(mimetype = 'image/jpeg') {
  const fakeBytes = Buffer.from('fake-image-bytes');
  return {
    promise: Promise.resolve({
      filename: 'photo.jpg',
      mimetype,
      encoding: '7bit',
      createReadStream: () => {
        let done = false;
        return {
          [Symbol.asyncIterator]() {
            return {
              next() {
                if (!done) {
                  done = true;
                  return Promise.resolve({ value: fakeBytes, done: false as const });
                }
                return Promise.resolve({ value: undefined, done: true as const });
              },
            };
          },
        };
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeImageRepo(): jest.Mocked<IImageRepository> {
  const saved = makeImageEntity();
  return {
    create: jest.fn().mockResolvedValue(saved),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByEntityId: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByEntityId: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IImageRepository>;
}

function makeStorageService(): jest.Mocked<IStorageService> {
  return {
    uploadFile: jest.fn().mockResolvedValue('/uploads/products/p1/product_p1_123.jpg'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UploadImageUseCase', () => {
  let imageRepo: jest.Mocked<IImageRepository>;
  let storageService: jest.Mocked<IStorageService>;
  let useCase: UploadImageUseCase;

  beforeEach(() => {
    imageRepo = makeImageRepo();
    storageService = makeStorageService();
    useCase = new UploadImageUseCase(imageRepo, storageService);
  });

  describe('happy path — write allowed', () => {
    it('creates image and forwards currentUser to repository', async () => {
      const currentUser = makeUser();
      const file = makeUploadFile();

      const result = await useCase.execute({
        file,
        entityType: ImageEntityType.PRODUCT,
        entityId: 'p1',
        currentUser,
      });

      expect(storageService.uploadFile).toHaveBeenCalledTimes(1);
      expect(imageRepo.create).toHaveBeenCalledTimes(1);
      // second arg must be the caller's TokenPayload
      expect(imageRepo.create).toHaveBeenCalledWith(expect.any(ImageEntity), currentUser);
      expect(result.id).toBe('img-1');
    });

    it('passes null currentUser when omitted from request', async () => {
      const file = makeUploadFile();

      await useCase.execute({
        file,
        entityType: ImageEntityType.PRODUCT,
        entityId: 'p1',
      });

      expect(imageRepo.create).toHaveBeenCalledWith(expect.any(ImageEntity), null);
    });

    it('derives extension from MIME type, not from client filename (Control 7)', async () => {
      // File has .jpg in its name, but we supply image/png MIME — extension must be .png
      const fakeBytes = Buffer.from('fake-image-bytes');
      const file = {
        promise: Promise.resolve({
          filename: 'sneaky.jpg',  // client-supplied — must be ignored for extension
          mimetype: 'image/png',
          encoding: '7bit',
          createReadStream: () => {
            let done = false;
            return {
              [Symbol.asyncIterator]() {
                return {
                  next() {
                    if (!done) {
                      done = true;
                      return Promise.resolve({ value: fakeBytes, done: false as const });
                    }
                    return Promise.resolve({ value: undefined, done: true as const });
                  },
                };
              },
            };
          },
        }),
      };

      await useCase.execute({
        file,
        entityType: ImageEntityType.PRODUCT,
        entityId: 'p1',
      });

      const [, capturedFileName] = storageService.uploadFile.mock.calls[0];
      expect(capturedFileName).toMatch(/\.png$/);
    });
  });

  describe('entityId validation — Control 5', () => {
    it('throws ValidationError for entityId with path traversal characters', async () => {
      const file = makeUploadFile();

      await expect(
        useCase.execute({
          file,
          entityType: ImageEntityType.PRODUCT,
          entityId: '../etc/passwd',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError for entityId with slash', async () => {
      const file = makeUploadFile();

      await expect(
        useCase.execute({
          file,
          entityType: ImageEntityType.PRODUCT,
          entityId: 'product/123',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('accepts valid entityId with alphanumeric, hyphens, and underscores', async () => {
      const file = makeUploadFile();

      const result = await useCase.execute({
        file,
        entityType: ImageEntityType.PRODUCT,
        entityId: 'product-123_abc',
      });

      expect(result.id).toBe('img-1');
    });
  });

  describe('record-rule write denial', () => {
    it('propagates NotFoundError when repo.create rejects due to a DENY record rule', async () => {
      imageRepo.create.mockRejectedValueOnce(new NotFoundError('Image', 'img-1'));
      const currentUser = makeUser();
      const file = makeUploadFile();

      await expect(
        useCase.execute({
          file,
          entityType: ImageEntityType.PRODUCT,
          entityId: 'p1',
          currentUser,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
