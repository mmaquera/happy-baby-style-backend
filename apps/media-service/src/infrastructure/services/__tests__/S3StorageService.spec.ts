// Required mock at top of every spec file — must precede all imports.
jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createServiceLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
      }),
    },
  }),
  { virtual: true },
);

// ---------------------------------------------------------------------------
// Mock aws-sdk v3 modules before importing S3StorageService.
// @aws-sdk/client-s3 and @aws-sdk/lib-storage are real installed modules
// (not virtual), so we mock them without { virtual: true }.
// ---------------------------------------------------------------------------

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _cmd: 'delete' })),
}));

const mockUploadDone = jest.fn();
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({ done: mockUploadDone })),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks are registered)
// ---------------------------------------------------------------------------
import { S3StorageService } from '../S3StorageService';
import { StorageConfigurationError, FileUploadError, FileDeleteError } from '../../../domain/errors/StorageError';
import { Upload } from '@aws-sdk/lib-storage';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_ENV: Record<string, string> = {
  S3_ENDPOINT: 'http://minio:9000',
  S3_BUCKET_NAME: 'media-bucket',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_PUBLIC_URL: 'http://localhost:9000/media-bucket',
};

function setEnv(overrides: Partial<Record<string, string | undefined>> = {}) {
  // First apply the base env
  Object.assign(process.env, BASE_ENV);
  // Then explicitly delete keys whose override value is undefined
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearS3Env() {
  for (const key of Object.keys(BASE_ENV)) {
    delete process.env[key];
  }
}

function makeService() {
  setEnv();
  return new S3StorageService();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('S3StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});
    mockUploadDone.mockResolvedValue({});
  });

  afterEach(() => {
    clearS3Env();
  });

  // ── Construction ──────────────────────────────────────────────────────────

  describe('construction', () => {
    it('constructs successfully when all env vars are present', () => {
      setEnv();
      expect(() => new S3StorageService()).not.toThrow();
    });

    it('throws StorageConfigurationError when S3_BUCKET_NAME is missing', () => {
      setEnv({ S3_BUCKET_NAME: undefined });
      expect(() => new S3StorageService()).toThrow(StorageConfigurationError);
    });

    it('throws StorageConfigurationError when S3_ENDPOINT is missing', () => {
      setEnv({ S3_ENDPOINT: undefined });
      expect(() => new S3StorageService()).toThrow(StorageConfigurationError);
    });

    it('throws StorageConfigurationError when S3_SECRET_ACCESS_KEY is missing', () => {
      setEnv({ S3_SECRET_ACCESS_KEY: undefined });
      expect(() => new S3StorageService()).toThrow(StorageConfigurationError);
    });

    it('lists all missing vars in the error when multiple are absent', () => {
      clearS3Env();
      let err: StorageConfigurationError | undefined;
      try {
        new S3StorageService();
      } catch (e) {
        err = e as StorageConfigurationError;
      }
      expect(err).toBeInstanceOf(StorageConfigurationError);
      expect(err?.message).toContain('missing required environment variable');
    });
  });

  // ── uploadFile ────────────────────────────────────────────────────────────

  describe('uploadFile', () => {
    it('calls Upload.done and returns the full public URL (S3_PUBLIC_URL/folder/fileName)', async () => {
      const svc = makeService();
      const buffer = Buffer.from('fake-image-data');
      const url = await svc.uploadFile(buffer, 'test.jpg', 'image/jpeg', 'products/p1');

      // uploadFile now returns the canonical public URL, not the raw key.
      // This allows buildMediaUrl() in the resolver to pass it through unchanged
      // (it short-circuits on URLs that start with 'http').
      expect(url).toBe('http://localhost:9000/media-bucket/products/p1/test.jpg');
      expect(Upload).toHaveBeenCalledTimes(1);
      expect(mockUploadDone).toHaveBeenCalledTimes(1);

      const uploadParams = (Upload as jest.MockedClass<typeof Upload>).mock.calls[0][0];
      expect(uploadParams.params.Bucket).toBe('media-bucket');
      expect(uploadParams.params.Key).toBe('products/p1/test.jpg');
      expect(uploadParams.params.ContentType).toBe('image/jpeg');
    });

    it('returns public URL without folder prefix when folder is omitted', async () => {
      const svc = makeService();
      const url = await svc.uploadFile(Buffer.from('data'), 'icon.jpg', 'image/jpeg');
      expect(url).toBe('http://localhost:9000/media-bucket/icon.jpg');
    });

    it('wraps S3 upload errors as FileUploadError', async () => {
      mockUploadDone.mockRejectedValueOnce(new Error('S3 connection refused'));
      const svc = makeService();

      await expect(
        svc.uploadFile(Buffer.from('data'), 'test.jpg', 'image/jpeg', 'images'),
      ).rejects.toBeInstanceOf(FileUploadError);
    });
  });

  // ── deleteFile ────────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('sends DeleteObjectCommand with the raw key', async () => {
      const svc = makeService();
      await svc.deleteFile('products/p1/test.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'media-bucket',
        Key: 'products/p1/test.jpg',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('extracts key from a full public URL', async () => {
      const svc = makeService();
      await svc.deleteFile('http://localhost:9000/media-bucket/products/p1/test.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'media-bucket',
        Key: 'products/p1/test.jpg',
      });
    });

    it('extracts key when URL ends with trailing slash in publicUrl', async () => {
      setEnv({ S3_PUBLIC_URL: 'http://localhost:9000/media-bucket/' });
      const svc = new S3StorageService();
      await svc.deleteFile('http://localhost:9000/media-bucket/some/key.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: 'some/key.jpg' }),
      );
    });

    it('wraps S3 delete errors as FileDeleteError', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 forbidden'));
      const svc = makeService();

      await expect(svc.deleteFile('products/p1/test.jpg')).rejects.toBeInstanceOf(FileDeleteError);
    });

    it('skips delete and logs warning when fileUrl is empty string', async () => {
      const svc = makeService();
      await expect(svc.deleteFile('')).resolves.toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  // ── getPublicUrl ──────────────────────────────────────────────────────────

  describe('getPublicUrl', () => {
    it('returns publicUrl/key for a key without folder', () => {
      const svc = makeService();
      expect(svc.getPublicUrl('icon.jpg')).toBe(
        'http://localhost:9000/media-bucket/icon.jpg',
      );
    });

    it('returns publicUrl/folder/fileName when folder is provided', () => {
      const svc = makeService();
      expect(svc.getPublicUrl('test.jpg', 'products/p1')).toBe(
        'http://localhost:9000/media-bucket/products/p1/test.jpg',
      );
    });
  });

  // ── getBucketName ─────────────────────────────────────────────────────────

  describe('getBucketName', () => {
    it('returns S3_BUCKET_NAME from env', () => {
      const svc = makeService();
      expect(svc.getBucketName()).toBe('media-bucket');
    });
  });

  // ── validateFile ─────────────────────────────────────────────────────────

  describe('validateFile', () => {
    it('returns true for a valid JPEG within size limits', () => {
      const svc = makeService();
      expect(svc.validateFile('photo.jpg', 'image/jpeg', 1024)).toBe(true);
    });

    it('returns false for an invalid MIME type', () => {
      const svc = makeService();
      expect(svc.validateFile('file.exe', 'application/octet-stream', 1024)).toBe(false);
    });
  });
});
