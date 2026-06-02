/**
 * Port for MFA challenge state management.
 *
 * Provides single-use challenge tokens backed by Redis to avoid a DB migration.
 * Challenges expire after a short TTL (default 5 minutes).
 * consume() is atomic: it reads and deletes in a single operation.
 */
export interface IMfaChallengeStore {
  /**
   * Persist a new challenge entry.
   * @param challengeId - uuid embedded in the MFA challenge JWT
   * @param userId - userId bound to this challenge (G-7 binding)
   * @param ttlSeconds - time-to-live for the key
   */
  save(challengeId: string, userId: string, ttlSeconds: number): Promise<void>;

  /**
   * Atomically read and delete the challenge entry.
   * Returns the bound userId if the challenge exists, null if it has already been
   * consumed or expired.
   */
  consume(challengeId: string): Promise<string | null>;

  /**
   * Increment and return the attempt counter for a challenge.
   * Used to enforce a max-attempts limit per challenge.
   * The counter shares the same TTL as the challenge key.
   */
  incrAttempts(challengeId: string): Promise<number>;

  /**
   * Delete a challenge entry (used on max-attempts exceeded).
   */
  del(challengeId: string): Promise<void>;
}
