import { LocalStorageService } from '../../../../infrastructure/services/LocalStorageService';
import { ILogger } from '../../../../domain/interfaces/ILogger';
import { IFileValidationService } from '../../../../domain/interfaces/IFileValidationService';
import { FileValidationError } from '../../../../domain/errors/StorageError';

// Mock logger
const mockLogger: ILogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(() => mockLogger),
  setTraceId: jest.fn(() => mockLogger)
};

// Mock validation service
const mockValidationService: IFileValidationService = {
  validateFile: jest.fn(),
  getExtensionFromMimeType: jest.fn(() => '.jpg')
};

describe('LocalStorageService', () => {
  let storageService: LocalStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    storageService = new LocalStorageService(mockLogger, mockValidationService);
  });

  describe('constructor', () => {
    it('should create instance with default logger and validation service', () => {
      const service = new LocalStorageService();
      expect(service).toBeInstanceOf(LocalStorageService);
    });

    it('should create instance with custom logger and validation service', () => {
      const service = new LocalStorageService(mockLogger, mockValidationService);
      expect(service).toBeInstanceOf(LocalStorageService);
    });
  });

  describe('validateFile', () => {
    it('should return true for valid file', () => {
      (mockValidationService.validateFile as jest.Mock).mockImplementation(() => {});
      
      const result = storageService.validateFile('test.jpg', 'image/jpeg', 1024);
      
      expect(result).toBe(true);
      expect(mockValidationService.validateFile).toHaveBeenCalledWith('test.jpg', 'image/jpeg', 1024);
    });

    it('should return false for invalid file', () => {
      (mockValidationService.validateFile as jest.Mock).mockImplementation(() => {
        throw new FileValidationError('Invalid file');
      });
      
      const result = storageService.validateFile('test.txt', 'text/plain', 1024);
      
      expect(result).toBe(false);
    });
  });

  describe('getPublicUrl', () => {
    it('should generate correct URL for file without folder', () => {
      const url = storageService.getPublicUrl('test.jpg');
      expect(url).toContain('uploads/test.jpg');
    });

    it('should generate correct URL for file with folder', () => {
      const url = storageService.getPublicUrl('test.jpg', 'products');
      expect(url).toContain('uploads/products/test.jpg');
    });
  });

  describe('getUploadResponse', () => {
    it('should return standardized upload response', () => {
      const response = storageService.getUploadResponse(
        'test.jpg',
        'http://localhost:3000/uploads/test.jpg',
        'req123',
        'trace456'
      );

      expect(response.success).toBe(true);
      expect(response.code).toBe('CREATED');
      expect(response.data).toEqual({
        url: 'http://localhost:3000/uploads/test.jpg',
        fileName: 'test.jpg'
      });
      expect(response.metadata?.requestId).toBe('req123');
      expect(response.metadata?.traceId).toBe('trace456');
    });
  });

  describe('getDeletionResponse', () => {
    it('should return standardized deletion response', () => {
      const response = storageService.getDeletionResponse(
        'http://localhost:3000/uploads/test.jpg',
        'req123',
        'trace456'
      );

      expect(response.success).toBe(true);
      expect(response.code).toBe('DELETED');
      expect(response.data).toEqual({
        fileUrl: 'http://localhost:3000/uploads/test.jpg',
        deletedAt: expect.any(String)
      });
      expect(response.metadata?.requestId).toBe('req123');
      expect(response.metadata?.traceId).toBe('trace456');
    });
  });
});
