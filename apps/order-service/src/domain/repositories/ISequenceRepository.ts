/**
 * ISequenceRepository
 *
 * Generates gap-tolerant, atomically-incrementing folios for business documents.
 *
 * The canonical implementation (PrismaSequenceRepository) issues an upsert that
 * is safe under concurrent writers:
 *
 *   INSERT INTO order_sequences (id, year, last_value, created_at, updated_at)
 *   VALUES (gen_random_uuid(), $year, 1, now(), now())
 *   ON CONFLICT (year)
 *   DO UPDATE SET last_value = order_sequences.last_value + 1,
 *                 updated_at = now()
 *   RETURNING last_value;
 *
 * Because the UPDATE expression is evaluated atomically by Postgres, two
 * concurrent callers for the same year will receive distinct, monotonically
 * increasing values. The sequence is gap-tolerant: if a transaction that called
 * nextValue() is later rolled back, that value is consumed but the counter does
 * not reset — downstream callers will see a gap in the folio sequence, which is
 * acceptable (ir.sequence semantics; see CLAUDE.md "ir.sequence" pattern).
 *
 * Folio formatting (caller responsibility):
 *   const raw = await repo.nextValue(year);
 *   const folio = `ORD-${year}-${String(raw).padStart(6, '0')}`;
 *   // => "ORD-2026-000001"
 */
export interface ISequenceRepository {
  /**
   * Atomically increments the counter for the given year and returns the new
   * (post-increment) raw numeric value as a bigint.
   *
   * @param year  Calendar year (e.g. 2026). Determines the per-year counter row.
   * @returns     The new last_value after increment (starts at 1 for the first
   *              call of a new year). The caller is responsible for zero-padding
   *              and prefixing to produce the final folio string.
   */
  nextValue(year: number): Promise<bigint>;

  /**
   * Convenience wrapper: calls nextValue(year) and returns a formatted folio
   * string in the canonical form  ORD-{year}-{value zero-padded to 6 digits}.
   *
   * Example output: "ORD-2026-000042"
   *
   * @param year  Calendar year.
   */
  nextOrderFolio(year: number): Promise<string>;
}
