import { RESPONSE_CODES, ResponseCode } from '../constants/ResponseCodes';

export interface ResponseMetadata {
  requestId?: string;
  traceId?: string;
  duration?: number;
  timestamp: string;
}

export interface BaseResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  code: string;
  timestamp: string;
  metadata?: ResponseMetadata;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationInfo;
}

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
    code: ResponseCode = RESPONSE_CODES.SUCCESS,
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
    code: ResponseCode,
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
      RESPONSE_CODES.PAGINATED_SUCCESS,
      metadata
    );
  }

  static createCreateResponse<T>(
    entity: T,
    id: string,
    createdAt: string,
    message: string = 'Resource created successfully',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<{ entity: T; id: string; createdAt: string }> {
    return this.createSuccessResponse(
      { entity, id, createdAt },
      message,
      RESPONSE_CODES.CREATED,
      metadata
    );
  }

  static createUpdateResponse<T>(
    entity: T,
    id: string,
    updatedAt: string,
    changes: string[],
    message: string = 'Resource updated successfully',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<{ entity: T; id: string; updatedAt: string; changes: string[] }> {
    return this.createSuccessResponse(
      { entity, id, updatedAt, changes },
      message,
      RESPONSE_CODES.UPDATED,
      metadata
    );
  }

  static createDeleteResponse(
    id: string,
    deletedAt: string,
    softDelete: boolean = false,
    message: string = 'Resource deleted successfully',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<{ id: string; deletedAt: string; softDelete: boolean }> {
    return this.createSuccessResponse(
      { id, deletedAt, softDelete },
      message,
      RESPONSE_CODES.DELETED,
      metadata
    );
  }
}

