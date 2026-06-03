jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { SetDefaultAddressUseCase } from '../SetDefaultAddressUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { User, UserAddress } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError } from '../../../../domain/errors/DomainError';

const USER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ADDR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_ADDR = '550e8400-e29b-41d4-a716-446655440002';

function makeUser(): User {
  return { id: USER_UUID, email: 'jane@test.com', isActive: true, emailVerified: false, createdAt: new Date(), updatedAt: new Date() };
}

function makeAddress(id = ADDR_UUID, userId = USER_UUID, isDefault = false): UserAddress {
  return {
    id,
    userId,
    title: 'Casa',
    firstName: 'Jane',
    lastName: 'Doe',
    addressLine1: 'Av. Lima 123',
    city: 'Lima',
    state: 'Lima',
    postalCode: '15001',
    country: 'PE',
    isDefault,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepo(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    getUserById: jest.fn().mockResolvedValue(makeUser()),
    getUserAddressById: jest.fn().mockResolvedValue(makeAddress()),
    getDefaultAddress: jest.fn().mockResolvedValue(null),
    updateUserAddress: jest.fn().mockResolvedValue(makeAddress()),
    setDefaultAddress: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('SetDefaultAddressUseCase', () => {
  it('sets address as default successfully', async () => {
    const repo = makeRepo();
    const uc = new SetDefaultAddressUseCase(repo);
    await uc.execute(USER_UUID, ADDR_UUID);
    expect(repo.setDefaultAddress).toHaveBeenCalledWith(USER_UUID, ADDR_UUID);
  });

  it('throws NotFoundError when user does not exist', async () => {
    const repo = makeRepo({ getUserById: jest.fn().mockResolvedValue(null) });
    const uc = new SetDefaultAddressUseCase(repo);
    await expect(uc.execute(USER_UUID, ADDR_UUID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when address does not exist', async () => {
    const repo = makeRepo({ getUserAddressById: jest.fn().mockResolvedValue(null) });
    const uc = new SetDefaultAddressUseCase(repo);
    await expect(uc.execute(USER_UUID, ADDR_UUID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when address belongs to a different user', async () => {
    const repo = makeRepo({
      getUserAddressById: jest.fn().mockResolvedValue(makeAddress(ADDR_UUID, 'other-user')),
    });
    const uc = new SetDefaultAddressUseCase(repo);
    await expect(uc.execute(USER_UUID, ADDR_UUID)).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns early without calling setDefaultAddress when address is already default', async () => {
    const repo = makeRepo({
      getDefaultAddress: jest.fn().mockResolvedValue(makeAddress(ADDR_UUID, USER_UUID, true)),
    });
    const uc = new SetDefaultAddressUseCase(repo);
    await uc.execute(USER_UUID, ADDR_UUID);
    expect(repo.setDefaultAddress).not.toHaveBeenCalled();
  });

  it('updates previous default when one exists', async () => {
    const repo = makeRepo({
      getDefaultAddress: jest.fn().mockResolvedValue(makeAddress(OTHER_ADDR, USER_UUID, true)),
    });
    const uc = new SetDefaultAddressUseCase(repo);
    await uc.execute(USER_UUID, ADDR_UUID);
    expect(repo.updateUserAddress).toHaveBeenCalledWith(OTHER_ADDR, { isDefault: false });
    expect(repo.setDefaultAddress).toHaveBeenCalledWith(USER_UUID, ADDR_UUID);
  });

  it('throws ValidationError for invalid user UUID', async () => {
    const repo = makeRepo();
    const uc = new SetDefaultAddressUseCase(repo);
    await expect(uc.execute('bad-id', ADDR_UUID)).rejects.toBeInstanceOf(ValidationError);
  });
});
