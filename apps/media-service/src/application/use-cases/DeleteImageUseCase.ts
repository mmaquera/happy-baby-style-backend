import type { TokenPayload } from '@hbs/auth';
import { IImageRepository } from '../../domain/repositories/IImageRepository';
import { IStorageService } from '../../domain/interfaces/IStorageService';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '../../domain/errors/DomainError';

export interface DeleteImageRequest {
  id: string;
  currentUser?: TokenPayload | null;
}

/**
 * ITEM E — DeleteImageUseCase.
 *
 * Coordinates:
 *   1. Repository lookup — verifies the record exists (and passes record-rule write gate).
 *   2. Physical file deletion via storageService.deleteFile().
 *   3. Database record deletion via imageRepository.delete().
 *
 * Ordering rationale: delete the physical file first. If the DB delete fails afterwards
 * the file is already gone, but the orphaned DB row can be cleaned up by a maintenance job
 * (low risk). The inverse order (DB first, then file) would leave an unreachable file in
 * storage with no DB pointer — a harder-to-detect leak.
 *
 * If storageService.deleteFile() throws, we log the error and still attempt the DB delete
 * so the record is not left in an inconsistent "pointer to missing file" state. Both
 * errors are surfaced to the caller.
 */
export class DeleteImageUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly imageRepository: IImageRepository,
    private readonly storageService: IStorageService,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteImageUseCase');
  }

  async execute(request: DeleteImageRequest): Promise<void> {
    const { id, currentUser = null } = request;

    // Find the record first to get the URL for physical file deletion.
    // PrismaImageRepository.delete() will re-probe under the record-rule filter,
    // so a race between findById and delete is safe (delete will throw NotFoundError
    // if the row disappeared or was rule-denied between the two calls).
    const image = await this.imageRepository.findById(id);
    if (!image) {
      throw new NotFoundError('Image', id);
    }

    const fileUrl = image.url;

    // Step 1 — delete physical file.
    // A missing file is logged as a warning (not an error) — the record should still
    // be cleaned up even if the file was already removed from disk.
    let storageError: Error | null = null;
    try {
      await this.storageService.deleteFile(fileUrl);
      this.logger.info('Image file deleted from storage', { imageId: id, fileUrl });
    } catch (err) {
      storageError = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        'Failed to delete image file from storage — proceeding with DB cleanup',
        storageError,
        { imageId: id, fileUrl },
      );
    }

    // Step 2 — delete DB record (passes record-rule write gate inside repository).
    await this.imageRepository.delete(id, currentUser);
    this.logger.info('Image record deleted', { imageId: id });

    // Surface the storage error after a successful DB delete so the caller is aware
    // that the file may still exist on disk (manual reconciliation may be needed).
    if (storageError) {
      throw storageError;
    }
  }
}
