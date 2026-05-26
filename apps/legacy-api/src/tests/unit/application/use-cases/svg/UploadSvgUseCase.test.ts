import { UploadSvgUseCase } from '@application/use-cases/svg/UploadSvgUseCase';
import { ISvgRepository } from '@domain/repositories/ISvgRepository';
import { IStorageService } from '@domain/interfaces/IStorageService';
import { SvgEntity, SvgEntityType } from '@domain/entities/Svg';
import {
  ValidationError,
  RequiredFieldError,
  InvalidFormatError,
} from '@domain/errors/DomainError';

// Mock implementations
const mockSvgRepository: jest.Mocked<ISvgRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByEntity: jest.fn(),
  findByFileName: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  findByEntityType: jest.fn(),
};

const mockStorageService: jest.Mocked<IStorageService> = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getPublicUrl: jest.fn(),
  validateFile: jest.fn(),
};

describe('UploadSvgUseCase', () => {
  let uploadSvgUseCase: UploadSvgUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    uploadSvgUseCase = new UploadSvgUseCase(mockSvgRepository, mockStorageService);
  });

  describe('execute', () => {
    const validSvgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="blue"/>
      </svg>
    `;

    const mockFile = {
      file: {
        filename: 'test.svg',
        mimetype: 'image/svg+xml',
        size: 200,
        encoding: '7bit',
        buffer: Buffer.from(validSvgContent, 'utf8'),
        createReadStream: jest.fn().mockReturnValue({
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(validSvgContent, 'utf8'));
            }
            if (event === 'end') {
              callback();
            }
          }),
        }),
      },
    };

    const mockSvgEntity = SvgEntity.create({
      fileName: 'product_test-123_1234567890.svg',
      originalName: 'test.svg',
      mimeType: 'image/svg+xml',
      size: 200,
      url: 'http://localhost:3000/uploads/products/test-123/product_test-123_1234567890.svg',
      bucket: 'local',
      path: 'products/test-123/product_test-123_1234567890.svg',
      entityType: SvgEntityType.PRODUCT,
      entityId: 'test-123',
      dimensions: { width: 100, height: 100 },
      viewBox: '0 0 100 100',
      optimized: true,
    });

    it('should successfully upload a valid SVG file', async () => {
      // Arrange
      mockStorageService.uploadFile.mockResolvedValue(
        'http://localhost:3000/uploads/products/test-123/product_test-123_1234567890.svg',
      );
      mockSvgRepository.create.mockResolvedValue(mockSvgEntity);

      const request = {
        file: mockFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
        optimize: true,
        sanitize: true,
      };

      // Act
      const result = await uploadSvgUseCase.execute(request);

      // Assert
      expect(result).toEqual(mockSvgEntity);
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringMatching(/product_test-123_\d+\.svg/),
        'image/svg+xml',
        'products/test-123',
      );
      expect(mockSvgRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringMatching(/product_test-123_\d+\.svg/),
          originalName: 'test.svg',
          mimeType: 'image/svg+xml',
          entityType: SvgEntityType.PRODUCT,
          entityId: 'test-123',
          dimensions: { width: 100, height: 100 },
          viewBox: '0 0 100 100',
          optimized: true,
        }),
      );
    });

    it('should throw RequiredFieldError when file is missing', async () => {
      // Arrange
      const request = {
        file: null,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(RequiredFieldError);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should throw RequiredFieldError when entityType is missing', async () => {
      // Arrange
      const request = {
        file: mockFile,
        entityType: null as any,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(RequiredFieldError);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should throw RequiredFieldError when entityId is missing', async () => {
      // Arrange
      const request = {
        file: mockFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: '',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(RequiredFieldError);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should throw InvalidFormatError for invalid MIME type', async () => {
      // Arrange
      const invalidFile = {
        ...mockFile,
        file: {
          ...mockFile.file,
          mimetype: 'image/png',
        },
      };

      const request = {
        file: invalidFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(InvalidFormatError);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should throw InvalidFormatError for file too large', async () => {
      // Arrange
      const largeFile = {
        ...mockFile,
        file: {
          ...mockFile.file,
          size: 3 * 1024 * 1024, // 3MB, exceeds 2MB limit
        },
      };

      const request = {
        file: largeFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(InvalidFormatError);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should throw InvalidFormatError for invalid SVG content', async () => {
      // Arrange
      const invalidSvgContent = '<div>Not SVG content</div>';
      const invalidFile = {
        ...mockFile,
        file: {
          ...mockFile.file,
          buffer: Buffer.from(invalidSvgContent, 'utf8'),
          createReadStream: jest.fn().mockReturnValue({
            on: jest.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from(invalidSvgContent, 'utf8'));
              }
              if (event === 'end') {
                callback();
              }
            }),
          }),
        },
      };

      const request = {
        file: invalidFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(InvalidFormatError);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should throw InvalidFormatError for SVG with script tags', async () => {
      // Arrange
      const maliciousSvgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <script>alert('xss')</script>
          <circle cx="50" cy="50" r="40" fill="blue"/>
        </svg>
      `;
      const maliciousFile = {
        ...mockFile,
        file: {
          ...mockFile.file,
          buffer: Buffer.from(maliciousSvgContent, 'utf8'),
          createReadStream: jest.fn().mockReturnValue({
            on: jest.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from(maliciousSvgContent, 'utf8'));
              }
              if (event === 'end') {
                callback();
              }
            }),
          }),
        },
      };

      const request = {
        file: maliciousFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(InvalidFormatError);
      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should handle storage service failure', async () => {
      // Arrange
      mockStorageService.uploadFile.mockRejectedValue(new Error('Storage service unavailable'));

      const request = {
        file: mockFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow(
        'Storage service unavailable',
      );
      expect(mockSvgRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository failure', async () => {
      // Arrange
      mockStorageService.uploadFile.mockResolvedValue(
        'http://localhost:3000/uploads/products/test-123/product_test-123_1234567890.svg',
      );
      mockSvgRepository.create.mockRejectedValue(new Error('Database error'));

      const request = {
        file: mockFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act & Assert
      await expect(uploadSvgUseCase.execute(request)).rejects.toThrow('Database error');
    });

    it('should work with different entity types', async () => {
      // Arrange
      mockStorageService.uploadFile.mockResolvedValue(
        'http://localhost:3000/uploads/users/test-user/user_test-user_1234567890.svg',
      );
      mockSvgRepository.create.mockResolvedValue({
        ...mockSvgEntity,
        entityType: SvgEntityType.USER,
        entityId: 'test-user',
      } as SvgEntity);

      const request = {
        file: mockFile,
        entityType: SvgEntityType.USER,
        entityId: 'test-user',
      };

      // Act
      const result = await uploadSvgUseCase.execute(request);

      // Assert
      expect(result.entityType).toBe(SvgEntityType.USER);
      expect(result.entityId).toBe('test-user');
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringMatching(/user_test-user_\d+\.svg/),
        'image/svg+xml',
        'users/test-user',
      );
    });

    it('should handle SVG without dimensions', async () => {
      // Arrange
      const svgWithoutDimensions = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="blue"/>
        </svg>
      `;
      const fileWithoutDimensions = {
        ...mockFile,
        file: {
          ...mockFile.file,
          buffer: Buffer.from(svgWithoutDimensions, 'utf8'),
          createReadStream: jest.fn().mockReturnValue({
            on: jest.fn((event, callback) => {
              if (event === 'data') {
                callback(Buffer.from(svgWithoutDimensions, 'utf8'));
              }
              if (event === 'end') {
                callback();
              }
            }),
          }),
        },
      };

      mockStorageService.uploadFile.mockResolvedValue(
        'http://localhost:3000/uploads/products/test-123/product_test-123_1234567890.svg',
      );
      mockSvgRepository.create.mockResolvedValue({
        ...mockSvgEntity,
        dimensions: undefined,
      } as SvgEntity);

      const request = {
        file: fileWithoutDimensions,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act
      const result = await uploadSvgUseCase.execute(request);

      // Assert
      expect(result.dimensions).toBeUndefined();
      expect(result.viewBox).toBe('0 0 100 100');
    });

    it('should respect optimize and sanitize parameters', async () => {
      // Arrange
      mockStorageService.uploadFile.mockResolvedValue(
        'http://localhost:3000/uploads/products/test-123/product_test-123_1234567890.svg',
      );
      mockSvgRepository.create.mockResolvedValue({
        ...mockSvgEntity,
        optimized: false,
      } as SvgEntity);

      const request = {
        file: mockFile,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
        optimize: false,
        sanitize: false,
      };

      // Act
      const result = await uploadSvgUseCase.execute(request);

      // Assert
      expect(result.optimized).toBe(false);
      // The sanitization would be tested by checking the content passed to storage
      expect(mockStorageService.uploadFile).toHaveBeenCalled();
    });

    it('should handle file with buffer directly', async () => {
      // Arrange
      const fileWithBuffer = {
        buffer: Buffer.from(validSvgContent, 'utf8'),
        filename: 'test.svg',
        mimetype: 'image/svg+xml',
        size: 200,
      };

      mockStorageService.uploadFile.mockResolvedValue(
        'http://localhost:3000/uploads/products/test-123/product_test-123_1234567890.svg',
      );
      mockSvgRepository.create.mockResolvedValue(mockSvgEntity);

      const request = {
        file: fileWithBuffer,
        entityType: SvgEntityType.PRODUCT,
        entityId: 'test-123',
      };

      // Act
      const result = await uploadSvgUseCase.execute(request);

      // Assert
      expect(result).toEqual(mockSvgEntity);
      expect(mockStorageService.uploadFile).toHaveBeenCalled();
      expect(mockSvgRepository.create).toHaveBeenCalled();
    });
  });
});
