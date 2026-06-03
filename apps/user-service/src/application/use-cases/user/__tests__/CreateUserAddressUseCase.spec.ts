jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { CreateUserAddressUseCase } from '../CreateUserAddressUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { UserAddress, CreateUserAddressRequest } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError } from '../../../../domain/errors/DomainError';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeAddress(overrides: Partial<UserAddress> = {}): UserAddress {
  return {
    id: 'addr-1',
    userId: VALID_UUID,
    title: 'Casa',
    firstName: 'Jane',
    lastName: 'Doe',
    addressLine1: 'Av. Lima 123',
    city: 'Lima',
    state: 'LIM',
    postalCode: '15001',
    country: 'PE',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRequest(overrides: Partial<CreateUserAddressRequest> = {}): CreateUserAddressRequest {
  return {
    userId: VALID_UUID,
    title: 'Casa',
    firstName: 'Jane',
    lastName: 'Doe',
    addressLine1: 'Av. Lima 123',
    city: 'Lima',
    state: 'LIM',
    postalCode: '15001',
    country: 'PE',
    isDefault: false,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    getUserById: jest.fn().mockResolvedValue({ id: VALID_UUID, email: 'jane@test.com', isActive: true }),
    createUserAddress: jest.fn().mockResolvedValue(makeAddress()),
    getDefaultAddress: jest.fn().mockResolvedValue(null),
    updateUserAddress: jest.fn().mockResolvedValue(makeAddress()),
    ...overrides,
  } as any;
}

describe('CreateUserAddressUseCase', () => {
  it('creates an address for an existing user', async () => {
    const repo = makeRepo();
    const uc = new CreateUserAddressUseCase(repo);
    const result = await uc.execute(makeRequest());
    expect(result.userId).toBe(VALID_UUID);
    expect(repo.createUserAddress).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundError when user does not exist', async () => {
    const repo = makeRepo({ getUserById: jest.fn().mockResolvedValue(null) });
    const uc = new CreateUserAddressUseCase(repo);
    await expect(uc.execute(makeRequest())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when required fields are missing', async () => {
    const repo = makeRepo();
    const uc = new CreateUserAddressUseCase(repo);
    await expect(
      uc.execute(makeRequest({ addressLine1: '' })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates previous default when isDefault=true', async () => {
    const existingDefault = makeAddress({ id: 'addr-old', isDefault: true });
    const repo = makeRepo({ getDefaultAddress: jest.fn().mockResolvedValue(existingDefault) });
    const uc = new CreateUserAddressUseCase(repo);
    await uc.execute(makeRequest({ isDefault: true }));
    expect(repo.updateUserAddress).toHaveBeenCalledWith('addr-old', { isDefault: false });
  });
});
