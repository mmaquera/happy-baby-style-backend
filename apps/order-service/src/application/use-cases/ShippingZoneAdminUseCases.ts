/**
 * ShippingZoneAdminUseCases
 *
 * Config-admin use cases for ShippingZone.
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
  IShippingZoneRepository,
  ShippingZone,
  CreateShippingZoneData,
  UpdateShippingZoneData,
} from '../../domain/repositories/IShippingZoneRepository';

export interface DeleteResult {
  success: boolean;
  message: string;
}

// ── GetShippingZonesUseCase ────────────────────────────────────────────────────

export class GetShippingZonesUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingZoneRepository: IShippingZoneRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetShippingZonesUseCase');
  }

  /** PUBLIC — storefront needs zone list without authentication. */
  async execute(): Promise<ShippingZone[]> {
    const items = await this.shippingZoneRepository.findAll();
    this.logger.info('ShippingZones retrieved', { count: items.length });
    return items;
  }
}

// ── GetShippingZoneByIdUseCase ─────────────────────────────────────────────────

export class GetShippingZoneByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingZoneRepository: IShippingZoneRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetShippingZoneByIdUseCase');
  }

  /** PUBLIC — storefront lookup without authentication. Returns null when not found. */
  async execute(id: string): Promise<ShippingZone | null> {
    const zone = await this.shippingZoneRepository.findById(id);
    this.logger.info('ShippingZone lookup by id', { zoneId: id, found: zone !== null });
    return zone;
  }
}

// ── CreateShippingZoneUseCase ──────────────────────────────────────────────────

export class CreateShippingZoneUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingZoneRepository: IShippingZoneRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateShippingZoneUseCase');
  }

  async execute(data: CreateShippingZoneData, currentUser: TokenPayload): Promise<ShippingZone> {
    if (!data.name?.trim()) throw new ValidationError('Zone name is required', 'name');

    const created = await this.shippingZoneRepository.create({
      ...data,
      name: data.name.trim(),
    });
    this.logger.info('ShippingZone created', { zoneId: created.id, name: created.name, requesterId: currentUser.userId });
    return created;
  }
}

// ── UpdateShippingZoneUseCase ──────────────────────────────────────────────────

export class UpdateShippingZoneUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingZoneRepository: IShippingZoneRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateShippingZoneUseCase');
  }

  async execute(id: string, data: UpdateShippingZoneData, currentUser: TokenPayload): Promise<ShippingZone> {
    const updated = await this.shippingZoneRepository.update(id, data);
    this.logger.info('ShippingZone updated', { zoneId: id, requesterId: currentUser.userId });
    return updated;
  }
}

// ── DeleteShippingZoneUseCase ──────────────────────────────────────────────────

export class DeleteShippingZoneUseCase {
  private readonly logger: ILogger;

  constructor(private readonly shippingZoneRepository: IShippingZoneRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteShippingZoneUseCase');
  }

  /** Always returns { success: true, message: 'Operation completed' } — M-2 anti-enumeration. */
  async execute(id: string, currentUser: TokenPayload): Promise<DeleteResult> {
    try {
      await this.shippingZoneRepository.delete(id);
      this.logger.info('ShippingZone deleted', { zoneId: id, requesterId: currentUser.userId });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        this.logger.info('DeleteShippingZone: record not found (ambiguous)', { zoneId: id, requesterId: currentUser.userId });
      } else {
        this.logger.error('DeleteShippingZone: unexpected error', err instanceof Error ? err : new Error(String(err)), { zoneId: id });
        throw err;
      }
    }
    return { success: true, message: 'Operation completed' };
  }
}
