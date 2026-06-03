import { PrismaClient } from '../../prisma';
import { ISequenceRepository } from '../../domain/repositories/ISequenceRepository';
import { LoggerFactory, ILogger } from '@hbs/logging';

/**
 * PrismaSequenceRepository
 *
 * Implements gap-tolerant, atomically-incrementing folio generation using a
 * Postgres INSERT … ON CONFLICT … DO UPDATE … RETURNING pattern.
 *
 * The UPDATE expression `last_value + 1` is evaluated atomically by Postgres
 * under the row-level lock acquired by ON CONFLICT — two concurrent callers for
 * the same year always receive distinct, monotonically increasing values.
 *
 * Gap-tolerance (ir.sequence semantics): if the transaction that called
 * nextValue() is rolled back, the counter is not reset.  The sequence will have
 * a gap, which is acceptable for business documents (SUNAT auditors accept gaps).
 *
 * BigInt handling: Postgres returns BIGINT as a JavaScript string when using
 * $queryRaw. We parse it back to BigInt before returning so the caller has the
 * correct type.  When formatting the folio we clamp to Number safely because the
 * 6-digit pad (max 999999) is well within Number.MAX_SAFE_INTEGER.
 */
export class PrismaSequenceRepository implements ISequenceRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger(
      'PrismaSequenceRepository',
    );
  }

  /**
   * Atomically increments the per-year counter and returns the new value.
   *
   * Uses $queryRaw with tagged template literal (the safe Prisma overload) so
   * parameters are always bound via server-side prepared statement — no SQL injection.
   */
  async nextValue(year: number): Promise<bigint> {
    try {
      // $queryRaw returns rows as an array of plain objects.
      // The RETURNING clause gives us a single row with the incremented last_value.
      // Prisma maps BIGINT columns as BigInt in the raw query result.
      const rows = await this.prisma.$queryRaw<Array<{ last_value: bigint }>>`
        INSERT INTO order_sequences (year, last_value, created_at, updated_at)
        VALUES (${year}, 1, now(), now())
        ON CONFLICT (year)
        DO UPDATE SET
          last_value = order_sequences.last_value + 1,
          updated_at = now()
        RETURNING last_value
      `;

      if (!rows || rows.length === 0) {
        throw new Error('PrismaSequenceRepository: INSERT…RETURNING returned no rows');
      }

      // Prisma maps Postgres BIGINT to BigInt in $queryRaw results.
      // If the driver returns it as string (edge runtimes), convert explicitly.
      const raw = rows[0].last_value;
      const value = typeof raw === 'bigint' ? raw : BigInt(String(raw));

      this.logger.info('Generated order sequence value', { year, value: value.toString() });
      return value;
    } catch (error) {
      this.logger.error(
        'Error generating order sequence value',
        error instanceof Error ? error : new Error(String(error)),
        { year },
      );
      throw error;
    }
  }

  /**
   * Convenience wrapper: calls nextValue(year) and formats the folio string.
   *
   * Format: ORD-{year}-{value zero-padded to 6 digits}
   * Example: "ORD-2026-000042"
   *
   * The 6-digit pad is safe to convert from BigInt to Number because the value
   * is always <= 999_999 for practical order volumes (limit imposed by format).
   * If your business expects >999999 orders per year, increase pad width before
   * the counter wraps the format column.
   */
  async nextOrderFolio(year: number): Promise<string> {
    const value = await this.nextValue(year);
    // Number() conversion is safe: padStart only shows 6 digits (max 999999 << MAX_SAFE_INTEGER).
    const folio = `ORD-${year}-${String(Number(value)).padStart(6, '0')}`;
    this.logger.info('Generated order folio', { year, folio });
    return folio;
  }
}
