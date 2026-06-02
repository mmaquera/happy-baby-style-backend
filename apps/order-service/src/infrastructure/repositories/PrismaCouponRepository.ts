import { PrismaClient } from '../../prisma';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  ICouponRepository,
  CouponData,
  CouponUsageData,
} from '../../domain/repositories/ICouponRepository';

export class PrismaCouponRepository implements ICouponRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaCouponRepository');
  }

  async findAll(): Promise<CouponData[]> {
    try {
      const items = await this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
      return items.map((c) => this.mapCouponToData(c));
    } catch (error) {
      this.logger.error(
        'Error finding all Coupons',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async findById(id: string): Promise<CouponData | null> {
    try {
      const c = await this.prisma.coupon.findUnique({ where: { id } });
      return c ? this.mapCouponToData(c) : null;
    } catch (error) {
      this.logger.error(
        'Error finding Coupon by id',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findByCode(code: string): Promise<CouponData | null> {
    try {
      const c = await this.prisma.coupon.findUnique({ where: { code } });
      return c ? this.mapCouponToData(c) : null;
    } catch (error) {
      this.logger.error(
        'Error finding Coupon by code',
        error instanceof Error ? error : new Error(String(error)),
        { code },
      );
      throw error;
    }
  }

  async findUsageByUserId(userId: string): Promise<CouponUsageData[]> {
    try {
      const items = await this.prisma.couponUsage.findMany({
        where: { userId },
        orderBy: { usedAt: 'desc' },
      });
      return items.map((u) => this.mapUsageToData(u));
    } catch (error) {
      this.logger.error(
        'Error finding CouponUsage by userId',
        error instanceof Error ? error : new Error(String(error)),
        { userId },
      );
      throw error;
    }
  }

  private mapCouponToData(c: any): CouponData {
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description ?? null,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      minimumAmount: c.minimumAmount != null ? Number(c.minimumAmount) : null,
      maximumDiscount: c.maximumDiscount != null ? Number(c.maximumDiscount) : null,
      usageLimit: c.usageLimit ?? null,
      usedCount: c.usedCount,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      isActive: c.isActive,
      isFirstTimeOnly: c.isFirstTimeOnly,
      applicableCategories: c.applicableCategories,
      applicableProducts: c.applicableProducts,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private mapUsageToData(u: any): CouponUsageData {
    return {
      id: u.id,
      couponId: u.couponId,
      userId: u.userId,
      orderId: u.orderId,
      discountAmount: Number(u.discountAmount),
      usedAt: u.usedAt,
    };
  }
}
