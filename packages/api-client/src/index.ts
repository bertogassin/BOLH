// BOLH API Client
// Type-safe HTTP client for BOLH backend

import ky, { type KyInstance, type Options } from 'ky';

export interface ApiConfig {
  baseUrl: string;
  getToken?: () => string | null;
  onUnauthorized?: () => void;
}

export interface User {
  id: number;
  phone: string;
  name: string;
  email?: string;
  role: 'client' | 'specialist' | 'admin';
  avatarUrl?: string;
  rating?: number;
  verifiedLevel?: number;
}

export interface Guard {
  id: number;
  userId: number;
  name: string;
  phone: string;
  avatarUrl?: string;
  verificationLevel: number;
  rating: number;
  totalReviews: number;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  isOnline: boolean;
  hourlyRate: number;
  experienceYears: number;
  specializations: string[];
}

export interface Order {
  id: string;
  clientId: number;
  specialistId?: number;
  serviceType: string;
  status: 'new' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  durationHours: number;
  price: number;
  currency: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

class ApiClient {
  private client: KyInstance;
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.client = ky.create({
      prefixUrl: config.baseUrl,
      hooks: {
        beforeRequest: [
          (request) => {
            const token = config.getToken?.();
            if (token) {
              request.headers.set('Authorization', `Bearer ${token}`);
            }
          },
        ],
        afterResponse: [
          async (_request, _options, response) => {
            if (response.status === 401) {
              config.onUnauthorized?.();
            }
          },
        ],
      },
    });
  }

  // Auth endpoints
  async register(data: {
    phone: string;
    password: string;
    name: string;
    role: 'client' | 'specialist';
  }): Promise<AuthResponse> {
    return this.client.post('auth/register', { json: data }).json();
  }

  async login(phone: string, password: string): Promise<AuthResponse> {
    return this.client.post('auth/login', { json: { phone, password } }).json();
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    return this.client.post('auth/refresh', { json: { refreshToken } }).json();
  }

  async logout(): Promise<void> {
    await this.client.post('auth/logout');
  }

  // User endpoints
  async getMe(): Promise<User> {
    return this.client.get('users/me').json();
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.client.put('users/me', { json: data }).json();
  }

  async updateLocation(latitude: number, longitude: number): Promise<void> {
    await this.client.put('users/me/location', { json: { latitude, longitude } });
  }

  // Guard endpoints
  async listGuards(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Guard>> {
    return this.client.get('specialists', { searchParams: params }).json();
  }

  async nearbyGuards(params: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    limit?: number;
  }): Promise<Guard[]> {
    const response = await this.client.get('specialists/nearby', { searchParams: params }).json<{ specialists: Guard[] }>();
    return response.specialists;
  }

  async getGuard(id: number): Promise<Guard> {
    return this.client.get(`specialists/${id}`).json();
  }

  // Order endpoints
  async listOrders(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Order>> {
    return this.client.get('orders', { searchParams: params }).json();
  }

  async createOrder(data: {
    serviceType: string;
    address: string;
    latitude: number;
    longitude: number;
    description?: string;
    durationHours?: number;
    scheduledAt?: string;
  }): Promise<Order> {
    return this.client.post('orders', { json: data }).json();
  }

  async getOrder(id: string): Promise<Order> {
    return this.client.get(`orders/${id}`).json();
  }

  async acceptOrder(id: string): Promise<Order> {
    return this.client.post(`orders/${id}/accept`).json();
  }

  async startOrder(id: string): Promise<Order> {
    return this.client.post(`orders/${id}/start`).json();
  }

  async completeOrder(id: string): Promise<Order> {
    return this.client.post(`orders/${id}/complete`).json();
  }

  async cancelOrder(id: string): Promise<Order> {
    return this.client.post(`orders/${id}/cancel`).json();
  }

  // Payment endpoints
  async listPayments(): Promise<PaginatedResponse<any>> {
    return this.client.get('payments').json();
  }

  async createPayment(data: {
    orderId?: string;
    amount: number;
    method: string;
  }): Promise<any> {
    return this.client.post('payments', { json: data }).json();
  }

  async getSubscription(): Promise<any> {
    return this.client.get('payments/subscription').json();
  }

  async subscribe(plan: string): Promise<any> {
    return this.client.post('payments/subscription', { json: { plan } }).json();
  }
}

// Factory function
export function createApiClient(config: ApiConfig): ApiClient {
  return new ApiClient(config);
}

export default ApiClient;
