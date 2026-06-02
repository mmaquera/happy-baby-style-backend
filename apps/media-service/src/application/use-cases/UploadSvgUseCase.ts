import type { TokenPayload } from '@hbs/auth';
import { SvgEntity, SvgEntityType } from '../../domain/entities/Svg';
import { ISvgRepository } from '../../domain/repositories/ISvgRepository';
import { IStorageService } from '../../domain/interfaces/IStorageService';
import { LoggerFactory, ILogger } from '@hbs/logging';
import { SvgValidationService } from '../validation/SvgValidationService';
import { InvalidFormatError } from '../../domain/errors/DomainError';

// Inlined from @config/storage
const svgConfig = {
  maxFileSize: parseInt(process.env.SVG_MAX_FILE_SIZE || '2097152'),
  allowedMimeTypes: ['image/svg+xml', 'application/svg+xml'] as string[],
  allowedExtensions: ['.svg'],
  maxContentSize: parseInt(process.env.SVG_MAX_CONTENT_SIZE || '1048576'),
  enableSanitization: process.env.SVG_ENABLE_SANITIZATION !== 'false',
  enableOptimization: process.env.SVG_ENABLE_OPTIMIZATION !== 'false',
};

export interface UploadSvgRequest {
  file: any;
  entityType: SvgEntityType;
  entityId: string;
  optimize?: boolean;
  sanitize?: boolean;
  currentUser?: TokenPayload | null;
}

export class UploadSvgUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly svgRepository: ISvgRepository,
    private readonly storageService: IStorageService,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('UploadSvgUseCase');
  }

  async execute(request: UploadSvgRequest): Promise<SvgEntity> {
    const { file, entityType, entityId, optimize = true, sanitize = true, currentUser = null } = request;

    SvgValidationService.validateSvgUploadRequest({ file, entityType, entityId });

    const svgContent = await this.readSvgContent(file);

    SvgValidationService.validateSvgFile(file, svgContent.length);
    SvgValidationService.validateSvgContent(svgContent);

    let processedContent = svgContent;
    if (sanitize && svgConfig.enableSanitization) {
      processedContent = SvgValidationService.sanitizeSvgContent(svgContent);
    }

    const metadata = SvgEntity.extractSvgMetadata(processedContent);

    SvgValidationService.validateSvgDimensions(metadata.dimensions);
    SvgValidationService.validateViewBox(metadata.viewBox);

    const fileInfo = this.extractFileInfo(file);
    const timestamp = Date.now();
    const extension = this.getFileExtension(fileInfo.filename);
    const fileName = `${entityType}_${entityId}_${timestamp}.${extension}`;

    const buffer = Buffer.from(processedContent, 'utf8');

    const url = await this.storageService.uploadFile(
      buffer,
      fileName,
      fileInfo.mimetype,
      `${entityType}s/${entityId}`,
    );

    const svg = SvgEntity.create({
      fileName,
      originalName: fileInfo.filename,
      mimeType: fileInfo.mimetype,
      size: buffer.length,
      url,
      bucket: 'local',
      path: `${entityType}s/${entityId}/${fileName}`,
      entityType,
      entityId,
      dimensions: metadata.dimensions,
      viewBox: metadata.viewBox,
      optimized: optimize && svgConfig.enableOptimization,
    });

    const savedSvg = await this.svgRepository.create(svg, currentUser);

    this.logger.info('SVG uploaded successfully', { svgId: savedSvg.id, entityType, entityId });

    return savedSvg;
  }

  private extractFileInfo(file: any): {
    filename: string;
    mimetype: string;
    size: number;
    encoding: string;
  } {
    return {
      filename: file?.file?.filename || file?.filename || 'unknown',
      mimetype: file?.file?.mimetype || file?.mimetype || 'unknown',
      size: file?.file?.size || file?.size || 0,
      encoding: file?.file?.encoding || file?.encoding || 'unknown',
    };
  }

  private async readSvgContent(file: any): Promise<string> {
    try {
      if (file?.file?.createReadStream) {
        return await this.readStreamContent(file.file.createReadStream());
      } else if (file?.createReadStream) {
        return await this.readStreamContent(file.createReadStream());
      } else if (file?.buffer) {
        return file.buffer.toString('utf8');
      } else if (file?.file?.buffer) {
        return file.file.buffer.toString('utf8');
      } else {
        throw new InvalidFormatError('Unable to read SVG content from file object');
      }
    } catch (error) {
      throw new InvalidFormatError(
        `Failed to read SVG content: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async readStreamContent(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', (error: Error) => reject(error));
    });
  }

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return 'svg';
    return filename.substring(lastDotIndex + 1);
  }
}
