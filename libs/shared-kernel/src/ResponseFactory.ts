import { BaseResponse, ResponseMetadata, PaginatedData, PaginationInfo } from './BaseResponse';

export class ResponseFactory {
  private static generateMetadata(
    requestId?: string, 
    traceId?: string, 
    duration?: number
  ): ResponseMetadata {
    return {
      requestId,
      traceId,
      duration,
      timestamp: new Date().toISOString()
    };
  }

  static createSuccessResponse<T>(
    data: T,
    message: string,
    code: string = 'SUCCESS',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<T> {
    return {
      success: true,
      data,
      message,
      code,
      timestamp: new Date().toISOString(),
      metadata: {
        ...this.generateMetadata(),
        ...metadata
      }
    };
  }

  static createErrorResponse(
    message: string,
    code: string,
    details?: any,
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<null> {
    return {
      success: false,
      data: null,
      message,
      code,
      timestamp: new Date().toISOString(),
      metadata: {
        ...this.generateMetadata(),
        ...metadata
      }
    };
  }

  static createPaginatedResponse<T>(
    items: T[],
    pagination: PaginationInfo,
    message: string = 'Data retrieved successfully',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<PaginatedData<T>> {
    return this.createSuccessResponse(
      { items, pagination },
      message,
      'PAGINATED_SUCCESS',
      metadata
    );
  }

  // SVG specific response methods
  static createSvgUploadResponse(
    svgData: {
      url: string;
      filename: string;
      svgId: string;
      dimensions?: { width?: number; height?: number };
      viewBox?: string;
      optimized: boolean;
    },
    message: string = 'SVG uploaded successfully',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<typeof svgData> {
    return this.createSuccessResponse(
      svgData,
      message,
      'SVG_UPLOADED',
      metadata
    );
  }

  static createSvgErrorResponse(
    message: string,
    code: string = 'SVG_UPLOAD_ERROR',
    details?: any,
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<null> {
    return this.createErrorResponse(
      message,
      code,
      details,
      metadata
    );
  }
}

