jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { UpdateUserAddressUseCase } from '../UpdateUserAddressUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { UserAddress } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError } from '../../../../domain/errors/DomainError';

const ADDR_ID = 'addr-1';
const USER_ID = 'user-1';

function makeAddress(overrides: Partial<UserAddress> = {}): UserAddress {
  return {
    id: ADDR_ID,
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
    updateUserAddress: jest.fn().mockResolvedValue(makeAddress({ city: 'Arequipa' })),
    getDefaultAddress: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as any;
}

describe('UpdateUserAddressUseCase', () => {
  it('updates address successfully', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserAddressUseCase(repo);
    const result = await uc.execute(ADDR_ID, { city: 'Arequipa' });
    expect(repo.updateUserAddress).toHaveBeenCalledWith(ADDR_ID, { city: 'Arequipa' });
    expect(result).toBeDefined();
  });

  it('throws NotFoundError when address does not exist', async () => {
    const repo = makeRepo({ getUserAddressById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateUserAddressUseCase(repo);
    await expect(uc.execute(ADDR_ID, { city: 'Lima' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when update has no fields', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserAddressUseCase(repo);
    await expect(uc.execute(ADDR_ID, {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when title is empty string', async () => {
    const repo = makeRepo();
    const uc = new UpdateUserAddressUseCase(repo);
    await expect(uc.execute(ADDR_ID, { title: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates previous default when isDefault is set to true', async () => {
    const existing = makeAddress({ id: 'addr-old', isDefault: true });
    const repo = makeRepo({ getDefaultAddress: jest.fn().mockResolvedValue(existing) });
    const uc = new UpdateUserAddressUseCase(repo);
    await uc.execute(ADDR_ID, { isDefault: true });
    expect(repo.updateUserAddress).toHaveBeenCalledWith('addr-old', { isDefault: false });
  });
});
