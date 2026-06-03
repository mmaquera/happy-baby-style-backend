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
    getPublicUrl: jest.fn().mockReturnValue(''),
    validateFile: jest.fn().mockReturnValue(true),
    getBucketName: jest.fn().mockReturnValue('images'),
    getSignedUrl: jest.fn().mockResolvedValue('http://localhost/signed'),
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

  describe('magic-byte validation — ITEM C', () => {
    /**
     * Builds an upload file whose buffer has PNG magic bytes (89 50 4E 47)
     * but declares mimetype as image/png. This is a legitimate upload, so it
     * must succeed (the magic bytes match the declared type).
     */
    it('accepts a PNG file when MIME matches magic bytes', async () => {
      // PNG magic bytes followed by minimal content
      const pngMagic = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(100, 0), // padding so file-type has enough bytes
      ]);

      const file = {
        promise: Promise.resolve({
          filename: 'photo.png',
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
                      return Promise.resolve({ value: pngMagic, done: false as const });
                    }
                    return Promise.resolve({ value: undefined, done: true as const });
                  },
                };
              },
            };
          },
        }),
      };

      const result = await useCase.execute({
        file,
        entityType: ImageEntityType.PRODUCT,
        entityId: 'p1',
      });

      expect(result.id).toBe('img-1');
    });

    /**
     * SVG text content >= 4100 bytes declared as image/jpeg must be rejected.
     * file-type returns undefined for text content; the new >= 4100 path rejects it.
     */
    it('throws ValidationError when SVG text content declared as image/jpeg (text-as-binary spoofing)', async () => {
      // Build a large SVG buffer (>= 4100 bytes) so the "small buffer" exception does not apply.
      const svgPayload = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
        '<circle r="10"/>'.repeat(300) +
        '</svg>';
      const svgBuf = Buffer.from(svgPayload, 'utf8');
      expect(svgBuf.length).toBeGreaterThanOrEqual(4100); // sanity-check

      const file = {
        promise: Promise.resolve({
          filename: 'image.jpg',
          mimetype: 'image/jpeg',
          encoding: '7bit',
          createReadStream: () => {
            let done = false;
            return {
              [Symbol.asyncIterator]() {
                return {
                  next() {
                    if (!done) {
                      done = true;
                      return Promise.resolve({ value: svgBuf, done: false as const });
                    }
                    return Promise.resolve({ value: undefined, done: true as const });
                  },
                };
              },
            };
          },
        }),
      };

      await expect(
        useCase.execute({
          file,
          entityType: ImageEntityType.PRODUCT,
          entityId: 'p1',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    /**
     * A file with PNG magic bytes declared as image/jpeg is a MIME-spoofing attempt.
     * UploadImageUseCase.validateMagicBytes must throw ValidationError.
     *
     * Note: file-type v16 requires a real PNG header including IHDR chunk to reliably
     * detect PNG. We build a minimal but spec-compliant PNG header here.
     */
    it('throws ValidationError when PNG content is declared as image/jpeg (MIME spoofing)', async () => {
      // Minimal valid PNG: signature + IHDR chunk (13 bytes)
      // PNG signature: 8 bytes, then IHDR length(4) + "IHDR"(4) + 13 bytes data + CRC(4)
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      // IHDR chunk: length=13, type=IHDR, 1x1 pixel, 8bit depth, color type 2 (RGB), rest zeros
      const ihdrLength = Buffer.from([0x00, 0x00, 0x00, 0x0d]);
      const ihdrType = Buffer.from('IHDR', 'ascii');
      const ihdrData = Buffer.from([
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, 0x02,             // bit depth: 8, color type: 2 (RGB)
        0x00, 0x00, 0x00,       // compression, filter, interlace
      ]);
      const ihdrCrc = Buffer.from([0x90, 0x77, 0x53, 0xde]); // pre-computed CRC for this IHDR
      const pngBuffer = Buffer.concat([pngSignature, ihdrLength, ihdrType, ihdrData, ihdrCrc]);

      const file = {
        promise: Promise.resolve({
          filename: 'sneaky.jpg',  // client declares JPEG
          mimetype: 'image/jpeg',
          encoding: '7bit',
          createReadStream: () => {
            let done = false;
            return {
              [Symbol.asyncIterator]() {
                return {
                  next() {
                    if (!done) {
                      done = true;
                      return Promise.resolve({ value: pngBuffer, done: false as const });
                    }
                    return Promise.resolve({ value: undefined, done: true as const });
                  },
                };
              },
            };
          },
        }),
      };

      await expect(
        useCase.execute({
          file,
          entityType: ImageEntityType.PRODUCT,
          entityId: 'p1',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
