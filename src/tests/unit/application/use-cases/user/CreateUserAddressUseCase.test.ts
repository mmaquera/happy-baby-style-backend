import { CreateUserAddressUseCase } from '../../../../../application/use-cases/user/CreateUserAddressUseCase';
import { IUserRepository } from '../../../../../domain/repositories/IUserRepository';
import { UserAddress, CreateUserAddressRequest, User } from '../../../../../domain/entities/User';
import { ValidationError, NotFoundError } from '../../../../../domain/errors/DomainError';

describe('CreateUserAddressUseCase', () => {
  let createUserAddressUseCase: CreateUserAddressUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'customer' as any,
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  } as any;

  const mockAddress: UserAddress = {
    id: 'address-123',
    userId: 'user-123',
    title: 'Home',
    firstName: 'John',
    lastName: 'Doe',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const validRequest: CreateUserAddressRequest = {
    userId: 'user-123',
    title: 'Home',
    firstName: 'John',
    lastName: 'Doe',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
    isDefault: true
  };

  beforeEach(() => {
    mockUserRepository = ({
      getUserById: jest.fn(),
      createUserAddress: jest.fn(),
      updateUserAddress: jest.fn(),
      getDefaultAddress: jest.fn(),
      getUserAddresses: jest.fn(),
      getUserAddressById: jest.fn(),
      deleteUserAddress: jest.fn(),
      setDefaultAddress: jest.fn(),
      createUser: jest.fn(),
      getUsers: jest.fn(),
      getUserByEmail: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      getUserStats: jest.fn(),
      getUsersByRole: jest.fn(),
      getActiveUsers: jest.fn(),
      searchUsers: jest.fn(),
      getUserPasswordHash: jest.fn(),
      updateUserLastLogin: jest.fn(),
      createUserProfile: jest.fn(),
      getUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
      deleteUserProfile: jest.fn()
    } as unknown) as jest.Mocked<IUserRepository>;

    createUserAddressUseCase = new CreateUserAddressUseCase(mockUserRepository);
  });

  describe('execute', () => {
    it('should create a user address successfully', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(mockUser);
      mockUserRepository.getDefaultAddress.mockResolvedValue(null);
      mockUserRepository.createUserAddress.mockResolvedValue(mockAddress);

      // Act
      const result = await createUserAddressUseCase.execute(validRequest);

      // Assert
      expect(result).toEqual(mockAddress);
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.createUserAddress).toHaveBeenCalledWith(validRequest);
    });

    it('should create a user address and set as default when isDefault is true', async () => {
      // Arrange
      const existingDefaultAddress: UserAddress = {
        ...mockAddress,
        id: 'existing-default-123',
        isDefault: true
      };

      mockUserRepository.getUserById.mockResolvedValue(mockUser);
      mockUserRepository.getDefaultAddress.mockResolvedValue(existingDefaultAddress);
      mockUserRepository.updateUserAddress.mockResolvedValue(existingDefaultAddress);
      mockUserRepository.createUserAddress.mockResolvedValue(mockAddress);

      // Act
      const result = await createUserAddressUseCase.execute(validRequest);

      // Assert
      expect(result).toEqual(mockAddress);
      expect(mockUserRepository.updateUserAddress).toHaveBeenCalledWith(
        'existing-default-123',
        { isDefault: false }
      );
    });

    it('should throw ValidationError when userId is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, userId: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when firstName is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, firstName: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when lastName is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, lastName: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when addressLine1 is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, addressLine1: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when city is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, city: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when state is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, state: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when postalCode is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, postalCode: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when country is missing', async () => {
      // Arrange
      const invalidRequest = { ...validRequest, country: '' };

      // Act & Assert
      await expect(createUserAddressUseCase.execute(invalidRequest))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      mockUserRepository.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(createUserAddressUseCase.execute(validRequest))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockUserRepository.getUserById.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(createUserAddressUseCase.execute(validRequest))
        .rejects
        .toThrow('Failed to create address');
    });
  });
});
