
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Kitchen from './pages/Kitchen';
import Inventory from './pages/Inventory';
import Tables from './pages/Tables';
import CRM from './pages/CRM';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { Product, CartItem, Order, OrderStatus, VariantOption, Payment, Table, Customer, Expense, AuditLog, Staff, Shift, PaymentMethod, LoyaltySettings, LoyaltyTransaction, ItemStatus, Reservation, ReservationStatus } from './types';
import { MOCK_PRODUCTS, DEFAULT_TABLES } from './constants';

// Firebase Imports (Realtime Database)
import { db } from './services/firebase';
import { 
  ref, 
  onValue, 
  push, 
  set, 
  update, 
  remove, 
  child,
  get,
  goOffline,
  goOnline,
  runTransaction
} from 'firebase/database';

// --- Global Store Context ---
interface AppState {
  // Data
  products: Product[];
  categories: string[];
  cart: CartItem[];
  orders: Order[];
  tables: Table[];
  reservations: Reservation[];
  customers: Customer[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  shifts: Shift[];
  staffList: Staff[];
  loyaltySettings: LoyaltySettings;
  
  // Session
  currentUser: Staff | null;
  currentShift: Shift | null;

  // Actions
  login: (id: string, pin: string) => boolean;
  logout: () => void;
  startShift: (openingBalance: number) => void;
  endShift: (actualCash: number) => void;

  addToCart: (product: Product, selectedVariants?: Record<string, VariantOption>) => void;
  removeFromCart: (itemId: string, selectedVariants?: Record<string, VariantOption>) => void;
  updateCartItemQty: (itemId: string, qty: number, selectedVariants?: Record<string, VariantOption>) => void;
  clearCart: () => void;
  sendToKitchen: (tableId: string, customerName?: string, customerPhone?: string) => Promise<string>; // Updated signature
  updateKotStatus: (orderId: string, kotId: string, status: ItemStatus) => void; // New Action
  settleOrder: (tableId: string, payments: Payment[], discount: number, discountNote: string, customerName: string, customerPhone: string, deliveryAddress?: string, customerEmail?: string, redeemedPoints?: number) => void;
  settleCustomerDue: (customerPhone: string, payment: Payment) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  addTable: (name: string, floor: string) => void;
  removeTable: (id: string) => void;
  
  // Reservation Actions
  addReservation: (reservation: Omit<Reservation, 'id' | 'createdAt'>) => void;
  updateReservationStatus: (id: string, status: ReservationStatus) => void;
  
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  updateCustomer: (customer: Customer) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => void;
  logAction: (action: string, details: string, severity?: 'INFO' | 'WARNING' | 'CRITICAL') => void;
  updateLoyaltySettings: (settings: LoyaltySettings) => void;
  retryConnection: () => void;
  
  // Staff Management
  addStaff: (staff: Staff) => void;
  removeStaff: (id: string) => void;
  
  // UI Controls for Shift
  showEndShiftModal: boolean;
  setShowEndShiftModal: (val: boolean) => void;
  
  // System Status
  isDbConnected: boolean;
  connectionError: string | null;
}

const StoreContext = createContext<AppState | null>(null);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};

// Helper to create a unique key for cart items based on variants
const getCartItemKey = (id: string, variants?: Record<string, VariantOption>) => {
  if (!variants || Object.keys(variants).length === 0) return id;
  const variantKey = Object.keys(variants).sort().map(k => `${k}:${variants[k].id}`).join('|');
  return `${id}_${variantKey}`;
};

// Helper to remove undefined fields for Firebase (prevents validation errors)
const cleanData = (data: any) => {
  return JSON.parse(JSON.stringify(data));
};

// Helper: Convert RTDB Object (Hash Map) to Array
// Ensure ID is set correctly from the key
function snapshotToArray<T>(snapshotVal: any): T[] {
    if (!snapshotVal) return [];
    return Object.keys(snapshotVal).map(key => ({
        ...snapshotVal[key],
        id: key
    })) as unknown as T[];
}

