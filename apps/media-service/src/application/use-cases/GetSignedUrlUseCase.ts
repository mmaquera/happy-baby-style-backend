import type { TokenPayload } from '@hbs/auth';
import { NotFoundError } from '@hbs/shared-kernel';
import { IImageRepository } from '../../domain/repositories/IImageRepository';
import { IStorageService } from '../../domain/interfaces/IStorageService';
import { LoggerFactory, ILogger } from '@hbs/logging';

// ---------------------------------------------------------------------------
// R2 — TTL constants enforced in the application layer, never in the resolver
// or storage driver. The use-case is the single authoritative TTL gate.
// ---------------------------------------------------------------------------
export const TTL_MIN = 60;       // seconds — floor
export const TTL_DEFAULT = 300;  // seconds — used when caller omits ttl
export const TTL_MAX = 3600;     // seconds — ceiling (never issue URLs valid > 1 h)

export interface GetSignedUrlRequest {
  /** R1 — UUID of the image record in the DB. No key/path/filename accepted. */
  id: string;
  /**
   * Requested TTL in seconds. Clamped server-side to [TTL_MIN, TTL_MAX].
   * Clients cannot escalate the TTL beyond TTL_MAX by passing large values.
   */
  ttl?: number;
  currentUser?: TokenPayload | null;
}

export interface GetSignedUrlResult {
  /** Presigned URL (S3) or public URL (local driver). */
  signedUrl: string;
  /** Clamped TTL actually applied — useful for clients caching the URL. */
  ttl: number;
  /** Image UUID echoed back for easy correlation. */
  imageId: string;
}

export class GetSignedUrlUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly imageRepository: IImageRepository,
    private readonly storageService: IStorageService,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('GetSignedUrlUseCase');
  }

  async execute(request: GetSignedUrlRequest): Promise<GetSignedUrlResult> {
    const { id, ttl, currentUser = null } = request;

    // ------------------------------------------------------------------
    // R1 — resolve key from DB only; never accept a key/path from input.
    // ------------------------------------------------------------------
    const image = await this.imageRepository.findById(id);
    if (!image) {
      throw new NotFoundError('Image', id);
    }

    // Prefer path (the canonical storage key), fall back to url column.
    // path is always the relative key (e.g. 'products/p1/product_p1_123.jpg').
    // url may be an absolute URL or a relative path — the storage driver handles both.
    const storageKey = image.path || image.url;

    if (!storageKey) {
      this.logger.error(
        'Image record has neither path nor url — cannot generate presigned URL',
        new Error('missing_storage_key'),
        { imageId: id },
      );
      throw new NotFoundError('Image', id);
    }

    // ------------------------------------------------------------------
    // R5 — backstop enum validation.
    // The SDL already enforces ImageEntityType on the mutations that store
    // the record; this guard defends against stale data or direct DB writes
    // that bypassed the schema. Currently informational — we log and continue.
    // ------------------------------------------------------------------
    const validEntityTypes = ['product', 'user', 'category'];
    if (!validEntityTypes.includes(image.entityType as string)) {
      this.logger.warn('Image has unexpected entityType — proceeding but flagging', {
        imageId: id,
        entityType: image.entityType,
      });
      // We do NOT throw here because the image exists and is accessible;
      // the entityType only affects upstream query filters, not URL generation.
    }

    // ------------------------------------------------------------------
    // R2 — clamp TTL in the application layer.
    // Use TTL_DEFAULT for any non-finite value (NaN, Infinity) so Math.max/min
    // arithmetic never propagates NaN into the presigner expiry parameter.
    // ------------------------------------------------------------------
    const resolvedTtl = Number.isFinite(ttl) ? (ttl as number) : TTL_DEFAULT;
    const safeTtl = Math.max(TTL_MIN, Math.min(resolvedTtl, TTL_MAX));

    const signedUrl = await this.storageService.getSignedUrl(storageKey, safeTtl, image.mimeType);

    this.logger.info('Presigned URL issued', {
      imageId: id,
      entityType: image.entityType,
      entityId: image.entityId,
      ttl: safeTtl,
      requestedTtl: ttl,
    });

    return {
      signedUrl,
      ttl: safeTtl,
      imageId: id,
    };
  }
}
