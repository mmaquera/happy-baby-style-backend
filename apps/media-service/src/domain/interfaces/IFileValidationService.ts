export interface IFileValidationService {
  validateFile(fileName: string, mimeType: string, fileSize: number): void;
  getExtensionFromMimeType(mimeType: string): string;
}