const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]); 
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Default Loyalty Settings
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>({
    enabled: true,
    earningRate: 100,
    redemptionValue: 1,
    minPointsToRedeem: 10,
    minOrderValueToRedeem: 0,
    expiryMonths: 12
  });

  // Session State
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);

  // UI State for Modal
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);

  // --- FALLBACK MODE TRIGGER ---
  const enableOfflineMode = useCallback(() => {
     setIsDbConnected(false);
     console.log("System running in Offline Mode (Demo Data Loaded)");
     
     // Initialize with mock data if empty
     setProducts(prev => prev.length ? prev : MOCK_PRODUCTS);
     setCategories(prev => prev.length ? prev : Array.from(new Set(MOCK_PRODUCTS.map(p => p.category))));
     setTables(prev => prev.length ? prev : DEFAULT_TABLES);
     
  }, []);

  const retryConnection = useCallback(async () => {
      console.log("Retrying connection...");
      setConnectionError(null);
      goOnline(db);
  }, []);

  // --- REALTIME DATABASE SYNC ---
  
  // 1. Connection Monitor (.info/connected)
  useEffect(() => {
    const connectedRef = ref(db, ".info/connected");
    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        setIsDbConnected(true);
        setConnectionError(null);
        console.log("RTDB Connected");
      } else {
        setIsDbConnected(false);
        // Note: We don't immediately trigger offline mode here to allow for brief disconnects
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    // Products
    const productsRef = ref(db, 'products');
    const unsubProducts = onValue(productsRef, (snapshot) => {
        const prodList = snapshotToArray<Product>(snapshot.val()).map(p => ({
            ...p,
            variants: p.variants || [] // Ensure array
        }));

        // Seeding logic
        if (prodList.length === 0 && !localStorage.getItem('seeded_products')) {
            const updates: any = {};
            MOCK_PRODUCTS.forEach(p => {
                const newKey = push(productsRef).key;
                if(newKey) updates['products/' + newKey] = cleanData(p);
            });
            update(ref(db), updates);
            localStorage.setItem('seeded_products', 'true');
        } else {
            setProducts(prodList);
            const cats = Array.from(new Set(prodList.map(p => p.category).filter((c): c is string => !!c))) as string[];
            setCategories(cats);
        }
    });

    // Tables
    const tablesRef = ref(db, 'tables');
    const unsubTables = onValue(tablesRef, (snapshot) => {
        const tableList = snapshotToArray<Table>(snapshot.val());
        if (tableList.length === 0 && !localStorage.getItem('seeded_tables')) {
            const updates: any = {};
            DEFAULT_TABLES.forEach(t => {
                updates['tables/' + t.id] = cleanData(t);
            });
            update(ref(db), updates);
            localStorage.setItem('seeded_tables', 'true');
        } else {
            setTables(tableList);
        }
    });

    // Reservations
    const resRef = ref(db, 'reservations');
    const unsubRes = onValue(resRef, (snapshot) => {
        const resList = snapshotToArray<Reservation>(snapshot.val());
        setReservations(resList.sort((a,b) => a.reservationTime - b.reservationTime));
    });

    // Staff
    const staffRef = ref(db, 'staff');
    const unsubStaff = onValue(staffRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
             // Seed Default Admin if DB is empty
             const defaultAdmin: Staff = {
                 id: 'ADMIN123',
                 name: 'Super Admin',
                 pin: '1234',
                 role: 'ADMIN'
             };
             set(ref(db, 'staff/ADMIN123'), defaultAdmin);
        } else {
             // Use snapshotToArray to ensure ID matches Key
             setStaffList(snapshotToArray<Staff>(data));
        }
    });

    // Orders
    const ordersRef = ref(db, 'orders');
    const unsubOrders = onValue(ordersRef, (snapshot) => {
        const rawOrders = snapshotToArray<Order>(snapshot.val());
        // Sanitize orders to ensure arrays exist
        const orderList = rawOrders.map(o => ({
            ...o,
            items: o.items || [],
            payments: o.payments || []
        }));
        setOrders(orderList.sort((a,b) => b.timestamp - a.timestamp));
    });

    // Customers
    const customersRef = ref(db, 'customers');
    const unsubCustomers = onValue(customersRef, (snapshot) => {
        // Customers uses phone as key in RTDB for direct access
        const data = snapshot.val();
        const customerList = data ? Object.values(data).map((c: any) => ({
             ...c,
             loyaltyHistory: c.loyaltyHistory || [] // Ensure array
        })) as Customer[] : [];
        setCustomers(customerList);
    });

    // Shifts
    const shiftsRef = ref(db, 'shifts');
    const unsubShifts = onValue(shiftsRef, (snapshot) => {
        const sList = snapshotToArray<Shift>(snapshot.val());
        setShifts(sList.sort((a,b) => b.startTime - a.startTime));
        
        // Sync active shift
        if (!currentShift) {
            const active = sList.find(s => s.status === 'ACTIVE');
            if (active) setCurrentShift(active);
        }
    });

    // Settings
    const settingsRef = ref(db, 'settings/loyalty');
    const unsubSettings = onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            setLoyaltySettings(snapshot.val());
        } else {
            set(settingsRef, cleanData(loyaltySettings));
        }
    });

    // Expenses & Logs
    const expensesRef = ref(db, 'expenses');
    const unsubExp = onValue(expensesRef, (snap) => setExpenses(snapshotToArray<Expense>(snap.val())));

    const logsRef = ref(db, 'auditLogs');
    const unsubLog = onValue(logsRef, (snap) => setAuditLogs(snapshotToArray<AuditLog>(snap.val())));

    return () => {
        unsubProducts();
        unsubTables();
        unsubOrders();
        unsubCustomers();
        unsubShifts();
        unsubSettings();
        unsubExp();
        unsubLog();
        unsubStaff();
        unsubRes();
    };
  }, []); // Run listeners once on mount

  // --- Audit Helper ---
  const logAction = (action: string, details: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') => {
    const newLog: AuditLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      action,
      details,
      timestamp: Date.now(),
      user: currentUser ? currentUser.name : 'System', 
      severity
    };
    push(ref(db, 'auditLogs'), cleanData(newLog));
  };

  const updateLoyaltySettings = (settings: LoyaltySettings) => {
    set(ref(db, 'settings/loyalty'), cleanData(settings));
    logAction('SETTINGS_UPDATE', 'Loyalty program settings updated', 'WARNING');
  };

  // --- Auth & Shift Logic ---
  const login = (id: string, pin: string) => {
    // Check against live staff list (synced from DB)
    // Case-insensitive ID check
    const normalizedId = id.toUpperCase().trim();
    const staff = staffList.find(s => s.id.toUpperCase() === normalizedId && s.pin === pin);
    
    if (staff) {
      setCurrentUser(staff);
      logAction('LOGIN', `${staff.name} logged in.`);
      return true;
    }
    return false;
  };

  const logout = () => {
    // Only require shift closing for non-Chef roles (Chefs don't handle cash)
    if (currentShift && currentUser?.role !== 'CHEF') {
       alert("Please end the active shift before logging out.");
       return;
    }
    logAction('LOGOUT', `${currentUser?.name} logged out.`);
    setCurrentUser(null);
  };

  const addStaff = (staff: Staff) => {
      // Use uppercase ID as key for consistency
      const cleanStaff = { ...staff, id: staff.id.toUpperCase().trim() };
      set(ref(db, 'staff/' + cleanStaff.id), cleanData(cleanStaff));
      logAction('STAFF_ADD', `New staff member created: ${cleanStaff.name} (${cleanStaff.role})`, 'WARNING');
  };

  const removeStaff = (id: string) => {
      const cleanId = id.trim();
      // Ensure we remove using the exact ID (Key)
      if (cleanId.toUpperCase() === 'ADMIN123') {
          alert("Cannot delete default Super Admin.");
          return;
      }
      remove(ref(db, 'staff/' + cleanId))
        .then(() => logAction('STAFF_REMOVE', `Staff member removed: ${cleanId}`, 'WARNING'))
        .catch(err => alert("Error removing staff: " + err.message));
  };

  const startShift = (openingBalance: number) => {
    if (!currentUser) return;
    const shiftId = `SHF${Date.now().toString().slice(-4)}`;
    const newShift: Shift = {
      id: shiftId,
      staffId: currentUser.id,
      staffName: currentUser.name,
      startTime: Date.now(),
      status: 'ACTIVE',
      openingBalance,
      cashSales: 0,
      upiSales: 0,
      cardSales: 0,
      totalSales: 0,
      expectedCash: openingBalance,
      ordersCount: 0,
      refundsTotal: 0,
      discountsTotal: 0
    };
    
    set(ref(db, 'shifts/' + shiftId), cleanData(newShift));
    setCurrentShift(newShift);
    logAction('SHIFT_START', `Shift ${newShift.id} started by ${currentUser.name}`);
  };

  const endShift = (actualCash: number) => {
    if (!currentShift) return;
    
    const variance = actualCash - currentShift.expectedCash;
    const closedShift: Shift = {
      ...currentShift,
      endTime: Date.now(),
      status: 'CLOSED',
      actualCash,
      variance
    };

    update(ref(db, 'shifts/' + currentShift.id), cleanData(closedShift));
    
    setCurrentShift(null); 
    setShowEndShiftModal(false);
    logAction('SHIFT_END', `Shift ${closedShift.id} ended. Variance: ${variance}`);
    setCurrentUser(null);
  };

  // --- Cart & Order Logic ---

  const addToCart = (product: Product, selectedVariants?: Record<string, VariantOption>) => {
    let finalPrice = product.price;
    if (selectedVariants) {
      Object.values(selectedVariants).forEach(v => finalPrice += v.priceModifier);
    }

    setCart(prev => {
      const itemKey = getCartItemKey(product.id, selectedVariants);
      const existingIndex = prev.findIndex(item => getCartItemKey(item.id, item.selectedVariants) === itemKey);

      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex] = { ...newCart[existingIndex], qty: newCart[existingIndex].qty + 1 };
        return newCart;
      }
      return [...prev, { ...product, price: finalPrice, qty: 1, selectedVariants: selectedVariants }];
    });
  };

  const removeFromCart = (itemId: string, selectedVariants?: Record<string, VariantOption>) => {
    const targetKey = getCartItemKey(itemId, selectedVariants);
    setCart(prev => prev.filter(item => getCartItemKey(item.id, item.selectedVariants) !== targetKey));
  };

  const updateCartItemQty = (itemId: string, qty: number, selectedVariants?: Record<string, VariantOption>) => {
    if (qty <= 0) {
      removeFromCart(itemId, selectedVariants);
      return;
    }
    const targetKey = getCartItemKey(itemId, selectedVariants);
    setCart(prev => prev.map(item => {
      if (getCartItemKey(item.id, item.selectedVariants) === targetKey) {
        return { ...item, qty };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  const sendToKitchen = async (tableId: string, customerName?: string, customerPhone?: string): Promise<string> => {
    if (cart.length === 0) return '';
    
    // Generate Daily Sequential KOT ID
    const d = new Date();
    // Use local date YYYY-MM-DD
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const counterRef = ref(db, `counters/${dateKey}`);
    
    let kotId = `KOT-${Date.now().toString().slice(-4)}`; // Fallback ID

    try {
        const result = await runTransaction(counterRef, (current) => {
            return (current || 0) + 1;
        });
        if (result.snapshot.exists()) {
            kotId = result.snapshot.val().toString();
        }
    } catch (error) {
        console.error("KOT Counter Transaction failed", error);
    }

    // Assign status 'KITCHEN' to new items
    const itemsWithKot = cart.map(item => ({ 
        ...item, 
        kotId, 
        timestamp: Date.now(),
        status: 'KITCHEN' as ItemStatus
    }));

    const existingOrder = orders.find(o => o.tableId === tableId && o.status === OrderStatus.OPEN);

    // Prepare updated/new order object
    let orderToSave: Order;
    const updates: any = {};

    if (existingOrder) {
        const newItems = [...(existingOrder.items || []), ...itemsWithKot];
        const newSubtotal = newItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const newTax = Math.round(newSubtotal * 0.05);
        
        orderToSave = {
          ...existingOrder,
          items: newItems,
          subtotal: newSubtotal,
          tax: newTax,
          total: newSubtotal + newTax - existingOrder.discount,
          // Update customer details if provided
          customerName: customerName || existingOrder.customerName,
          customerPhone: customerPhone || existingOrder.customerPhone
        };
        updates['orders/' + existingOrder.id] = cleanData(orderToSave);
    } else {
        const subtotal = itemsWithKot.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const tax = Math.round(subtotal * 0.05);
        const orderId = `ORD-${Date.now()}`;
        orderToSave = {
          id: orderId,
          tableId,
          items: itemsWithKot,
          subtotal,
          tax,
          discount: 0,
          total: subtotal + tax,
          status: OrderStatus.OPEN,
          timestamp: Date.now(),
          payments: [],
          amountPaid: 0,
          isFullyPaid: false,
          shiftId: currentShift?.id,
          staffId: currentUser?.id,
          staffName: currentUser?.name,
          customerName,
          customerPhone
        };
        updates['orders/' + orderId] = cleanData(orderToSave);
    }

    await update(ref(db), updates);
    setCart([]);
    return kotId;
  };

  // --- Update KOT Status (Kitchen Ready Logic) ---
  const updateKotStatus = (orderId: string, kotId: string, status: ItemStatus) => {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedItems = order.items.map(item => {
          if (item.kotId === kotId) {
              return { ...item, status: status };
          }
          return item;
      });

      update(ref(db, 'orders/' + orderId), cleanData({ ...order, items: updatedItems }));
  };

  const settleOrder = (tableId: string, payments: Payment[], discount: number, discountNote: string, customerName: string, customerPhone: string, deliveryAddress?: string, customerEmail?: string, redeemedPoints: number = 0) => {
    
    const activeOrder = orders.find(o => o.tableId === tableId && o.status === OrderStatus.OPEN);
    if (!activeOrder) return;

    const finalTotal = activeOrder.subtotal + activeOrder.tax - discount;
    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const isFullyPaid = totalPaid >= finalTotal - 0.01;

    // Construct update data
    const updateData = {
          ...activeOrder,
          status: OrderStatus.COMPLETED,
          discount,
          discountNote,
          total: finalTotal,
          customerName,
          customerPhone,
          deliveryAddress,
          payments: payments,
          amountPaid: totalPaid,
          isFullyPaid: isFullyPaid,
          shiftId: currentShift?.id || activeOrder.shiftId, 
          staffId: currentUser?.id || activeOrder.staffId,
          staffName: currentUser?.name || activeOrder.staffName
    };

    const updates: any = {};

    // 1. Update Order
    updates['orders/' + activeOrder.id] = cleanData(updateData);

    // 2. Update Customer (Atomic update in RTDB)
    let earnedPoints = 0;
    if (loyaltySettings.enabled && customerPhone) {
         if (isFullyPaid) {
             earnedPoints = Math.floor(finalTotal / loyaltySettings.earningRate);
        }
        const existingCustomer = customers.find(c => c.phone === customerPhone);
        
        // Ensure arrays are initialized if undefined in existing record
        const customerData: Customer = existingCustomer ? { 
            ...existingCustomer,
            loyaltyHistory: existingCustomer.loyaltyHistory || [],
            totalPointsEarned: existingCustomer.totalPointsEarned || 0,
            totalPointsRedeemed: existingCustomer.totalPointsRedeemed || 0
        } : {
             phone: customerPhone, 
             name: customerName || 'Guest', 
             loyaltyPoints: 0, 
             loyaltyHistory: [],
             totalPointsEarned: 0,
             totalPointsRedeemed: 0
        };
        
        customerData.lastVisit = Date.now();
        
        // Update History & Totals
        if (earnedPoints > 0) {
            const earnedTx: LoyaltyTransaction = {
                id: `tx_${Date.now()}_earn`,
                date: Date.now(),
                type: 'EARNED',
                points: earnedPoints,
                orderId: activeOrder.id,
                description: `Earned from Order #${activeOrder.id.slice(-4)}`
            };
            customerData.loyaltyHistory.push(earnedTx);
            customerData.totalPointsEarned += earnedPoints;
        }

        if (redeemedPoints > 0) {
             const redeemedTx: LoyaltyTransaction = {
                id: `tx_${Date.now()}_redeem`,
                date: Date.now(),
                type: 'REDEEMED',
                points: redeemedPoints,
                orderId: activeOrder.id,
                description: `Redeemed on Order #${activeOrder.id.slice(-4)}`
            };
            customerData.loyaltyHistory.push(redeemedTx);
            customerData.totalPointsRedeemed += redeemedPoints;
        }

        // Update Balance
        customerData.loyaltyPoints = (customerData.loyaltyPoints || 0) + earnedPoints - redeemedPoints;
        
        // Use phone as key for O(1) lookup
        updates['customers/' + customerPhone] = cleanData(customerData);
    }

    // 3. Update Shift
    if (currentShift) {
        const updatedShift = { ...currentShift };
        updatedShift.ordersCount += 1;
        updatedShift.totalSales += finalTotal;
        updatedShift.discountsTotal += discount;

        payments.forEach(p => {
            if (p.method === PaymentMethod.CASH) {
                updatedShift.cashSales += p.amount;
                updatedShift.expectedCash += p.amount;
            } else if (p.method === PaymentMethod.UPI) {
                updatedShift.upiSales += p.amount;
            } else if (p.method === PaymentMethod.CARD) {
                updatedShift.cardSales += p.amount;
            }
        });
        updates['shifts/' + currentShift.id] = cleanData(updatedShift);
    }

    update(ref(db), updates).then(() => {
        logAction('ORDER_SETTLED', `Order ${activeOrder.id} settled. Total: ${finalTotal}`);
    });
  };

  const settleCustomerDue = (customerPhone: string, payment: Payment) => {
    
    const unpaidOrders = orders
        .filter(o => o.customerPhone === customerPhone && o.status === OrderStatus.COMPLETED && !o.isFullyPaid)
        .sort((a, b) => a.timestamp - b.timestamp);

    let remainingPayment = payment.amount;
    const updates: any = {};
    
    // Update Shift for the payment received
    if (currentShift) {
        const updatedShift = { ...currentShift };
        if (payment.method === PaymentMethod.CASH) {
             updatedShift.cashSales += payment.amount;
             updatedShift.expectedCash += payment.amount;
        } else if (payment.method === PaymentMethod.UPI) updatedShift.upiSales += payment.amount;
        else if (payment.method === PaymentMethod.CARD) updatedShift.cardSales += payment.amount;
        updates['shifts/' + currentShift.id] = cleanData(updatedShift);
    }

    for (const order of unpaidOrders) {
        if (remainingPayment <= 0.01) break;
        const due = order.total - order.amountPaid;
        const amountToPay = Math.min(due, remainingPayment);
        
        const newPayments = [...(order.payments || []), { ...payment, amount: amountToPay }];
        const newAmountPaid = order.amountPaid + amountToPay;
        const isFullyPaid = newAmountPaid >= order.total - 0.01;

        const updatedOrder = {
            ...order,
            payments: newPayments,
            amountPaid: newAmountPaid,
            isFullyPaid: isFullyPaid
        };
        updates['orders/' + order.id] = cleanData(updatedOrder);
        
        remainingPayment -= amountToPay;
    }

    update(ref(db), updates).then(() => {
        logAction('DUE_PAYMENT', `Customer ${customerPhone} paid due amount: ${payment.amount}`);
    });
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    update(ref(db, 'orders/' + orderId), { status });
  };

  const updateCustomer = (updatedCustomer: Customer) => {
    set(ref(db, 'customers/' + updatedCustomer.phone), cleanData(updatedCustomer));
  };

  const addTable = (name: string, floor: string) => {
    const newId = name.replace(/\s+/g, '-');
    set(ref(db, 'tables/' + newId), cleanData({ id: newId, name, floor }));
  };

  const removeTable = async (id: string) => {
    if (!id) {
        console.error("No Table ID provided for deletion");
        return;
    }
    console.log("Attempting to delete table:", id);
    
    // 1. Optimistic Update (Immediate)
    setTables(prev => {
        const newState = prev.filter(t => t.id !== id);
        return newState;
    });
    
    // 2. DB Update
    try {
        await set(child(ref(db), `tables/${id.trim()}`), null);
        logAction('TABLE_REMOVE', `Table ${id} removed`);
    } catch (err: any) {
        console.error("Failed to delete table from DB:", err);
        // Force refresh data from server if delete fails
        const snapshot = await get(ref(db, 'tables'));
        if (snapshot.exists()) {
             setTables(snapshotToArray<Table>(snapshot.val()));
        }
        alert("Failed to delete table from server: " + err.message);
    }
  };

  // --- RESERVATION ACTIONS ---
  
  const addReservation = (data: Omit<Reservation, 'id' | 'createdAt'>) => {
      const newRef = push(ref(db, 'reservations'));
      const reservation: Reservation = {
          ...data,
          id: newRef.key!,
          createdAt: Date.now(),
          status: ReservationStatus.CONFIRMED,
          createdBy: currentUser?.name
      };
      set(newRef, cleanData(reservation));
      logAction('RESERVATION_ADD', `Reserved Table ${data.tableId} for ${data.customerName}`);
  };

  const updateReservationStatus = (id: string, status: ReservationStatus) => {
      update(ref(db, `reservations/${id}`), { status });
      logAction('RESERVATION_UPDATE', `Reservation ${id} status updated to ${status}`);
  };

  const addProduct = (productData: Omit<Product, 'id'>) => {
    const productsRef = ref(db, 'products');
    const newRef = push(productsRef); // generate ID
    set(newRef, cleanData(productData));
  };

  const updateProduct = (updatedProduct: Product) => {
    const { id, ...data } = updatedProduct;
    update(ref(db, 'products/' + id), cleanData(data));
  };

  // --- Expenses Management ---
  const addExpense = (expense: Omit<Expense, 'id' | 'timestamp'>) => {
    const newExpense = { ...expense, timestamp: Date.now() };
    push(ref(db, 'expenses'), cleanData(newExpense));
  };

  return (
    <StoreContext.Provider value={{
      products, categories, cart, orders, tables, reservations, customers, expenses, auditLogs, shifts, loyaltySettings, staffList,
      currentUser, currentShift, isDbConnected, connectionError,
      login, logout, startShift, endShift, 
      showEndShiftModal, setShowEndShiftModal,
      addToCart, removeFromCart, updateCartItemQty, clearCart,
      sendToKitchen, updateKotStatus, settleOrder, settleCustomerDue, updateOrderStatus,
      addTable, removeTable, addProduct, updateProduct, updateCustomer,
      addReservation, updateReservationStatus,
      addExpense, logAction, updateLoyaltySettings, retryConnection,
      addStaff, removeStaff
    }}>
      {children}
    </StoreContext.Provider>
  );
};

// --- Sub-Components for Auth/Shift UI ---

const LoginScreen: React.FC = () => {
    const { login, isDbConnected, connectionError, retryConnection } = useStore();
    const [id, setId] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (login(id, pin)) {
            setError('');
        } else {
            setError('Invalid Staff ID or PIN');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Connection Indicator */}
            <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${isDbConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-green-50 animate-pulse' : 'bg-red-500'}`}></div>
                {isDbConnected ? 'Realtime DB Online' : 'Offline Mode'}
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800">NexPOS</h1>
                    <p className="text-slate-500">Realtime Edition</p>
                </div>
                {!isDbConnected && (
                    <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded mb-4 text-center border border-amber-100">
                        {connectionError ? (
                            <>
                                <strong className="block text-red-600 mb-1">Connection Error</strong>
                                {connectionError}
                            </>
                        ) : (
                            <>
                                <strong>Connecting...</strong><br/>
                                Checking Realtime Database status.
                            </>
                        )}
                        <div className="mt-3">
                             <button 
                                onClick={retryConnection}
                                className="w-full bg-red-100 text-red-800 py-2 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
                            >
                                ↻ Retry Connection
                            </button>
                        </div>
                    </div>
                )}
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Staff ID</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-center text-lg font-bold uppercase tracking-widest"
                            placeholder="Enter Staff ID"
                            value={id}
                            onChange={e => setId(e.target.value.toUpperCase())}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">PIN</label>
                        <input 
                            type="password" 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-center text-lg font-bold tracking-widest"
                            placeholder="••••"
                            value={pin}
                            maxLength={8}
                            onChange={e => setPin(e.target.value)}
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
                    
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all mt-4">
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

const StartShiftModal: React.FC = () => {
    const { startShift, currentUser, logout } = useStore();
    const [openingBalance, setOpeningBalance] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(openingBalance);
        if (!isNaN(amount) && amount >= 0) {
            startShift(amount);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
                 <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🌅</div>
                 <h2 className="text-2xl font-bold text-slate-800 mb-1">Start Shift</h2>
                 <p className="text-slate-500 mb-6">Welcome, <span className="font-bold text-slate-700">{currentUser?.name}</span></p>
                 
                 <form onSubmit={handleSubmit}>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Opening Cash Balance</label>
                    <div className="relative mb-6">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                            type="number" 
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-bold text-slate-800"
                            placeholder="0.00"
                            value={openingBalance}
                            onChange={e => setOpeningBalance(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-lg transition-all">
                        Start Shift
                    </button>
                    <button type="button" onClick={logout} className="mt-4 text-slate-400 hover:text-slate-600 text-sm font-medium">
                        Cancel & Logout
                    </button>
                 </form>
             </div>
        </div>
    );
};

const EndShiftModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { currentShift, endShift } = useStore();
    const [actualCash, setActualCash] = useState('');

    if (!currentShift) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(actualCash);
        if (!isNaN(amount)) {
            endShift(amount);
        }
    };

    const variance = (parseFloat(actualCash) || 0) - currentShift.expectedCash;

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
                 <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">End Shift</h2>
                        <p className="text-xs text-slate-500">ID: {currentShift.id}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                 </div>

                 <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="bg-slate-50 p-3 rounded-lg">
                         <p className="text-xs text-slate-500 uppercase font-bold">Total Sales</p>
                         <p className="text-lg font-bold text-slate-800">₹{currentShift.totalSales}</p>
                     </div>
                     <div className="bg-slate-50 p-3 rounded-lg">
                         <p className="text-xs text-slate-500 uppercase font-bold">UPI / Card</p>
                         <p className="text-lg font-bold text-slate-800">₹{currentShift.upiSales + currentShift.cardSales}</p>
                     </div>
                     <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 col-span-2">
                         <p className="text-xs text-emerald-700 uppercase font-bold">Expected Cash in Drawer</p>
                         <p className="text-2xl font-bold text-emerald-900">₹{currentShift.expectedCash}</p>
                         <p className="text-[10px] text-emerald-600">Opening ({currentShift.openingBalance}) + Cash Sales ({currentShift.cashSales})</p>
                     </div>
                 </div>

                 <form onSubmit={handleSubmit}>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Enter Physical Cash Count</label>
                    <input 
                        type="number" 
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none text-xl font-bold text-slate-800 mb-2"
                        placeholder="0.00"
                        value={actualCash}
                        onChange={e => setActualCash(e.target.value)}
                        required
                        autoFocus
                    />
                    
                    {actualCash && (
                        <div className={`text-center p-2 rounded-lg font-bold text-sm mb-4 ${variance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {variance >= 0 ? `Excess: +₹${variance}` : `Shortage: -₹${Math.abs(variance)}`}
                        </div>
                    )}

                    <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg transition-all">
                        Confirm End Shift
                    </button>
                 </form>
             </div>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
};

const AppContent: React.FC = () => {
    const { currentUser, currentShift, showEndShiftModal, setShowEndShiftModal } = useStore();

    if (!currentUser) {
        return <LoginScreen />;
    }

    // Chefs don't need to start a shift, they just log in to see the screen
    if (!currentShift && currentUser.role !== 'CHEF') {
        return <StartShiftModal />;
    }

    return (
        <HashRouter>
            <div className="relative">
                <Layout>
                    <Routes>
                        {currentUser.role === 'CHEF' ? (
                            <>
                                <Route path="/kitchen" element={<Kitchen />} />
                                <Route path="*" element={<Navigate to="/kitchen" replace />} />
                            </>
                        ) : (
                            <>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/pos" element={<POS />} />
                                <Route path="/tables" element={<Tables />} />
                                <Route path="/kitchen" element={<Kitchen />} />
                                <Route path="/inventory" element={<Inventory />} />
                                <Route path="/crm" element={<CRM />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/settings" element={
                                    currentUser.role === 'ADMIN' ? <Settings /> : <Navigate to="/" replace />
                                } />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </>
                        )}
                    </Routes>
                </Layout>
                
                {/* Global Modals */}
                {showEndShiftModal && <EndShiftModal onClose={() => setShowEndShiftModal(false)} />}
            </div>
        </HashRouter>
    );
};

export default App;
