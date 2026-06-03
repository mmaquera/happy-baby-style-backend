/**
 * TaxRateAdminUseCases
 *
 * Config-admin use cases for TaxRate.
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
  ITaxRateRepository,
  TaxRate,
  CreateTaxRateData,
  UpdateTaxRateData,
} from '../../domain/repositories/ITaxRateRepository';

export interface DeleteResult {
  success: boolean;
  message: string;
}

// ── GetTaxRatesUseCase ─────────────────────────────────────────────────────────

export class GetTaxRatesUseCase {
  private readonly logger: ILogger;

  constructor(private readonly taxRateRepository: ITaxRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetTaxRatesUseCase');
  }

  /** PUBLIC — storefront needs tax rates without authentication. Returns only active rates. */
  async execute(): Promise<TaxRate[]> {
    const items = await this.taxRateRepository.findAll({ isActive: true });
    this.logger.info('TaxRates retrieved', { count: items.length });
    return items;
  }
}

// ── GetTaxRateByIdUseCase ──────────────────────────────────────────────────────

export class GetTaxRateByIdUseCase {
  private readonly logger: ILogger;

  constructor(private readonly taxRateRepository: ITaxRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetTaxRateByIdUseCase');
  }

  /** PUBLIC — storefront lookup without authentication. Returns null when not found. */
  async execute(id: string): Promise<TaxRate | null> {
    const rate = await this.taxRateRepository.findById(id);
    this.logger.info('TaxRate lookup by id', { taxRateId: id, found: rate !== null });
    return rate;
  }
}

// ── CreateTaxRateUseCase ───────────────────────────────────────────────────────

export class CreateTaxRateUseCase {
  private readonly logger: ILogger;

  constructor(private readonly taxRateRepository: ITaxRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateTaxRateUseCase');
  }

  async execute(data: CreateTaxRateData, currentUser: TokenPayload): Promise<TaxRate> {
    if (!data.name?.trim()) throw new ValidationError('TaxRate name is required', 'name');
    if (!data.rate?.trim()) throw new ValidationError('TaxRate rate is required', 'rate');
    const rateNum = parseFloat(data.rate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 1)
      throw new ValidationError('rate must be a decimal between 0 and 1 (e.g. 0.18 for 18%)', 'rate');

    const created = await this.taxRateRepository.create({ ...data, name: data.name.trim() });
    this.logger.info('TaxRate created', { taxRateId: created.id, name: created.name, requesterId: currentUser.userId });
    return created;
  }
}

// ── UpdateTaxRateUseCase ───────────────────────────────────────────────────────

export class UpdateTaxRateUseCase {
  private readonly logger: ILogger;

  constructor(private readonly taxRateRepository: ITaxRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UpdateTaxRateUseCase');
  }

  async execute(id: string, data: UpdateTaxRateData, currentUser: TokenPayload): Promise<TaxRate> {
    if (data.rate !== undefined) {
      const rateNum = parseFloat(data.rate);
      if (isNaN(rateNum) || rateNum < 0 || rateNum > 1)
        throw new ValidationError('rate must be a decimal between 0 and 1 (e.g. 0.18 for 18%)', 'rate');
    }

    const updated = await this.taxRateRepository.update(id, data);
    this.logger.info('TaxRate updated', { taxRateId: id, requesterId: currentUser.userId });
    return updated;
  }
}

// ── DeleteTaxRateUseCase ───────────────────────────────────────────────────────

export class DeleteTaxRateUseCase {
  private readonly logger: ILogger;

  constructor(private readonly taxRateRepository: ITaxRateRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteTaxRateUseCase');
  }

  /** Always returns { success: true, message: 'Operation completed' } — M-2 anti-enumeration. */
  async execute(id: string, currentUser: TokenPayload): Promise<DeleteResult> {
    try {
      await this.taxRateRepository.delete(id);
      this.logger.info('TaxRate deleted', { taxRateId: id, requesterId: currentUser.userId });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        this.logger.info('DeleteTaxRate: record not found (ambiguous)', { taxRateId: id, requesterId: currentUser.userId });
      } else {
        this.logger.error('DeleteTaxRate: unexpected error', err instanceof Error ? err : new Error(String(err)), { taxRateId: id });
        throw err;
      }
    }
    return { success: true, message: 'Operation completed' };
  }
}
