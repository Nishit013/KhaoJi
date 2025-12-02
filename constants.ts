
import { Product, Table, Staff } from './types';

export const MOCK_PRODUCTS: Product[] = [
  { 
    id: 'P1', 
    name: 'Classic Chicken Burger', 
    price: 189, 
    category: 'Food', 
    stock: 50, 
    taxRate: 5, 
    isVeg: false,
    variants: [
        {
            id: 'v1',
            name: 'Size',
            options: [
                { id: 'o1', name: 'Regular', priceModifier: 0 },
                { id: 'o2', name: 'Large', priceModifier: 60 }
            ]
        },
        {
            id: 'v2',
            name: 'Add-ons',
            options: [
                { id: 'a1', name: 'Cheese Slice', priceModifier: 20 },
                { id: 'a2', name: 'Extra Patty', priceModifier: 80 }
            ]
        }
    ]
  },
  { 
    id: 'P2', 
    name: 'Veggie Supreme Pizza', 
    price: 349, 
    category: 'Food', 
    stock: 20, 
    taxRate: 5, 
    isVeg: true,
    variants: [
        {
            id: 'v_crust',
            name: 'Crust',
            options: [
                { id: 'c1', name: 'Pan', priceModifier: 0 },
                { id: 'c2', name: 'Thin Crust', priceModifier: 30 },
                { id: 'c3', name: 'Cheese Burst', priceModifier: 90 }
            ]
        }
    ]
  },
  { id: 'P3', name: 'Peri Peri Fries', price: 129, category: 'Food', stock: 100, taxRate: 5, isVeg: true },
  { id: 'P4', name: 'Cappuccino', price: 149, category: 'Beverage', stock: 200, taxRate: 18, isVeg: true },
  { id: 'P5', name: 'Iced Lemon Tea', price: 119, category: 'Beverage', stock: 150, taxRate: 18, isVeg: true },
  { id: 'P6', name: 'Chocolate Brownie', price: 169, category: 'Dessert', stock: 30, taxRate: 5, isVeg: false },
  { id: 'P7', name: 'Mineral Water (500ml)', price: 20, category: 'Beverage', stock: 500, taxRate: 18, isVeg: true },
  { id: 'P8', name: 'Paneer Tikka Wrap', price: 229, category: 'Food', stock: 40, taxRate: 5, isVeg: true },
];

export const DEFAULT_TABLES: Table[] = [
  { id: 'T1', name: 'Table 1', floor: 'Ground Floor' },
  { id: 'T2', name: 'Table 2', floor: 'Ground Floor' },
  { id: 'T3', name: 'Table 3', floor: 'Ground Floor' },
  { id: 'T4', name: 'Table 4', floor: 'Ground Floor' },
  { id: 'T5', name: 'Family 1', floor: 'First Floor' },
  { id: 'T6', name: 'Family 2', floor: 'First Floor' },
  { id: 'DEL-01', name: 'Delivery 1', floor: 'Delivery' },
  { id: 'TK-01', name: 'Takeaway', floor: 'Counter' },
];

export const MOCK_STAFF: Staff[] = [
  {
    id: 'ST123',
    name: 'John Doe',
    pin: '1234',
    role: 'ADMIN'
  },
  {
    id: 'ST124',
    name: 'Sarah Smith',
    pin: '0000',
    role: 'CASHIER'
  }
];
