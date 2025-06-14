export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface MonetizationMetrics {
  revenue: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  breakdown: {
    affiliate: number;
    subscriptions: number;
    sponsored: number;
  };
}

export interface PerformanceMetrics {
  responseTime: number;
  cacheHitRate: number;
  errorRate: number;
  activeUsers: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface AffiliateMetrics {
  clicks: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
}

export interface CacheConfig {
  ttl: number;
  prefix: string;
  invalidateOnUpdate?: boolean;
}
