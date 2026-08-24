// Shared shapes for the backend's { success, data, ... } JSON envelope.

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
  pagination: Pagination;
}
