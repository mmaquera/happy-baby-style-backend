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

// SvgValidationService performs real validation — mock it out so tests focus on security logic.
// sanitizeSvgContent is a jest.fn() that passes the content through so the
// use case can continue without DOMPurify, but is still spy-able.
jest.mock('../../validation/SvgValidationService', () => ({
  SvgValidationService: {
    validateSvgUploadRequest: jest.fn(),
    validateSvgFile: jest.fn(),
    validateSvgContent: jest.fn(),
    sanitizeSvgContent: jest.fn((c: string) => c),
    validateSvgDimensions: jest.fn(),
    validateViewBox: jest.fn(),
  },
}));

import { UploadSvgUseCase } from '../UploadSvgUseCase';
import type { ISvgRepository } from '../../../domain/repositories/ISvgRepository';
import type { IStorageService } from '../../../domain/interfaces/IStorageService';
import { SvgEntity, SvgEntityType } from '../../../domain/entities/Svg';
import { NotFoundError, ValidationError } from '@hbs/shared-kernel';
import { UserRole } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeSvgEntity(): SvgEntity {
  return new SvgEntity(
    'svg-1',
    'icon_cat_123.svg',
    'icon.svg',
    'image/svg+xml',
    1024,
    '/uploads/categorys/cat-1/icon_cat_123.svg',
    'local',
    'categorys/cat-1/icon_cat_123.svg',
    SvgEntityType.CATEGORY,
    'cat-1',
    new Date(),
    undefined,
    undefined,
    false,
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
 * Minimal file object whose buffer is readable by the SVG content reader path.
 * SvgValidationService is mocked so content checks are skipped.
 */
function makeUploadFile() {
  const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>';
  return {
    buffer: Buffer.from(svgContent, 'utf8'),
    filename: 'icon.svg',
    mimetype: 'image/svg+xml',
    size: svgContent.length,
    encoding: '7bit',
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeSvgRepo(): jest.Mocked<ISvgRepository> {
  const saved = makeSvgEntity();
  return {
    create: jest.fn().mockResolvedValue(saved),
    findById: jest.fn().mockResolvedValue(null),
    findByEntity: jest.fn().mockResolvedValue([]),
    findByFileName: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
    findAll: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findByEntityType: jest.fn().mockResolvedValue([]),
  } as jest.Mocked<ISvgRepository>;
}

function makeStorageService(): jest.Mocked<IStorageService> {
  return {
    uploadFile: jest
      .fn()
      .mockResolvedValue('/uploads/categorys/cat-1/icon_cat_123.svg'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UploadSvgUseCase', () => {
  let svgRepo: jest.Mocked<ISvgRepository>;
  let storageService: jest.Mocked<IStorageService>;
  let useCase: UploadSvgUseCase;

  beforeEach(() => {
    svgRepo = makeSvgRepo();
    storageService = makeStorageService();
    useCase = new UploadSvgUseCase(svgRepo, storageService);
  });

  describe('happy path — write allowed', () => {
    it('creates SVG and forwards currentUser to repository', async () => {
      const currentUser = makeUser();
      const file = makeUploadFile();

      const result = await useCase.execute({
        file,
        entityType: SvgEntityType.CATEGORY,
        entityId: 'cat-1',
        currentUser,
      });

      expect(storageService.uploadFile).toHaveBeenCalledTimes(1);
      expect(svgRepo.create).toHaveBeenCalledTimes(1);
      // currentUser forwarded as second arg
      expect(svgRepo.create).toHaveBeenCalledWith(expect.any(SvgEntity), currentUser);
      expect(result.id).toBe('svg-1');
    });

    it('passes null currentUser when omitted from request', async () => {
      const file = makeUploadFile();

      await useCase.execute({
        file,
        entityType: SvgEntityType.CATEGORY,
        entityId: 'cat-1',
      });

      expect(svgRepo.create).toHaveBeenCalledWith(expect.any(SvgEntity), null);
    });

    it('sanitizes SVG content server-side regardless of any flag (Control 1)', async () => {
      const { SvgValidationService } = require('../../validation/SvgValidationService');
      const file = makeUploadFile();

      await useCase.execute({
        file,
        entityType: SvgEntityType.CATEGORY,
        entityId: 'cat-1',
        // No sanitize arg — must always sanitize
      });

      // sanitizeSvgContent must have been called
      expect(SvgValidationService.sanitizeSvgContent).toHaveBeenCalled();
    });
  });

  describe('entityId validation — Control 5 (via SvgValidationService)', () => {
    // entityId validation lives in SvgValidationService.validateSvgUploadRequest.
    // The use-case spec mocks that method; we test entityId format directly on
    // SvgValidationService to keep these tests deterministic.
    it('validateSvgUploadRequest throws InvalidFormatError for entityId with path traversal', () => {
      const { SvgValidationService: Real } = jest.requireActual<
        typeof import('../../validation/SvgValidationService')
      >('../../validation/SvgValidationService');

      expect(() =>
        Real.validateSvgUploadRequest({
          file: makeUploadFile(),
          entityType: SvgEntityType.CATEGORY,
          entityId: '../etc/passwd',
        }),
      ).toThrow();
    });

    it('validateSvgUploadRequest throws for entityId with slash', () => {
      const { SvgValidationService: Real } = jest.requireActual<
        typeof import('../../validation/SvgValidationService')
      >('../../validation/SvgValidationService');

      expect(() =>
        Real.validateSvgUploadRequest({
          file: makeUploadFile(),
          entityType: SvgEntityType.ICON,
          entityId: 'icons/bad',
        }),
      ).toThrow();
    });

    it('accepts valid entityId with hyphens and underscores (use case level)', async () => {
      const file = makeUploadFile();

      const result = await useCase.execute({
        file,
        entityType: SvgEntityType.CATEGORY,
        entityId: 'cat-1_foo',
      });

      expect(result.id).toBe('svg-1');
    });
  });

  describe('record-rule write denial', () => {
    it('propagates NotFoundError when repo.create rejects due to a DENY record rule', async () => {
      svgRepo.create.mockRejectedValueOnce(new NotFoundError('Image', 'svg-1'));
      const currentUser = makeUser();
      const file = makeUploadFile();

      await expect(
        useCase.execute({
          file,
          entityType: SvgEntityType.CATEGORY,
          entityId: 'cat-1',
          currentUser,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
