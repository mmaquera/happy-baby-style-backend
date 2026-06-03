jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({
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

import { GenerateOrderFolioUseCase } from '../GenerateOrderFolioUseCase';
import type { ISequenceRepository } from '../../../domain/repositories/ISequenceRepository';

function makeSequenceRepo(nextValue: bigint = 42n): jest.Mocked<ISequenceRepository> {
  return {
    nextValue: jest.fn().mockResolvedValue(nextValue),
    nextOrderFolio: jest.fn().mockResolvedValue(`ORD-2026-${String(nextValue).padStart(6, '0')}`),
  } as jest.Mocked<ISequenceRepository>;
}

describe('GenerateOrderFolioUseCase', () => {
  it('returns a correctly formatted folio for year 2026', async () => {
    const repo = makeSequenceRepo(42n);
    const uc = new GenerateOrderFolioUseCase(repo);

    const result = await uc.execute(2026);

    expect(result.folio).toBe('ORD-2026-000042');
    expect(result.year).toBe(2026);
    expect(result.sequence).toBe(42n);
  });

  it('pads the sequence number to 6 digits', async () => {
    const repo = makeSequenceRepo(1n);
    const uc = new GenerateOrderFolioUseCase(repo);

    const result = await uc.execute(2026);
    expect(result.folio).toBe('ORD-2026-000001');
  });

  it('handles large sequence numbers without truncation', async () => {
    const repo = makeSequenceRepo(999999n);
    const uc = new GenerateOrderFolioUseCase(repo);

    const result = await uc.execute(2026);
    expect(result.folio).toBe('ORD-2026-999999');
  });

  it('uses the provided year in the folio', async () => {
    const repo = makeSequenceRepo(1n);
    const uc = new GenerateOrderFolioUseCase(repo);

    const result = await uc.execute(2030);
    expect(result.folio).toContain('ORD-2030-');
    expect(repo.nextValue).toHaveBeenCalledWith(2030);
  });

  it('defaults to the current year when no year is passed', async () => {
    const repo = makeSequenceRepo(1n);
    const uc = new GenerateOrderFolioUseCase(repo);
    const currentYear = new Date().getFullYear();

    await uc.execute();

    expect(repo.nextValue).toHaveBeenCalledWith(currentYear);
  });

  it('propagates errors from ISequenceRepository', async () => {
    const repo = makeSequenceRepo();
    repo.nextValue.mockRejectedValue(new Error('DB connection lost'));
    const uc = new GenerateOrderFolioUseCase(repo);

    await expect(uc.execute(2026)).rejects.toThrow('DB connection lost');
  });
});
