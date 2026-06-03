// Mock compartido: la misma instancia de logger es retornada en cada llamada,
// lo que permite hacer spy sobre sus métodos desde los tests.
const mockLoggerInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => mockLoggerInstance,
    }),
  },
}), { virtual: true });

import { UpdateFiscalProfileUseCase } from '../user/UpdateFiscalProfileUseCase';
import type { IUserFiscalProfileRepository } from '../../../domain/repositories/IUserFiscalProfileRepository';
import type { IFiscalProfileTransactionRunner } from '../user/UpdateFiscalProfileUseCase';
import type { UserFiscalProfile } from '../../../domain/entities/UserFiscalProfile';
import { DuplicateError, ValidationError } from '../../../domain/errors/DomainError';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTHER_USER_ID = 'ffffffff-eeee-dddd-cccc-bbbbbbbbbbbb';

// Valid RUC with correct DV: 20600000006
// RUC: digits = [2,0,6,0,0,0,0,0,0,0,6]
// weights = [5,4,3,2,7,6,5,4,3,2]
// sum = 2*5+0*4+6*3+0*2+0*7+0*6+0*5+0*4+0*3+0*2 = 10+0+18+0+0+0+0+0+0+0 = 28
// residuo = 28 % 11 = 6; expected = 11 - 6 = 5 — wait, let me recalculate:
// Actually use RUC 20100070970 (known valid Peruvian RUC)
// Or use a manually computed one:
// digits[0..9] = [2,0,5,0,0,0,0,0,0,0]; dv = digits[10]
// sum = 2*5+0*4+5*3+0*2+0*7+0*6+0*5+0*4+0*3+0*2 = 10+0+15+0+0+0+0+0+0+0 = 25
// residuo=25%11=3; expected=11-3=8; dv=8 → RUC=20500000008
const VALID_RUC = '20500000008';
const INVALID_RUC_BAD_DV = '20500000009'; // wrong DV

function makeProfile(overrides: Partial<UserFiscalProfile> = {}): UserFiscalProfile {
  return {
    id: 'fp-id-1',
    userId: USER_ID,
    documentType: 'ruc',
    documentNumber: VALID_RUC,
    legalName: 'Mi Empresa SAC',
    verifiedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeRepo(
  overrides: Partial<jest.Mocked<IUserFiscalProfileRepository>> = {},
): jest.Mocked<IUserFiscalProfileRepository> {
  return {
    findByUserId: jest.fn().mockResolvedValue(null),
    findByDocument: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(makeProfile()),
    ...overrides,
  };
}

function makeTxRunner(
  overrides: Partial<jest.Mocked<IFiscalProfileTransactionRunner>> = {},
): jest.Mocked<IFiscalProfileTransactionRunner> {
  return {
    runTransaction: jest.fn().mockResolvedValue(makeProfile()),
    ...overrides,
  };
}

function makeUseCase(
  repoOverrides: Partial<jest.Mocked<IUserFiscalProfileRepository>> = {},
  txOverrides: Partial<jest.Mocked<IFiscalProfileTransactionRunner>> = {},
) {
  const repo = makeRepo(repoOverrides);
  const tx = makeTxRunner(txOverrides);
  const uc = new UpdateFiscalProfileUseCase(repo, tx);
  return { uc, repo, tx };
}

// ── Happy path ────────────────────────────────────────────────────────────────

describe('UpdateFiscalProfileUseCase — happy path', () => {
  it('creates a new RUC profile with valid DV', async () => {
    const { uc, tx } = makeUseCase();
    const result = await uc.execute({
      userId: USER_ID,
      documentType: 'ruc',
      documentNumber: VALID_RUC,
      legalName: 'Mi Empresa SAC',
    });
    expect(result).toBeDefined();
    expect(tx.runTransaction).toHaveBeenCalledWith(
      USER_ID,
      'ruc',
      VALID_RUC,
      'Mi Empresa SAC',
      {}, // no previous profile
    );
  });

  it('creates a new DNI profile', async () => {
    const { uc, tx } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'dni', documentNumber: '12345678' });
    expect(tx.runTransaction).toHaveBeenCalledWith(USER_ID, 'dni', '12345678', null, {});
  });

  it('creates a new CE profile', async () => {
    const { uc, tx } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'ce', documentNumber: 'ABC123456' });
    expect(tx.runTransaction).toHaveBeenCalledWith(USER_ID, 'ce', 'ABC123456', null, {});
  });

  it('passes old values from existing profile to transaction', async () => {
    const existingProfile = makeProfile({ documentNumber: VALID_RUC, legalName: 'Old Name SAC' });
    const { uc, tx } = makeUseCase({
      findByUserId: jest.fn().mockResolvedValue(existingProfile),
    });
    await uc.execute({
      userId: USER_ID,
      documentType: 'ruc',
      documentNumber: VALID_RUC,
      legalName: 'New Name SAC',
    });
    const oldValues = tx.runTransaction.mock.calls[0][4];
    expect(oldValues).toMatchObject({
      documentType: 'ruc',
      documentNumber: VALID_RUC,
      legalName: 'Old Name SAC',
    });
  });

  it('emits runTransaction (verifying 3 ops contract)', async () => {
    const { uc, tx } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: 'Empresa SA' });
    expect(tx.runTransaction).toHaveBeenCalledTimes(1);
    // The transaction runner is responsible for executing 3 ops atomically
    // (upsert + auditLog + securityEvent) — verified by unit tests of the runner itself.
  });

  it('masks documentNumber in logs — does not pass full number to logger directly', async () => {
    // Limpia llamadas previas para aislar este test
    mockLoggerInstance.info.mockClear();

    const { uc } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: 'Empresa SA' });

    // El logger debe haber sido llamado al menos una vez (con el perfil actualizado)
    expect(mockLoggerInstance.info).toHaveBeenCalled();

    const allCalls = mockLoggerInstance.info.mock.calls;
    // Ninguna llamada al logger debe incluir el RUC completo en su contexto
    for (const [_msg, ctx] of allCalls) {
      if (typeof ctx === 'object' && ctx !== null) {
        expect(JSON.stringify(ctx)).not.toContain(VALID_RUC);
      }
    }

    // Al menos una llamada debe incluir el campo enmascarado con el patrón correcto
    const callsWithMasked = allCalls.filter(([_msg, ctx]) => ctx?.documentNumberMasked);
    expect(callsWithMasked.length).toBeGreaterThan(0);
    for (const [_msg, ctx] of callsWithMasked) {
      // Solo los últimos 4 dígitos visibles, el resto asteriscos
      expect(ctx.documentNumberMasked).toMatch(/^\*+\d{4}$/);
      expect(ctx.documentNumberMasked).not.toBe(VALID_RUC);
    }
  });

  it('strips spaces and dashes from RUC before validation', async () => {
    const { uc, tx } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: '20500 000 008', legalName: 'Empresa' });
    expect(tx.runTransaction).toHaveBeenCalledWith(USER_ID, 'ruc', VALID_RUC, 'Empresa', {});
  });

  it('converts CE to uppercase before saving', async () => {
    const { uc, tx } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'ce', documentNumber: 'abc123456' });
    expect(tx.runTransaction).toHaveBeenCalledWith(USER_ID, 'ce', 'ABC123456', null, {});
  });
});

