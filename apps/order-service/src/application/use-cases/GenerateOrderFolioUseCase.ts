import { ISequenceRepository } from '../../domain/repositories/ISequenceRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

export interface GenerateOrderFolioResult {
  folio: string;
  year: number;
  sequence: bigint;
}

/**
 * GenerateOrderFolioUseCase
 *
 * Generates a human-readable, gap-tolerant order folio in the canonical form:
 *   ORD-{year}-{sequence zero-padded to 6 digits}
 * Example: ORD-2026-000042
 *
 * The underlying ISequenceRepository (PrismaSequenceRepository in round ⑤)
 * performs an atomic upsert so concurrent callers always receive distinct,
 * monotonically increasing values within a calendar year.
 *
 * Odoo equivalence: ir.sequence with year-based prefix and gap-tolerant semantics.
 * Gaps are acceptable (a rolled-back transaction increments the counter but does not
 * undo it). Downstream consumers MUST NOT assume contiguous folios.
 */
export class GenerateOrderFolioUseCase {
  private readonly logger: ILogger;

  constructor(private readonly sequenceRepository: ISequenceRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GenerateOrderFolioUseCase');
  }

  /**
   * @param year  Calendar year for the folio counter (defaults to current year).
   */
  async execute(year: number = new Date().getFullYear()): Promise<GenerateOrderFolioResult> {
    const sequence = await this.sequenceRepository.nextValue(year);
    const folio = `ORD-${year}-${String(sequence).padStart(6, '0')}`;

    this.logger.info('Folio generated', { folio, year, sequence: String(sequence) });

    return { folio, year, sequence };
  }
}
