import { BaseResponse, ResponseMetadata, PaginatedData, PaginationInfo } from '../types/BaseResponse';

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
}

