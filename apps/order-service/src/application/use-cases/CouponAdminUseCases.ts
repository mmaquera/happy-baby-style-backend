/**
 * CouponAdminUseCases
 *
 * Config-admin write use cases for Coupon.
 * Guards live at the resolver layer (assertModelAccess). These use cases assume
 * an already-validated currentUser and focus exclusively on business logic.
 *
 * Delete semantics (rule M-2 anti-enumeration):
 *   - Captures Prisma P2025 (record not found).
 *   - ALWAYS returns { success: true, message: 'Operation completed' }.
 *   - Existence is never confirmed to the caller.
 */

import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { DuplicateError, ValidationError } from '@hbs/shared-kernel';
import type {
  ICouponRepository,
  CouponData,
  CreateCouponData,
  UpdateCouponData,
} from '../../domain/repositories/ICouponRepository';

export interface DeleteResult {
  success: boolean;
  message: string;
}

// ── CreateCouponUseCase ────────────────────────────────────────────────────────

export class CreateCouponUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateCouponUseCase');
  }

  async execute(data: CreateCouponData, currentUser: TokenPayload): Promise<CouponData> {
    if (!data.code?.trim()) throw new ValidationError('Coupon code is required', 'code');
    if (!data.name?.trim()) throw new ValidationError('Coupon name is required', 'name');
    // Allow discountValue = 0 for free_shipping coupons (no monetary discount).
    if (data.discountType !== 'free_shipping' && data.discountValue <= 0)
      throw new ValidationError('discountValue must be positive', 'discountValue');

    const existing = await this.couponRepository.findByCode(data.code.trim());
    if (existing) throw new DuplicateError('Coupon', 'code', data.code);

    const created = await this.couponRepository.create(data);
    this.logger.info('Coupon created', { couponId: created.id, code: created.code, requesterId: currentUser.userId });
    return created;
  }
}

// ── UpdateCouponUseCase ────────────────────────────────────────────────────────

export class UpdateCouponUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateCouponUseCase');
  }

  async execute(id: string, data: UpdateCouponData, currentUser: TokenPayload): Promise<CouponData> {
    // For updates, allow discountValue = 0 (valid for free_shipping coupon type).
    // Only reject strictly negative values.
    if (data.discountValue !== undefined && data.discountValue < 0)
      throw new ValidationError('discountValue must not be negative', 'discountValue');

    const updated = await this.couponRepository.update(id, data);
    this.logger.info('Coupon updated', { couponId: id, requesterId: currentUser.userId });
    return updated;
  }
}

// ── DeleteCouponUseCase ────────────────────────────────────────────────────────

export class DeleteCouponUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteCouponUseCase');
  }

  /** Always returns { success: true, message: 'Operation completed' } — M-2 anti-enumeration. */
  async execute(id: string, currentUser: TokenPayload): Promise<DeleteResult> {
    try {
      await this.couponRepository.delete(id);
      this.logger.info('Coupon deleted', { couponId: id, requesterId: currentUser.userId });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        this.logger.info('DeleteCoupon: record not found (ambiguous)', { couponId: id, requesterId: currentUser.userId });
      } else {
        this.logger.error('DeleteCoupon: unexpected error', err instanceof Error ? err : new Error(String(err)), { couponId: id });
        throw err;
      }
    }
    return { success: true, message: 'Operation completed' };
  }
}

// ── GetActiveCouponsUseCase (public read) ────────────────────────────────────

export class GetActiveCouponsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly couponRepository: ICouponRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetActiveCouponsUseCase');
  }

  /** Public — no auth required. Returns currently active and valid coupons. */
  async execute(): Promise<CouponData[]> {
    const now = new Date();
    const all = await this.couponRepository.findAllActive(now);
    this.logger.info('Active coupons retrieved', { count: all.length });
    return all;
  }
}
