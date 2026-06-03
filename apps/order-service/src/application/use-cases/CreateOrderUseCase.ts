import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { ISequenceRepository } from '../../domain/repositories/ISequenceRepository';
import { IStoreSettingsRepository } from '../../domain/repositories/IStoreSettingsRepository';
import { IProductValidationPort } from '../../domain/ports/IProductValidationPort';
import { IEventPublisher } from '../../domain/ports/IEventPublisher';
import { CreateOrderRequest, Order, BillingData, TaxAffectation } from '../../domain/entities/Order';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError, ValidationError, BusinessLogicError } from '@hbs/shared-kernel';

// Configure Decimal.js for SUNAT-compliant arithmetic:
// ROUND_HALF_UP matches standard accounting/SUNAT rounding rules.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export class CreateOrderUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productValidation: IProductValidationPort,
    private readonly eventPublisher: IEventPublisher,
    private readonly sequenceRepository: ISequenceRepository,
    private readonly storeSettingsRepository: IStoreSettingsRepository,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateOrderUseCase');
  }

  async execute(orderData: CreateOrderRequest): Promise<Order> {
    // ── Fast-fail: billing validation FIRST — cheap, synchronous, no I/O ─────
    // Running before product-service calls avoids wasting N HTTP round-trips and
    // a folio sequence increment on obviously invalid billing data.
    // validateBillingData returns the normalized copy; we replace the raw input so
    // only the clean value reaches the repository.
    if (orderData.billingData) {
      const normalizedBilling = CreateOrderUseCase.validateBillingData(orderData.billingData);
      orderData = { ...orderData, billingData: normalizedBilling };
    }

    // Read IGV rate from StoreSettings — system call, no auth guard.
    // Fallback 0.18 (18%) is the current Peruvian IGV rate.
    // Guard against mis-typed admin values (e.g. '0,18', 'invalid') that cause
    // parseFloat to return NaN — NaN propagates silently through Decimal arithmetic
    // and produces an opaque Prisma failure. Fall back to 0.18 + warn instead of
    // breaking checkout over a bad config entry.
    const igvSetting = await this.storeSettingsRepository.findByKey('igv_rate');
    let igvRate: Decimal;
    if (igvSetting) {
      const parsed = parseFloat(igvSetting.settingValue);
      // Accept rates in (0, 1]: 0 is rejected because parseFloat('0,18') returns 0
      // (reads the digit before the comma), which would silently compute zero tax.
      // A rate of exactly 0 configured in DB almost always signals a typo, not a
      // deliberate zero-rate setting. Future zero-rate support should be explicit.
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) {
        igvRate = new Decimal(parsed);
      } else {
        this.logger.warn('igv_rate setting is invalid — falling back to 0.18', {
          rawValue: igvSetting.settingValue,
        });
        igvRate = new Decimal(0.18);
      }
    } else {
      igvRate = new Decimal(0.18);
    }

    // Validate products and calculate total via product-service (no direct DB dependency)
    const validatedItems = await Promise.all(
      orderData.items.map(async (item) => {
        const product = await this.productValidation.getProductById(item.productId);

        if (!product) {
          throw new NotFoundError('Product', item.productId);
        }
        if (!product.isActive) {
          throw new BusinessLogicError(`Product ${product.name} is not active`);
        }

        const totalStock = product.stockQuantity;
        if (totalStock < item.quantity) {
          throw new ValidationError(
            `Insufficient stock for product ${product.name}. Available: ${totalStock}, Requested: ${item.quantity}`,
            'quantity',
          );
        }

        const variant = product.variants?.find(
          (v) => v.size === item.size && v.color === item.color && v.isActive,
        );

        if (!variant) {
          throw new NotFoundError('ProductVariant', `${item.size}/${item.color} for product ${product.name}`);
        }

        if (variant.stockQuantity < item.quantity) {
          throw new ValidationError(
            `Insufficient variant stock for ${item.size}/${item.color} of ${product.name}. Available: ${variant.stockQuantity}`,
            'quantity',
          );
        }

        // Effective tax affectation: variant wins over product; default 'gravado' when
        // product-service hasn't been deployed with the new field yet (retro-compat).
        // NEVER read this from client input — rule C-1 (anti-manipulation).
        const effectiveTaxAffectation: TaxAffectation =
          variant.taxAffectation ?? product.taxAffectation ?? 'gravado';

        return { product, variant, item, effectiveTaxAffectation };
      }),
    );

    // ── IGV computation (all arithmetic via Decimal.js, ROUND_HALF_UP) ────────
    //
    // Prices are IGV-INCLUDED (precio con IGV). For 'gravado' lines:
    //   igvBase = lineTotal / (1 + igvRate)   → base imponible (excl. IGV)
    //   igvLineAmount = lineTotal - igvBase    → tax portion
    //
    // For exonerado/inafecto lines, no IGV applies:
    //   igvBase = lineTotal
    //   igvLineAmount = 0
    //
    // Order-level accumulators (SUNAT-aligned):
    //   taxableAmount  = Σ igvBase for gravado lines
    //   exemptAmount   = Σ lineTotal for exonerado lines
    //   nonTaxableAmount = Σ lineTotal for inafecto lines
    //   igvAmount      = Σ igvLineAmount (only gravado lines contribute)

    let taxableAmount = new Decimal(0);
    let exemptAmount = new Decimal(0);
    let nonTaxableAmount = new Decimal(0);
    let igvAmount = new Decimal(0);
    let subtotalDecimal = new Decimal(0);

    const computedItems = validatedItems.map(({ product, variant, item, effectiveTaxAffectation }) => {
      // Use ?? not || so that a variant with price=0 (free sample, gift) does not
      // accidentally fall back to the product price. 0 is a valid explicit variant price.
      const effectivePrice = variant.price ?? product.price;
      const lineTotal = new Decimal(effectivePrice).mul(item.quantity).toDP(2);

      let igvBase: Decimal;
      let igvLineAmount: Decimal;

      if (effectiveTaxAffectation === 'gravado') {
        // Prices are IGV-inclusive: extract the base (excl. IGV)
        igvBase = lineTotal.div(new Decimal(1).plus(igvRate)).toDP(2);
        igvLineAmount = lineTotal.minus(igvBase).toDP(2);
        taxableAmount = taxableAmount.plus(igvBase);
        igvAmount = igvAmount.plus(igvLineAmount);
      } else {
        // exonerado or inafecto: entire line amount is the base, no IGV
        igvBase = lineTotal;
        igvLineAmount = new Decimal(0);
        if (effectiveTaxAffectation === 'exonerado') {
          exemptAmount = exemptAmount.plus(lineTotal);
        } else {
          nonTaxableAmount = nonTaxableAmount.plus(lineTotal);
        }
      }

      subtotalDecimal = subtotalDecimal.plus(lineTotal);

      return {
        product,
        variant,
        item,
        effectiveTaxAffectation,
        effectivePrice,
        lineTotal,
        igvBase: igvBase.toDP(2),
        igvLineAmount: igvLineAmount.toDP(2),
      };
    });

    // Round accumulators to 2dp before persisting
    taxableAmount = taxableAmount.toDP(2);
    exemptAmount = exemptAmount.toDP(2);
    nonTaxableAmount = nonTaxableAmount.toDP(2);
    igvAmount = igvAmount.toDP(2);
    subtotalDecimal = subtotalDecimal.toDP(2);

    // totalAmount = subtotal + shipping − discount (shipping and discount kept from
    // existing logic; they are 0 at create time currently).
    const shippingAmount = new Decimal(0);
    const discountAmount = new Decimal(0);
    const totalAmount = subtotalDecimal.plus(shippingAmount).minus(discountAmount).toDP(2);

    // Enrich each item with the computed fiscal snapshot before passing to repo.
    // lineTotal (Decimal) is forwarded so PrismaOrderRepository can write the
    // totalPrice column with the same decimal-precise value rather than
    // recomputing it with float JS arithmetic.
    const enrichedItems = computedItems.map(({ item, effectiveTaxAffectation, effectivePrice, lineTotal, igvBase, igvLineAmount }) => ({
      ...item,
      unitPrice: effectivePrice,
      lineTotal: lineTotal.toNumber(),
      taxAffectation: effectiveTaxAffectation,
      igvBase: igvBase.toNumber(),
      igvAmount: igvLineAmount.toNumber(),
    }));

    // Generate a folio before creating the order so the orderNumber is a human-readable
    // document identifier (ORD-YYYY-NNNNNN) rather than Date.now()+random.
    const year = new Date().getFullYear();
    const folio = await this.sequenceRepository.nextOrderFolio(year);

    const enrichedOrderData: CreateOrderRequest = {
      ...orderData,
      folio,
      items: enrichedItems,
      // IGV accumulators — passed to repo for persistence
      taxableAmount: taxableAmount.toNumber(),
      exemptAmount: exemptAmount.toNumber(),
      nonTaxableAmount: nonTaxableAmount.toNumber(),
      igvAmount: igvAmount.toNumber(),
    };

    const order = await this.orderRepository.create(enrichedOrderData, totalAmount.toNumber());

    // Publish event so product-service decrements stock (consumed via Redis Stream).
    try {
      await this.eventPublisher.publishOrderCreated({
        eventId: randomUUID(),
        orderId: order.id,
        orderNumber: order.orderNumber,
        items: computedItems.map(({ variant, item }) => ({
          productId: item.productId,
          variantId: variant.id,
          variantSize: item.size,
          variantColor: item.color,
          quantity: item.quantity,
        })),
        createdAt: order.createdAt.toISOString(),
      });
    } catch (publishError) {
      // Order is committed but the stock event was not durably enqueued: stock will NOT
      // be decremented until this is reconciled. Surfaced as an error for alerting.
      this.logger.error(
        'Failed to enqueue order.created event — stock decrement skipped',
        publishError instanceof Error ? publishError : new Error(String(publishError)),
        { orderId: order.id },
      );
    }

    this.logger.info('Order created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: totalAmount.toNumber(),
      taxableAmount: taxableAmount.toNumber(),
      igvAmount: igvAmount.toNumber(),
    });

    return order;
  }

  /**
   * Verifies the RUC check digit using the SUNAT módulo-11 algorithm.
   *
   * Weights: [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] applied to digits 0–9.
   * sum = Σ(digit[i] * weight[i]) for i = 0..9
   * remainder = sum % 11
   * expected = 11 - remainder  →  if 10 → 0, if 11 → 1
   * valid if digit[10] === expected
   *
   * @param ruc 11-digit string (digits only — already validated by regex before this is called).
   */
  private static verifyRucCheckDigit(ruc: string): boolean {
    const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const digits = ruc.split('').map(Number);
    const sum = WEIGHTS.reduce((acc, w, i) => acc + w * digits[i], 0);
    const remainder = sum % 11;
    let expected = 11 - remainder;
    if (expected === 10) expected = 0;
    if (expected === 11) expected = 1;
    return digits[10] === expected;
  }

  /**
   * Validates and normalizes SUNAT billing data.
   *
   * Normalization (applied BEFORE validation):
   * - documentNumber: trimmed; for ruc/dni stripped of spaces and hyphens then non-digits removed;
   *   for ce/passport uppercased.
   * - legalName: trimmed.
   *
   * Rules enforced:
   * - 'ruc': 11 numeric digits only + legalName required + check-digit módulo-11.
   * - 'dni': 8 numeric digits only.
   * - 'ce': 9–12 alphanumeric characters.
   * - 'passport': 5–20 alphanumeric characters (permissive, no SUNAT check).
   * - addressId: UUID v4 format when provided.
   *
   * Returns the normalized BillingData so the caller persists clean values.
   *
   * @throws ValidationError on any constraint violation.
   */
  static validateBillingData(billing: BillingData): BillingData {
    const { documentType, addressId } = billing;

    // ── Normalize ─────────────────────────────────────────────────────────────
    let documentNumber = billing.documentNumber.trim();
    let legalName = billing.legalName?.trim();

    switch (documentType) {
      case 'ruc':
      case 'dni': {
        // Strip spaces and hyphens, then discard any remaining non-digit character.
        documentNumber = documentNumber.replace(/[\s\-]/g, '').replace(/[^\d]/g, '');
        break;
      }
      case 'ce':
      case 'passport': {
        documentNumber = documentNumber.toUpperCase();
        break;
      }
      // unknown type falls through to the validation switch below
    }

    // ── Validate ──────────────────────────────────────────────────────────────
    switch (documentType) {
      case 'ruc': {
        if (!legalName || legalName === '') {
          throw new ValidationError(
            'legalName is required when documentType is "ruc"',
            'billingData.legalName',
          );
        }
        if (!/^\d{11}$/.test(documentNumber)) {
          throw new ValidationError(
            'RUC must be exactly 11 numeric digits',
            'billingData.documentNumber',
          );
        }
        // Depth-in-defense: check-digit verification (módulo 11).
        // order-service validates consistency; invoicing-service will be authoritative.
        if (!CreateOrderUseCase.verifyRucCheckDigit(documentNumber)) {
          throw new ValidationError(
            'RUC check digit is invalid',
            'billingData.documentNumber',
          );
        }
        break;
      }
      case 'dni': {
        if (!/^\d{8}$/.test(documentNumber)) {
          throw new ValidationError(
            'DNI must be exactly 8 numeric digits',
            'billingData.documentNumber',
          );
        }
        break;
      }
      case 'ce': {
        // Carné de Extranjería: 9–12 alphanumeric chars (SUNAT catálogo 07)
        if (!/^[A-Z0-9]{9,12}$/.test(documentNumber)) {
          throw new ValidationError(
            'CE must be between 9 and 12 alphanumeric characters',
            'billingData.documentNumber',
          );
        }
        break;
      }
      case 'passport': {
        // Passport: permissive 5–20 alphanumeric (no SUNAT-specific rule)
        if (!/^[A-Z0-9]{5,20}$/.test(documentNumber)) {
          throw new ValidationError(
            'Passport number must be between 5 and 20 alphanumeric characters',
            'billingData.documentNumber',
          );
        }
        break;
      }
      default: {
        throw new ValidationError(
          `Unsupported documentType "${documentType}". Allowed: ruc, dni, ce, passport`,
          'billingData.documentType',
        );
      }
    }

    // UUID v4 format guard for addressId — DB column is @db.Uuid; invalid values throw
    // an unhandled Postgres error. Validate here to return a typed BAD_USER_INPUT instead.
    if (addressId !== undefined && addressId !== null) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(addressId)) {
        throw new ValidationError(
          'billingData.addressId must be a valid UUID v4',
          'billingData.addressId',
        );
      }
    }

    // Return normalized billing so the caller persists the clean value.
    return {
      ...billing,
      documentNumber,
      ...(legalName !== undefined && { legalName }),
    };
  }
}
