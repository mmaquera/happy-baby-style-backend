/**
 * Resolver RBAC guard tests — Control 2.
 *
 * These tests exercise the authorization layer in createResolvers() by calling
 * the resolver functions directly with mocked repositories and a controlled
 * context.currentUser. They do NOT test business logic (that belongs in use-case
 * specs); they only assert that the guard throws or passes before the use case runs.
 */

jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
        createServiceLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
        createRepositoryLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
      }),
    },
  }),
  { virtual: true },
);

// Mock the use cases so the guard tests never reach actual business logic.
jest.mock('../../application/use-cases/UploadImageUseCase', () => ({
  UploadImageUseCase: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({
      id: 'img-test',
      fileName: 'test.jpg',
      url: '/uploads/test.jpg',
      mimeType: 'image/jpeg',
      size: 100,
      bucket: 'images',
      path: 'products/p1/test.jpg',
      entityType: 'product',
      entityId: 'p1',
      createdAt: new Date(),
    }),
  })),
}));

jest.mock('../../application/use-cases/UploadSvgUseCase', () => ({
  UploadSvgUseCase: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({
      id: 'svg-test',
      fileName: 'icon.svg',
      url: '/uploads/icon.svg',
      mimeType: 'image/svg+xml',
      size: 100,
      bucket: 'local',
      path: 'icons/icon.svg',
      entityType: 'icon',
      entityId: 'ico-1',
      createdAt: new Date(),
      dimensions: undefined,
      viewBox: undefined,
      optimized: false,
    }),
  })),
}));

import { createResolvers } from '../resolvers';
import { UserRole } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeImageRepo(): any {
  return { create: jest.fn(), findById: jest.fn(), findAll: jest.fn(), findByEntityId: jest.fn(), delete: jest.fn(), deleteByEntityId: jest.fn() };
}

function makeSvgRepo(): any {
  return { create: jest.fn(), findById: jest.fn(), findByEntity: jest.fn(), findByFileName: jest.fn(), update: jest.fn(), delete: jest.fn(), findAll: jest.fn(), count: jest.fn(), findByEntityType: jest.fn() };
}

function makeStorageService(): any {
  return { uploadFile: jest.fn(), deleteFile: jest.fn() };
}

// Minimal fake Upload scalar so the resolver doesn't crash on missing .promise
function makeFakeFile() {
  return {
    promise: Promise.resolve({
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      encoding: '7bit',
      createReadStream: jest.fn(),
    }),
  };
}

