/**
 * storageFactory tests — verifies that index.ts logic chooses the correct
 * IStorageService implementation based on STORAGE_DRIVER env var.
 *
 * We test the factory logic directly (not the full index.ts boot sequence)
 * to avoid requiring a live DB, Redis, etc.  The factory is extracted inline
 * here, mirroring the same condition used in index.ts.
 */

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

// Mock aws-sdk before importing S3StorageService
const mockUploadDone = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({ done: mockUploadDone })),
}));

import { LocalStorageService } from '../LocalStorageService';
import { S3StorageService } from '../S3StorageService';
import type { IStorageService } from '../../../domain/interfaces/IStorageService';

// ---------------------------------------------------------------------------
// Factory — mirrors the logic in apps/media-service/src/index.ts
// ---------------------------------------------------------------------------
function createStorageService(): IStorageService {
  if (process.env.STORAGE_DRIVER === 's3') {
    return new S3StorageService();
  }
  return new LocalStorageService();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const S3_ENV: Record<string, string> = {
  S3_ENDPOINT: 'http://minio:9000',
  S3_BUCKET_NAME: 'media-bucket',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_PUBLIC_URL: 'http://localhost:9000/media-bucket',
};

function setS3Env() {
  Object.assign(process.env, S3_ENV);
}

function clearS3Env() {
  for (const key of Object.keys(S3_ENV)) {
    delete process.env[key];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('storage factory (STORAGE_DRIVER selector)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STORAGE_DRIVER;
    clearS3Env();
  });

  afterEach(() => {
    delete process.env.STORAGE_DRIVER;
    clearS3Env();
  });

  it('returns LocalStorageService when STORAGE_DRIVER is not set (default)', () => {
    const svc = createStorageService();
    expect(svc).toBeInstanceOf(LocalStorageService);
  });

  it('returns LocalStorageService when STORAGE_DRIVER=local', () => {
    process.env.STORAGE_DRIVER = 'local';
    const svc = createStorageService();
    expect(svc).toBeInstanceOf(LocalStorageService);
  });

  it('returns LocalStorageService when STORAGE_DRIVER is an empty string', () => {
    process.env.STORAGE_DRIVER = '';
    const svc = createStorageService();
    expect(svc).toBeInstanceOf(LocalStorageService);
  });

  it('returns S3StorageService when STORAGE_DRIVER=s3 and S3 env vars are set', () => {
    process.env.STORAGE_DRIVER = 's3';
    setS3Env();
    const svc = createStorageService();
    expect(svc).toBeInstanceOf(S3StorageService);
  });

  it('both drivers satisfy IStorageService interface (uploadFile, deleteFile, getPublicUrl, validateFile, getBucketName)', () => {
    // local
    const local = createStorageService();
    expect(typeof local.uploadFile).toBe('function');
    expect(typeof local.deleteFile).toBe('function');
    expect(typeof local.getPublicUrl).toBe('function');
    expect(typeof local.validateFile).toBe('function');
    expect(typeof local.getBucketName).toBe('function');
    expect(local.getBucketName()).toBe('local');

    // s3
    process.env.STORAGE_DRIVER = 's3';
    setS3Env();
    const s3 = createStorageService();
    expect(typeof s3.uploadFile).toBe('function');
    expect(typeof s3.deleteFile).toBe('function');
    expect(typeof s3.getPublicUrl).toBe('function');
    expect(typeof s3.validateFile).toBe('function');
    expect(typeof s3.getBucketName).toBe('function');
    expect(s3.getBucketName()).toBe('media-bucket');
  });
});
