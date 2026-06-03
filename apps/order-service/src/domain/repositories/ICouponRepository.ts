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

export interface CreateCouponData {
  code: string;
  name: string;
  description?: string;
  discountType: string;
  discountValue: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  validFrom: Date;
  validUntil: Date;
  isActive?: boolean;
  isFirstTimeOnly?: boolean;
  applicableCategories?: string[];
  applicableProducts?: string[];
}

export interface UpdateCouponData {
  name?: string;
  description?: string;
  discountValue?: number;
  minimumAmount?: number | null;
  maximumDiscount?: number | null;
  usageLimit?: number | null;
  validFrom?: Date;
  validUntil?: Date;
  isActive?: boolean;
  isFirstTimeOnly?: boolean;
  applicableCategories?: string[];
  applicableProducts?: string[];
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

  /** Create a new coupon. Throws Prisma P2002 on duplicate code. */
  create(data: CreateCouponData): Promise<CouponData>;

  /** Update an existing coupon. Throws Prisma P2025 when not found. */
  update(id: string, data: UpdateCouponData): Promise<CouponData>;

  /** Delete a coupon. Returns true on success; throws Prisma P2025 when not found. */
  delete(id: string): Promise<boolean>;

  /**
   * Returns active coupons valid at the given timestamp.
   * PUBLIC — no auth required. Used by storefront coupon discovery.
   */
  findAllActive(asOf: Date): Promise<CouponData[]>;
}
