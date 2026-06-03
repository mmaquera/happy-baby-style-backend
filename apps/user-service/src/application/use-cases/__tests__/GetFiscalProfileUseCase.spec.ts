jest.mock('@hbs/logging', () => ({
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
}), { virtual: true });

import { GetFiscalProfileUseCase } from '../user/GetFiscalProfileUseCase';
import type { IUserFiscalProfileRepository } from '../../../domain/repositories/IUserFiscalProfileRepository';
import type { UserFiscalProfile } from '../../../domain/entities/UserFiscalProfile';
import { NotFoundError } from '../../../domain/errors/DomainError';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeProfile(overrides: Partial<UserFiscalProfile> = {}): UserFiscalProfile {
  return {
    id: 'fp-id-1',
    userId: USER_ID,
    documentType: 'ruc',
    documentNumber: '20600000006',
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
    findByUserId: jest.fn().mockResolvedValue(makeProfile()),
    findByDocument: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(makeProfile()),
    ...overrides,
  };
}

describe('GetFiscalProfileUseCase', () => {
  it('returns the fiscal profile when it exists', async () => {
    const repo = makeRepo();
    const uc = new GetFiscalProfileUseCase(repo);
    const result = await uc.execute(USER_ID);
    expect(result.userId).toBe(USER_ID);
    expect(result.documentType).toBe('ruc');
    expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it('throws NotFoundError when profile does not exist', async () => {
    const repo = makeRepo({ findByUserId: jest.fn().mockResolvedValue(null) });
    const uc = new GetFiscalProfileUseCase(repo);
    await expect(uc.execute(USER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns profile with DNI documentType', async () => {
    const repo = makeRepo({
      findByUserId: jest.fn().mockResolvedValue(makeProfile({ documentType: 'dni', documentNumber: '12345678', legalName: null })),
    });
    const uc = new GetFiscalProfileUseCase(repo);
    const result = await uc.execute(USER_ID);
    expect(result.documentType).toBe('dni');
    expect(result.legalName).toBeNull();
  });
});
