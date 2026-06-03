import { PrismaClient, DiscountType } from '../../prisma';
import { LoggerFactory, ILogger } from '@hbs/logging';
import type {
  ICouponRepository,
  CouponData,
  CouponUsageData,
  CreateCouponData,
  UpdateCouponData,
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

  async create(data: CreateCouponData): Promise<CouponData> {
    try {
      const c = await this.prisma.coupon.create({
        data: {
          code: data.code.trim(),
          name: data.name.trim(),
          description: data.description ?? null,
          discountType: data.discountType as DiscountType,
          discountValue: data.discountValue,
          minimumAmount: data.minimumAmount ?? null,
          maximumDiscount: data.maximumDiscount ?? null,
          usageLimit: data.usageLimit ?? null,
          validFrom: data.validFrom,
          validUntil: data.validUntil,
          isActive: data.isActive ?? true,
          isFirstTimeOnly: data.isFirstTimeOnly ?? false,
          applicableCategories: data.applicableCategories ?? [],
          applicableProducts: data.applicableProducts ?? [],
        },
      });
      return this.mapCouponToData(c);
    } catch (error) {
      this.logger.error(
        'Error creating Coupon',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async update(id: string, data: UpdateCouponData): Promise<CouponData> {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData['name'] = data.name;
      if (data.description !== undefined) updateData['description'] = data.description;
      if (data.discountValue !== undefined) updateData['discountValue'] = data.discountValue;
      if (data.minimumAmount !== undefined) updateData['minimumAmount'] = data.minimumAmount;
      if (data.maximumDiscount !== undefined) updateData['maximumDiscount'] = data.maximumDiscount;
      if (data.usageLimit !== undefined) updateData['usageLimit'] = data.usageLimit;
      if (data.validFrom !== undefined) updateData['validFrom'] = data.validFrom;
      if (data.validUntil !== undefined) updateData['validUntil'] = data.validUntil;
      if (data.isActive !== undefined) updateData['isActive'] = data.isActive;
      if (data.isFirstTimeOnly !== undefined) updateData['isFirstTimeOnly'] = data.isFirstTimeOnly;
      if (data.applicableCategories !== undefined)
        updateData['applicableCategories'] = data.applicableCategories;
      if (data.applicableProducts !== undefined)
        updateData['applicableProducts'] = data.applicableProducts;

      const c = await this.prisma.coupon.update({ where: { id }, data: updateData });
      return this.mapCouponToData(c);
    } catch (error) {
      this.logger.error(
        'Error updating Coupon',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.coupon.delete({ where: { id } });
      return true;
    } catch (error) {
      this.logger.error(
        'Error deleting Coupon',
        error instanceof Error ? error : new Error(String(error)),
        { id },
      );
      throw error;
    }
  }

  async findAllActive(asOf: Date): Promise<CouponData[]> {
    try {
      const items = await this.prisma.coupon.findMany({
        where: { isActive: true, validFrom: { lte: asOf }, validUntil: { gte: asOf } },
        orderBy: { createdAt: 'desc' },
      });
      return items.map((c) => this.mapCouponToData(c));
    } catch (error) {
      this.logger.error(
        'Error finding active Coupons',
        error instanceof Error ? error : new Error(String(error)),
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
