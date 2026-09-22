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
    /** Payload estruturado opcional — ex.: registro conflitante num erro de duplicidade. */
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
