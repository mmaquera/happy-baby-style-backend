/**
 * productTransformer — taxAffectation inheritance tests.
 *
 * The transformer is pure (no I/O, no DI), so no mocks are needed beyond the
 * standard @hbs/logging mock (required by every spec in the project even if not
 * directly used, to satisfy the module resolver in ts-jest).
 */
jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
        createServiceLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
        createRepositoryLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
      }),
    },
  }),
  { virtual: true },
);

import { ProductEntity, ProductVariantEntity, TaxAffectation } from '../../../domain/entities/Product';
import { transformProduct, transformVariant } from '../productTransformer';

// ── Factories ──────────────────────────────────────────────────────────────────

function makeVariantEntity(overrides: Partial<{
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  attributes: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  taxAffectation: TaxAffectation | undefined;
}> = {}): ProductVariantEntity {
  return new ProductVariantEntity(
    overrides.id ?? 'var-1',
    overrides.productId ?? 'prod-1',
    overrides.name ?? 'Variant A',
    overrides.sku ?? 'SKU-VAR-001',
    overrides.price ?? 90,
    overrides.stockQuantity ?? 5,
    overrides.attributes ?? {},
    overrides.isActive ?? true,
    overrides.createdAt ?? new Date('2024-01-01'),
    overrides.updatedAt ?? new Date('2024-01-01'),
    overrides.taxAffectation,
  );
}

function makeProductEntity(overrides: Partial<{
  taxAffectation: TaxAffectation;
  variants: ProductVariantEntity[];
}> = {}): ProductEntity {
  const variants = overrides.variants ?? [];
  return new ProductEntity(
    'prod-1',
    'cat-1',
    'Test Product',
    'A description',
    100,
    undefined,
    'SKU-001',
    [],
    {},
    true,
    10,
    [],
    0,
    0,
    overrides.taxAffectation ?? 'gravado',
    new Date('2024-01-01'),
    new Date('2024-01-01'),
    variants,
  );
}

// ── transformVariant (standalone) ─────────────────────────────────────────────

describe('transformVariant — standalone (no parentTaxAffectation)', () => {
  it('returns the variant taxAffectation when explicitly set', () => {
    const variant = makeVariantEntity({ taxAffectation: 'exonerado' });
    const dto = transformVariant(variant);
    expect(dto.taxAffectation).toBe('exonerado');
  });

  it('returns null when variant taxAffectation is undefined and no parent is provided', () => {
    const variant = makeVariantEntity({ taxAffectation: undefined });
    const dto = transformVariant(variant);
    expect(dto.taxAffectation).toBeNull();
  });

  it('includes all core fields', () => {
    const variant = makeVariantEntity({ taxAffectation: 'gravado' });
    const dto = transformVariant(variant);
    expect(dto).toMatchObject({
      id: 'var-1',
      productId: 'prod-1',
      sku: 'SKU-VAR-001',
      taxAffectation: 'gravado',
    });
  });
});

// ── transformVariant (with parent context) ────────────────────────────────────

describe('transformVariant — with parentTaxAffectation (inheritance resolution)', () => {
  it('returns variant own value when set, ignoring parent', () => {
    const variant = makeVariantEntity({ taxAffectation: 'inafecto' });
    const dto = transformVariant(variant, 'gravado');
    expect(dto.taxAffectation).toBe('inafecto');
  });

  it('falls back to parent taxAffectation when variant is null/undefined', () => {
    const variant = makeVariantEntity({ taxAffectation: undefined });
    const dto = transformVariant(variant, 'exonerado');
    expect(dto.taxAffectation).toBe('exonerado');
  });

  it('falls back to gravado parent when variant is null/undefined', () => {
    const variant = makeVariantEntity({ taxAffectation: undefined });
    const dto = transformVariant(variant, 'gravado');
    expect(dto.taxAffectation).toBe('gravado');
  });

  it('falls back to inafecto parent when variant is null/undefined', () => {
    const variant = makeVariantEntity({ taxAffectation: undefined });
    const dto = transformVariant(variant, 'inafecto');
    expect(dto.taxAffectation).toBe('inafecto');
  });
});

// ── transformProduct — variant inheritance propagation ────────────────────────

describe('transformProduct — variant taxAffectation inheritance via transformProduct', () => {
  it('variant with null taxAffectation inherits gravado from parent product', () => {
    const variant = makeVariantEntity({ taxAffectation: undefined });
    const product = makeProductEntity({ taxAffectation: 'gravado', variants: [variant] });

    const dto = transformProduct(product);

    expect(dto.taxAffectation).toBe('gravado');
    expect(dto.variants).toHaveLength(1);
    expect(dto.variants[0].taxAffectation).toBe('gravado');
  });

  it('variant with null taxAffectation inherits exonerado from parent product', () => {
    const variant = makeVariantEntity({ taxAffectation: undefined });
    const product = makeProductEntity({ taxAffectation: 'exonerado', variants: [variant] });

    const dto = transformProduct(product);

    expect(dto.variants[0].taxAffectation).toBe('exonerado');
  });

  it('variant with explicit inafecto overrides parent gravado', () => {
    const variant = makeVariantEntity({ taxAffectation: 'inafecto' });
    const product = makeProductEntity({ taxAffectation: 'gravado', variants: [variant] });

    const dto = transformProduct(product);

    expect(dto.variants[0].taxAffectation).toBe('inafecto');
  });

  it('variant with explicit exonerado overrides parent inafecto', () => {
    const variant = makeVariantEntity({ taxAffectation: 'exonerado' });
    const product = makeProductEntity({ taxAffectation: 'inafecto', variants: [variant] });

    const dto = transformProduct(product);

    expect(dto.variants[0].taxAffectation).toBe('exonerado');
  });

  it('product with no variants returns empty variants array', () => {
    const product = makeProductEntity({ taxAffectation: 'gravado', variants: [] });
    const dto = transformProduct(product);
    expect(dto.variants).toHaveLength(0);
  });

  it('multiple variants each resolve inheritance independently', () => {
    const varInherits = makeVariantEntity({ id: 'var-1', sku: 'SKU-1', taxAffectation: undefined });
    const varOverride = makeVariantEntity({ id: 'var-2', sku: 'SKU-2', taxAffectation: 'inafecto' });
    const product = makeProductEntity({ taxAffectation: 'exonerado', variants: [varInherits, varOverride] });

    const dto = transformProduct(product);

    expect(dto.variants[0].taxAffectation).toBe('exonerado'); // inherited
    expect(dto.variants[1].taxAffectation).toBe('inafecto');  // own value wins
  });
});
