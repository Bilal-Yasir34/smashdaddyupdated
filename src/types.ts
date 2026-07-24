export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
  is_available: boolean;
  created_at: string;
}

export type OrderStatus = 'Being Prepared' | 'Served' | 'Cancelled';

export interface Order {
  id: string;
  subtotal?: number;
  discount_percent?: number;
  discount_amount?: number;
  total_amount: number;
  payment_method: 'cash' | 'card';
  status: OrderStatus;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
  created_at: string;
}

export interface CartLine {
  item: MenuItem;
  quantity: number;
}

export interface Staff {
  id: string;
  name: string;
  cnic: string;
  phone: string;
  position: string;
  salary: number;
  joining_date: string;
  address: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}
