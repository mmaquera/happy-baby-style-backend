/**
 * Tests for all guarded read-side use cases added in the security hardening pass.
 *
 * Covered use cases:
 *   - GetUserPaymentMethodsUseCase
 *   - GetPaymentMethodByIdUseCase
 *   - GetUserTransactionsUseCase
 *   - GetTransactionByIdUseCase
 *   - GetUserCartUseCase
 *   - GetCartItemByIdUseCase
 *   - GetCouponsUseCase
 *   - GetCouponByIdUseCase
 *   - GetCouponByCodeUseCase
 *   - GetUserCouponUsageUseCase
 *   - GetStoreSettingsUseCase
 *   - GetStoreSettingByKeyUseCase
 */

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

import {
  GetUserPaymentMethodsUseCase,
  GetPaymentMethodByIdUseCase,
} from '../GetUserPaymentMethodsUseCase';
import {
  GetUserTransactionsUseCase,
  GetTransactionByIdUseCase,
} from '../GetUserTransactionsUseCase';
import {
  GetUserCartUseCase,
  GetCartItemByIdUseCase,
} from '../GetUserCartUseCase';
import {
  GetCouponsUseCase,
  GetCouponByIdUseCase,
  GetCouponByCodeUseCase,
  GetUserCouponUsageUseCase,
} from '../GetCouponUseCase';
import {
  GetStoreSettingsUseCase,
  GetStoreSettingByKeyUseCase,
} from '../GetStoreSettingsUseCase';

import type {
  IPaymentMethodRepository,
  PaymentMethodData,
} from '../../../domain/repositories/IPaymentMethodRepository';
import type {
  ITransactionRepository,
  TransactionData,
} from '../../../domain/repositories/ITransactionRepository';
import type {
  IShoppingCartRepository,
  ShoppingCartItemData,
  ShoppingCartData,
} from '../../../domain/repositories/IShoppingCartRepository';
import type {
  ICouponRepository,
  CouponData,
  CouponUsageData,
} from '../../../domain/repositories/ICouponRepository';
import type {
  IStoreSettingsRepository,
  StoreSettingData,
} from '../../../domain/repositories/IStoreSettingsRepository';

import { NotFoundError } from '@hbs/shared-kernel';
import { GraphQLError } from 'graphql';
import { UserRole } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeOwner(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-owner',
    email: 'owner@test.com',
    role: UserRole.CUSTOMER,
    permissions: [],
    groups: ['customer'],
    ...overrides,
  };
}

function makeOtherCustomer(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-other',
    email: 'other@test.com',
    role: UserRole.CUSTOMER,
    permissions: [],
    groups: ['customer'],
    ...overrides,
  };
}

function makeManagement(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-mgmt',
    email: 'mgmt@test.com',
    role: UserRole.STAFF,
    permissions: [],
    groups: ['sales-manager'],
    ...overrides,
  };
}

function makeAdmin(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-admin',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
    permissions: [],
    groups: ['administrators'],
    ...overrides,
  };
}

