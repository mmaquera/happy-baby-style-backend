/**
 * ShippingRateAdminUseCases
 *
 * Config-admin use cases for ShippingRate.
 * Guards live at the resolver layer (assertModelAccess).
 *
 * Delete semantics (rule M-2 anti-enumeration):
 *   - Captures Prisma P2025 (record not found).
 *   - ALWAYS returns { success: true, message: 'Operation completed' }.
 */

import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { ValidationError } from '@hbs/shared-kernel';
import type {
  IShippingRateRepository,
  ShippingRate,
  CreateShippingRateData,
  UpdateShippingRateData,
} from '../../domain/repositories/IShippingRateRepository';

export interface DeleteResult {
  success: boolean;
  message: string;
}

// ── GetShippingRatesByZoneUseCase ──────────────────────────────────────────────

export class GetShippingRatesByZoneUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingRateRepository: IShippingRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetShippingRatesByZoneUseCase');
  }

  /**
   * PUBLIC — returns all rates for a zone (active + inactive) ordered by price.
   * Uses findAll with zoneId filter to preserve the pre-refactor behavior of returning
   * every rate regardless of isActive. The storefront can filter client-side;
   * admin management tools need to see inactive rates too.
   */
  async execute(zoneId: string): Promise<ShippingRate[]> {
    const items = await this.shippingRateRepository.findAll({ zoneId });
    this.logger.info('ShippingRates retrieved by zone', { zoneId, count: items.length });
    return items;
  }
}

// ── CreateShippingRateUseCase ──────────────────────────────────────────────────

export class CreateShippingRateUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingRateRepository: IShippingRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateShippingRateUseCase');
  }

  async execute(data: CreateShippingRateData, currentUser: TokenPayload): Promise<ShippingRate> {
    if (!data.zoneId?.trim()) throw new ValidationError('zoneId is required', 'zoneId');
    if (!data.name?.trim()) throw new ValidationError('Rate name is required', 'name');
    if (!data.price) throw new ValidationError('Rate price is required', 'price');

    const created = await this.shippingRateRepository.create(data);
    this.logger.info('ShippingRate created', { rateId: created.id, zoneId: data.zoneId, requesterId: currentUser.userId });
    return created;
  }
}

// ── UpdateShippingRateUseCase ──────────────────────────────────────────────────

export class UpdateShippingRateUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingRateRepository: IShippingRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateShippingRateUseCase');
  }

  async execute(id: string, data: UpdateShippingRateData, currentUser: TokenPayload): Promise<ShippingRate> {
    const updated = await this.shippingRateRepository.update(id, data);
    this.logger.info('ShippingRate updated', { rateId: id, requesterId: currentUser.userId });
    return updated;
  }
}

// ── DeleteShippingRateUseCase ──────────────────────────────────────────────────

export class DeleteShippingRateUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingRateRepository: IShippingRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteShippingRateUseCase');
  }

  /** Always returns { success: true, message: 'Operation completed' } — M-2 anti-enumeration. */
  async execute(id: string, currentUser: TokenPayload): Promise<DeleteResult> {
    try {
      await this.shippingRateRepository.delete(id);
      this.logger.info('ShippingRate deleted', { rateId: id, requesterId: currentUser.userId });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        this.logger.info('DeleteShippingRate: record not found (ambiguous)', { rateId: id, requesterId: currentUser.userId });
      } else {
        this.logger.error('DeleteShippingRate: unexpected error', err instanceof Error ? err : new Error(String(err)), { rateId: id });
        throw err;
      }
    }
    return { success: true, message: 'Operation completed' };
  }
}
