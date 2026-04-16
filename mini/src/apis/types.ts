/** 后端标准响应 */
export interface ApiResponse<T> {
  data: T
}

/** 后端错误响应 */
export interface ApiErrorResponse {
  statusCode: number
  code: string
  message: string
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** 分页请求参数 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}
