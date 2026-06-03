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

import { CreateOrderUseCase } from '../CreateOrderUseCase';
import type { IOrderRepository } from '../../../domain/repositories/IOrderRepository';
import type { IProductValidationPort, ProductInfo } from '../../../domain/ports/IProductValidationPort';
import type { IEventPublisher } from '../../../domain/ports/IEventPublisher';
import type { ISequenceRepository } from '../../../domain/repositories/ISequenceRepository';
import type { IStoreSettingsRepository, StoreSettingData } from '../../../domain/repositories/IStoreSettingsRepository';
import type { Order, CreateOrderRequest, BillingData } from '../../../domain/entities/Order';
import { NotFoundError, ValidationError, BusinessLogicError } from '@hbs/shared-kernel';

const makeProduct = (overrides: Partial<ProductInfo> = {}): ProductInfo => ({
  id: 'prod-1',
  name: 'Pijama Bebé',
  isActive: true,
  price: 29.99,
  stockQuantity: 10,
  taxAffectation: 'gravado',
  variants: [
    { id: 'var-1', size: 'M', color: 'blue', stockQuantity: 5, price: 29.99, isActive: true, taxAffectation: 'gravado' },
  ],
  ...overrides,
});

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'ord-1',
  userId: 'user-1',
  orderNumber: 'ORD-2026-000001',
  customerEmail: 'test@test.com',
  customerName: 'Test User',
  status: 'pending',
  paymentStatus: 'pending',
  subtotal: 59.98,
  taxAmount: 0,
  shippingAmount: 0,
  discountAmount: 0,
  totalAmount: 59.98,
  currency: 'PEN',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeRequest = (): CreateOrderRequest => ({
  // userId and customerEmail are caller-supplied from JWT (not client input).
  userId: 'user-1',
  customerEmail: 'test@test.com',
  customerName: 'Test User',
  items: [{ productId: 'prod-1', quantity: 2, size: 'M', color: 'blue' }],
  shippingAddress: { street: '123 Main St', city: 'Lima', state: 'Lima', zipCode: '15001' },
});

const makeRepo = (order: Order = makeOrder()): jest.Mocked<IOrderRepository> =>
  ({ create: jest.fn().mockResolvedValue(order) } as any);

const makeValidation = (product: ProductInfo | null = makeProduct()): jest.Mocked<IProductValidationPort> =>
  ({ getProductById: jest.fn().mockResolvedValue(product) } as any);

const makeSequenceRepo = (): jest.Mocked<ISequenceRepository> => ({
  nextValue: jest.fn().mockResolvedValue(1n),
  nextOrderFolio: jest.fn().mockResolvedValue('ORD-2026-000001'),
} as jest.Mocked<ISequenceRepository>);

const makePublisher = (): jest.Mocked<IEventPublisher> => ({
  publishOrderCreated: jest.fn().mockResolvedValue(undefined),
  publishOrderConfirmed: jest.fn().mockResolvedValue(undefined),
  publishOrderCancelled: jest.fn().mockResolvedValue(undefined),
} as jest.Mocked<IEventPublisher>);

