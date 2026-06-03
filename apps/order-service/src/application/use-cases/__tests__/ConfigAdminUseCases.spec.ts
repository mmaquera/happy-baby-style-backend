/**
 * Tests for config-admin use cases (Ronda 4).
 *
 * Covered use cases:
 *   Coupon:       CreateCouponUseCase, UpdateCouponUseCase, DeleteCouponUseCase, GetActiveCouponsUseCase
 *   Carrier:      GetCarriersUseCase, GetCarrierByIdUseCase, CreateCarrierUseCase, UpdateCarrierUseCase, DeleteCarrierUseCase
 *   ShippingZone: GetShippingZonesUseCase, GetShippingZoneByIdUseCase, CreateShippingZoneUseCase, UpdateShippingZoneUseCase, DeleteShippingZoneUseCase
 *   ShippingRate: GetShippingRatesByZoneUseCase, CreateShippingRateUseCase, UpdateShippingRateUseCase, DeleteShippingRateUseCase
 *   DeliverySlot: GetDeliverySlotsUseCase, CreateDeliverySlotUseCase, UpdateDeliverySlotUseCase, DeleteDeliverySlotUseCase
 *   TaxRate:      GetTaxRatesUseCase, GetTaxRateByIdUseCase, CreateTaxRateUseCase, UpdateTaxRateUseCase, DeleteTaxRateUseCase
 *
 * Guard rule: the resolver holds assertModelAccess; use cases assume a valid currentUser.
 * Tests verify: happy path, repo delegation, validation errors, P2025 captured → ambiguous SuccessResponse.
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
  CreateCouponUseCase,
  UpdateCouponUseCase,
  DeleteCouponUseCase,
  GetActiveCouponsUseCase,
} from '../CouponAdminUseCases';
import {
  GetCarriersUseCase,
  GetCarrierByIdUseCase,
  CreateCarrierUseCase,
  UpdateCarrierUseCase,
  DeleteCarrierUseCase,
} from '../CarrierAdminUseCases';
import {
  GetShippingZonesUseCase,
  GetShippingZoneByIdUseCase,
  CreateShippingZoneUseCase,
  UpdateShippingZoneUseCase,
  DeleteShippingZoneUseCase,
} from '../ShippingZoneAdminUseCases';
import {
  GetShippingRatesByZoneUseCase,
  CreateShippingRateUseCase,
  UpdateShippingRateUseCase,
  DeleteShippingRateUseCase,
} from '../ShippingRateAdminUseCases';
import {
  GetDeliverySlotsUseCase,
  CreateDeliverySlotUseCase,
  UpdateDeliverySlotUseCase,
  DeleteDeliverySlotUseCase,
} from '../DeliverySlotAdminUseCases';
import {
  GetTaxRatesUseCase,
  GetTaxRateByIdUseCase,
  CreateTaxRateUseCase,
  UpdateTaxRateUseCase,
  DeleteTaxRateUseCase,
} from '../TaxRateAdminUseCases';

import type {
  ICouponRepository,
  CouponData,
  CreateCouponData,
} from '../../../domain/repositories/ICouponRepository';
import type {
  ICarrierRepository,
  Carrier,
} from '../../../domain/repositories/ICarrierRepository';
import type {
  IShippingZoneRepository,
  ShippingZone,
} from '../../../domain/repositories/IShippingZoneRepository';
import type {
  IShippingRateRepository,
  ShippingRate,
} from '../../../domain/repositories/IShippingRateRepository';
import type {
  IDeliverySlotRepository,
  DeliverySlot,
} from '../../../domain/repositories/IDeliverySlotRepository';
import type {
  ITaxRateRepository,
  TaxRate,
} from '../../../domain/repositories/ITaxRateRepository';

import { ValidationError, DuplicateError } from '@hbs/shared-kernel';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeAdmin(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    userId: 'user-admin',
    email: 'admin@test.com',
    permissions: [],
    groups: ['administrators'],
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
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    isFirstTimeOnly: false,
    applicableCategories: [],
    applicableProducts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCarrier(overrides: Partial<Carrier> = {}): Carrier {
  return {
    id: 'carrier-1',
    name: 'DHL',
    code: 'DHL',
    trackingUrlTemplate: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeShippingZone(overrides: Partial<ShippingZone> = {}): ShippingZone {
  return {
    id: 'zone-1',
    name: 'Lima',
    countries: ['PE'],
    states: ['Lima'],
    cities: [],
    postalCodes: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeShippingRate(overrides: Partial<ShippingRate> = {}): ShippingRate {
  return {
    id: 'rate-1',
    zoneId: 'zone-1',
    name: 'Standard',
    minWeight: null,
    maxWeight: null,
    price: '10.00',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeliverySlot(overrides: Partial<DeliverySlot> = {}): DeliverySlot {
  return {
    id: 'slot-1',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '13:00',
    maxOrders: 20,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTaxRate(overrides: Partial<TaxRate> = {}): TaxRate {
  return {
    id: 'tax-1',
    name: 'IGV Peru',
    rate: '0.1800',
    country: 'PE',
    state: null,
    city: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock repository factories
// ---------------------------------------------------------------------------

function makeCouponRepo(
  overrides: Partial<jest.Mocked<ICouponRepository>> = {},
): jest.Mocked<ICouponRepository> {
  return {
    findAll: jest.fn().mockResolvedValue([makeCoupon()]),
    findById: jest.fn().mockResolvedValue(makeCoupon()),
    findByCode: jest.fn().mockResolvedValue(null),
    findUsageByUserId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(makeCoupon()),
    update: jest.fn().mockResolvedValue(makeCoupon()),
    delete: jest.fn().mockResolvedValue(true),
    findAllActive: jest.fn().mockResolvedValue([makeCoupon()]),
    ...overrides,
  } as jest.Mocked<ICouponRepository>;
}

function makeCarrierRepo(
  overrides: Partial<jest.Mocked<ICarrierRepository>> = {},
): jest.Mocked<ICarrierRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeCarrier()),
    update: jest.fn().mockResolvedValue(makeCarrier()),
    delete: jest.fn().mockResolvedValue(true),
    findById: jest.fn().mockResolvedValue(makeCarrier()),
    findAll: jest.fn().mockResolvedValue([makeCarrier()]),
    ...overrides,
  } as jest.Mocked<ICarrierRepository>;
}

function makeShippingZoneRepo(
  overrides: Partial<jest.Mocked<IShippingZoneRepository>> = {},
): jest.Mocked<IShippingZoneRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeShippingZone()),
    update: jest.fn().mockResolvedValue(makeShippingZone()),
    delete: jest.fn().mockResolvedValue(true),
    findById: jest.fn().mockResolvedValue(makeShippingZone()),
    findAll: jest.fn().mockResolvedValue([makeShippingZone()]),
    ...overrides,
  } as jest.Mocked<IShippingZoneRepository>;
}

function makeShippingRateRepo(
  overrides: Partial<jest.Mocked<IShippingRateRepository>> = {},
): jest.Mocked<IShippingRateRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeShippingRate()),
    update: jest.fn().mockResolvedValue(makeShippingRate()),
    delete: jest.fn().mockResolvedValue(true),
    findById: jest.fn().mockResolvedValue(makeShippingRate()),
    findAll: jest.fn().mockResolvedValue([makeShippingRate()]),
    findByZoneId: jest.fn().mockResolvedValue([makeShippingRate()]),
    ...overrides,
  } as jest.Mocked<IShippingRateRepository>;
}

function makeDeliverySlotRepo(
  overrides: Partial<jest.Mocked<IDeliverySlotRepository>> = {},
): jest.Mocked<IDeliverySlotRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeDeliverySlot()),
    update: jest.fn().mockResolvedValue(makeDeliverySlot()),
    delete: jest.fn().mockResolvedValue(true),
    findById: jest.fn().mockResolvedValue(makeDeliverySlot()),
    findAll: jest.fn().mockResolvedValue([makeDeliverySlot()]),
    findByDayOfWeek: jest.fn().mockResolvedValue([makeDeliverySlot()]),
    ...overrides,
  } as jest.Mocked<IDeliverySlotRepository>;
}

function makeTaxRateRepo(
  overrides: Partial<jest.Mocked<ITaxRateRepository>> = {},
): jest.Mocked<ITaxRateRepository> {
  return {
    create: jest.fn().mockResolvedValue(makeTaxRate()),
    update: jest.fn().mockResolvedValue(makeTaxRate()),
    delete: jest.fn().mockResolvedValue(true),
    findById: jest.fn().mockResolvedValue(makeTaxRate()),
    findAll: jest.fn().mockResolvedValue([makeTaxRate()]),
    findMatchingRate: jest.fn().mockResolvedValue(makeTaxRate()),
    ...overrides,
  } as jest.Mocked<ITaxRateRepository>;
}

// ---------------------------------------------------------------------------
// Helper: make a P2025 Prisma error
// ---------------------------------------------------------------------------
function makeP2025(): Error & { code: string } {
  const err = new Error('Record to delete does not exist') as Error & { code: string };
  err.code = 'P2025';
  return err;
}

// ===========================================================================
// COUPON admin use cases
// ===========================================================================

describe('GetActiveCouponsUseCase', () => {
  it('delegates to repository.findAllActive and returns results', async () => {
    const repo = makeCouponRepo();
    const uc = new GetActiveCouponsUseCase(repo);

    const result = await uc.execute();

    expect(repo.findAllActive).toHaveBeenCalledWith(expect.any(Date));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('SAVE10');
  });
});

describe('CreateCouponUseCase', () => {
  const validInput: CreateCouponData = {
    code: 'NEW10',
    name: 'New coupon',
    discountType: 'percentage',
    discountValue: 10,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
  };

  it('creates coupon when code is unique', async () => {
    const repo = makeCouponRepo({ findByCode: jest.fn().mockResolvedValue(null) });
    const uc = new CreateCouponUseCase(repo);

    const result = await uc.execute(validInput, makeAdmin());

    expect(repo.findByCode).toHaveBeenCalledWith('NEW10');
    expect(repo.create).toHaveBeenCalled();
    expect(result.id).toBe('coupon-1');
  });

  it('throws DuplicateError when code already exists', async () => {
    const repo = makeCouponRepo({ findByCode: jest.fn().mockResolvedValue(makeCoupon()) });
    const uc = new CreateCouponUseCase(repo);

    await expect(uc.execute(validInput, makeAdmin())).rejects.toBeInstanceOf(DuplicateError);
  });

  it('throws ValidationError when code is empty', async () => {
    const repo = makeCouponRepo();
    const uc = new CreateCouponUseCase(repo);

    await expect(uc.execute({ ...validInput, code: '' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when discountValue is zero', async () => {
    const repo = makeCouponRepo();
    const uc = new CreateCouponUseCase(repo);

    await expect(uc.execute({ ...validInput, discountValue: 0 }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('UpdateCouponUseCase', () => {
  it('delegates to repository.update', async () => {
    const repo = makeCouponRepo();
    const uc = new UpdateCouponUseCase(repo);

    const result = await uc.execute('coupon-1', { name: 'Updated' }, makeAdmin());

    expect(repo.update).toHaveBeenCalledWith('coupon-1', { name: 'Updated' });
    expect(result.id).toBe('coupon-1');
  });

  it('throws ValidationError when discountValue is negative', async () => {
    const repo = makeCouponRepo();
    const uc = new UpdateCouponUseCase(repo);

    await expect(uc.execute('coupon-1', { discountValue: -5 }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('DeleteCouponUseCase', () => {
  it('returns ambiguous SuccessResponse on successful delete', async () => {
    const repo = makeCouponRepo();
    const uc = new DeleteCouponUseCase(repo);

    const result = await uc.execute('coupon-1', makeAdmin());

    expect(repo.delete).toHaveBeenCalledWith('coupon-1');
    expect(result).toEqual({ success: true, message: 'Operation completed' });
  });

  it('captures P2025 and returns same ambiguous SuccessResponse (M-2 anti-enumeration)', async () => {
    const repo = makeCouponRepo({ delete: jest.fn().mockRejectedValue(makeP2025()) });
    const uc = new DeleteCouponUseCase(repo);

    const result = await uc.execute('nonexistent', makeAdmin());

    expect(result).toEqual({ success: true, message: 'Operation completed' });
  });

  it('rethrows unexpected errors', async () => {
    const unexpectedErr = new Error('DB connection lost');
    const repo = makeCouponRepo({ delete: jest.fn().mockRejectedValue(unexpectedErr) });
    const uc = new DeleteCouponUseCase(repo);

    await expect(uc.execute('coupon-1', makeAdmin())).rejects.toBe(unexpectedErr);
  });
});

// ===========================================================================
// CARRIER admin use cases
// ===========================================================================

describe('GetCarriersUseCase', () => {
  it('returns all carriers from repository', async () => {
    const repo = makeCarrierRepo();
    const uc = new GetCarriersUseCase(repo);

    const result = await uc.execute();

    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DHL');
  });
});

describe('GetCarrierByIdUseCase', () => {
  it('returns carrier when found', async () => {
    const repo = makeCarrierRepo();
    const uc = new GetCarrierByIdUseCase(repo);

    const result = await uc.execute('carrier-1');

    expect(repo.findById).toHaveBeenCalledWith('carrier-1');
    expect(result?.id).toBe('carrier-1');
  });

  it('returns null when carrier not found', async () => {
    const repo = makeCarrierRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetCarrierByIdUseCase(repo);

    const result = await uc.execute('carrier-x');
    expect(result).toBeNull();
  });
});

describe('CreateCarrierUseCase', () => {
  it('creates carrier with valid data', async () => {
    const repo = makeCarrierRepo();
    const uc = new CreateCarrierUseCase(repo);

    const result = await uc.execute({ name: 'DHL', code: 'DHL' }, makeAdmin());

    expect(repo.create).toHaveBeenCalled();
    expect(result.name).toBe('DHL');
  });

  it('throws ValidationError when name is empty', async () => {
    const repo = makeCarrierRepo();
    const uc = new CreateCarrierUseCase(repo);

    await expect(uc.execute({ name: '', code: 'DHL' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when code is empty', async () => {
    const repo = makeCarrierRepo();
    const uc = new CreateCarrierUseCase(repo);

    await expect(uc.execute({ name: 'DHL', code: '' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('UpdateCarrierUseCase', () => {
  it('delegates to repository.update', async () => {
    const repo = makeCarrierRepo();
    const uc = new UpdateCarrierUseCase(repo);

    const result = await uc.execute('carrier-1', { name: 'FedEx' }, makeAdmin());

    expect(repo.update).toHaveBeenCalledWith('carrier-1', { name: 'FedEx' });
    expect(result.id).toBe('carrier-1');
  });
});

describe('DeleteCarrierUseCase', () => {
  it('returns ambiguous SuccessResponse on successful delete', async () => {
    const repo = makeCarrierRepo();
    const uc = new DeleteCarrierUseCase(repo);

    const result = await uc.execute('carrier-1', makeAdmin());

    expect(repo.delete).toHaveBeenCalledWith('carrier-1');
    expect(result).toEqual({ success: true, message: 'Operation completed' });
  });

  it('captures P2025 and returns same ambiguous SuccessResponse', async () => {
    const repo = makeCarrierRepo({ delete: jest.fn().mockRejectedValue(makeP2025()) });
    const uc = new DeleteCarrierUseCase(repo);

    const result = await uc.execute('nonexistent', makeAdmin());
    expect(result).toEqual({ success: true, message: 'Operation completed' });
  });

  it('rethrows unexpected errors', async () => {
    const unexpectedErr = new Error('disk full');
    const repo = makeCarrierRepo({ delete: jest.fn().mockRejectedValue(unexpectedErr) });
    const uc = new DeleteCarrierUseCase(repo);

    await expect(uc.execute('carrier-1', makeAdmin())).rejects.toBe(unexpectedErr);
  });
});

// ===========================================================================
// SHIPPING ZONE admin use cases
// ===========================================================================

describe('GetShippingZonesUseCase', () => {
  it('returns all zones', async () => {
    const repo = makeShippingZoneRepo();
    const uc = new GetShippingZonesUseCase(repo);

    const result = await uc.execute();
    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});

describe('GetShippingZoneByIdUseCase', () => {
  it('returns zone by id', async () => {
    const repo = makeShippingZoneRepo();
    const uc = new GetShippingZoneByIdUseCase(repo);

    const result = await uc.execute('zone-1');
    expect(result?.id).toBe('zone-1');
  });

  it('returns null when not found', async () => {
    const repo = makeShippingZoneRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetShippingZoneByIdUseCase(repo);

    expect(await uc.execute('zone-x')).toBeNull();
  });
});

describe('CreateShippingZoneUseCase', () => {
  it('creates zone with valid data', async () => {
    const repo = makeShippingZoneRepo();
    const uc = new CreateShippingZoneUseCase(repo);

    const result = await uc.execute({ name: 'Lima', countries: ['PE'] }, makeAdmin());
    expect(repo.create).toHaveBeenCalled();
    expect(result.name).toBe('Lima');
  });

  it('throws ValidationError when name is empty', async () => {
    const repo = makeShippingZoneRepo();
    const uc = new CreateShippingZoneUseCase(repo);

    await expect(uc.execute({ name: '' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('UpdateShippingZoneUseCase', () => {
  it('delegates to repository.update', async () => {
    const repo = makeShippingZoneRepo();
    const uc = new UpdateShippingZoneUseCase(repo);

    await uc.execute('zone-1', { name: 'Callao' }, makeAdmin());
    expect(repo.update).toHaveBeenCalledWith('zone-1', { name: 'Callao' });
  });
});

describe('DeleteShippingZoneUseCase', () => {
  it('returns ambiguous SuccessResponse on success', async () => {
    const repo = makeShippingZoneRepo();
    const uc = new DeleteShippingZoneUseCase(repo);

    expect(await uc.execute('zone-1', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });

  it('captures P2025 and returns ambiguous SuccessResponse', async () => {
    const repo = makeShippingZoneRepo({ delete: jest.fn().mockRejectedValue(makeP2025()) });
    const uc = new DeleteShippingZoneUseCase(repo);

    expect(await uc.execute('zone-x', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });
});

// ===========================================================================
// SHIPPING RATE admin use cases
// ===========================================================================

describe('GetShippingRatesByZoneUseCase', () => {
  it('returns all rates for zone (active + inactive) via findAll', async () => {
    const repo = makeShippingRateRepo();
    const uc = new GetShippingRatesByZoneUseCase(repo);

    const result = await uc.execute('zone-1');
    // Uses findAll({ zoneId }) to preserve pre-refactor behavior of returning all rates
    // (including inactive ones) so admin management tools can see the full list.
    expect(repo.findAll).toHaveBeenCalledWith({ zoneId: 'zone-1' });
    expect(result).toHaveLength(1);
  });
});

describe('CreateShippingRateUseCase', () => {
  it('creates rate with valid data', async () => {
    const repo = makeShippingRateRepo();
    const uc = new CreateShippingRateUseCase(repo);

    const result = await uc.execute(
      { zoneId: 'zone-1', name: 'Standard', price: '10.00' },
      makeAdmin(),
    );
    expect(repo.create).toHaveBeenCalled();
    expect(result.price).toBe('10.00');
  });

  it('throws ValidationError when zoneId is missing', async () => {
    const repo = makeShippingRateRepo();
    const uc = new CreateShippingRateUseCase(repo);

    await expect(uc.execute({ zoneId: '', name: 'Standard', price: '10.00' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when price is missing', async () => {
    const repo = makeShippingRateRepo();
    const uc = new CreateShippingRateUseCase(repo);

    await expect(uc.execute({ zoneId: 'zone-1', name: 'Standard', price: '' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('UpdateShippingRateUseCase', () => {
  it('delegates to repository.update', async () => {
    const repo = makeShippingRateRepo();
    const uc = new UpdateShippingRateUseCase(repo);

    await uc.execute('rate-1', { name: 'Express' }, makeAdmin());
    expect(repo.update).toHaveBeenCalledWith('rate-1', { name: 'Express' });
  });
});

describe('DeleteShippingRateUseCase', () => {
  it('returns ambiguous SuccessResponse on success', async () => {
    const repo = makeShippingRateRepo();
    const uc = new DeleteShippingRateUseCase(repo);

    expect(await uc.execute('rate-1', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });

  it('captures P2025 and returns ambiguous SuccessResponse', async () => {
    const repo = makeShippingRateRepo({ delete: jest.fn().mockRejectedValue(makeP2025()) });
    const uc = new DeleteShippingRateUseCase(repo);

    expect(await uc.execute('rate-x', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });
});

// ===========================================================================
// DELIVERY SLOT admin use cases
// ===========================================================================

describe('GetDeliverySlotsUseCase', () => {
  it('returns active slots', async () => {
    const repo = makeDeliverySlotRepo();
    const uc = new GetDeliverySlotsUseCase(repo);

    const result = await uc.execute();
    expect(repo.findAll).toHaveBeenCalledWith({ isActive: true });
    expect(result).toHaveLength(1);
  });
});

describe('CreateDeliverySlotUseCase', () => {
  it('creates slot with valid data', async () => {
    const repo = makeDeliverySlotRepo();
    const uc = new CreateDeliverySlotUseCase(repo);

    const result = await uc.execute(
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', maxOrders: 20 },
      makeAdmin(),
    );
    expect(repo.create).toHaveBeenCalled();
    expect(result.dayOfWeek).toBe(1);
  });

  it('throws ValidationError for invalid dayOfWeek', async () => {
    const repo = makeDeliverySlotRepo();
    const uc = new CreateDeliverySlotUseCase(repo);

    await expect(uc.execute(
      { dayOfWeek: 7, startTime: '09:00', endTime: '13:00', maxOrders: 20 },
      makeAdmin(),
    )).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for zero maxOrders', async () => {
    const repo = makeDeliverySlotRepo();
    const uc = new CreateDeliverySlotUseCase(repo);

    await expect(uc.execute(
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', maxOrders: 0 },
      makeAdmin(),
    )).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('UpdateDeliverySlotUseCase', () => {
  it('delegates to repository.update', async () => {
    const repo = makeDeliverySlotRepo();
    const uc = new UpdateDeliverySlotUseCase(repo);

    await uc.execute('slot-1', { maxOrders: 30 }, makeAdmin());
    expect(repo.update).toHaveBeenCalledWith('slot-1', { maxOrders: 30 });
  });

  it('throws ValidationError for invalid dayOfWeek in update', async () => {
    const repo = makeDeliverySlotRepo();
    const uc = new UpdateDeliverySlotUseCase(repo);

    await expect(uc.execute('slot-1', { dayOfWeek: -1 }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('DeleteDeliverySlotUseCase', () => {
  it('returns ambiguous SuccessResponse on success', async () => {
    const repo = makeDeliverySlotRepo();
    const uc = new DeleteDeliverySlotUseCase(repo);

    expect(await uc.execute('slot-1', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });

  it('captures P2025 and returns ambiguous SuccessResponse', async () => {
    const repo = makeDeliverySlotRepo({ delete: jest.fn().mockRejectedValue(makeP2025()) });
    const uc = new DeleteDeliverySlotUseCase(repo);

    expect(await uc.execute('slot-x', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });
});

// ===========================================================================
// TAX RATE admin use cases
// ===========================================================================

describe('GetTaxRatesUseCase', () => {
  it('returns active tax rates', async () => {
    const repo = makeTaxRateRepo();
    const uc = new GetTaxRatesUseCase(repo);

    const result = await uc.execute();
    expect(repo.findAll).toHaveBeenCalledWith({ isActive: true });
    expect(result).toHaveLength(1);
  });
});

describe('GetTaxRateByIdUseCase', () => {
  it('returns rate by id', async () => {
    const repo = makeTaxRateRepo();
    const uc = new GetTaxRateByIdUseCase(repo);

    const result = await uc.execute('tax-1');
    expect(result?.id).toBe('tax-1');
  });

  it('returns null when not found', async () => {
    const repo = makeTaxRateRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new GetTaxRateByIdUseCase(repo);

    expect(await uc.execute('tax-x')).toBeNull();
  });
});

describe('CreateTaxRateUseCase', () => {
  it('creates tax rate with valid data', async () => {
    const repo = makeTaxRateRepo();
    const uc = new CreateTaxRateUseCase(repo);

    const result = await uc.execute(
      { name: 'IGV Peru', rate: '0.18', country: 'PE' },
      makeAdmin(),
    );
    expect(repo.create).toHaveBeenCalled();
    expect(result.name).toBe('IGV Peru');
  });

  it('throws ValidationError for empty name', async () => {
    const repo = makeTaxRateRepo();
    const uc = new CreateTaxRateUseCase(repo);

    await expect(uc.execute({ name: '', rate: '0.18' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for rate > 1', async () => {
    const repo = makeTaxRateRepo();
    const uc = new CreateTaxRateUseCase(repo);

    await expect(uc.execute({ name: 'IGV', rate: '1.5' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for negative rate', async () => {
    const repo = makeTaxRateRepo();
    const uc = new CreateTaxRateUseCase(repo);

    await expect(uc.execute({ name: 'IGV', rate: '-0.1' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('UpdateTaxRateUseCase', () => {
  it('delegates to repository.update', async () => {
    const repo = makeTaxRateRepo();
    const uc = new UpdateTaxRateUseCase(repo);

    await uc.execute('tax-1', { name: 'IGV Updated' }, makeAdmin());
    expect(repo.update).toHaveBeenCalledWith('tax-1', { name: 'IGV Updated' });
  });

  it('throws ValidationError for invalid rate in update', async () => {
    const repo = makeTaxRateRepo();
    const uc = new UpdateTaxRateUseCase(repo);

    await expect(uc.execute('tax-1', { rate: '2.00' }, makeAdmin())).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('DeleteTaxRateUseCase', () => {
  it('returns ambiguous SuccessResponse on success', async () => {
    const repo = makeTaxRateRepo();
    const uc = new DeleteTaxRateUseCase(repo);

    expect(await uc.execute('tax-1', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });

  it('captures P2025 and returns ambiguous SuccessResponse', async () => {
    const repo = makeTaxRateRepo({ delete: jest.fn().mockRejectedValue(makeP2025()) });
    const uc = new DeleteTaxRateUseCase(repo);

    expect(await uc.execute('tax-x', makeAdmin())).toEqual({ success: true, message: 'Operation completed' });
  });

  it('rethrows unexpected errors', async () => {
    const unexpectedErr = new Error('network timeout');
    const repo = makeTaxRateRepo({ delete: jest.fn().mockRejectedValue(unexpectedErr) });
    const uc = new DeleteTaxRateUseCase(repo);

    await expect(uc.execute('tax-1', makeAdmin())).rejects.toBe(unexpectedErr);
  });
});
