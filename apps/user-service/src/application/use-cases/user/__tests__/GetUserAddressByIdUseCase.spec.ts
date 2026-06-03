jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { GetUserAddressByIdUseCase } from '../GetUserAddressByIdUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { UserAddress } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError } from '../../../../domain/errors/DomainError';

const ADDR_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeAddress(overrides: Partial<UserAddress> = {}): UserAddress {
  return {
    id: ADDR_UUID,
    userId: 'user-1',
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

function makeRepo(address: UserAddress | null = makeAddress()): jest.Mocked<Pick<IUserRepository, 'getUserAddressById'>> {
  return { getUserAddressById: jest.fn().mockResolvedValue(address) } as any;
}

describe('GetUserAddressByIdUseCase', () => {
  it('returns the address for a valid UUID', async () => {
    const repo = makeRepo();
    const uc = new GetUserAddressByIdUseCase(repo as any);
    const result = await uc.execute(ADDR_UUID);
    expect(result.id).toBe(ADDR_UUID);
    expect(repo.getUserAddressById).toHaveBeenCalledWith(ADDR_UUID);
  });

  it('throws NotFoundError when address does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new GetUserAddressByIdUseCase(repo as any);
    await expect(uc.execute(ADDR_UUID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError for invalid UUID format', async () => {
    const repo = makeRepo();
    const uc = new GetUserAddressByIdUseCase(repo as any);
    await expect(uc.execute('not-a-uuid')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for empty id', async () => {
    const repo = makeRepo();
    const uc = new GetUserAddressByIdUseCase(repo as any);
    await expect(uc.execute('')).rejects.toBeInstanceOf(ValidationError);
  });
});
