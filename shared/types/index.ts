// Shared TypeScript types for BOLH

// User types
export type UserRole = 'client' | 'specialist' | 'admin';

export interface User {
  id: number;
  phone: string;
  name: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string;
  rating?: number;
  verifiedLevel?: number;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

// Guard types
export interface Guard {
  id: number;
  userId: number;
  name: string;
  phone: string;
  avatarUrl?: string;
  verificationLevel: VerificationLevel;
  rating: number;
  totalReviews: number;
  totalOrders: number;
  completedOrders: number;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  isOnline: boolean;
  hourlyRate: number;
  experienceYears: number;
  specializations: Specialization[];
  bio?: string;
  createdAt: string;
}

export type VerificationLevel = 0 | 1 | 2 | 3 | 4;

export type Specialization =
  | 'bodyguard'
  | 'property_patrol'
  | 'event_security'
  | 'vehicle_escort'
  | 'vip_protection'
  | 'cctv_operator'
  | 'k9_handler'
  | 'firearms_certified'
  | 'first_aid'
  | 'martial_arts';

// Order types
export interface Order {
  id: string;
  clientId: number;
  specialistId?: number;
  serviceType: ServiceType;
  status: OrderStatus;
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
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ServiceType =
  | 'bodyguard'
  | 'property_patrol'
  | 'event_security'
  | 'vehicle_escort'
  | 'personal_protection'
  | 'cctv_monitoring'
  | 'alarm_response'
  | 'custom';

export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

// Payment types
export interface Payment {
  id: string;
  userId: number;
  orderId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  cardLastFour?: string;
  errorMessage?: string;
  createdAt: string;
}

export type PaymentMethod =
  | 'card'
  | 'apple_pay'
  | 'google_pay'
  | 'bank_transfer'
  | 'cash'
  | 'wallet';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

// Subscription types
export interface Subscription {
  id: string;
  userId: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired';

// Message types
export interface Message {
  id: string;
  conversationId: string;
  senderId: number;
  text: string;
  attachmentUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  orderId?: string;
  participant1: number;
  participant2: number;
  lastMessageAt?: string;
  createdAt: string;
}

// Notification types
export interface Notification {
  id: string;
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export type NotificationType =
  | 'order_created'
  | 'order_accepted'
  | 'order_started'
  | 'order_completed'
  | 'order_cancelled'
  | 'message_received'
  | 'payment_received'
  | 'promotion'
  | 'system';

// Review types
export interface Review {
  id: string;
  orderId: string;
  reviewerId: number;
  reviewedId: number;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

// Geolocation types
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

// WebSocket event types
export type WsEventType =
  | 'specialist:location'
  | 'order:status'
  | 'chat:message'
  | 'sos:alert'
  | 'notification'
  | 'ping'
  | 'pong';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  data: T;
}
