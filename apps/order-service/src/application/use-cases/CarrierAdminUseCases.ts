/**
 * CarrierAdminUseCases
 *
 * Config-admin use cases for Carrier (shipping carriers / couriers).
 * Guards live at the resolver layer (assertModelAccess). These use cases assume
 * an already-validated currentUser.
 *
 * Delete semantics (rule M-2 anti-enumeration):
 *   - Captures Prisma P2025 (record not found).
 *   - ALWAYS returns { success: true, message: 'Operation completed' }.
 */

import type { TokenPayload } from '@hbs/auth';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { ValidationError } from '@hbs/shared-kernel';
import type {
  ICarrierRepository,
  Carrier,
  CreateCarrierData,
  UpdateCarrierData,
} from '../../domain/repositories/ICarrierRepository';

export interface DeleteResult {
  success: boolean;
  message: string;
}

// ── GetCarriersUseCase ─────────────────────────────────────────────────────────

export class GetCarriersUseCase {
  private readonly logger: ILogger;

  constructor(private readonly carrierRepository: ICarrierRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCarriersUseCase');
  }

  /** PUBLIC — storefront needs carrier list without authentication. */
  async execute(): Promise<Carrier[]> {
    const items = await this.carrierRepository.findAll();
    this.logger.info('Carriers retrieved', { count: items.length });
    return items;
  }
}

// ── GetCarrierByIdUseCase ──────────────────────────────────────────────────────

export class GetCarrierByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly carrierRepository: ICarrierRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetCarrierByIdUseCase');
  }

  /** PUBLIC — storefront lookup without authentication. Returns null when not found. */
  async execute(id: string): Promise<Carrier | null> {
    const carrier = await this.carrierRepository.findById(id);
    this.logger.info('Carrier lookup by id', { carrierId: id, found: carrier !== null });
    return carrier;
  }
}

// ── CreateCarrierUseCase ───────────────────────────────────────────────────────

export class CreateCarrierUseCase {
  private readonly logger: ILogger;

  constructor(private readonly carrierRepository: ICarrierRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateCarrierUseCase');
  }

  async execute(data: CreateCarrierData, currentUser: TokenPayload): Promise<Carrier> {
    if (!data.name?.trim()) throw new ValidationError('Carrier name is required', 'name');
    if (!data.code?.trim()) throw new ValidationError('Carrier code is required', 'code');

    const created = await this.carrierRepository.create({
      ...data,
      name: data.name.trim(),
      code: data.code.trim(),
    });
    this.logger.info('Carrier created', { carrierId: created.id, code: created.code, requesterId: currentUser.userId });
    return created;
  }
}

// ── UpdateCarrierUseCase ───────────────────────────────────────────────────────

export class UpdateCarrierUseCase {
  private readonly logger: ILogger;

  constructor(private readonly carrierRepository: ICarrierRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateCarrierUseCase');
  }

  async execute(id: string, data: UpdateCarrierData, currentUser: TokenPayload): Promise<Carrier> {
    const updated = await this.carrierRepository.update(id, data);
    this.logger.info('Carrier updated', { carrierId: id, requesterId: currentUser.userId });
    return updated;
  }
}

// ── DeleteCarrierUseCase ───────────────────────────────────────────────────────

export class DeleteCarrierUseCase {
  private readonly logger: ILogger;

  constructor(private readonly carrierRepository: ICarrierRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteCarrierUseCase');
  }

  /** Always returns { success: true, message: 'Operation completed' } — M-2 anti-enumeration. */
  async execute(id: string, currentUser: TokenPayload): Promise<DeleteResult> {
    try {
      await this.carrierRepository.delete(id);
      this.logger.info('Carrier deleted', { carrierId: id, requesterId: currentUser.userId });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        this.logger.info('DeleteCarrier: record not found (ambiguous)', { carrierId: id, requesterId: currentUser.userId });
      } else {
        this.logger.error('DeleteCarrier: unexpected error', err instanceof Error ? err : new Error(String(err)), { carrierId: id });
        throw err;
      }
    }
    return { success: true, message: 'Operation completed' };
  }
}