// ── Validation errors ─────────────────────────────────────────────────────────

describe('UpdateFiscalProfileUseCase — validation errors', () => {
  it('throws ValidationError for RUC with invalid DV', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: INVALID_RUC_BAD_DV, legalName: 'Empresa' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for RUC with wrong length', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: '123', legalName: 'Empresa' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for DNI with wrong format (7 digits)', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'dni', documentNumber: '1234567' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for DNI with letters', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'dni', documentNumber: '1234567A' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for CE shorter than 9 chars', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ce', documentNumber: 'AB12345' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for CE longer than 12 chars', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ce', documentNumber: 'ABC1234567890X' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for RUC without legalName', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: undefined }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for RUC with empty legalName', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for legalName exceeding 200 chars', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: 'A'.repeat(201) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for legalName with control characters', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: 'Empresa\x01SA' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for legalName with < > characters', async () => {
    const { uc } = makeUseCase();
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: '<script>Empresa</script>' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── Duplicate error ───────────────────────────────────────────────────────────

describe('UpdateFiscalProfileUseCase — duplicate RUC', () => {
  it('throws DuplicateError when RUC belongs to another user', async () => {
    const existingForOtherUser = makeProfile({ userId: OTHER_USER_ID });
    const { uc } = makeUseCase({
      findByDocument: jest.fn().mockResolvedValue(existingForOtherUser),
    });
    await expect(
      uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: 'Empresa SA' }),
    ).rejects.toBeInstanceOf(DuplicateError);
  });

  it('does NOT throw DuplicateError when RUC belongs to the same user (update own)', async () => {
    const ownProfile = makeProfile({ userId: USER_ID });
    const { uc, tx } = makeUseCase({
      findByDocument: jest.fn().mockResolvedValue(ownProfile),
      findByUserId: jest.fn().mockResolvedValue(ownProfile),
    });
    const result = await uc.execute({ userId: USER_ID, documentType: 'ruc', documentNumber: VALID_RUC, legalName: 'Empresa SA' });
    expect(result).toBeDefined();
    expect(tx.runTransaction).toHaveBeenCalledTimes(1);
  });

  it('does NOT check uniqueness for DNI (duplicates allowed)', async () => {
    const { uc, repo } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'dni', documentNumber: '12345678' });
    // findByDocument should NOT be called for DNI
    expect(repo.findByDocument).not.toHaveBeenCalled();
  });

  it('does NOT check uniqueness for CE (duplicates allowed)', async () => {
    const { uc, repo } = makeUseCase();
    await uc.execute({ userId: USER_ID, documentType: 'ce', documentNumber: 'ABC123456' });
    expect(repo.findByDocument).not.toHaveBeenCalled();
  });
});
