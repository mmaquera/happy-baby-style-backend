jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { DeleteUserAddressUseCase } from '../DeleteUserAddressUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { UserAddress } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError, BusinessLogicError } from '../../../../domain/errors/DomainError';

const ADDR_UUID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-1';

function makeAddress(overrides: Partial<UserAddress> = {}): UserAddress {
  return {
    id: ADDR_UUID,
    userId: USER_ID,
    title: 'Casa',
    firstName: 'Jane',
    lastName: 'Doe',
    addressLine1: 'Av. Lima 123',
    city: 'Lima',
    state: 'Lima',
    postalCode: '15001',
    country: 'PE',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    getUserAddressById: jest.fn().mockResolvedValue(makeAddress()),
    getUserAddresses: jest.fn().mockResolvedValue([makeAddress(), makeAddress({ id: 'addr-2' })]),
    deleteUserAddress: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('DeleteUserAddressUseCase', () => {
  it('deletes address when user has multiple addresses', async () => {
    const repo = makeRepo();
    const uc = new DeleteUserAddressUseCase(repo);
    await uc.execute(ADDR_UUID);
    expect(repo.deleteUserAddress).toHaveBeenCalledWith(ADDR_UUID);
  });

  it('throws NotFoundError when address does not exist', async () => {
    const repo = makeRepo({ getUserAddressById: jest.fn().mockResolvedValue(null) });
    const uc = new DeleteUserAddressUseCase(repo);
    await expect(uc.execute(ADDR_UUID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError for invalid UUID format', async () => {
    const repo = makeRepo();
    const uc = new DeleteUserAddressUseCase(repo);
    await expect(uc.execute('not-a-uuid')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for empty id', async () => {
    const repo = makeRepo();
    const uc = new DeleteUserAddressUseCase(repo);
    await expect(uc.execute('')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws BusinessLogicError when it is the only address', async () => {
    const repo = makeRepo({
      getUserAddresses: jest.fn().mockResolvedValue([makeAddress()]),
    });
    const uc = new DeleteUserAddressUseCase(repo);
    await expect(uc.execute(ADDR_UUID)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
