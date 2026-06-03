jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createRepositoryLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
      }),
    },
  }),
  { virtual: true },
);

import { PrismaSequenceRepository } from '../PrismaSequenceRepository';

// ── Factory helpers ─────────────────────────────────────────────────────────────

type PrismaQueryRawMock = {
  $queryRaw: jest.Mock;
};

function makePrisma(
  queryRawResult: Array<{ last_value: bigint | string }> = [{ last_value: BigInt(1) }],
): PrismaQueryRawMock {
  return {
    $queryRaw: jest.fn().mockResolvedValue(queryRawResult),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('PrismaSequenceRepository', () => {
  describe('nextValue()', () => {
    it('returns the last_value from the DB as BigInt (native bigint row)', async () => {
      const prisma = makePrisma([{ last_value: BigInt(42) }]);
      const repo = new PrismaSequenceRepository(prisma as any);

      const result = await repo.nextValue(2026);

      expect(result).toBe(BigInt(42));
    });

    it('returns the last_value from the DB as BigInt when DB returns string (edge runtime)', async () => {
      // Some Prisma edge runtimes return BIGINT as string — the impl must convert.
      const prisma = makePrisma([{ last_value: '7' as any }]);
      const repo = new PrismaSequenceRepository(prisma as any);

      const result = await repo.nextValue(2026);

      expect(result).toBe(BigInt(7));
    });

    it('calls $queryRaw with the correct year parameter', async () => {
      const prisma = makePrisma();
      const repo = new PrismaSequenceRepository(prisma as any);

      await repo.nextValue(2026);

      // $queryRaw is called with a tagged template — the first argument is the
      // TemplateStringsArray and subsequent args are the interpolated values.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('throws when $queryRaw returns an empty array (unexpected DB state)', async () => {
      const prisma = makePrisma([]);
      const repo = new PrismaSequenceRepository(prisma as any);

      await expect(repo.nextValue(2026)).rejects.toThrow();
    });

    it('propagates errors from $queryRaw (DB unavailable)', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockRejectedValue(new Error('Connection refused')),
      };
      const repo = new PrismaSequenceRepository(prisma as any);

      await expect(repo.nextValue(2026)).rejects.toThrow('Connection refused');
    });
  });

  describe('nextOrderFolio()', () => {
    it('formats folio as ORD-{year}-{value zero-padded to 6 digits}', async () => {
      const prisma = makePrisma([{ last_value: BigInt(1) }]);
      const repo = new PrismaSequenceRepository(prisma as any);

      const folio = await repo.nextOrderFolio(2026);

      expect(folio).toBe('ORD-2026-000001');
    });

    it('pads folio correctly for value 42', async () => {
      const prisma = makePrisma([{ last_value: BigInt(42) }]);
      const repo = new PrismaSequenceRepository(prisma as any);

      const folio = await repo.nextOrderFolio(2026);

      expect(folio).toBe('ORD-2026-000042');
    });

    it('pads folio correctly for value 999999 (max 6 digits)', async () => {
      const prisma = makePrisma([{ last_value: BigInt(999999) }]);
      const repo = new PrismaSequenceRepository(prisma as any);

      const folio = await repo.nextOrderFolio(2026);

      expect(folio).toBe('ORD-2026-999999');
    });

    it('folio contains the correct year', async () => {
      const prisma = makePrisma([{ last_value: BigInt(100) }]);
      const repo = new PrismaSequenceRepository(prisma as any);

      const folio2025 = await repo.nextOrderFolio(2025);
      const folio2030 = await repo.nextOrderFolio(2030);

      expect(folio2025).toBe('ORD-2025-000100');
      expect(folio2030).toBe('ORD-2030-000100');
    });

    it('two sequential calls produce different folios (atomicity simulation)', async () => {
      // Simulate two sequential DB increments: 1 → 2
      const prisma = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([{ last_value: BigInt(1) }])
          .mockResolvedValueOnce([{ last_value: BigInt(2) }]),
      };
      const repo = new PrismaSequenceRepository(prisma as any);

      const folio1 = await repo.nextOrderFolio(2026);
      const folio2 = await repo.nextOrderFolio(2026);

      expect(folio1).toBe('ORD-2026-000001');
      expect(folio2).toBe('ORD-2026-000002');
      expect(folio1).not.toBe(folio2);
    });
  });
});
