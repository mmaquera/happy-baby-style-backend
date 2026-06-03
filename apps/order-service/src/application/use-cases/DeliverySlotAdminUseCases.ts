/**
 * DeliverySlotAdminUseCases
 *
 * Config-admin use cases for DeliverySlot.
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
  IDeliverySlotRepository,
  DeliverySlot,
  CreateDeliverySlotData,
  UpdateDeliverySlotData,
} from '../../domain/repositories/IDeliverySlotRepository';

export interface DeleteResult {
  success: boolean;
  message: string;
}

// ── GetDeliverySlotsUseCase ────────────────────────────────────────────────────

export class GetDeliverySlotsUseCase {
  private readonly logger: ILogger;

  constructor(private readonly deliverySlotRepository: IDeliverySlotRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetDeliverySlotsUseCase');
  }

  /** PUBLIC — storefront needs active slots without authentication. */
  async execute(): Promise<DeliverySlot[]> {
    const items = await this.deliverySlotRepository.findAll({ isActive: true });
    this.logger.info('DeliverySlots retrieved', { count: items.length });
    return items;
  }
}

// ── CreateDeliverySlotUseCase ──────────────────────────────────────────────────

export class CreateDeliverySlotUseCase {
  private readonly logger: ILogger;

  constructor(private readonly deliverySlotRepository: IDeliverySlotRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateDeliverySlotUseCase');
  }

  async execute(data: CreateDeliverySlotData, currentUser: TokenPayload): Promise<DeliverySlot> {
    if (data.dayOfWeek < 0 || data.dayOfWeek > 6)
      throw new ValidationError('dayOfWeek must be 0–6 (Sun–Sat)', 'dayOfWeek');
    if (!data.startTime?.trim()) throw new ValidationError('startTime is required', 'startTime');
    if (!data.endTime?.trim()) throw new ValidationError('endTime is required', 'endTime');
    if (data.maxOrders <= 0) throw new ValidationError('maxOrders must be positive', 'maxOrders');

    const created = await this.deliverySlotRepository.create(data);
    this.logger.info('DeliverySlot created', { slotId: created.id, dayOfWeek: data.dayOfWeek, requesterId: currentUser.userId });
    return created;
  }
}

// ── UpdateDeliverySlotUseCase ──────────────────────────────────────────────────

export class UpdateDeliverySlotUseCase {
  private readonly logger: ILogger;

  constructor(private readonly deliverySlotRepository: IDeliverySlotRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateDeliverySlotUseCase');
  }

  async execute(id: string, data: UpdateDeliverySlotData, currentUser: TokenPayload): Promise<DeliverySlot> {
    if (data.dayOfWeek !== undefined && (data.dayOfWeek < 0 || data.dayOfWeek > 6))
      throw new ValidationError('dayOfWeek must be 0–6 (Sun–Sat)', 'dayOfWeek');
    if (data.maxOrders !== undefined && data.maxOrders <= 0)
      throw new ValidationError('maxOrders must be positive', 'maxOrders');

    const updated = await this.deliverySlotRepository.update(id, data);
    this.logger.info('DeliverySlot updated', { slotId: id, requesterId: currentUser.userId });
    return updated;
  }
}

// ── DeleteDeliverySlotUseCase ──────────────────────────────────────────────────

export class DeleteDeliverySlotUseCase {
  private readonly logger: ILogger;

  constructor(private readonly deliverySlotRepository: IDeliverySlotRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteDeliverySlotUseCase');
  }

  /** Always returns { success: true, message: 'Operation completed' } — M-2 anti-enumeration. */
  async execute(id: string, currentUser: TokenPayload): Promise<DeleteResult> {
    try {
      await this.deliverySlotRepository.delete(id);
      this.logger.info('DeliverySlot deleted', { slotId: id, requesterId: currentUser.userId });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        this.logger.info('DeleteDeliverySlot: record not found (ambiguous)', { slotId: id, requesterId: currentUser.userId });
      } else {
        this.logger.error('DeleteDeliverySlot: unexpected error', err instanceof Error ? err : new Error(String(err)), { slotId: id });
        throw err;
      }
    }
    return { success: true, message: 'Operation completed' };
  }
}
