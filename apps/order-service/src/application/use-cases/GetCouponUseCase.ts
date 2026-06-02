import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import type {
  ICouponRepository,
  CouponData,
  CouponUsageData,
} from '../../domain/repositories/ICouponRepository';
import {
  assertOrderManagementAccess,
  assertOwnerOrOrderManagement,
} from './guards/orderAuthGuards';

export class GetCouponsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCouponsUseCase');
  }

  /**
   * Returns all coupons including inactive ones and usage limits.
   * Restricted to management/admin — exposes sensitive business configuration.
   */
  async execute(currentUser: TokenPayload | null): Promise<CouponData[]> {
    assertOrderManagementAccess(currentUser);

    const results = await this.couponRepository.findAll();
    this.logger.info('Coupons retrieved', {
      requesterId: currentUser!.userId,
      count: results.length,
    });
    return results;
  }
}

export class GetCouponByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCouponByIdUseCase');
  }

  /**
   * Returns a coupon by id.
   * Restricted to management/admin.
   * Returns NotFoundError when the coupon does not exist.
   */
  async execute(id: string, currentUser: TokenPayload | null): Promise<CouponData> {
    assertOrderManagementAccess(currentUser);

    const coupon = await this.couponRepository.findById(id);
    if (!coupon) {
      throw new NotFoundError('Coupon', id);
    }

    this.logger.info('Coupon retrieved by id', {
      couponId: id,
      requesterId: currentUser!.userId,
    });
    return coupon;
  }
}

export class GetCouponByCodeUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCouponByCodeUseCase');
  }

  /**
   * Returns a coupon by code. Used for checkout validation.
   * Any authenticated user may call this — customers validating a code at checkout.
   * Throws UNAUTHENTICATED for anonymous callers.
   * Returns null when the coupon is not found (the caller may want to show "invalid code").
   */
  async execute(code: string, currentUser: TokenPayload | null): Promise<CouponData | null> {
    if (!currentUser) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
      });
    }

    const coupon = await this.couponRepository.findByCode(code);
    this.logger.info('Coupon lookup by code', {
      code,
      requesterId: currentUser.userId,
      found: coupon !== null,
    });
    return coupon;
  }
}

export class GetUserCouponUsageUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetUserCouponUsageUseCase');
  }

  /**
   * Returns all coupon usages for the target user.
   * Owner sees their own usage history; management sees any user's history.
   */
  async execute(
    targetUserId: string,
    currentUser: TokenPayload | null,
  ): Promise<CouponUsageData[]> {
    assertOwnerOrOrderManagement(currentUser, targetUserId);

    const results = await this.couponRepository.findUsageByUserId(targetUserId);
    this.logger.info('User coupon usage retrieved', {
      targetUserId,
      requesterId: currentUser!.userId,
      count: results.length,
    });
    return results;
  }
}