/** Default igv_rate = 0.18 (standard Peruvian rate) */
const makeStoreSettingsRepo = (igvRate?: string): jest.Mocked<IStoreSettingsRepository> => {
  const value: StoreSettingData | null = igvRate != null
    ? {
        id: 'set-1',
        settingKey: 'igv_rate',
        settingValue: igvRate,
        description: null,
        category: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    : null;
  return { findByKey: jest.fn().mockResolvedValue(value), findAll: jest.fn().mockResolvedValue([]) } as jest.Mocked<IStoreSettingsRepository>;
};

/** Helper: build a CreateOrderUseCase with sensible defaults */
const makeUseCase = (opts: {
  repo?: jest.Mocked<IOrderRepository>;
  validation?: jest.Mocked<IProductValidationPort>;
  publisher?: jest.Mocked<IEventPublisher>;
  seqRepo?: jest.Mocked<ISequenceRepository>;
  settingsRepo?: jest.Mocked<IStoreSettingsRepository>;
} = {}) =>
  new CreateOrderUseCase(
    opts.repo ?? makeRepo(),
    opts.validation ?? makeValidation(),
    opts.publisher ?? makePublisher(),
    opts.seqRepo ?? makeSequenceRepo(),
    opts.settingsRepo ?? makeStoreSettingsRepo('0.18'),
  );

describe('CreateOrderUseCase', () => {
  // ── Typed domain errors (assertions by instance) ───────────────────────────

  it('throws NotFoundError when product is not found', async () => {
    const uc = makeUseCase({ validation: makeValidation(null) });
    const err = await uc.execute(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toContain('prod-1');
  });

  it('throws BusinessLogicError when product is inactive', async () => {
    const uc = makeUseCase({ validation: makeValidation(makeProduct({ isActive: false })) });
    const err = await uc.execute(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect(err.message).toContain('not active');
  });

  it('throws ValidationError when product stock is insufficient', async () => {
    const uc = makeUseCase({ validation: makeValidation(makeProduct({ stockQuantity: 1 })) });
    const err = await uc.execute(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('Insufficient stock');
  });

  it('throws NotFoundError when variant is not found', async () => {
    const product = makeProduct({ variants: [] });
    const uc = makeUseCase({ validation: makeValidation(product) });
    const err = await uc.execute(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toContain('M/blue');
  });

  it('throws ValidationError when variant stock is insufficient', async () => {
    const product = makeProduct({
      variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 1, price: 29.99, isActive: true, taxAffectation: 'gravado' }],
    });
    const uc = makeUseCase({ validation: makeValidation(product) });
    const err = await uc.execute(makeRequest()).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('Insufficient variant stock');
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('creates order and publishes event on success', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const seqRepo = makeSequenceRepo();
    const uc = makeUseCase({ repo, publisher, seqRepo });

    const result = await uc.execute(makeRequest());

    expect(result.id).toBe('ord-1');
    // repo.create receives the folio embedded in the request
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ folio: 'ORD-2026-000001' }),
      expect.any(Number),
    );
    expect(publisher.publishOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord-1',
        items: [expect.objectContaining({ productId: 'prod-1', variantId: 'var-1', quantity: 2 })],
      }),
    );
  });

  it('uses sequence repository to generate folio', async () => {
    const seqRepo = makeSequenceRepo();
    const uc = makeUseCase({ seqRepo });

    await uc.execute(makeRequest());

    expect(seqRepo.nextOrderFolio).toHaveBeenCalledWith(new Date().getFullYear());
  });

  it('still returns the order when event publishing fails', async () => {
    const publisher = makePublisher();
    publisher.publishOrderCreated.mockRejectedValue(new Error('Redis down'));
    const uc = makeUseCase({ publisher });

    const result = await uc.execute(makeRequest());

    expect(result.id).toBe('ord-1');
  });

  // ── Billing data — happy paths ─────────────────────────────────────────────

  it('passes normalized billingData to repo.create when provided (DNI)', async () => {
    const repo = makeRepo();
    const billing: BillingData = {
      documentType: 'dni',
      documentNumber: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingData: expect.objectContaining({ documentNumber: '12345678' }),
      }),
      expect.any(Number),
    );
  });

  it('passes normalized billingData to repo.create when provided (RUC)', async () => {
    const repo = makeRepo();
    // 20100070970 is a valid RUC (check digit verified)
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '20100070970',
      legalName: 'Empresa SAC',
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingData: expect.objectContaining({ documentNumber: '20100070970', legalName: 'Empresa SAC' }),
      }),
      expect.any(Number),
    );
  });

  it('creates order without billingData when absent (all billing fields will be null)', async () => {
    const repo = makeRepo();
    const uc = makeUseCase({ repo });

    const result = await uc.execute(makeRequest()); // no billingData

    expect(result.id).toBe('ord-1');
    expect(repo.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ billingData: expect.anything() }),
      expect.any(Number),
    );
  });

  // ── Billing data — validation errors ──────────────────────────────────────

  it('throws ValidationError when documentType is "ruc" and legalName is missing', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '20100070970',
      // legalName intentionally absent
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('legalName');
  });

  it('throws ValidationError when documentType is "ruc" and legalName is empty string', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '20100070970',
      legalName: '   ', // whitespace-only
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('legalName');
  });

  it('throws ValidationError when documentType is "ruc" and documentNumber length is not 11', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '123', // too short
      legalName: 'Empresa SAC',
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('RUC');
  });

  it('throws ValidationError when RUC documentNumber contains non-digit characters', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '1234567890A', // 11 chars but not all digits
      legalName: 'Empresa SAC',
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('RUC');
  });

  it('throws ValidationError when documentType is "dni" and documentNumber length is not 8', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'dni',
      documentNumber: '123', // too short
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('DNI');
  });

  it('throws ValidationError when DNI documentNumber contains non-digit characters', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'dni',
      documentNumber: '1234567A', // 8 chars but last is a letter — passes .length but must fail regex
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('DNI');
  });

  it('accepts valid CE document type and stores it uppercased', async () => {
    const repo = makeRepo();
    const billing: BillingData = {
      documentType: 'ce',
      documentNumber: 'a12345678', // lowercase input — must be uppercased
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingData: expect.objectContaining({ documentNumber: 'A12345678' }),
      }),
      expect.any(Number),
    );
  });

  it('accepts valid passport document type and stores it uppercased', async () => {
    const repo = makeRepo();
    const billing: BillingData = {
      documentType: 'passport',
      documentNumber: 'ab12345',
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingData: expect.objectContaining({ documentNumber: 'AB12345' }),
      }),
      expect.any(Number),
    );
  });

  it('throws ValidationError when documentType is unknown/unsupported', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'alien_id' as any,
      documentNumber: '123456789',
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('documentType');
  });

  it('throws ValidationError when addressId is not a valid UUID v4', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'dni',
      documentNumber: '12345678',
      addressId: 'not-a-uuid', // would cause Postgres error if not caught here
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('UUID');
  });

  it('accepts valid UUID v4 as addressId', async () => {
    const repo = makeRepo();
    const billing: BillingData = {
      documentType: 'dni',
      documentNumber: '12345678',
      addressId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingData: expect.objectContaining({
          documentNumber: '12345678',
          addressId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      }),
      expect.any(Number),
    );
  });

  // ── F-2: Normalization — persisted value is always clean ──────────────────

  it('normalizes RUC with spaces and hyphens and persists clean digits', async () => {
    const repo = makeRepo();
    // 20-100-070-970 → stripped → 20100070970 (valid DV)
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '20-100-070-970',
      legalName: 'Empresa SAC',
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingData: expect.objectContaining({ documentNumber: '20100070970' }),
      }),
      expect.any(Number),
    );
  });

  it('normalizes CE lowercase to uppercase and persists uppercased value', async () => {
    const repo = makeRepo();
    const billing: BillingData = {
      documentType: 'ce',
      documentNumber: 'a12345678', // 9 lowercase chars
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    const capturedBilling = (repo.create as jest.Mock).mock.calls[0][0].billingData as BillingData;
    expect(capturedBilling.documentNumber).toBe('A12345678');
  });

  it('trims legalName whitespace before persisting', async () => {
    const repo = makeRepo();
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '20100070970',
      legalName: '  Empresa SAC  ',
    };
    const uc = makeUseCase({ repo });

    await uc.execute({ ...makeRequest(), billingData: billing });

    const capturedBilling = (repo.create as jest.Mock).mock.calls[0][0].billingData as BillingData;
    expect(capturedBilling.legalName).toBe('Empresa SAC');
  });

  // ── F-3: RUC check-digit (módulo 11) ──────────────────────────────────────

  it('throws ValidationError when RUC has a valid format but invalid check digit', async () => {
    const uc = makeUseCase();
    const billing: BillingData = {
      documentType: 'ruc',
      // 11 digits, correct format, but last digit is intentionally wrong
      documentNumber: '20100070971', // DV should be 0, not 1
      legalName: 'Empresa SAC',
    };

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain('check digit');
  });

  it('billing validation runs before product-service calls (fail fast)', async () => {
    // If billingData is invalid, productValidation must NOT be called — we fail fast
    const productValidation = makeValidation();
    const billing: BillingData = {
      documentType: 'ruc',
      documentNumber: '123', // invalid
      legalName: 'Empresa SAC',
    };
    const uc = makeUseCase({ validation: productValidation });

    const err = await uc.execute({ ...makeRequest(), billingData: billing }).catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect(productValidation.getProductById).not.toHaveBeenCalled();
  });

  // ── IGV computation ────────────────────────────────────────────────────────
  // All assertions are on the data passed to repo.create (the enriched request),
  // NOT on the returned order object (which is the mock return value and carries
  // no IGV fields unless explicitly set).

  describe('IGV computation', () => {
    /**
     * Helper: capture the first argument of repo.create (the enriched CreateOrderRequest)
     * and return it, so individual tests can assert on specific fields.
     */
    const executeAndCaptureRequest = async (opts: {
      product?: ProductInfo;
      igvRate?: string;
      quantity?: number;
    } = {}) => {
      const repo = makeRepo();
      const product = opts.product ?? makeProduct();
      const quantity = opts.quantity ?? 1;
      const settingsRepo = makeStoreSettingsRepo(opts.igvRate ?? '0.18');
      const request: CreateOrderRequest = {
        userId: 'user-1',
        customerEmail: 'test@test.com',
        customerName: 'Test User',
        items: [{ productId: product.id, quantity, size: product.variants[0].size, color: product.variants[0].color }],
        shippingAddress: { street: '123 Main St', city: 'Lima', state: 'Lima', zipCode: '15001' },
      };
      const uc = makeUseCase({ repo, validation: makeValidation(product), settingsRepo });
      await uc.execute(request);
      return (repo.create as jest.Mock).mock.calls[0][0] as CreateOrderRequest;
    };

    it('all gravado — taxableAmount = sum of bases, igvAmount > 0, exempt/nonTaxable = 0', async () => {
      // variant price = 118 (IGV-inclusive), qty = 1
      // base = 118 / 1.18 = 100.00, igv = 18.00
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const req = await executeAndCaptureRequest({ product, igvRate: '0.18', quantity: 1 });

      expect(req.taxableAmount).toBeCloseTo(100.00, 2);
      expect(req.igvAmount).toBeCloseTo(18.00, 2);
      expect(req.exemptAmount).toBe(0);
      expect(req.nonTaxableAmount).toBe(0);
    });

    it('all exonerado — igvAmount = 0, exemptAmount = total, taxable/nonTaxable = 0', async () => {
      // price = 100, exonerado → no IGV
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 100, isActive: true, taxAffectation: 'exonerado' }],
        taxAffectation: 'exonerado',
      });
      const req = await executeAndCaptureRequest({ product, igvRate: '0.18', quantity: 2 });

      expect(req.igvAmount).toBe(0);
      expect(req.exemptAmount).toBeCloseTo(200.00, 2);
      expect(req.taxableAmount).toBe(0);
      expect(req.nonTaxableAmount).toBe(0);
    });

    it('mix gravado + exonerado + inafecto — 4 accumulators correct', async () => {
      // We need 3 products × 1 quantity each. Use 3 separate execute calls OR build
      // a product with 3 distinct variants. Using separate calls for clarity.

      // Product A: gravado, price=118 → base=100, igv=18
      const productA = makeProduct({
        id: 'prod-a',
        variants: [{ id: 'var-a', size: 'S', color: 'red', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      // Product B: exonerado, price=50 → exempt=50, igv=0
      const productB = makeProduct({
        id: 'prod-b',
        name: 'Producto B',
        variants: [{ id: 'var-b', size: 'M', color: 'blue', stockQuantity: 10, price: 50, isActive: true, taxAffectation: 'exonerado' }],
        taxAffectation: 'exonerado',
      });
      // Product C: inafecto, price=30 → nonTaxable=30, igv=0
      const productC = makeProduct({
        id: 'prod-c',
        name: 'Producto C',
        variants: [{ id: 'var-c', size: 'L', color: 'green', stockQuantity: 10, price: 30, isActive: true, taxAffectation: 'inafecto' }],
        taxAffectation: 'inafecto',
      });

      const repo = makeRepo();
      const settingsRepo = makeStoreSettingsRepo('0.18');

      // Mock validation: returns each product based on productId
      const validation: jest.Mocked<IProductValidationPort> = {
        getProductById: jest.fn().mockImplementation((id: string) => {
          if (id === 'prod-a') return Promise.resolve(productA);
          if (id === 'prod-b') return Promise.resolve(productB);
          if (id === 'prod-c') return Promise.resolve(productC);
          return Promise.resolve(null);
        }),
      };

      const request: CreateOrderRequest = {
        userId: 'user-1',
        customerEmail: 'test@test.com',
        customerName: 'Test User',
        items: [
          { productId: 'prod-a', quantity: 1, size: 'S', color: 'red' },
          { productId: 'prod-b', quantity: 1, size: 'M', color: 'blue' },
          { productId: 'prod-c', quantity: 1, size: 'L', color: 'green' },
        ],
        shippingAddress: { street: '123 Main St', city: 'Lima', state: 'Lima', zipCode: '15001' },
      };

      const uc = makeUseCase({ repo, validation, settingsRepo });
      await uc.execute(request);

      const capturedReq = (repo.create as jest.Mock).mock.calls[0][0] as CreateOrderRequest;

      // taxableAmount = base of gravado line = 100.00
      expect(capturedReq.taxableAmount).toBeCloseTo(100.00, 2);
      // igvAmount = IGV of gravado line = 18.00
      expect(capturedReq.igvAmount).toBeCloseTo(18.00, 2);
      // exemptAmount = lineTotal of exonerado = 50.00
      expect(capturedReq.exemptAmount).toBeCloseTo(50.00, 2);
      // nonTaxableAmount = lineTotal of inafecto = 30.00
      expect(capturedReq.nonTaxableAmount).toBeCloseTo(30.00, 2);
    });

    it('rounding: S/.118 gravado → igvBase=100.00, igvAmount=18.00', async () => {
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const req = await executeAndCaptureRequest({ product, igvRate: '0.18', quantity: 1 });

      expect(req.taxableAmount).toBe(100.00);
      expect(req.igvAmount).toBe(18.00);
    });

    it('rounding: S/.100 gravado → igvBase=84.75 (ROUND_HALF_UP), igvAmount=15.25', async () => {
      // 100 / 1.18 = 84.745762... → ROUND_HALF_UP → 84.75
      // igv = 100 - 84.75 = 15.25
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 100, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const req = await executeAndCaptureRequest({ product, igvRate: '0.18', quantity: 1 });

      expect(req.taxableAmount).toBe(84.75);
      expect(req.igvAmount).toBe(15.25);
    });

    it('reads igv_rate from StoreSettings and uses it for computation', async () => {
      const settingsRepo = makeStoreSettingsRepo('0.18');
      const uc = makeUseCase({ settingsRepo });
      await uc.execute(makeRequest());
      expect(settingsRepo.findByKey).toHaveBeenCalledWith('igv_rate');
    });

    it('falls back to igv_rate=0.18 when StoreSettings returns null', async () => {
      // settingsRepo returns null → should use 0.18 default
      // price=118, qty=2 → lineTotal=236, base=236/1.18=200.00, igv=36.00
      const settingsRepo = makeStoreSettingsRepo(undefined); // null return
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const repo = makeRepo();
      const request: CreateOrderRequest = {
        userId: 'user-1',
        customerEmail: 'test@test.com',
        customerName: 'Test User',
        items: [{ productId: product.id, quantity: 2, size: 'M', color: 'blue' }],
        shippingAddress: { street: '123 Main St', city: 'Lima', state: 'Lima', zipCode: '15001' },
      };
      const uc = makeUseCase({ repo, validation: makeValidation(product), settingsRepo });
      await uc.execute(request);

      const capturedReq = (repo.create as jest.Mock).mock.calls[0][0] as CreateOrderRequest;
      expect(capturedReq.taxableAmount).toBeCloseTo(200.00, 2);
      expect(capturedReq.igvAmount).toBeCloseTo(36.00, 2);
    });

    it('tax affectation comes from product/variant — never from client input', async () => {
      // variant explicitly taxAffectation='exonerado'; even if someone injects it on the item
      // (which the type does not allow at resolver level), the use case uses the product snapshot.
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 100, isActive: true, taxAffectation: 'exonerado' }],
        taxAffectation: 'gravado', // product says gravado
      });
      // variant wins over product → exonerado
      const req = await executeAndCaptureRequest({ product, igvRate: '0.18', quantity: 1 });

      // Since variant.taxAffectation='exonerado', no IGV
      expect(req.igvAmount).toBe(0);
      expect(req.exemptAmount).toBeCloseTo(100.00, 2);
      expect(req.taxableAmount).toBe(0);
    });

    it('unitPrice is populated on enriched items (bug fix: was always 0)', async () => {
      // Before Ronda 2, unitPrice was hardcoded to 0. This test guards the regression.
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 59.99, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const repo = makeRepo();
      const uc = makeUseCase({ repo, validation: makeValidation(product) });
      await uc.execute(makeRequest());

      const capturedReq = (repo.create as jest.Mock).mock.calls[0][0] as CreateOrderRequest;
      // items[0].unitPrice should be 59.99 (not 0)
      expect(capturedReq.items[0].unitPrice).toBe(59.99);
    });

    it('taxAmount back-compat equals igvAmount', async () => {
      // taxAmount (legacy field) must equal igvAmount so downstream code querying
      // the legacy column still gets the correct IGV total.
      // This is enforced in PrismaOrderRepository.create — here we just confirm
      // the use case passes igvAmount correctly in the enriched request.
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const repo = makeRepo();
      const uc = makeUseCase({ repo, validation: makeValidation(product) });
      await uc.execute(makeRequest());

      const capturedReq = (repo.create as jest.Mock).mock.calls[0][0] as CreateOrderRequest;
      // The use case must populate igvAmount on the request; repo.create maps it to taxAmount.
      expect(capturedReq.igvAmount).toBeGreaterThan(0);
    });

    it('falls back to igv_rate=0.18 when StoreSettings value is non-numeric (NaN guard)', async () => {
      // 'invalid' produces NaN from parseFloat → falls back to 0.18.
      // price=118, qty=1 → lineTotal=118, base=118/1.18=100.00, igv=18.00
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const capturedReq = await executeAndCaptureRequest({ product, igvRate: 'invalid', quantity: 1 });
      expect(capturedReq.igvAmount).toBeCloseTo(18.00, 2);
      expect(capturedReq.taxableAmount).toBeCloseTo(100.00, 2);
    });

    it('falls back to igv_rate=0.18 when StoreSettings value is comma-formatted "0,18" (zero guard)', async () => {
      // parseFloat('0,18') = 0 (reads digit before comma), which is then caught by
      // the parsed > 0 guard. This prevents silent zero-tax computation.
      // price=118, qty=1 → lineTotal=118, base=118/1.18=100.00, igv=18.00
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const capturedReq = await executeAndCaptureRequest({ product, igvRate: '0,18', quantity: 1 });
      expect(capturedReq.igvAmount).toBeCloseTo(18.00, 2);
      expect(capturedReq.taxableAmount).toBeCloseTo(100.00, 2);
    });

    it('falls back to igv_rate=0.18 when StoreSettings value is out-of-range (NaN guard, >1)', async () => {
      // '2.5' is a parseable float but fails the [0,1] range check — must fall back to 0.18.
      // price=118, qty=1 → lineTotal=118, base=118/1.18=100.00, igv=18.00
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 118, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const capturedReq = await executeAndCaptureRequest({ product, igvRate: '2.5', quantity: 1 });
      expect(capturedReq.igvAmount).toBeCloseTo(18.00, 2);
      expect(capturedReq.taxableAmount).toBeCloseTo(100.00, 2);
    });

    it('lineTotal is forwarded on enriched items (Decimal consistency with igvBase)', async () => {
      // Ensures the use case populates lineTotal so PrismaOrderRepository does not
      // recompute totalPrice with float JS arithmetic (consistency fix).
      const product = makeProduct({
        variants: [{ id: 'var-1', size: 'M', color: 'blue', stockQuantity: 10, price: 59.99, isActive: true, taxAffectation: 'gravado' }],
        taxAffectation: 'gravado',
      });
      const repo = makeRepo();
      const request: CreateOrderRequest = {
        userId: 'user-1',
        customerEmail: 'test@test.com',
        customerName: 'Test User',
        items: [{ productId: product.id, quantity: 1, size: 'M', color: 'blue' }],
        shippingAddress: { street: '123 Main St', city: 'Lima', state: 'Lima', zipCode: '15001' },
      };
      const uc = makeUseCase({ repo, validation: makeValidation(product) });
      await uc.execute(request);

      const capturedReq = (repo.create as jest.Mock).mock.calls[0][0] as CreateOrderRequest;
      // unitPrice=59.99, qty=1 → lineTotal=59.99
      expect(capturedReq.items[0].lineTotal).toBeCloseTo(59.99, 2);
    });
  });
});
