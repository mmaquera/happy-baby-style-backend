-- Migration: add_login_hardening
-- Adds login hardening fields to user_profiles (additive only — no ALTER column type, no DROP):
--
--   WS1 (Account lockout):
--     failed_login_attempts  INT     NOT NULL DEFAULT 0
--     locked_until           TIMESTAMPTZ      NULL
--
--   WS2 (Email verification token — mirrors user_passwords.reset_token pattern):
--     email_verification_token      TEXT     NULL  UNIQUE
--     email_verification_expires_at TIMESTAMPTZ  NULL
--
--   WS3 (MFA / TOTP):
--     mfa_enabled      BOOLEAN NOT NULL DEFAULT false
--     mfa_secret       TEXT     NULL  (AES-256-GCM ciphertext base64; plaintext never stored)
--     mfa_backup_codes TEXT[]  NOT NULL DEFAULT '{}'  (bcrypt hashes, one-time use)
--
-- Backwards-compatible: all new columns are nullable or have safe defaults.
-- No data loss. Safe for rolling deploy (old pods that don't read these columns are unaffected).

-- WS1: Account lockout
ALTER TABLE "user_profiles"
    ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "locked_until"          TIMESTAMP(3);

-- WS2: Email verification token
ALTER TABLE "user_profiles"
    ADD COLUMN "email_verification_token"      TEXT,
    ADD COLUMN "email_verification_expires_at" TIMESTAMP(3);

-- WS3: MFA / TOTP
ALTER TABLE "user_profiles"
    ADD COLUMN "mfa_enabled"      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "mfa_secret"       TEXT,
    ADD COLUMN "mfa_backup_codes" TEXT[] NOT NULL DEFAULT '{}';

-- UniqueIndex: email_verification_token (mirrors reset_token unique constraint pattern)
CREATE UNIQUE INDEX "user_profiles_email_verification_token_key"
    ON "user_profiles"("email_verification_token");

-- Index: locked_until — partial index covering only locked rows (WHERE locked_until IS NOT NULL).
-- Rationale: the lockout check path (`WHERE id = $1 AND locked_until > NOW()`) benefits from
-- an index on locked_until. A partial index keeps it tiny (only locked users) and avoids
-- write amplification on the hot UPDATE path for every login attempt.
CREATE INDEX "user_profiles_locked_until_idx"
    ON "user_profiles"("locked_until")
    WHERE "locked_until" IS NOT NULL;