function makeContext(user: TokenPayload | null) {
  return { currentUser: user, req: { headers: {} } };
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

function makeCustomer(userId = 'user-customer'): TokenPayload {
  return {
    userId,
    email: 'customer@test.com',
    role: UserRole.CUSTOMER,
    permissions: [],
    groups: ['customer'],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createResolvers — RBAC guards (Control 2)', () => {
  let resolvers: ReturnType<typeof createResolvers>;

  beforeEach(() => {
    resolvers = createResolvers(makeImageRepo(), makeSvgRepo(), makeStorageService());
  });

  // ── uploadImage ──────────────────────────────────────────────────────────

  describe('uploadImage', () => {
    it('allows an admin to upload a product image', async () => {
      const ctx = makeContext(makeUser());
      const result = await resolvers.Mutation.uploadImage(
        {},
        { file: makeFakeFile(), entityType: 'product', entityId: 'p1' },
        ctx,
      );
      expect(result.success).toBe(true);
    });

    it('allows a user to upload their own avatar (entityType=user, entityId=own userId)', async () => {
      const customer = makeCustomer('user-42');
      const ctx = makeContext(customer);
      const result = await resolvers.Mutation.uploadImage(
        {},
        { file: makeFakeFile(), entityType: 'user', entityId: 'user-42' },
        ctx,
      );
      expect(result.success).toBe(true);
    });

    it('denies a customer uploading a product image (not their entity type)', async () => {
      const customer = makeCustomer('user-42');
      const ctx = makeContext(customer);
      await expect(
        resolvers.Mutation.uploadImage(
          {},
          { file: makeFakeFile(), entityType: 'product', entityId: 'p1' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    });

    it("denies a customer uploading another user's avatar (BOLA write)", async () => {
      const customer = makeCustomer('user-42');
      const ctx = makeContext(customer);
      await expect(
        resolvers.Mutation.uploadImage(
          {},
          { file: makeFakeFile(), entityType: 'user', entityId: 'user-99' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    });

    it('denies unauthenticated upload', async () => {
      const ctx = makeContext(null);
      await expect(
        resolvers.Mutation.uploadImage(
          {},
          { file: makeFakeFile(), entityType: 'product', entityId: 'p1' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    });

    it('allows RBAC administrator (groups only, role=CUSTOMER) to upload avatar for any user', async () => {
      // Finding 4 — RBAC admins with groups but legacy role=CUSTOMER should pass owner check
      const rbacAdmin = makeCustomer('rbac-admin-42');
      rbacAdmin.groups = ['administrators'];
      const ctx = makeContext(rbacAdmin);
      const result = await resolvers.Mutation.uploadImage(
        {},
        { file: makeFakeFile(), entityType: 'user', entityId: 'user-99' },
        ctx,
      );
      expect(result.success).toBe(true);
    });

    it('guard is case-insensitive for entityType (Finding 6)', async () => {
      // entityType='USER' (uppercase) should still route to the owner check, not management check
      const customer = makeCustomer('user-42');
      const ctx = makeContext(customer);
      // customer uploading their own avatar with uppercase entityType — should succeed
      const result = await resolvers.Mutation.uploadImage(
        {},
        { file: makeFakeFile(), entityType: 'USER', entityId: 'user-42' },
        ctx,
      );
      expect(result.success).toBe(true);
    });
  });

  // ── uploadSvg ────────────────────────────────────────────────────────────

  describe('uploadSvg', () => {
    it('allows an admin to upload an icon SVG', async () => {
      const ctx = makeContext(makeUser());
      const result = await resolvers.Mutation.uploadSvg(
        {},
        { file: makeFakeFile(), entityType: 'icon', entityId: 'ico-1' },
        ctx,
      );
      expect(result.success).toBe(true);
    });

    it('allows a user to upload their own SVG avatar (entityType=user, own userId)', async () => {
      const customer = makeCustomer('user-42');
      const ctx = makeContext(customer);
      const result = await resolvers.Mutation.uploadSvg(
        {},
        { file: makeFakeFile(), entityType: 'user', entityId: 'user-42' },
        ctx,
      );
      expect(result.success).toBe(true);
    });

    it('denies a customer uploading an icon SVG (non-user entityType)', async () => {
      const customer = makeCustomer('user-42');
      const ctx = makeContext(customer);
      await expect(
        resolvers.Mutation.uploadSvg(
          {},
          { file: makeFakeFile(), entityType: 'icon', entityId: 'ico-1' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    });

    it("denies a customer uploading another user's SVG avatar (BOLA write)", async () => {
      const customer = makeCustomer('user-42');
      const ctx = makeContext(customer);
      await expect(
        resolvers.Mutation.uploadSvg(
          {},
          { file: makeFakeFile(), entityType: 'user', entityId: 'user-99' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
    });

    it('denies unauthenticated SVG upload', async () => {
      const ctx = makeContext(null);
      await expect(
        resolvers.Mutation.uploadSvg(
          {},
          { file: makeFakeFile(), entityType: 'icon', entityId: 'ico-1' },
          ctx,
        ),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    });
  });
});

// ---------------------------------------------------------------------------
// Pagination — imagesByEntity and svgsByEntity
// ---------------------------------------------------------------------------

describe('createResolvers — pagination (imagesByEntity / svgsByEntity)', () => {
  let imageRepo: ReturnType<typeof makeImageRepo>;
  let svgRepo: ReturnType<typeof makeSvgRepo>;
  let resolvers: ReturnType<typeof createResolvers>;

  function makeImageRepo() {
    return {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByEntityId: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      deleteByEntityId: jest.fn(),
    };
  }

  function makeSvgRepo() {
    return {
      create: jest.fn(),
      findById: jest.fn(),
      findByEntity: jest.fn().mockResolvedValue([]),
      findByFileName: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      findByEntityType: jest.fn(),
    };
  }

  beforeEach(() => {
    imageRepo = makeImageRepo();
    svgRepo = makeSvgRepo();
    resolvers = createResolvers(imageRepo, svgRepo, { uploadFile: jest.fn(), deleteFile: jest.fn() } as any);
  });

  describe('imagesByEntity', () => {
    it('passes default limit=50 and offset=0 when no pagination args given', async () => {
      await resolvers.Query.imagesByEntity({}, { entityId: 'p1', entityType: 'product' as any });
      expect(imageRepo.findByEntityId).toHaveBeenCalledWith('p1', 'product', 50, 0);
    });

    it('passes caller-supplied limit and offset', async () => {
      await resolvers.Query.imagesByEntity(
        {},
        { entityId: 'p1', entityType: 'product' as any, limit: 10, offset: 20 },
      );
      expect(imageRepo.findByEntityId).toHaveBeenCalledWith('p1', 'product', 10, 20);
    });

    it('caps limit at 100 when caller passes a value above 100', async () => {
      await resolvers.Query.imagesByEntity(
        {},
        { entityId: 'p1', entityType: 'product' as any, limit: 999, offset: 0 },
      );
      expect(imageRepo.findByEntityId).toHaveBeenCalledWith('p1', 'product', 100, 0);
    });
  });

  describe('svgsByEntity', () => {
    it('passes default limit=50 and offset=0 when no pagination args given', async () => {
      await resolvers.Query.svgsByEntity({}, { entityType: 'product' as any, entityId: 'p1' });
      expect(svgRepo.findByEntity).toHaveBeenCalledWith('product', 'p1', 50, 0);
    });

    it('passes caller-supplied limit and offset', async () => {
      await resolvers.Query.svgsByEntity(
        {},
        { entityType: 'icon' as any, entityId: 'ico-1', limit: 5, offset: 10 },
      );
      expect(svgRepo.findByEntity).toHaveBeenCalledWith('icon', 'ico-1', 5, 10);
    });

    it('caps limit at 100 when caller passes a value above 100', async () => {
      await resolvers.Query.svgsByEntity(
        {},
        { entityType: 'icon' as any, entityId: 'ico-1', limit: 500 },
      );
      expect(svgRepo.findByEntity).toHaveBeenCalledWith('icon', 'ico-1', 100, 0);
    });
  });
});
