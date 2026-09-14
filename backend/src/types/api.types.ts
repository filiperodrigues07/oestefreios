export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string | null;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
