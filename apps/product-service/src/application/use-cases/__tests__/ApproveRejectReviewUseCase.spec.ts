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

jest.mock(
  '@hbs/authz',
  () => ({
    hasPermission: jest.fn(),
  }),
  { virtual: true },
);

import { ApproveReviewUseCase } from '../ApproveReviewUseCase';
import { RejectReviewUseCase } from '../RejectReviewUseCase';
import { IProductReviewRepository } from '../../../domain/repositories/IProductReviewRepository';
import { ProductReviewEntity } from '../../../domain/entities/ProductReview';
import { NotFoundError, BusinessLogicError, ValidationError, ForbiddenError } from '../../../domain/errors/DomainError';
import type { TokenPayload } from '@hbs/auth';
import { hasPermission } from '@hbs/authz';

// ── Factories ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: overrides.userId ?? 'mod-1',
    email: overrides.email ?? 'mod@test.com',
    groups: overrides.groups ?? ['customer-service'],
    permissions: overrides.permissions ?? ['reviews:moderate'],
  };
}

function makeReview(overrides: Partial<any> = {}): ProductReviewEntity {
  return new ProductReviewEntity(
    overrides.id ?? 'rev-1',
    overrides.productId ?? 'prod-1',
    overrides.userId ?? 'user-1',
    overrides.rating ?? 4,
    overrides.isApproved ?? false,
    false,
    0,
    overrides.status ?? 'pending',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    overrides.title,
    overrides.comment,
  );
}

function makeRepo(overrides: Partial<IProductReviewRepository> = {}): jest.Mocked<IProductReviewRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByProduct: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    approve: jest.fn().mockResolvedValue(makeReview({ status: 'approved', isApproved: true })),
    reject: jest.fn().mockResolvedValue(makeReview({ status: 'rejected', isApproved: false })),
    ...overrides,
  } as jest.Mocked<IProductReviewRepository>;
}

// ── ApproveReviewUseCase tests ─────────────────────────────────────────────────

