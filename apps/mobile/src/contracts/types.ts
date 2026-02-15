// Contract & Payment Types for BOLH
// Legally compliant contract system

export type ContractType = 'instant' | 'short' | 'monthly' | 'subscription';

export interface ContractPlan {
  id: ContractType;
  name: string;
  nameRu: string;
  description: string;
  minDuration: string;
  maxDuration: string;
  escrow: boolean;
  escrowPercent: number;
  platformFee: number; // percentage
  cancellationPolicy: string;
  paymentSchedule: 'upfront' | 'weekly' | 'monthly' | 'auto';
  // Legal compliance fields
  coolingOffPeriod: number; // hours — right to cancel after signing (consumer protection)
  disputeResolutionDays: number; // days to resolve disputes
  liabilityLimit: 'platform_fee' | 'contract_total'; // max platform liability
  autoRenewalNotice: number; // days before auto-renewal to notify
  dataRetentionDays: number; // how long to keep contract data after completion
  jurisdictionNote: string; // applicable law note
}

export const contractPlans: ContractPlan[] = [
  {
    id: 'instant',
    name: 'Instant',
    nameRu: 'Срочный',
    description: 'Специалист за 15 минут. Идеально для непредвиденных ситуаций.',
    minDuration: '1 час',
    maxDuration: '24 часа',
    escrow: true,
    escrowPercent: 100,
    platformFee: 15,
    cancellationPolicy: 'Бесплатная отмена до прибытия специалиста. После — 50% возврат.',
    paymentSchedule: 'upfront',
    coolingOffPeriod: 0, // urgent — no cooling off
    disputeResolutionDays: 7,
    liabilityLimit: 'platform_fee',
    autoRenewalNotice: 0,
    dataRetentionDays: 365,
    jurisdictionNote: 'local',
  },
  {
    id: 'short',
    name: 'Short-term',
    nameRu: 'Краткосрочный',
    description: 'На несколько дней. Мероприятия, поездки, особые случаи.',
    minDuration: '1 день',
    maxDuration: '7 дней',
    escrow: true,
    escrowPercent: 100,
    platformFee: 12,
    cancellationPolicy: 'Бесплатная отмена за 24ч. Позже — 25% удержание.',
    paymentSchedule: 'upfront',
    coolingOffPeriod: 24,
    disputeResolutionDays: 14,
    liabilityLimit: 'platform_fee',
    autoRenewalNotice: 0,
    dataRetentionDays: 365,
    jurisdictionNote: 'local',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    nameRu: 'Месячный',
    description: 'Постоянная работа. Еженедельная оплата, гибкие условия.',
    minDuration: '1 месяц',
    maxDuration: '12 месяцев',
    escrow: true,
    escrowPercent: 25,
    platformFee: 10,
    cancellationPolicy: 'Уведомление за 7 дней. Оплата за отработанное время.',
    paymentSchedule: 'weekly',
    coolingOffPeriod: 48,
    disputeResolutionDays: 30,
    liabilityLimit: 'platform_fee',
    autoRenewalNotice: 7,
    dataRetentionDays: 730,
    jurisdictionNote: 'local',
  },
  {
    id: 'subscription',
    name: 'Subscription',
    nameRu: 'Подписка',
    description: 'Регулярный сервис. Автоматическое продление и оплата.',
    minDuration: '1 месяц',
    maxDuration: 'Бессрочно',
    escrow: false,
    escrowPercent: 0,
    platformFee: 8,
    cancellationPolicy: 'Отмена в любое время. Оплата до конца текущего периода.',
    paymentSchedule: 'auto',
    coolingOffPeriod: 336, // 14 days (EU consumer right)
    disputeResolutionDays: 30,
    liabilityLimit: 'platform_fee',
    autoRenewalNotice: 3,
    dataRetentionDays: 730,
    jurisdictionNote: 'local',
  },
];

export type PaymentMethod = 'kaspi' | 'card' | 'apple_pay' | 'google_pay' | 'balance';

export interface PaymentMethodInfo {
  id: PaymentMethod;
  name: string;
  icon: string;
  description: string;
  available: boolean;
  fee: number; // percentage, 0 = free
}

export const paymentMethods: PaymentMethodInfo[] = [
  {
    id: 'kaspi',
    name: 'Kaspi Pay',
    icon: '🏦',
    description: 'Мгновенный перевод через Kaspi',
    available: true,
    fee: 0,
  },
  {
    id: 'card',
    name: 'Банковская карта',
    icon: '💳',
    description: 'Visa, Mastercard, Мир',
    available: true,
    fee: 2,
  },
  {
    id: 'apple_pay',
    name: 'Apple Pay',
    icon: '🍎',
    description: 'Быстрая оплата с iPhone',
    available: true,
    fee: 0,
  },
  {
    id: 'google_pay',
    name: 'Google Pay',
    icon: '🤖',
    description: 'Быстрая оплата с Android',
    available: true,
    fee: 0,
  },
  {
    id: 'balance',
    name: 'Баланс BOLH',
    icon: '👛',
    description: 'Оплата с внутреннего счёта',
    available: true,
    fee: 0,
  },
];

export type ContractStatus = 
  | 'draft'           // Being created
  | 'pending_payment' // Waiting for payment
  | 'paid'            // Payment received, escrow held
  | 'guard_assigned'  // Guard accepted
  | 'in_progress'     // Service started
  | 'completed'       // Service finished
  | 'cancelled'       // Cancelled by either party
  | 'disputed'        // Payment dispute
  | 'refunded';       // Money returned

export interface Contract {
  id: string;
  type: ContractType;
  clientId: string;
  guardId?: string;
  
  // Details
  address: string;
  startDate: Date;
  endDate: Date;
  totalHours: number;
  
  // Pricing
  hourlyRate: number;
  subtotal: number;
  platformFee: number;
  paymentFee: number;
  total: number;
  
  // Escrow
  escrowAmount: number;
  escrowReleased: boolean;
  
  // Status
  status: ContractStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  
  // Legal & Compliance
  termsAccepted: boolean;
  termsAcceptedAt?: Date;
  privacyAccepted: boolean;
  cancellationPolicyAccepted: boolean;
  coolingOffExpires?: Date; // when cooling-off period ends
  disputeDeadline?: Date; // last date to file dispute
  contractVersion: string; // version of terms at signing
  signatureHash?: string; // digital signature hash
  clientIP?: string; // IP at signing for audit
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Price calculation helpers
export function calculateContractPrice(
  hourlyRate: number,
  hours: number,
  contractType: ContractType,
  paymentMethod: PaymentMethod
): {
  subtotal: number;
  platformFee: number;
  paymentFee: number;
  total: number;
  escrowAmount: number;
} {
  const plan = contractPlans.find(p => p.id === contractType)!;
  const method = paymentMethods.find(m => m.id === paymentMethod)!;
  
  const subtotal = hourlyRate * hours;
  const platformFee = Math.round(subtotal * (plan.platformFee / 100));
  const paymentFee = Math.round(subtotal * (method.fee / 100));
  const total = subtotal + platformFee + paymentFee;
  const escrowAmount = Math.round(total * (plan.escrowPercent / 100));
  
  return {
    subtotal,
    platformFee,
    paymentFee,
    total,
    escrowAmount,
  };
}
