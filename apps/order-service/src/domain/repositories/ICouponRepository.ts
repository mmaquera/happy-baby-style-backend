export interface CouponData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minimumAmount: number | null;
  maximumDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  isFirstTimeOnly: boolean;
  applicableCategories: string[];
  applicableProducts: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponUsageData {
  id: string;
  couponId: string;
  userId: string;
  orderId: string;
  discountAmount: number;
  usedAt: Date;
}

export interface ICouponRepository {
  /**
   * List all coupons (including inactive ones).
   * Only for management/admin callers — callers are responsible for the auth guard.
   */
  findAll(): Promise<CouponData[]>;

  /**
   * Find a coupon by id.
   * Returns null when not found.
   * Only for management/admin callers — callers are responsible for the auth guard.
   */
  findById(id: string): Promise<CouponData | null>;

  /**
   * Find a coupon by its code.
   * Returns null when not found.
   * Used for checkout validation — any authenticated customer may call this.
   */
  findByCode(code: string): Promise<CouponData | null>;

  /**
   * Find all coupon usages for a given userId.
   * Callers must apply owner-or-management guard before calling.
   */
  findUsageByUserId(userId: string): Promise<CouponUsageData[]>;
}