describe('ApproveReviewUseCase', () => {
  beforeEach(() => {
    // Default: user has the permission
    (hasPermission as jest.Mock).mockReset().mockReturnValue(true);
  });

  describe('happy path', () => {
    it('approves a pending review and returns approved entity', async () => {
      const approved = makeReview({ status: 'approved', isApproved: true });
      const repo = makeRepo({ approve: jest.fn().mockResolvedValue(approved) });
      const useCase = new ApproveReviewUseCase(repo);
      const moderator = makeUser();

      const result = await useCase.execute('rev-1', moderator);

      expect(result.status).toBe('approved');
      expect(result.isApproved).toBe(true);
      expect(repo.approve).toHaveBeenCalledWith('rev-1');
      expect(hasPermission).toHaveBeenCalledWith(moderator, 'reviews:moderate');
    });
  });

  describe('authorization', () => {
    it('throws ForbiddenError when user lacks reviews:moderate permission', async () => {
      (hasPermission as jest.Mock).mockReturnValue(false);
      const repo = makeRepo();
      const useCase = new ApproveReviewUseCase(repo);
      const unprivilegedUser = makeUser({ permissions: [] });

      await expect(useCase.execute('rev-1', unprivilegedUser)).rejects.toBeInstanceOf(ForbiddenError);
      // Verify the injected repo was NOT called — the ForbiddenError short-circuits before any DB operation.
      expect(repo.approve).not.toHaveBeenCalled();
    });
  });

  describe('not found', () => {
    it('propagates NotFoundError when review does not exist', async () => {
      const repo = makeRepo({ approve: jest.fn().mockRejectedValue(new NotFoundError('ProductReview', 'rev-99')) });
      const useCase = new ApproveReviewUseCase(repo);

      await expect(useCase.execute('rev-99', makeUser())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('illegal state transition', () => {
    it('propagates BusinessLogicError when review is already approved (double-approval)', async () => {
      const repo = makeRepo({
        approve: jest.fn().mockRejectedValue(
          new BusinessLogicError('Review is already approved (id: rev-1)'),
        ),
      });
      const useCase = new ApproveReviewUseCase(repo);

      await expect(useCase.execute('rev-1', makeUser())).rejects.toBeInstanceOf(BusinessLogicError);
    });

    it('propagates BusinessLogicError when trying to approve an already-rejected review', async () => {
      const repo = makeRepo({
        approve: jest.fn().mockRejectedValue(
          new BusinessLogicError('Cannot approve a review that is already rejected (id: rev-1)'),
        ),
      });
      const useCase = new ApproveReviewUseCase(repo);

      await expect(useCase.execute('rev-1', makeUser())).rejects.toBeInstanceOf(BusinessLogicError);
    });
  });

  describe('validation', () => {
    it('throws ValidationError when id is empty', async () => {
      const useCase = new ApproveReviewUseCase(makeRepo());
      await expect(useCase.execute('', makeUser())).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

// ── RejectReviewUseCase tests ──────────────────────────────────────────────────

describe('RejectReviewUseCase', () => {
  beforeEach(() => {
    // Default: user has the permission
    (hasPermission as jest.Mock).mockReset().mockReturnValue(true);
  });

  describe('happy path', () => {
    it('rejects a pending review and returns rejected entity', async () => {
      const rejected = makeReview({ status: 'rejected', isApproved: false });
      const repo = makeRepo({ reject: jest.fn().mockResolvedValue(rejected) });
      const useCase = new RejectReviewUseCase(repo);
      const moderator = makeUser();

      const result = await useCase.execute('rev-1', moderator);

      expect(result.status).toBe('rejected');
      expect(result.isApproved).toBe(false);
      expect(repo.reject).toHaveBeenCalledWith('rev-1');
      expect(hasPermission).toHaveBeenCalledWith(moderator, 'reviews:moderate');
    });
  });

  describe('authorization', () => {
    it('throws ForbiddenError when user lacks reviews:moderate permission', async () => {
      (hasPermission as jest.Mock).mockReturnValue(false);
      const repo = makeRepo();
      const useCase = new RejectReviewUseCase(repo);
      const unprivilegedUser = makeUser({ permissions: [] });

      await expect(useCase.execute('rev-1', unprivilegedUser)).rejects.toBeInstanceOf(ForbiddenError);
      // Verify the injected repo was NOT called — the ForbiddenError short-circuits before any DB operation.
      expect(repo.reject).not.toHaveBeenCalled();
    });
  });

  describe('not found', () => {
    it('propagates NotFoundError when review does not exist', async () => {
      const repo = makeRepo({ reject: jest.fn().mockRejectedValue(new NotFoundError('ProductReview', 'rev-99')) });
      const useCase = new RejectReviewUseCase(repo);

      await expect(useCase.execute('rev-99', makeUser())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('illegal state transition', () => {
    it('propagates BusinessLogicError when review is already rejected (double-rejection)', async () => {
      const repo = makeRepo({
        reject: jest.fn().mockRejectedValue(
          new BusinessLogicError('Review is already rejected (id: rev-1)'),
        ),
      });
      const useCase = new RejectReviewUseCase(repo);

      await expect(useCase.execute('rev-1', makeUser())).rejects.toBeInstanceOf(BusinessLogicError);
    });

    it('propagates BusinessLogicError when trying to reject an already-approved review', async () => {
      const repo = makeRepo({
        reject: jest.fn().mockRejectedValue(
          new BusinessLogicError('Cannot reject a review that is already approved (id: rev-1)'),
        ),
      });
      const useCase = new RejectReviewUseCase(repo);

      await expect(useCase.execute('rev-1', makeUser())).rejects.toBeInstanceOf(BusinessLogicError);
    });
  });

  describe('validation', () => {
    it('throws ValidationError when id is empty', async () => {
      const useCase = new RejectReviewUseCase(makeRepo());
      await expect(useCase.execute('', makeUser())).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
