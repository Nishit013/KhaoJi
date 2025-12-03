
export enum OrderStatus {
  OPEN = 'OPEN', // Table is active/eating
  COMPLETED = 'COMPLETED', // Bill paid (or partial paid/due)
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI'
}

export interface Payment {
  method: PaymentMethod;
  amount: number;
  timestamp: number;
}

export enum ItemCategory {
  FOOD = 'FOOD',
  BEVERAGE = 'BEVERAGE',
  DESSERT = 'DESSERT',
  RETAIL = 'RETAIL'
}

export interface VariantOption {
  id: string;
  name: string;
  priceModifier: number; // e.g. 0 or 50
}

export interface VariantGroup {
  id: string;
  name: string; // e.g. "Size", "Spice Level"
  options: VariantOption[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string; // Changed from ItemCategory to string for dynamic categories
  stock: number;
  taxRate: number; // Percentage, e.g., 5 for 5%
  image?: string;
  isVeg?: boolean;
  variants?: VariantGroup[];
}

export type ItemStatus = 'KITCHEN' | 'READY' | 'SERVED';

export interface CartItem extends Product {
  qty: number;
  notes?: string;
  selectedVariants?: Record<string, VariantOption>; // Key: VariantGroup.id
  kotId?: string; // ID to group items by KOT batch
  timestamp?: number; // Time added to KOT
  status?: ItemStatus; // Status of this specific item in kitchen
}

export interface Order {
  id: string;
  tableId?: string; // Optional for retail
  customerName?: string;
  customerPhone?: string; // Added field for tracking history
  deliveryAddress?: string; // New field for delivery orders
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  discountNote?: string; // Details about the discount type (e.g., "Flat", "Loyalty")
  total: number;
  
  // Payment tracking
  payments: Payment[]; // List of partial payments
  amountPaid: number; // Total amount paid so far
  isFullyPaid: boolean; // True if amountPaid >= total

  // Shift & Staff Tracking
  shiftId?: string;
  staffId?: string;
  staffName?: string;

  status: OrderStatus;
  timestamp: number;
}

export interface Table {
  id: string;
  name: string;
  floor: string;
}

// --- Reservation System ---

export enum ReservationStatus {
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED', // Guest Arrived
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export interface Reservation {
  id: string;
  tableId: string;
  customerName: string;
  customerPhone: string;
  reservationTime: number; // Timestamp of booking
  guests: number;
  notes?: string;
  status: ReservationStatus;
  createdAt: number;
  createdBy?: string;
}

// --- Loyalty System Types ---

export interface LoyaltySettings {
  enabled: boolean;
  earningRate: number; // Spend Amount required to earn 1 Point (e.g., ₹100 = 1 Point)
  redemptionValue: number; // Value of 1 Point in currency (e.g., 1 Point = ₹1)
  minPointsToRedeem: number; // Minimum points required to start redeeming
  minOrderValueToRedeem: number; // Minimum bill amount required to redeem points
  expiryMonths: number; // Points expire after X months
}

export interface LoyaltyTransaction {
  id: string;
  date: number;
  type: 'EARNED' | 'REDEEMED' | 'EXPIRED' | 'ADJUSTMENT';
  points: number;
  orderId?: string;
  description?: string;
  expiryDate?: number; // Only for EARNED points
}

export interface Customer {
  phone: string; // Primary Key
  name: string;
  email?: string;
  address?: string;
  notes?: string; // VIP, Allergies, Blacklisted
  firstVisit?: number;
  lastVisit?: number;
  
  // Loyalty Data
  loyaltyPoints: number; // Current Available Balance
  totalPointsEarned: number; // Lifetime Earned
  totalPointsRedeemed: number; // Lifetime Redeemed
  loyaltyHistory: LoyaltyTransaction[];
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  topSellingItems: { name: string; count: number }[];
}

// --- New Types for Reports ---

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string; // e.g., "Utilities", "Inventory", "Salaries"
  timestamp: number;
  recordedBy: string;
}

export interface AuditLog {
  id: string;
  action: string; // e.g., "ORDER_CANCELLED", "ITEM_VOIDED", "CASH_DRAWER_OPEN"
  details: string;
  timestamp: number;
  user: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

// --- Staff & Shift Management ---

export interface Staff {
  id: string; // e.g., ST123
  name: string;
  pin: string; // 4-6 digit PIN
  role: 'ADMIN' | 'CASHIER' | 'MANAGER' | 'CHEF';
}

export interface Shift {
  id: string; // e.g., SHF2548
  staffId: string;
  staffName: string;
  startTime: number;
  endTime?: number;
  status: 'ACTIVE' | 'CLOSED';
  
  // Money Tracking
  openingBalance: number; // Cash in drawer at start
  cashSales: number;
  upiSales: number;
  cardSales: number;
  totalSales: number; // sum of sales
  
  // Closing
  expectedCash: number; // opening + cashSales
  actualCash?: number; // Counted by staff
  variance?: number; // actual - expected (Shortage if neg, Excess if pos)
  
  // Other stats
  ordersCount: number;
  refundsTotal: number;
  discountsTotal: number;
}
