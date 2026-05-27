export interface BaseResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  code: string;
  timestamp: string;
  metadata?: {
    requestId?: string;
    traceId?: string;
    duration?: number;
  };
}

export interface ResponseMetadata {
  requestId?: string;
  traceId?: string;
  duration?: number;
  timestamp?: string;
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
