import type { TokenPayload } from '@hbs/auth';
import { ISvgRepository } from '../../domain/repositories/ISvgRepository';
import { IStorageService } from '../../domain/interfaces/IStorageService';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { NotFoundError } from '../../domain/errors/DomainError';

export interface DeleteSvgRequest {
  id: string;
  currentUser?: TokenPayload | null;
}

/**
 * ITEM E — DeleteSvgUseCase.
 *
 * Coordinates:
 *   1. Repository lookup — verifies the record exists (and passes record-rule write gate).
 *   2. Physical file deletion via storageService.deleteFile().
 *   3. Database record deletion via svgRepository.delete().
 *
 * Same ordering rationale as DeleteImageUseCase: physical deletion first to avoid
 * unreachable files with no DB pointer. If storageService.deleteFile() fails, we still
 * proceed with the DB delete and surface the storage error afterwards.
 */
export class DeleteSvgUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly svgRepository: ISvgRepository,
    private readonly storageService: IStorageService,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('DeleteSvgUseCase');
  }

  async execute(request: DeleteSvgRequest): Promise<boolean> {
    const { id, currentUser = null } = request;

    // Find the record first to get the URL for physical file deletion.
    const svg = await this.svgRepository.findById(id);
    if (!svg) {
      throw new NotFoundError('Svg', id);
    }

    const fileUrl = svg.url;

    // Step 1 — delete physical file.
    let storageError: Error | null = null;
    try {
      await this.storageService.deleteFile(fileUrl);
      this.logger.info('SVG file deleted from storage', { svgId: id, fileUrl });
    } catch (err) {
      storageError = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        'Failed to delete SVG file from storage — proceeding with DB cleanup',
        storageError,
        { svgId: id, fileUrl },
      );
    }

    // Step 2 — delete DB record (passes record-rule write gate inside repository).
    const deleted = await this.svgRepository.delete(id, currentUser);
    this.logger.info('SVG record deleted', { svgId: id });

    // Surface the storage error after a successful DB delete so the caller is aware
    // that the file may still exist on disk.
    if (storageError) {
      throw storageError;
    }

    return deleted;
  }
}
