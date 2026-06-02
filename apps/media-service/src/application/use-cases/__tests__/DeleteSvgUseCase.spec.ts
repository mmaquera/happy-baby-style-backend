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

import { DeleteSvgUseCase } from '../DeleteSvgUseCase';
import type { ISvgRepository } from '../../../domain/repositories/ISvgRepository';
import type { IStorageService } from '../../../domain/interfaces/IStorageService';
import { SvgEntity, SvgEntityType } from '../../../domain/entities/Svg';
import { NotFoundError } from '@hbs/shared-kernel';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeSvgEntity(overrides: Partial<SvgEntity> = {}): SvgEntity {
  return new SvgEntity(
    overrides.id ?? 'svg-1',
    overrides.fileName ?? 'icon_cat_123.svg',
    overrides.originalName ?? 'icon.svg',
    overrides.mimeType ?? 'image/svg+xml',
    overrides.size ?? 1024,
    overrides.url ?? 'http://localhost:3004/uploads/categorys/cat-1/icon_cat_123.svg',
    overrides.bucket ?? 'local',
    overrides.path ?? 'categorys/cat-1/icon_cat_123.svg',
    overrides.entityType ?? SvgEntityType.CATEGORY,
    overrides.entityId ?? 'cat-1',
    overrides.createdAt ?? new Date(),
    overrides.dimensions,
    overrides.viewBox,
    overrides.optimized ?? false,
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

function makeSvgRepo(found: SvgEntity | null = makeSvgEntity()): jest.Mocked<ISvgRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(found),
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
    uploadFile: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest.fn().mockReturnValue(''),
    validateFile: jest.fn().mockReturnValue(true),
    getBucketName: jest.fn().mockReturnValue('local'),
  } as jest.Mocked<IStorageService>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeleteSvgUseCase', () => {
  let svgRepo: jest.Mocked<ISvgRepository>;
  let storageService: jest.Mocked<IStorageService>;
  let useCase: DeleteSvgUseCase;

  beforeEach(() => {
    svgRepo = makeSvgRepo();
    storageService = makeStorageService();
    useCase = new DeleteSvgUseCase(svgRepo, storageService);
  });

  describe('happy path', () => {
    it('deletes the physical file and the DB record, returns true', async () => {
      const currentUser = makeUser();

      const result = await useCase.execute({ id: 'svg-1', currentUser });

      expect(svgRepo.findById).toHaveBeenCalledWith('svg-1');
      expect(storageService.deleteFile).toHaveBeenCalledTimes(1);
      expect(svgRepo.delete).toHaveBeenCalledWith('svg-1', currentUser);
      expect(result).toBe(true);
    });

    it('passes the fileUrl from the found entity to storageService.deleteFile', async () => {
      const entity = makeSvgEntity({
        url: 'http://localhost:3004/uploads/categorys/cat-1/icon.svg',
      });
      svgRepo = makeSvgRepo(entity);
      useCase = new DeleteSvgUseCase(svgRepo, storageService);

      await useCase.execute({ id: 'svg-1' });

      expect(storageService.deleteFile).toHaveBeenCalledWith(
        'http://localhost:3004/uploads/categorys/cat-1/icon.svg',
      );
    });

    it('passes null currentUser to repository when omitted from request', async () => {
      await useCase.execute({ id: 'svg-1' });

      expect(svgRepo.delete).toHaveBeenCalledWith('svg-1', null);
    });
  });

  describe('not found', () => {
    it('throws NotFoundError when SVG does not exist', async () => {
      svgRepo = makeSvgRepo(null);
      useCase = new DeleteSvgUseCase(svgRepo, storageService);

      await expect(useCase.execute({ id: 'svg-missing' })).rejects.toBeInstanceOf(NotFoundError);

      expect(storageService.deleteFile).not.toHaveBeenCalled();
      expect(svgRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('storage failure — ITEM E coherence', () => {
    it('still deletes the DB record when storage deletion fails, then surfaces the storage error', async () => {
      storageService.deleteFile.mockRejectedValueOnce(new Error('S3 unreachable'));

      await expect(useCase.execute({ id: 'svg-1' })).rejects.toThrow('S3 unreachable');

      // DB record must still have been deleted despite the storage failure
      expect(svgRepo.delete).toHaveBeenCalledWith('svg-1', null);
    });
  });

  describe('record-rule write denial', () => {
    it('propagates NotFoundError when repository.delete rejects due to DENY record rule', async () => {
      svgRepo.delete.mockRejectedValueOnce(new NotFoundError('Svg', 'svg-1'));

      await expect(useCase.execute({ id: 'svg-1' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