function makePaymentMethod(overrides: Partial<PaymentMethodData> = {}): PaymentMethodData {
  return {
    id: 'pm-1',
    orderId: 'ord-1',
    type: 'credit_card',
    amount: 100,
    status: 'pending',
    transactionId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<TransactionData> = {}): TransactionData {
  return {
    id: 'tx-1',
    orderId: 'ord-1',
    userId: 'user-owner',
    type: 'payment',
    amount: 100,
    currency: 'PEN',
    status: 'completed',
    gateway: null,
    gatewayTransactionId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<ShoppingCartItemData> = {}): ShoppingCartItemData {
  return {
    id: 'item-1',
    cartId: 'cart-1',
    productId: 'prod-1',
    quantity: 2,
    price: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCartData(overrides: Partial<ShoppingCartData> = {}): ShoppingCartData {
  return {
    id: 'cart-1',
    userId: 'user-owner',
    sessionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [makeCartItem()],
    ...overrides,
  };
}

function makeCoupon(overrides: Partial<CouponData> = {}): CouponData {
  return {
    id: 'coupon-1',
    code: 'SAVE10',
    name: 'Save 10',
    description: null,
    discountType: 'percentage',
    discountValue: 10,
    minimumAmount: null,
    maximumDiscount: null,
    usageLimit: null,
    usedCount: 0,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 86400000),
    isActive: true,
    isFirstTimeOnly: false,
    applicableCategories: [],
    applicableProducts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCouponUsage(overrides: Partial<CouponUsageData> = {}): CouponUsageData {
  return {
    id: 'usage-1',
    couponId: 'coupon-1',
    userId: 'user-owner',
    orderId: 'ord-1',
    discountAmount: 10,
    usedAt: new Date(),
    ...overrides,
  };
}

function makeStoreSetting(overrides: Partial<StoreSettingData> = {}): StoreSettingData {
  return {
    id: 'setting-1',
    settingKey: 'tax_rate',
    settingValue: '0.18',
    description: null,
    category: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock repository factories
// ---------------------------------------------------------------------------

function makePaymentMethodRepo(
  overrides: Partial<jest.Mocked<IPaymentMethodRepository>> = {},
): jest.Mocked<IPaymentMethodRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(makePaymentMethod()),
    findByUserId: jest.fn().mockResolvedValue([makePaymentMethod()]),
    resolveOwnerUserId: jest.fn().mockResolvedValue('user-owner'),
    update: jest.fn(),
    delete: jest.fn(),
    assertOrderWriteAccess: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IPaymentMethodRepository>;
}

function makeTransactionRepo(
  overrides: Partial<jest.Mocked<ITransactionRepository>> = {},
): jest.Mocked<ITransactionRepository> {
  return {
    findByUserId: jest.fn().mockResolvedValue([makeTransaction()]),
    findById: jest.fn().mockResolvedValue(makeTransaction()),
    resolveOwnerUserId: jest.fn().mockResolvedValue('user-owner'),
    ...overrides,
  } as jest.Mocked<ITransactionRepository>;
}

function makeCartRepo(
  overrides: Partial<jest.Mocked<IShoppingCartRepository>> = {},
): jest.Mocked<IShoppingCartRepository> {
  return {
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
    findByUserId: jest.fn().mockResolvedValue([makeCartData()]),
    findItemById: jest.fn().mockResolvedValue({ ...makeCartItem(), cartUserId: 'user-owner' }),
    ...overrides,
  } as jest.Mocked<IShoppingCartRepository>;
}

function makeCouponRepo(
  overrides: Partial<jest.Mocked<ICouponRepository>> = {},
): jest.Mocked<ICouponRepository> {
  return {
    findAll: jest.fn().mockResolvedValue([makeCoupon()]),
    findById: jest.fn().mockResolvedValue(makeCoupon()),
    findByCode: jest.fn().mockResolvedValue(makeCoupon()),
    findUsageByUserId: jest.fn().mockResolvedValue([makeCouponUsage()]),
    ...overrides,
  } as jest.Mocked<ICouponRepository>;
}

function makeStoreSettingsRepo(
  overrides: Partial<jest.Mocked<IStoreSettingsRepository>> = {},
): jest.Mocked<IStoreSettingsRepository> {
  return {
    findAll: jest.fn().mockResolvedValue([makeStoreSetting()]),
    findByKey: jest.fn().mockResolvedValue(makeStoreSetting()),
    ...overrides,
  } as jest.Mocked<IStoreSettingsRepository>;
}

// ---------------------------------------------------------------------------
// Helpers for checking UNAUTHENTICATED GraphQLError
// ---------------------------------------------------------------------------

function expectUnauthenticated(error: any) {
  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions?.code).toBe('UNAUTHENTICATED');
}

function expectForbidden(error: any) {
  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions?.code).toBe('FORBIDDEN');
}

// ===========================================================================
// GetUserPaymentMethodsUseCase
// ===========================================================================

describe('GetUserPaymentMethodsUseCase', () => {
  it('owner can retrieve their own payment methods', async () => {
    const repo = makePaymentMethodRepo();
    const uc = new GetUserPaymentMethodsUseCase(repo);

    const result = await uc.execute('user-owner', makeOwner());

    expect(repo.findByUserId).toHaveBeenCalledWith('user-owner');
    expect(result).toHaveLength(1);
  });

  it('management user can retrieve any user payment methods', async () => {
    const repo = makePaymentMethodRepo();
    const uc = new GetUserPaymentMethodsUseCase(repo);

    await uc.execute('user-owner', makeManagement());
    expect(repo.findByUserId).toHaveBeenCalledWith('user-owner');
  });

  it('anonymous caller → UNAUTHENTICATED', async () => {
    const uc = new GetUserPaymentMethodsUseCase(makePaymentMethodRepo());
    const err = await uc.execute('user-owner', null).catch((e) => e);
    expectUnauthenticated(err);
  });

  it('other customer → FORBIDDEN', async () => {
    const uc = new GetUserPaymentMethodsUseCase(makePaymentMethodRepo());
    const err = await uc.execute('user-owner', makeOtherCustomer()).catch((e) => e);
    expectForbidden(err);
  });
});

// ===========================================================================
// GetPaymentMethodByIdUseCase
// ===========================================================================

describe('GetPaymentMethodByIdUseCase', () => {
  it('owner can retrieve their own payment method by id', async () => {
    const repo = makePaymentMethodRepo();
    const uc = new GetPaymentMethodByIdUseCase(repo);

    const result = await uc.execute('pm-1', makeOwner());
    expect(result.id).toBe('pm-1');
  });

  it('management user can retrieve any payment method by id', async () => {
    const repo = makePaymentMethodRepo();
    const uc = new GetPaymentMethodByIdUseCase(repo);

    const result = await uc.execute('pm-1', makeManagement());
    expect(result.id).toBe('pm-1');
  });

  it('non-existent payment method → NotFoundError', async () => {
    const repo = makePaymentMethodRepo({
      resolveOwnerUserId: jest.fn().mockResolvedValue(null),
    });
    const uc = new GetPaymentMethodByIdUseCase(repo);

    const err = await uc.execute('pm-x', makeOwner()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('other customer (non-owner, non-management) → ambiguous NotFoundError', async () => {
    const repo = makePaymentMethodRepo({
      resolveOwnerUserId: jest.fn().mockResolvedValue('user-owner'),
    });
    const uc = new GetPaymentMethodByIdUseCase(repo);

    const err = await uc.execute('pm-1', makeOtherCustomer()).catch((e) => e);
    // Must be NotFoundError (ambiguous 404), NOT a ForbiddenError, to prevent enumeration.
    expect(err).toBeInstanceOf(NotFoundError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('anonymous caller → UNAUTHENTICATED', async () => {
    const uc = new GetPaymentMethodByIdUseCase(makePaymentMethodRepo());
    const err = await uc.execute('pm-1', null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetUserTransactionsUseCase
// ===========================================================================

describe('GetUserTransactionsUseCase', () => {
  it('owner retrieves their own transactions', async () => {
    const repo = makeTransactionRepo();
    const uc = new GetUserTransactionsUseCase(repo);

    const result = await uc.execute('user-owner', makeOwner());
    expect(repo.findByUserId).toHaveBeenCalledWith('user-owner');
    expect(result).toHaveLength(1);
  });

  it('management retrieves any user transactions', async () => {
    const repo = makeTransactionRepo();
    const uc = new GetUserTransactionsUseCase(repo);

    await uc.execute('user-owner', makeManagement());
    expect(repo.findByUserId).toHaveBeenCalledWith('user-owner');
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetUserTransactionsUseCase(makeTransactionRepo());
    const err = await uc.execute('user-owner', null).catch((e) => e);
    expectUnauthenticated(err);
  });

  it('other customer → FORBIDDEN', async () => {
    const uc = new GetUserTransactionsUseCase(makeTransactionRepo());
    const err = await uc.execute('user-owner', makeOtherCustomer()).catch((e) => e);
    expectForbidden(err);
  });
});

// ===========================================================================
// GetTransactionByIdUseCase
// ===========================================================================

describe('GetTransactionByIdUseCase', () => {
  it('owner retrieves their transaction by id', async () => {
    const repo = makeTransactionRepo();
    const uc = new GetTransactionByIdUseCase(repo);

    const result = await uc.execute('tx-1', makeOwner());
    expect(result.id).toBe('tx-1');
  });

  it('management retrieves any transaction by id', async () => {
    const repo = makeTransactionRepo();
    const uc = new GetTransactionByIdUseCase(repo);

    const result = await uc.execute('tx-1', makeManagement());
    expect(result.id).toBe('tx-1');
  });

  it('non-existent transaction → NotFoundError', async () => {
    const repo = makeTransactionRepo({
      resolveOwnerUserId: jest.fn().mockResolvedValue(null),
    });
    const uc = new GetTransactionByIdUseCase(repo);

    const err = await uc.execute('tx-x', makeOwner()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('other customer → ambiguous NotFoundError (not FORBIDDEN)', async () => {
    const repo = makeTransactionRepo({
      resolveOwnerUserId: jest.fn().mockResolvedValue('user-owner'),
    });
    const uc = new GetTransactionByIdUseCase(repo);

    const err = await uc.execute('tx-1', makeOtherCustomer()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetTransactionByIdUseCase(makeTransactionRepo());
    const err = await uc.execute('tx-1', null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetUserCartUseCase
// ===========================================================================

describe('GetUserCartUseCase', () => {
  it('owner retrieves their own carts', async () => {
    const repo = makeCartRepo();
    const uc = new GetUserCartUseCase(repo);

    const result = await uc.execute('user-owner', makeOwner());
    expect(repo.findByUserId).toHaveBeenCalledWith('user-owner');
    expect(result).toHaveLength(1);
  });

  it('management retrieves any user carts', async () => {
    const repo = makeCartRepo();
    const uc = new GetUserCartUseCase(repo);

    await uc.execute('user-owner', makeManagement());
    expect(repo.findByUserId).toHaveBeenCalledWith('user-owner');
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetUserCartUseCase(makeCartRepo());
    const err = await uc.execute('user-owner', null).catch((e) => e);
    expectUnauthenticated(err);
  });

  it('other customer → FORBIDDEN', async () => {
    const uc = new GetUserCartUseCase(makeCartRepo());
    const err = await uc.execute('user-owner', makeOtherCustomer()).catch((e) => e);
    expectForbidden(err);
  });
});

// ===========================================================================
// GetCartItemByIdUseCase
// ===========================================================================

describe('GetCartItemByIdUseCase', () => {
  it('owner retrieves their own cart item by id', async () => {
    const repo = makeCartRepo();
    const uc = new GetCartItemByIdUseCase(repo);

    const result = await uc.execute('item-1', makeOwner());
    expect(result.id).toBe('item-1');
  });

  it('management retrieves any cart item by id', async () => {
    const repo = makeCartRepo();
    const uc = new GetCartItemByIdUseCase(repo);

    const result = await uc.execute('item-1', makeManagement());
    expect(result.id).toBe('item-1');
  });

  it('non-existent item → NotFoundError', async () => {
    const repo = makeCartRepo({
      findItemById: jest.fn().mockResolvedValue(null),
    });
    const uc = new GetCartItemByIdUseCase(repo);

    const err = await uc.execute('item-x', makeOwner()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('other customer → ambiguous NotFoundError (not FORBIDDEN)', async () => {
    const repo = makeCartRepo({
      findItemById: jest.fn().mockResolvedValue({ ...makeCartItem(), cartUserId: 'user-owner' }),
    });
    const uc = new GetCartItemByIdUseCase(repo);

    const err = await uc.execute('item-1', makeOtherCustomer()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetCartItemByIdUseCase(makeCartRepo());
    const err = await uc.execute('item-1', null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetCouponsUseCase
// ===========================================================================

describe('GetCouponsUseCase', () => {
  it('management retrieves all coupons', async () => {
    const repo = makeCouponRepo();
    const uc = new GetCouponsUseCase(repo);

    const result = await uc.execute(makeManagement());
    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('admin retrieves all coupons', async () => {
    const repo = makeCouponRepo();
    const uc = new GetCouponsUseCase(repo);

    await uc.execute(makeAdmin());
    expect(repo.findAll).toHaveBeenCalled();
  });

  it('customer → FORBIDDEN', async () => {
    const uc = new GetCouponsUseCase(makeCouponRepo());
    const err = await uc.execute(makeOwner()).catch((e) => e);
    expectForbidden(err);
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetCouponsUseCase(makeCouponRepo());
    const err = await uc.execute(null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetCouponByIdUseCase
// ===========================================================================

describe('GetCouponByIdUseCase', () => {
  it('management retrieves coupon by id', async () => {
    const repo = makeCouponRepo();
    const uc = new GetCouponByIdUseCase(repo);

    const result = await uc.execute('coupon-1', makeManagement());
    expect(result.id).toBe('coupon-1');
  });

  it('non-existent coupon → NotFoundError', async () => {
    const repo = makeCouponRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetCouponByIdUseCase(repo);

    const err = await uc.execute('coupon-x', makeManagement()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('customer → FORBIDDEN', async () => {
    const uc = new GetCouponByIdUseCase(makeCouponRepo());
    const err = await uc.execute('coupon-1', makeOwner()).catch((e) => e);
    expectForbidden(err);
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetCouponByIdUseCase(makeCouponRepo());
    const err = await uc.execute('coupon-1', null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetCouponByCodeUseCase
// ===========================================================================

describe('GetCouponByCodeUseCase', () => {
  it('authenticated customer can validate a coupon code', async () => {
    const repo = makeCouponRepo();
    const uc = new GetCouponByCodeUseCase(repo);

    const result = await uc.execute('SAVE10', makeOwner());
    expect(repo.findByCode).toHaveBeenCalledWith('SAVE10');
    expect(result?.code).toBe('SAVE10');
  });

  it('authenticated management can validate a coupon code', async () => {
    const repo = makeCouponRepo();
    const uc = new GetCouponByCodeUseCase(repo);

    await uc.execute('SAVE10', makeManagement());
    expect(repo.findByCode).toHaveBeenCalledWith('SAVE10');
  });

  it('not found code returns null (not NotFoundError) — checkout UX', async () => {
    const repo = makeCouponRepo({ findByCode: jest.fn().mockResolvedValue(null) });
    const uc = new GetCouponByCodeUseCase(repo);

    const result = await uc.execute('INVALID', makeOwner());
    expect(result).toBeNull();
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetCouponByCodeUseCase(makeCouponRepo());
    const err = await uc.execute('SAVE10', null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetUserCouponUsageUseCase
// ===========================================================================

describe('GetUserCouponUsageUseCase', () => {
  it('owner retrieves their coupon usage', async () => {
    const repo = makeCouponRepo();
    const uc = new GetUserCouponUsageUseCase(repo);

    const result = await uc.execute('user-owner', makeOwner());
    expect(repo.findUsageByUserId).toHaveBeenCalledWith('user-owner');
    expect(result).toHaveLength(1);
  });

  it('management retrieves any user coupon usage', async () => {
    const repo = makeCouponRepo();
    const uc = new GetUserCouponUsageUseCase(repo);

    await uc.execute('user-owner', makeManagement());
    expect(repo.findUsageByUserId).toHaveBeenCalledWith('user-owner');
  });

  it('other customer → FORBIDDEN', async () => {
    const uc = new GetUserCouponUsageUseCase(makeCouponRepo());
    const err = await uc.execute('user-owner', makeOtherCustomer()).catch((e) => e);
    expectForbidden(err);
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetUserCouponUsageUseCase(makeCouponRepo());
    const err = await uc.execute('user-owner', null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetStoreSettingsUseCase
// ===========================================================================

describe('GetStoreSettingsUseCase', () => {
  it('management retrieves store settings', async () => {
    const repo = makeStoreSettingsRepo();
    const uc = new GetStoreSettingsUseCase(repo);

    const result = await uc.execute(makeManagement());
    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('customer → FORBIDDEN', async () => {
    const uc = new GetStoreSettingsUseCase(makeStoreSettingsRepo());
    const err = await uc.execute(makeOwner()).catch((e) => e);
    expectForbidden(err);
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetStoreSettingsUseCase(makeStoreSettingsRepo());
    const err = await uc.execute(null).catch((e) => e);
    expectUnauthenticated(err);
  });
});

// ===========================================================================
// GetStoreSettingByKeyUseCase
// ===========================================================================

describe('GetStoreSettingByKeyUseCase', () => {
  it('management retrieves setting by key', async () => {
    const repo = makeStoreSettingsRepo();
    const uc = new GetStoreSettingByKeyUseCase(repo);

    const result = await uc.execute('tax_rate', makeManagement());
    expect(repo.findByKey).toHaveBeenCalledWith('tax_rate');
    expect(result?.settingKey).toBe('tax_rate');
  });

  it('returns null when key not found', async () => {
    const repo = makeStoreSettingsRepo({ findByKey: jest.fn().mockResolvedValue(null) });
    const uc = new GetStoreSettingByKeyUseCase(repo);

    const result = await uc.execute('nonexistent', makeManagement());
    expect(result).toBeNull();
  });

  it('customer → FORBIDDEN', async () => {
    const uc = new GetStoreSettingByKeyUseCase(makeStoreSettingsRepo());
    const err = await uc.execute('tax_rate', makeOwner()).catch((e) => e);
    expectForbidden(err);
  });

  it('anonymous → UNAUTHENTICATED', async () => {
    const uc = new GetStoreSettingByKeyUseCase(makeStoreSettingsRepo());
    const err = await uc.execute('tax_rate', null).catch((e) => e);
    expectUnauthenticated(err);
  });
});
