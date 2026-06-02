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

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

import bcrypt from 'bcryptjs';
import { DisableMfaUseCase } from '../DisableMfaUseCase';
import { LoggerFactory } from '@hbs/logging';

const mockBcryptCompare = bcrypt.compare as jest.Mock;

function makeLogger() {
  return LoggerFactory.getInstance().createUseCaseLogger('test') as any;
}

function makeUserRepo(overrides: Partial<any> = {}): any {
  return {
    getMfaData: jest.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'enc:x', mfaBackupCodes: ['h1'] }),
    getUserPasswordHash: jest.fn().mockResolvedValue('$bcrypt$stored-hash'),
    disableMfa: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeSecurityEventRepo(): any {
  return {
    create: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DisableMfaUseCase', () => {
  let useCase: DisableMfaUseCase;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let securityEventRepo: ReturnType<typeof makeSecurityEventRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = makeUserRepo();
    securityEventRepo = makeSecurityEventRepo();
    useCase = new DisableMfaUseCase(userRepo, securityEventRepo, makeLogger());
  });

  describe('Happy path', () => {
    it('disables MFA when password is correct', async () => {
      mockBcryptCompare.mockResolvedValue(true);

      await useCase.execute({ userId: 'user-1', password: 'correct-password' });

      expect(userRepo.disableMfa).toHaveBeenCalledWith('user-1');
      expect(securityEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'mfa_disabled', userId: 'user-1' }),
      );
    });
  });

  describe('Error conditions', () => {
    it('throws ValidationError for wrong password', async () => {
      mockBcryptCompare.mockResolvedValue(false);

      await expect(
        useCase.execute({ userId: 'user-1', password: 'wrong' }),
      ).rejects.toMatchObject({ message: 'Invalid password' });

      expect(userRepo.disableMfa).not.toHaveBeenCalled();
    });

    it('throws BusinessLogicError if MFA not enabled', async () => {
      userRepo.getMfaData.mockResolvedValue({ mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] });

      await expect(
        useCase.execute({ userId: 'user-1', password: 'pass' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('not enabled') });
    });

    it('throws ValidationError if password is empty', async () => {
      await expect(
        useCase.execute({ userId: 'user-1', password: '' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('required') });
    });

    it('throws NotFoundError if user not found', async () => {
      userRepo.getMfaData.mockResolvedValue(null);

      await expect(
        useCase.execute({ userId: 'ghost', password: 'pass' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('User') });
    });
  });
});
