import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { MenuItem, CartLine, Order, OrderItem, OrderStatus, OrderType } from '../types';
import { formatPKR, formatDateTime } from '../lib/format';
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  X,
  CreditCard,
  Banknote,
  Check,
  Printer,
  ArrowLeft,
  Percent,
  ChefHat,
  Clock,
  Utensils,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  User,
  UtensilsCrossed,
  ShoppingBag,
  Pencil,
  Trash2,
} from 'lucide-react';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import ThemeToggle from '../components/ThemeToggle';

interface OrderModuleProps {
  onBack: () => void;
}

type CheckoutStep = 'cart' | 'payment' | 'receipt';
type PortalSection = 'menu' | 'kds';

interface KDSOrder extends Order {
  items: OrderItem[];
}

export function isDrinkItem(item: { name: string; category?: string | null }): boolean {
  const cat = (item.category || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  return (
    cat.includes('drink') ||
    cat.includes('beverage') ||
    cat.includes('soda') ||
    cat.includes('shake') ||
    cat.includes('juice') ||
    cat.includes('tea') ||
    cat.includes('coffee') ||
    cat.includes('water') ||
    name.includes('drink') ||
    name.includes('coke') ||
    name.includes('sprite') ||
    name.includes('fanta') ||
    name.includes('pepsi') ||
    name.includes('7up') ||
    name.includes('water') ||
    name.includes('shake') ||
    name.includes('soda') ||
    name.includes('mojito') ||
    name.includes('lemonade') ||
    name.includes('slush')
  );
}

export function formatOrderDisplayNumber(order: { id: string; order_number?: string | null } | null | undefined): string {
  if (!order) return 'SD-1001';
  if (order.order_number && order.order_number.trim()) {
    return order.order_number.trim();
  }
  const shortId = order.id.slice(0, 4).toUpperCase();
  return `SD-${shortId}`;
}

export default function OrderModule({ onBack }: OrderModuleProps) {
  const [activeSection, setActiveSection] = useState<PortalSection>('menu');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(3);
  const [userHasOverriddenDiscount, setUserHasOverriddenDiscount] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [orderInstructions, setOrderInstructions] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [orderType, setOrderType] = useState<OrderType>('Dine In');
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | null>(null);
  const [placing, setPlacing] = useState(false);
  const [receipt, setReceipt] = useState<{
    orderId: string;
    orderNumber: string;
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    total: number;
    method: 'cash' | 'card';
    lines: CartLine[];
    instructions?: string | null;
    customerName?: string | null;
    tableNumber?: string | null;
    orderType: OrderType;
    timestamp: string;
  } | null>(null);

  // KDS State
  const [kdsOrders, setKdsOrders] = useState<KDSOrder[]>([]);
  const [kdsLoading, setKdsLoading] = useState(false);
  const [kdsFilter, setKdsFilter] = useState<OrderStatus | 'All'>('Being Prepared');
  const [kdsSearch, setKdsSearch] = useState<string>('');
  const [showFloorMapInHeader, setShowFloorMapInHeader] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // KDS Edit Order State
  const [editingOrder, setEditingOrder] = useState<KDSOrder | null>(null);
  const [editItems, setEditItems] = useState<
    Array<{ id?: string; menu_item_id: string | null; item_name: string; item_price: number; quantity: number }>
  >([]);
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editTableNumber, setEditTableNumber] = useState<string>('');
  const [editOrderType, setEditOrderType] = useState<OrderType>('Dine In');
  const [editInstructions, setEditInstructions] = useState<string>('');
  const [editDiscountType, setEditDiscountType] = useState<'percent' | 'amount'>('percent');
  const [editDiscountValue, setEditDiscountValue] = useState<number>(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [selectedAddItem, setSelectedAddItem] = useState<string>('');

  // Delete Order State
  const [deletingOrder, setDeletingOrder] = useState<KDSOrder | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Ref for auto-closing header Tables Map on click-outside
  const floorMapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFloorMapInHeader) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (floorMapRef.current && !floorMapRef.current.contains(event.target as Node)) {
        setShowFloorMapInHeader(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFloorMapInHeader]);

  // Ticker for KDS 25-minute countdown (updates every 1 second)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) console.error(error);
    else setItems(data as MenuItem[]);
    setLoading(false);
  }, []);

  const loadKdsOrders = useCallback(async () => {
    setKdsLoading(true);
    const { data: ordersData, error: ordersErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersErr) {
      console.error(ordersErr);
      setKdsLoading(false);
      return;
    }

    const { data: itemsData, error: itemsErr } = await supabase
      .from('order_items')
      .select('*');

    if (itemsErr) console.error(itemsErr);

    const itemsMap = new Map<string, OrderItem[]>();
    ((itemsData as OrderItem[]) || []).forEach((item) => {
      const existing = itemsMap.get(item.order_id) || [];
      existing.push(item);
      itemsMap.set(item.order_id, existing);
    });

    const fullOrders: KDSOrder[] = ((ordersData as Order[]) || []).map((ord) => ({
      ...ord,
      status: ord.status || 'Being Prepared',
      items: itemsMap.get(ord.id) || [],
    }));

    setKdsOrders(fullOrders);
    setKdsLoading(false);
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (activeSection === 'kds') {
      loadKdsOrders();
    }
  }, [activeSection, loadKdsOrders]);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { item, quantity: 1 }];
    });
  }

  function updateQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.item.id === itemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(itemId: string) {
    setCart((prev) => prev.filter((l) => l.item.id !== itemId));
  }

  // Auto-calculate default discount (3% default, 0% if cart contains ONLY drinks)
  useEffect(() => {
    if (userHasOverriddenDiscount) return;
    if (cart.length === 0) {
      setDiscountType('percent');
      setDiscountValue(0);
      return;
    }
    const isDrinksOnly = cart.every((l) => isDrinkItem(l.item));
    if (isDrinksOnly) {
      setDiscountType('percent');
      setDiscountValue(0);
    } else {
      setDiscountType('percent');
      setDiscountValue(3);
    }
  }, [cart, userHasOverriddenDiscount]);

  const subtotal = cart.reduce((s, l) => s + Number(l.item.price) * l.quantity, 0);
  const isDrinksOnly = cart.length > 0 && cart.every((l) => isDrinkItem(l.item));

  let validDiscountPercent = 0;
  let discountAmount = 0;

  if (discountType === 'percent') {
    validDiscountPercent = Math.max(0, Math.min(100, isNaN(discountValue) ? 0 : discountValue));
    discountAmount = Math.round((subtotal * validDiscountPercent) / 100);
  } else {
    discountAmount = Math.min(subtotal, Math.max(0, isNaN(discountValue) ? 0 : discountValue));
    validDiscountPercent = subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : 0;
  }

  const cartTotal = Math.max(0, subtotal - discountAmount);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()),
  );

  const categories = [...new Set(filtered.map((i) => i.category))].sort();

  async function placeOrder() {
    if (!paymentMethod || cart.length === 0) return;
    setPlacing(true);

    let nextOrderNumber = 'SD-1001';
    try {
      const { data: latestData } = await supabase
        .from('orders')
        .select('order_number, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestData && latestData.length > 0 && latestData[0].order_number) {
        const match = latestData[0].order_number.match(/SD-(\d+)/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num)) {
            nextOrderNumber = `SD-${num + 1}`;
          }
        }
      } else {
        const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
        if (count && count > 0) {
          nextOrderNumber = `SD-${1000 + count + 1}`;
        }
      }
    } catch (e) {
      console.warn('Failed to compute next order number:', e);
    }

    const fullPayload = {
      total_amount: cartTotal,
      subtotal: subtotal,
      discount_percent: validDiscountPercent,
      discount_amount: discountAmount,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      status: 'Being Prepared',
      instructions: orderInstructions.trim() || null,
      customer_name: customerName.trim() || null,
      table_number: tableNumber.trim() || null,
      order_type: orderType,
      order_number: nextOrderNumber,
    };

    let orderRes = await supabase.from('orders').insert(fullPayload).select().single();

    // Fallback 0: Try without table_number if DB schema lacks 'table_number' column
    if (orderRes.error) {
      console.warn('Full payload insert failed, trying without table_number:', orderRes.error);
      const { table_number, ...payloadWithoutTableNumber } = fullPayload;
      orderRes = await supabase
        .from('orders')
        .insert(payloadWithoutTableNumber)
        .select()
        .single();
    }

    // Fallback 1: Try without payment_status if DB schema lacks 'payment_status' column
    if (orderRes.error) {
      console.warn('Full payload insert failed, trying without payment_status:', orderRes.error);
      const { payment_status, table_number, ...payloadWithoutPaymentStatus } = fullPayload;
      orderRes = await supabase
        .from('orders')
        .insert(payloadWithoutPaymentStatus)
        .select()
        .single();
    }

    // Fallback 1: Try without order_number if DB schema lacks 'order_number' column
    if (orderRes.error) {
      console.warn('Full payload insert failed, trying without order_number:', orderRes.error);
      const { order_number, table_number, ...payloadWithoutOrderNumber } = fullPayload;
      orderRes = await supabase
        .from('orders')
        .insert(payloadWithoutOrderNumber)
        .select()
        .single();
    }

    // Fallback 2: Try without order_type if DB schema lacks 'order_type' column
    if (orderRes.error) {
      console.warn('Insert failed, trying without order_type:', orderRes.error);
      const { order_type, order_number, table_number, ...payloadWithoutOrderType } = fullPayload;
      orderRes = await supabase
        .from('orders')
        .insert(payloadWithoutOrderType)
        .select()
        .single();
    }

    // Fallback 3: Try without customer_name if DB schema lacks 'customer_name' column
    if (orderRes.error) {
      console.warn('Insert failed, trying without customer_name:', orderRes.error);
      const { customer_name, order_type, order_number, table_number, ...payloadWithoutCustomerName } = fullPayload;
      orderRes = await supabase
        .from('orders')
        .insert(payloadWithoutCustomerName)
        .select()
        .single();
    }

    // Fallback 4: Try basic payload with status if discount columns don't exist
    if (orderRes.error) {
      console.warn('Payload without instructions failed, trying basic payload:', orderRes.error);
      orderRes = await supabase
        .from('orders')
        .insert({
          total_amount: cartTotal,
          payment_method: paymentMethod,
          status: 'Being Prepared',
        })
        .select()
        .single();
    }

    // Fallback 5: Minimum payload
    if (orderRes.error) {
      console.warn('Basic payload failed, attempting minimum payload:', orderRes.error);
      orderRes = await supabase
        .from('orders')
        .insert({
          total_amount: cartTotal,
          payment_method: paymentMethod,
        })
        .select()
        .single();
    }

    if (orderRes.error || !orderRes.data) {
      console.error('Order placement failed:', orderRes.error);
      setPlacing(false);
      return;
    }

    const order = orderRes.data;

    const orderItemsPayload = cart.map((l) => ({
      order_id: order.id,
      menu_item_id: l.item.id,
      item_name: l.item.name,
      item_price: Number(l.item.price),
      quantity: l.quantity,
    }));
    const { error: oiError } = await supabase.from('order_items').insert(orderItemsPayload);
    if (oiError) console.error(oiError);

    setReceipt({
      orderId: order.id,
      orderNumber: order.order_number || nextOrderNumber,
      subtotal: subtotal,
      discountPercent: validDiscountPercent,
      discountAmount: discountAmount,
      total: cartTotal,
      method: paymentMethod,
      lines: cart,
      instructions: orderInstructions.trim() || null,
      customerName: customerName.trim() || null,
      tableNumber: tableNumber.trim() || null,
      orderType: orderType,
      timestamp: order.created_at || new Date().toISOString(),
    });
    setPlacing(false);
    setCheckoutStep('receipt');
  }

  function resetOrder() {
    setCart([]);
    setDiscountType('percent');
    setDiscountValue(3);
    setUserHasOverriddenDiscount(false);
    setPaymentStatus('unpaid');
    setOrderInstructions('');
    setCustomerName('');
    setTableNumber('');
    setOrderType('Dine In');
    setReceipt(null);
    setPaymentMethod(null);
    setCheckoutStep('cart');
    setCartOpen(false);
  }

  async function deductInventoryForOrder(orderOrId: KDSOrder | string) {
    try {
      let targetOrder: KDSOrder | undefined;

      if (typeof orderOrId === 'string') {
        targetOrder = kdsOrders.find((o) => o.id === orderOrId);
      } else {
        targetOrder = orderOrId;
      }

      let itemsToDeduct: OrderItem[] = targetOrder?.items || [];

      if (itemsToDeduct.length === 0 && typeof orderOrId === 'string') {
        const { data: oiData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderOrId);
        if (oiData) itemsToDeduct = oiData as OrderItem[];
      }

      if (itemsToDeduct.length === 0) return;

      const menuItemIds = itemsToDeduct
        .map((i) => i.menu_item_id)
        .filter((id): id is string => Boolean(id));

      if (menuItemIds.length === 0) return;

      const { data: ingredientsData, error: ingErr } = await supabase
        .from('menu_item_ingredients')
        .select('*')
        .in('menu_item_id', menuItemIds);

      if (ingErr || !ingredientsData || ingredientsData.length === 0) {
        return;
      }

      const ingredientsByMenuItem = new Map<
        string,
        Array<{ inventory_item_id: string; quantity_required: number }>
      >();

      ingredientsData.forEach((ing) => {
        const existing = ingredientsByMenuItem.get(ing.menu_item_id) || [];
        existing.push({
          inventory_item_id: ing.inventory_item_id,
          quantity_required: Number(ing.quantity_required) || 1,
        });
        ingredientsByMenuItem.set(ing.menu_item_id, existing);
      });

      const deductions = new Map<string, number>();
      itemsToDeduct.forEach((item) => {
        if (!item.menu_item_id) return;
        const recipeList = ingredientsByMenuItem.get(item.menu_item_id);
        if (recipeList) {
          recipeList.forEach((ing) => {
            const currentTotal = deductions.get(ing.inventory_item_id) || 0;
            deductions.set(
              ing.inventory_item_id,
              currentTotal + item.quantity * ing.quantity_required,
            );
          });
        }
      });

      if (deductions.size === 0) return;

      const invItemIds = Array.from(deductions.keys());
      const { data: currentInvData } = await supabase
        .from('inventory_items')
        .select('id, quantity')
        .in('id', invItemIds);

      if (!currentInvData) return;

      for (const inv of currentInvData) {
        const qtyToSubtract = deductions.get(inv.id) || 0;
        if (qtyToSubtract > 0) {
          const newQty = Math.max(0, Number(inv.quantity || 0) - qtyToSubtract);
          await supabase
            .from('inventory_items')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', inv.id);
        }
      }
    } catch (err) {
      console.error('Failed to deduct inventory for served order:', err);
    }
  }

  async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    const existingOrder = kdsOrders.find((o) => o.id === orderId);
    const previousStatus = existingOrder?.status || 'Being Prepared';

    const updates: { status: OrderStatus; payment_status?: 'paid' | 'unpaid' } = { status: newStatus };
    if (newStatus === 'Served') {
      updates.payment_status = 'paid';
    }

    setKdsOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus,
              ...(newStatus === 'Served' ? { payment_status: 'paid' } : {}),
            }
          : o,
      ),
    );
    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      console.error('Failed to update status:', error);
      loadKdsOrders();
      return;
    }

    if (newStatus === 'Served' && previousStatus !== 'Served') {
      deductInventoryForOrder(existingOrder || orderId);
    }
  }

  async function updateOrderPaymentStatus(orderId: string, newPaymentStatus: 'paid' | 'unpaid') {
    setKdsOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, payment_status: newPaymentStatus } : o)),
    );
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: newPaymentStatus })
      .eq('id', orderId);

    if (error) {
      console.error('Failed to update payment status:', error);
      loadKdsOrders();
    }
  }

  function openEditOrder(order: KDSOrder) {
    setEditingOrder(order);
    setEditCustomerName(order.customer_name || '');
    setEditTableNumber(order.table_number || '');
    setEditOrderType(order.order_type || 'Dine In');
    setEditInstructions(order.instructions || '');
    setEditDiscountType('percent');
    setEditDiscountValue(order.discount_percent || 0);
    setEditPaymentStatus(order.payment_status || 'unpaid');
    setEditPaymentMethod(order.payment_method || 'cash');
    setSelectedAddItem('');
    setEditItems(
      order.items.map((it) => ({
        id: it.id,
        menu_item_id: it.menu_item_id,
        item_name: it.item_name,
        item_price: Number(it.item_price),
        quantity: it.quantity,
      })),
    );
  }

  async function saveEditedOrder(andPrint: boolean = false) {
    if (!editingOrder) return;
    setEditSaving(true);

    const editSubtotal = editItems.reduce((acc, it) => acc + it.item_price * it.quantity, 0);
    let editValidDiscount = 0;
    let editDiscountAmount = 0;

    if (editDiscountType === 'percent') {
      editValidDiscount = Math.max(0, Math.min(100, isNaN(editDiscountValue) ? 0 : editDiscountValue));
      editDiscountAmount = Math.round((editSubtotal * editValidDiscount) / 100);
    } else {
      editDiscountAmount = Math.min(editSubtotal, Math.max(0, isNaN(editDiscountValue) ? 0 : editDiscountValue));
      editValidDiscount = editSubtotal > 0 ? Math.round((editDiscountAmount / editSubtotal) * 100) : 0;
    }

    const editTotalAmount = Math.max(0, editSubtotal - editDiscountAmount);

    const updatePayload = {
      total_amount: editTotalAmount,
      subtotal: editSubtotal,
      discount_percent: editValidDiscount,
      discount_amount: editDiscountAmount,
      payment_method: editPaymentMethod,
      payment_status: editPaymentStatus,
      customer_name: editCustomerName.trim() || null,
      table_number: editTableNumber.trim() || null,
      order_type: editOrderType,
      instructions: editInstructions.trim() || null,
    };

    let { error: ordErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', editingOrder.id);

    if (ordErr) {
      console.warn('Update full order failed, trying without extra fields:', ordErr);
      const { payment_status, order_type, customer_name, table_number, instructions, ...basicPayload } = updatePayload;
      await supabase.from('orders').update(basicPayload).eq('id', editingOrder.id);
    }

    await supabase.from('order_items').delete().eq('order_id', editingOrder.id);

    if (editItems.length > 0) {
      const itemsPayload = editItems.map((it) => ({
        order_id: editingOrder.id,
        menu_item_id: it.menu_item_id,
        item_name: it.item_name,
        item_price: it.item_price,
        quantity: it.quantity,
      }));
      await supabase.from('order_items').insert(itemsPayload);
    }

    const currentEditingOrder = editingOrder;
    setEditSaving(false);
    setEditingOrder(null);
    loadKdsOrders();

    if (andPrint) {
      const cartLines: CartLine[] = editItems.map((it) => ({
        item: {
          id: it.menu_item_id || it.id || '',
          name: it.item_name,
          category: '',
          price: it.item_price,
          description: null,
          is_available: true,
          created_at: '',
        },
        quantity: it.quantity,
      }));

      setReceipt({
        orderId: currentEditingOrder.id,
        orderNumber: formatOrderDisplayNumber(currentEditingOrder),
        subtotal: editSubtotal,
        discountPercent: editValidDiscount,
        discountAmount: editDiscountAmount,
        total: editTotalAmount,
        method: editPaymentMethod,
        lines: cartLines,
        instructions: editInstructions.trim() || null,
        customerName: editCustomerName.trim() || null,
        orderType: editOrderType,
        timestamp: currentEditingOrder.created_at || new Date().toISOString(),
      });
      setCartOpen(true);
      setCheckoutStep('receipt');
    }
  }

  function reprintOrderReceipt(order: KDSOrder) {
    const computedItemsSubtotal = order.items.reduce(
      (acc, item) => acc + Number(item.item_price || 0) * (item.quantity || 1),
      0,
    );
    const displaySubtotal =
      order.subtotal && Number(order.subtotal) > 0
        ? Number(order.subtotal)
        : computedItemsSubtotal > 0
          ? computedItemsSubtotal
          : order.total_amount;

    const displayDiscountAmount =
      order.discount_amount && Number(order.discount_amount) > 0
        ? Number(order.discount_amount)
        : displaySubtotal > order.total_amount
          ? displaySubtotal - order.total_amount
          : 0;

    const displayDiscountPercent =
      order.discount_percent && Number(order.discount_percent) > 0
        ? Number(order.discount_percent)
        : displaySubtotal > 0 && displayDiscountAmount > 0
          ? Math.round((displayDiscountAmount / displaySubtotal) * 100)
          : 0;

    const cartLines: CartLine[] = order.items.map((it) => ({
      item: {
        id: it.menu_item_id || it.id || '',
        name: it.item_name,
        category: '',
        price: Number(it.item_price),
        description: null,
        is_available: true,
        created_at: '',
      },
      quantity: it.quantity,
    }));

    setReceipt({
      orderId: order.id,
      orderNumber: formatOrderDisplayNumber(order),
      subtotal: displaySubtotal,
      discountPercent: displayDiscountPercent,
      discountAmount: displayDiscountAmount,
      total: Number(order.total_amount),
      method: order.payment_method || 'cash',
      lines: cartLines,
      instructions: order.instructions || null,
      customerName: order.customer_name || null,
      orderType: order.order_type || 'Dine In',
      timestamp: order.created_at || new Date().toISOString(),
    });
    setCartOpen(true);
    setCheckoutStep('receipt');
  }

  async function executeDeleteOrder() {
    if (!deletingOrder) return;
    setDeleting(true);
    try {
      await supabase.from('order_items').delete().eq('order_id', deletingOrder.id);
      await supabase.from('orders').delete().eq('id', deletingOrder.id);
    } catch (err) {
      console.error('Failed to delete order:', err);
    }
    setDeleting(false);
    setDeletingOrder(null);
    loadKdsOrders();
  }

  // Count active orders currently Being Prepared
  const preparingCount = kdsOrders.filter((o) => (o.status || 'Being Prepared') === 'Being Prepared').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Top Header */}
      <header ref={floorMapRef} className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <Logo size={36} />
            <span className="font-black text-lg">
              SMASH <span className="text-yellow-400">DADDY</span>
            </span>
            <span className="text-xs text-zinc-500 hidden sm:inline ml-1">Order Portal</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* Section Switcher Tabs & Live Tables Map Button */}
            <div className="flex items-center gap-2">
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setActiveSection('menu')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSection === 'menu'
                    ? 'bg-yellow-400 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                    }`}
                >
                  <Utensils size={14} /> Menu
                </button>
                <button
                  onClick={() => setActiveSection('kds')}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeSection === 'kds'
                    ? 'bg-yellow-400 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                    }`}
                >
                  <ChefHat size={14} /> KDS
                  {preparingCount > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                      {preparingCount}
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowFloorMapInHeader((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  showFloorMapInHeader
                    ? 'bg-yellow-400 text-black border-yellow-400 shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
                title="Toggle Live Table Floor Map"
              >
                <Utensils size={14} className={showFloorMapInHeader ? 'text-black' : 'text-yellow-400'} />
                <span className="hidden sm:inline">Tables Map</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  showFloorMapInHeader ? 'bg-black/20 text-black' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {Math.max(0, 8 - kdsOrders.filter((o) => (o.status || 'Being Prepared') === 'Being Prepared' && o.table_number).length)} Free
                </span>
              </button>
            </div>

            {/* Cart Button */}
            {activeSection === 'menu' && (
              <button
                onClick={() => setCartOpen(true)}
                className="relative bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-xs sm:text-sm"
              >
                <ShoppingCart size={16} />
                <span className="hidden sm:inline">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-[scaleIn_0.2s_ease-out]">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Live Table Floor Map Collapsible Banner */}
        {showFloorMapInHeader && (
          <div className="max-w-6xl mx-auto px-4 pb-3 animate-[slideDown_0.2s_ease-out]">
            <TableFloorGraphic
              orders={kdsOrders}
              selectedTable={tableNumber}
              onSelectTable={(tName) => {
                setTableNumber(tName);
                if (activeSection === 'kds') {
                  setKdsSearch(tName);
                } else if (cart.length > 0) {
                  setCartOpen(true);
                }
              }}
            />
          </div>
        )}

        {/* Search Bar (Only visible in Menu tab) */}
        {activeSection === 'menu' && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400/50 outline-none transition-all text-sm"
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Section Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeSection === 'menu' ? (
          /* ================= MENU SECTION ================= */
          loading ? (
            <div className="flex justify-center py-20">
              <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <p>No items available.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {categories.map((cat) => {
                const catItems = filtered.filter((i) => i.category === cat);
                return (
                  <div key={cat}>
                    <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">
                      {cat}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {catItems.map((item) => {
                        const inCart = cart.find((l) => l.item.id === item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => addToCart(item)}
                            className={`group relative text-left glass-card border rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex flex-col justify-between ${
                              inCart
                                ? 'border-yellow-400/80 shadow-md shadow-yellow-400/10'
                                : 'border-zinc-800/80 hover:border-yellow-400/50'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-bold text-sm leading-tight text-white group-hover:text-yellow-400 transition-colors">
                                  {item.name}
                                </h3>
                                {inCart && (
                                  <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-sm animate-[scaleIn_0.2s_ease-out]">
                                    {inCart.quantity} in cart
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-zinc-500 text-xs mt-1.5 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/50">
                              <span className="text-yellow-400 font-extrabold text-sm font-mono">{formatPKR(item.price)}</span>
                              <span className="w-7 h-7 rounded-xl bg-yellow-400/10 text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black flex items-center justify-center transition-all font-bold">
                                <Plus size={15} />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ================= KITCHEN DISPLAY SYSTEM (KDS) SECTION ================= */
          <div className="space-y-6">
            {/* KDS Header & Search & Status Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <ChefHat className="text-yellow-400" size={24} /> Kitchen Display System (KDS)
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Live kitchen order queue with 25-minute countdown timers.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Bar for Table Number or Customer Name */}
                <div className="relative flex-1 min-w-[210px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                  <input
                    type="text"
                    value={kdsSearch}
                    onChange={(e) => setKdsSearch(e.target.value)}
                    placeholder="Search by table # or customer..."
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-yellow-400 text-xs text-white placeholder-zinc-500 rounded-xl pl-9 pr-8 py-2 outline-none transition-colors"
                  />
                  {kdsSearch && (
                    <button
                      type="button"
                      onClick={() => setKdsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                  <button
                    onClick={loadKdsOrders}
                    disabled={kdsLoading}
                    className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl transition-all shrink-0"
                    title="Refresh Queue"
                  >
                    <RefreshCw size={16} className={kdsLoading ? 'animate-spin' : ''} />
                  </button>
                  {(['Being Prepared', 'Served', 'Cancelled', 'All'] as const).map((st) => {
                    const count =
                      st === 'All'
                        ? kdsOrders.length
                        : kdsOrders.filter((o) => (o.status || 'Being Prepared') === st).length;
                    return (
                      <button
                        key={st}
                        onClick={() => setKdsFilter(st)}
                        className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${kdsFilter === st
                          ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/10'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                      >
                        <span>{st}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            kdsFilter === st
                              ? 'bg-black/20 text-black'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* KDS Orders Grid */}
            {kdsLoading ? (
              <div className="flex justify-center py-20">
                <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
              </div>
            ) : (
              <KDSOrdersGrid
                orders={kdsOrders.filter((o) => {
                  const matchesStatus =
                    kdsFilter === 'All' ? true : (o.status || 'Being Prepared') === kdsFilter;
                  const term = kdsSearch.trim().toLowerCase();
                  if (!term) return matchesStatus;
                  const matchesCustomer = o.customer_name ? o.customer_name.toLowerCase().includes(term) : false;
                  const matchesTable = o.table_number ? o.table_number.toLowerCase().includes(term) : false;
                  const matchesOrderNo = o.order_number ? o.order_number.toLowerCase().includes(term) : false;
                  return matchesStatus && (matchesCustomer || matchesTable || matchesOrderNo);
                })}
                nowMs={nowMs}
                onUpdateStatus={updateOrderStatus}
                onUpdatePaymentStatus={updateOrderPaymentStatus}
                onEditOrder={openEditOrder}
                onDeleteOrder={(ord) => setDeletingOrder(ord)}
                onReprintReceipt={reprintOrderReceipt}
              />
            )}
          </div>
        )}
      </main>

      {/* Cart / Checkout / Receipt Modal */}
      <Modal
        open={cartOpen}
        onClose={() => {
          if (checkoutStep === 'receipt') {
            resetOrder();
          } else {
            setCartOpen(false);
          }
        }}
        title={
          checkoutStep === 'receipt'
            ? 'Receipt'
            : checkoutStep === 'payment'
              ? 'Payment Method'
              : 'Your Order & Checkout'
        }
        maxWidth="max-w-4xl"
      >
        {checkoutStep === 'cart' && (
          <div className="space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <ShoppingCart className="mx-auto text-zinc-600" size={44} />
                <p className="text-zinc-300 text-base font-semibold">Your cart is empty.</p>
                <p className="text-zinc-500 text-xs max-w-xs mx-auto">
                  Select delicious burgers, sides, or drinks from the menu to build an order.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* LEFT COLUMN: Cart Items & Subtotal */}
                <div className="md:col-span-6 space-y-3">
                  <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                      <span className="text-xs font-extrabold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingCart size={14} /> Cart Items ({cartCount})
                      </span>
                      <button
                        type="button"
                        onClick={resetOrder}
                        className="text-[11px] text-zinc-500 hover:text-red-400 font-semibold transition-colors"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                      {cart.map((line) => (
                        <div
                          key={line.item.id}
                          className="flex items-center gap-2.5 bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-2.5 transition-all hover:border-zinc-700"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs sm:text-sm text-white truncate" title={line.item.name}>{line.item.name}</p>
                            <p className="text-zinc-400 text-[11px]">{formatPKR(line.item.price)} each</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateQty(line.item.id, -1)}
                              className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-5 text-center font-black text-xs text-white">{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(line.item.id, 1)}
                              className="w-6 h-6 rounded-lg bg-yellow-400 text-black hover:bg-yellow-300 flex items-center justify-center transition-colors font-bold"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="w-16 text-right font-black text-xs text-yellow-400 shrink-0">
                            {formatPKR(Number(line.item.price) * line.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(line.item.id)}
                            className="text-zinc-500 hover:text-red-400 p-1 transition-colors shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Left Column Summary Card */}
                  <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatPKR(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-400 font-semibold">
                        <span>Discount ({validDiscountPercent}%)</span>
                        <span className="font-mono">-{formatPKR(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm text-white pt-2 border-t border-zinc-800">
                      <span>Total Amount</span>
                      <span className="text-yellow-400 text-base font-mono">{formatPKR(cartTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Table Floor Graphic, Order Type, Info & Discount */}
                <div className="md:col-span-6 space-y-3">
                  {/* Visual Table Floor Plan Selector */}
                  <TableFloorGraphic
                    orders={kdsOrders}
                    selectedTable={tableNumber}
                    onSelectTable={(tName) => setTableNumber(tName)}
                    compact={true}
                  />

                  {/* Order Type & Payment Status Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Order Type
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setOrderType('Dine In')}
                          className={`py-1.5 rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                            orderType === 'Dine In'
                              ? 'bg-yellow-400 text-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <UtensilsCrossed size={12} /> Dine In
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderType('Take Away')}
                          className={`py-1.5 rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                            orderType === 'Take Away'
                              ? 'bg-yellow-400 text-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <ShoppingBag size={12} /> Take Away
                        </button>
                      </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Payment Status
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('paid')}
                          className={`py-1.5 rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                            paymentStatus === 'paid'
                              ? 'bg-emerald-500 text-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <CheckCircle size={12} /> Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('unpaid')}
                          className={`py-1.5 rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                            paymentStatus === 'unpaid'
                              ? 'bg-rose-500 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <XCircle size={12} /> Unpaid
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Table # Input, Customer Name & Special Instructions */}
                  <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 mb-1">
                          <Utensils size={12} className="text-yellow-400" /> Selected Table
                        </label>
                        <input
                          type="text"
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="e.g. Table 1..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-yellow-400 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 mb-1">
                          <User size={12} className="text-yellow-400" /> Customer Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Name (optional)..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-yellow-400 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 mb-1">
                          <FileText size={12} className="text-yellow-400" /> Instructions
                        </label>
                        <input
                          type="text"
                          value={orderInstructions}
                          onChange={(e) => setOrderInstructions(e.target.value)}
                          placeholder="Instructions..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-yellow-400 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Discount Calculator */}
                  <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Percent size={13} className="text-yellow-400" /> Discount Options
                      </label>
                      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountType('percent');
                            setDiscountValue(validDiscountPercent);
                            setUserHasOverriddenDiscount(true);
                          }}
                          className={`px-2.5 py-0.5 text-[10px] rounded font-extrabold transition-all ${
                            discountType === 'percent'
                              ? 'bg-yellow-400 text-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          % (Percent)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountType('amount');
                            setDiscountValue(discountAmount);
                            setUserHasOverriddenDiscount(true);
                          }}
                          className={`px-2.5 py-0.5 text-[10px] rounded font-extrabold transition-all ${
                            discountType === 'amount'
                              ? 'bg-yellow-400 text-black shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Rs (Fixed)
                        </button>
                      </div>
                    </div>

                    {isDrinksOnly && (
                      <div className="text-[11px] text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg font-medium">
                        🍹 Drinks only — 0% default discount applied.
                      </div>
                    )}

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {discountType === 'percent'
                        ? [0, 3, 5, 10, 15, 20, 25, 50].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                setDiscountType('percent');
                                setDiscountValue(pct);
                                setUserHasOverriddenDiscount(true);
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                                discountType === 'percent' && discountValue === pct
                                  ? 'bg-yellow-400 text-black shadow-sm'
                                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))
                        : [0, 50, 100, 150, 200, 300, 500].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => {
                                setDiscountType('amount');
                                setDiscountValue(amt);
                                setUserHasOverriddenDiscount(true);
                              }}
                              className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                                discountType === 'amount' && discountValue === amt
                                  ? 'bg-yellow-400 text-black shadow-sm'
                                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                              }`}
                            >
                              Rs. {amt}
                            </button>
                          ))}
                    </div>

                    {/* Custom Discount Input */}
                    <div className="pt-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400 text-xs font-bold">
                          {discountType === 'percent' ? '%' : 'Rs.'}
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={discountType === 'percent' ? 100 : subtotal}
                          step={discountType === 'percent' ? '1' : '10'}
                          value={discountValue === 0 ? '' : discountValue}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setDiscountValue(isNaN(val) ? 0 : val);
                            setUserHasOverriddenDiscount(true);
                          }}
                          placeholder={discountType === 'percent' ? 'Custom % (e.g. 12)...' : 'Custom Rs (e.g. 250)...'}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-bold text-white placeholder-zinc-500 focus:border-yellow-400 outline-none transition-colors"
                        />
                      </div>
                      {discountAmount > 0 && (
                        <div className="text-xs font-black text-green-400 bg-green-950/40 border border-green-500/30 px-2.5 py-1.5 rounded-lg shrink-0">
                          -{formatPKR(discountAmount)} ({validDiscountPercent}%)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary Checkout CTA */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCartOpen(false)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 px-4 rounded-xl text-xs transition-colors"
                    >
                      Continue Shopping
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('payment')}
                      className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold py-3 px-4 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-yellow-400/10 flex items-center justify-center gap-2"
                    >
                      <span>Proceed to Payment</span>
                      <span className="font-mono">({formatPKR(cartTotal)})</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {checkoutStep === 'payment' && (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Items</span>
                <span>{cartCount}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-400">
                <span>Original Price</span>
                <span>{formatPKR(subtotal)}</span>
              </div>
              {validDiscountPercent > 0 && (
                <div className="flex justify-between text-sm text-green-400 font-medium">
                  <span>Discount ({validDiscountPercent}%)</span>
                  <span>-{formatPKR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-zinc-800 pt-2">
                <span className="text-zinc-300 font-bold">Order Total</span>
                <span className="text-2xl font-black text-yellow-400">{formatPKR(cartTotal)}</span>
              </div>
            </div>
            <p className="text-sm text-zinc-300">Select payment method:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all active:scale-95 ${paymentMethod === 'cash'
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
              >
                <Banknote size={28} />
                <span className="font-bold">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center gap-2 py-6 rounded-xl border-2 transition-all active:scale-95 ${paymentMethod === 'card'
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
              >
                <CreditCard size={28} />
                <span className="font-bold">Card / Online</span>
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCheckoutStep('cart')}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-3 rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={placeOrder}
                disabled={!paymentMethod || placing}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {placing ? (
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Check size={18} /> Confirm Order
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {checkoutStep === 'receipt' && receipt && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/10 rounded-full mb-2 animate-[scaleIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
                <Check className="text-green-400" size={24} />
              </div>
              <p className="font-bold text-base">Order Complete!</p>
              <p className="text-zinc-500 text-xs mt-1.5">{formatDateTime(receipt.timestamp)}</p>
            </div>

            {/* Printable receipt */}
            <div
              id="receipt-print"
              className="bg-white text-black rounded-xl p-5 font-mono text-sm shadow-md border border-zinc-200"
            >
              {/* Receipt Top Header with Restaurant Logo */}
              <div className="text-center mb-3 space-y-1">
                <img
                  src="/images/logo.jpeg"
                  alt="Smash Daddy Logo"
                  className="w-16 h-16 rounded-full mx-auto mb-2 object-cover border-2 border-black p-0.5 shadow-sm"
                />
                <p className="font-black text-xl tracking-wider uppercase leading-none">SMASH DADDY</p>
                <p className="text-[11px] font-bold text-zinc-700 uppercase tracking-widest">--- PREMIUM BURGERS & Sandos ---</p>
                <p className="text-[10px] text-zinc-600 font-sans">Official Receipt</p>
              </div>

              {/* Big & Bold Order Type Banner at Top of Receipt */}
              <div className="text-center my-2.5 py-1.5 px-3 bg-black text-white rounded-lg font-sans font-black text-lg tracking-widest uppercase shadow-sm">
                *** {receipt.orderType || 'DINE IN'} ***
              </div>

              {/* Order Info Details Box */}
              <div className="bg-zinc-100 border border-zinc-300 rounded-lg p-2.5 my-2 space-y-1 text-xs font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-medium">Order Number:</span>
                  <span className="font-black font-mono text-base text-black">
                    {receipt.orderNumber || formatOrderDisplayNumber({ id: receipt.orderId, order_number: receipt.orderNumber })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-medium">Order Type:</span>
                  <span className="font-black text-black text-sm uppercase">{receipt.orderType || 'DINE IN'}</span>
                </div>
                {receipt.customerName && (
                  <div className="flex justify-between items-center bg-zinc-200/80 border border-zinc-300 px-2 py-1 rounded my-0.5">
                    <span className="text-zinc-700 font-bold uppercase text-[10px] tracking-wider">Customer Name:</span>
                    <span className="font-black font-sans text-sm text-black">{receipt.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-medium">Date & Time:</span>
                  <span className="font-medium text-zinc-800">{formatDateTime(receipt.timestamp)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-medium">Payment Method:</span>
                  <span className="font-bold text-zinc-900">{receipt.method === 'cash' ? 'CASH' : 'CARD / ONLINE'}</span>
                </div>
              </div>

              {/* Table Header */}
              <div className="border-b-2 border-black pb-1 mb-1 font-bold text-xs uppercase flex justify-between tracking-wide">
                <span className="w-10">QTY</span>
                <span className="flex-1 text-left">ITEM</span>
                <span className="text-right">AMOUNT</span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-dashed divide-zinc-300 py-1">
                {receipt.lines.map((l) => (
                  <div key={l.item.id} className="flex justify-between items-center py-1.5 text-xs font-mono">
                    <span className="w-10 font-bold text-zinc-900">{l.quantity}x</span>
                    <span className="flex-1 text-left font-medium pr-2 truncate">{l.item.name}</span>
                    <span className="font-bold text-zinc-900 shrink-0">{formatPKR(Number(l.item.price) * l.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Order Instructions (Visible only if instructions exist) */}
              {receipt.instructions && receipt.instructions.trim().length > 0 && (
                <div className="my-2.5 p-2 bg-zinc-100 border border-zinc-300 rounded-lg font-sans text-xs">
                  <p className="font-bold text-[10px] uppercase text-zinc-800 tracking-wider mb-0.5">
                    ORDER INSTRUCTIONS:
                  </p>
                  <p className="text-zinc-900 font-medium whitespace-pre-wrap leading-tight">
                    {receipt.instructions.trim()}
                  </p>
                </div>
              )}

              <div className="border-t-2 border-dashed border-black my-2" />

              {/* Financial Summary */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-0.5 text-zinc-700 font-medium">
                  <span>Original Price</span>
                  <span className="font-mono">{formatPKR(receipt.subtotal)}</span>
                </div>
                {receipt.discountPercent > 0 && (
                  <div className="flex justify-between py-0.5 text-green-700 font-bold">
                    <span>Discount ({receipt.discountPercent}%)</span>
                    <span className="font-mono">-{formatPKR(receipt.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center font-black text-sm pt-2 mt-1 border-t-2 border-black">
                  <span className="uppercase tracking-wider">ORDER TOTAL</span>
                  <span className="font-mono text-base">{formatPKR(receipt.total)}</span>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-black my-3" />

              {/* Instagram QR Code Footer */}
              <div className="text-center py-2 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5 my-2">
                <img
                  src="/images/instagram-qr.png"
                  alt="Follow us on Instagram"
                  className="w-32 h-32 mx-auto object-contain p-1 bg-white border border-zinc-300 rounded-lg shadow-sm"
                />
                <p className="text-xs font-black uppercase tracking-wider text-zinc-900">FOLLOW US ON INSTAGRAM</p>
                <p className="text-[10px] text-zinc-600 font-sans">Scan QR code to connect with @_smash_daddy</p>
              </div>

              <div className="border-t border-dashed border-zinc-400 my-2" />
              <p className="text-center text-xs font-bold text-zinc-900 mt-2 uppercase tracking-wide">Thank you for dining with us!</p>
              <p className="text-center text-[10px] text-zinc-500 font-sans mt-0.5">Please visit us again soon</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Printer size={18} /> Print
              </button>
              <button
                onClick={resetOrder}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
              >
                New Order
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* KDS Edit Order Modal */}
      <Modal
        open={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        title={`Edit Order ${editingOrder ? formatOrderDisplayNumber(editingOrder) : ''}`}
        maxWidth="max-w-lg"
      >
        {editingOrder && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Table Number, Customer Name & Order Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                  <Utensils size={13} className="text-yellow-400" /> Table #
                </label>
                <input
                  type="text"
                  value={editTableNumber}
                  onChange={(e) => setEditTableNumber(e.target.value)}
                  placeholder="Table number..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-yellow-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                  <User size={13} className="text-yellow-400" /> Customer Name
                </label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="Optional customer name"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-yellow-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                  <UtensilsCrossed size={13} className="text-yellow-400" /> Order Type
                </label>
                <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setEditOrderType('Dine In')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      editOrderType === 'Dine In'
                        ? 'bg-yellow-400 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Dine In
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditOrderType('Take Away')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      editOrderType === 'Take Away'
                        ? 'bg-yellow-400 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Take Away
                  </button>
                </div>
              </div>
            </div>

            {/* Order Items List */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Order Line Items
              </label>
              {editItems.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2 text-center">No items in order. Add items below.</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {editItems.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-white">{line.item_name}</p>
                        <p className="text-zinc-500 text-[11px]">{formatPKR(line.item_price)} each</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((prev) =>
                              prev
                                .map((l, i) => (i === idx ? { ...l, quantity: l.quantity - 1 } : l))
                                .filter((l) => l.quantity > 0),
                            );
                          }}
                          className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center font-bold text-white">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l)),
                            );
                          }}
                          className="w-6 h-6 rounded bg-yellow-400 text-black hover:bg-yellow-300 flex items-center justify-center font-bold"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <span className="w-16 text-right font-bold text-yellow-400">
                        {formatPKR(line.item_price * line.quantity)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Menu Item Dropdown */}
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={selectedAddItem}
                  onChange={(e) => setSelectedAddItem(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-yellow-400 outline-none"
                >
                  <option value="">-- Add item from menu --</option>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({formatPKR(m.price)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedAddItem) return;
                    const found = items.find((i) => i.id === selectedAddItem);
                    if (!found) return;
                    setEditItems((prev) => {
                      const existing = prev.find((l) => l.menu_item_id === found.id);
                      if (existing) {
                        return prev.map((l) =>
                          l.menu_item_id === found.id ? { ...l, quantity: l.quantity + 1 } : l,
                        );
                      }
                      return [
                        ...prev,
                        {
                          menu_item_id: found.id,
                          item_name: found.name,
                          item_price: Number(found.price),
                          quantity: 1,
                        },
                      ];
                    });
                    setSelectedAddItem('');
                  }}
                  disabled={!selectedAddItem}
                  className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-black font-bold px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-1"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Discount & Payment Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                  <CreditCard size={13} className="text-yellow-400" /> Payment Method
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value as 'cash' | 'card')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-yellow-400 outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card / Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                  <CheckCircle size={13} className="text-yellow-400" /> Payment Status
                </label>
                <div className="grid grid-cols-2 gap-1 bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditPaymentStatus('paid')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      editPaymentStatus === 'paid'
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentStatus('unpaid')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      editPaymentStatus === 'unpaid'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Unpaid
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                    <Percent size={13} className="text-yellow-400" /> Discount
                  </label>
                  <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEditDiscountType('percent')}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-all ${
                        editDiscountType === 'percent'
                          ? 'bg-yellow-400 text-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDiscountType('amount')}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-all ${
                        editDiscountType === 'amount'
                          ? 'bg-yellow-400 text-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Rs
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={editDiscountValue === 0 ? '' : editDiscountValue}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEditDiscountValue(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    placeholder="0"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-yellow-400 outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                    {editDiscountType === 'percent' ? '%' : 'PKR'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                <FileText size={13} className="text-yellow-400" /> Order Instructions
              </label>
              <textarea
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder="Special notes..."
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-white focus:border-yellow-400 outline-none resize-none"
              />
            </div>

            {/* Price Summary */}
            {(() => {
              const editSubtotal = editItems.reduce((acc, it) => acc + it.item_price * it.quantity, 0);
              let editValidDiscount = 0;
              let editDiscountAmount = 0;

              if (editDiscountType === 'percent') {
                editValidDiscount = Math.max(0, Math.min(100, isNaN(editDiscountValue) ? 0 : editDiscountValue));
                editDiscountAmount = Math.round((editSubtotal * editValidDiscount) / 100);
              } else {
                editDiscountAmount = Math.min(editSubtotal, Math.max(0, isNaN(editDiscountValue) ? 0 : editDiscountValue));
                editValidDiscount = editSubtotal > 0 ? Math.round((editDiscountAmount / editSubtotal) * 100) : 0;
              }

              const editTotalAmount = Math.max(0, editSubtotal - editDiscountAmount);
              return (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal:</span>
                    <span>{formatPKR(editSubtotal)}</span>
                  </div>
                  {editDiscountAmount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount {editDiscountType === 'percent' ? `(${editValidDiscount}%)` : '(Fixed Price)'}:</span>
                      <span>-{formatPKR(editDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-white text-sm pt-1 border-t border-zinc-800">
                    <span>New Total:</span>
                    <span className="text-yellow-400 font-black">{formatPKR(editTotalAmount)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Save / Save & Print / Cancel Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 px-3 rounded-xl transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEditedOrder(false)}
                disabled={editSaving || editItems.length === 0}
                className="flex-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-40 font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
              >
                <Check size={15} /> Save Changes
              </button>
              <button
                type="button"
                onClick={() => saveEditedOrder(true)}
                disabled={editSaving || editItems.length === 0}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-black font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs shadow-md shadow-yellow-400/10"
              >
                {editSaving ? (
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Printer size={15} /> Save & Print
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Cancelled Order Confirmation Modal */}
      <Modal
        open={!!deletingOrder}
        onClose={() => setDeletingOrder(null)}
        title="Delete Order Permanently"
        maxWidth="max-w-sm"
      >
        {deletingOrder && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">
              Are you sure you want to permanently delete Order{' '}
              <span className="font-mono font-bold text-yellow-400">
                {formatOrderDisplayNumber(deletingOrder)}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 rounded-xl transition-colors text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteOrder}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={15} /> Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================= KDS ORDERS GRID COMPONENT ================= */

function KDSOrdersGrid({
  orders,
  nowMs,
  onUpdateStatus,
  onUpdatePaymentStatus,
  onEditOrder,
  onDeleteOrder,
  onReprintReceipt,
}: {
  orders: KDSOrder[];
  nowMs: number;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onUpdatePaymentStatus: (orderId: string, newPaymentStatus: 'paid' | 'unpaid') => void;
  onEditOrder: (order: KDSOrder) => void;
  onDeleteOrder: (order: KDSOrder) => void;
  onReprintReceipt: (order: KDSOrder) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
        <ChefHat className="mx-auto text-zinc-600 mb-3" size={40} />
        <p className="text-zinc-400 text-base font-medium">No orders in this view.</p>
        <p className="text-zinc-600 text-xs mt-1">New punched orders will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map((order) => (
        <KDSCard
          key={order.id}
          order={order}
          nowMs={nowMs}
          onUpdateStatus={onUpdateStatus}
          onUpdatePaymentStatus={onUpdatePaymentStatus}
          onEditOrder={onEditOrder}
          onDeleteOrder={onDeleteOrder}
          onReprintReceipt={onReprintReceipt}
        />
      ))}
    </div>
  );
}

function KDSCard({
  order,
  nowMs,
  onUpdateStatus,
  onUpdatePaymentStatus,
  onEditOrder,
  onDeleteOrder,
  onReprintReceipt,
}: {
  order: KDSOrder;
  nowMs: number;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
  onUpdatePaymentStatus: (orderId: string, newPaymentStatus: 'paid' | 'unpaid') => void;
  onEditOrder: (order: KDSOrder) => void;
  onDeleteOrder: (order: KDSOrder) => void;
  onReprintReceipt: (order: KDSOrder) => void;
}) {
  const status = order.status || 'Being Prepared';

  // Calculate dynamic subtotal & discount fallbacks from line items if DB fields are missing
  const computedItemsSubtotal = order.items.reduce(
    (acc, item) => acc + Number(item.item_price || 0) * (item.quantity || 1),
    0,
  );
  const displaySubtotal =
    order.subtotal && Number(order.subtotal) > 0
      ? Number(order.subtotal)
      : computedItemsSubtotal > 0
        ? computedItemsSubtotal
        : order.total_amount;

  const displayDiscountAmount =
    order.discount_amount && Number(order.discount_amount) > 0
      ? Number(order.discount_amount)
      : displaySubtotal > order.total_amount
        ? displaySubtotal - order.total_amount
        : 0;

  const displayDiscountPercent =
    order.discount_percent && Number(order.discount_percent) > 0
      ? Number(order.discount_percent)
      : displaySubtotal > 0 && displayDiscountAmount > 0
        ? Math.round((displayDiscountAmount / displaySubtotal) * 100)
        : 0;

  // Calculate 25-minute moving countdown timer
  const createdMs = new Date(order.created_at).getTime();
  const targetMs = createdMs + 25 * 60 * 1000; // 25 mins target
  const diffSec = Math.floor((targetMs - nowMs) / 1000);

  const isOverdue = diffSec < 0;
  const absSec = Math.abs(diffSec);
  const minutes = Math.floor(absSec / 60);
  const seconds = absSec % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      className={`bg-zinc-900 border rounded-2xl p-4 flex flex-col justify-between transition-all animate-[fadeIn_0.3s_ease-out] ${status === 'Being Prepared'
        ? isOverdue
          ? 'border-red-500/80 shadow-lg shadow-red-500/10'
          : diffSec <= 300
            ? 'border-orange-500/70'
            : 'border-yellow-400/50'
        : status === 'Served'
          ? 'border-green-500/30 bg-zinc-900/60 opacity-85'
          : 'border-zinc-800 opacity-60'
        }`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-base text-yellow-400">
                {formatOrderDisplayNumber(order)}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.payment_method === 'cash'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}
              >
                {order.payment_method === 'cash' ? 'Cash' : 'Card'}
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdatePaymentStatus(
                    order.id,
                    order.payment_status === 'paid' ? 'unpaid' : 'paid',
                  )
                }
                title="Click to toggle Payment Status"
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider transition-all flex items-center gap-1 ${
                  order.payment_status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                }`}
              >
                {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
              </button>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  (order.order_type || 'Dine In') === 'Take Away'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {order.order_type || 'Dine In'}
              </span>
            </div>
            {/* Table Number & Status Indicator */}
            {order.table_number && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                <span className="font-extrabold text-white flex items-center gap-1 bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700">
                  <Utensils size={11} className="text-yellow-400" />
                  {order.table_number.toLowerCase().includes('table') ? order.table_number : `Table ${order.table_number}`}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                    status === 'Served' || status === 'Cancelled'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                      : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                  }`}
                >
                  {status === 'Served' || status === 'Cancelled' ? 'Clear / Empty' : 'Occupied'}
                </span>
              </div>
            )}
            {order.customer_name && (
              <p className="text-xs font-bold text-white mt-1 flex items-center gap-1">
                <span className="text-zinc-400 font-normal">Cust:</span>
                <span className="text-yellow-400 font-extrabold">{order.customer_name}</span>
              </p>
            )}
            <p className="text-[11px] text-zinc-500 mt-0.5">{formatDateTime(order.created_at)}</p>
          </div>

          {/* Status & Timer Badge */}
          {status === 'Being Prepared' ? (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${isOverdue
                ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                : diffSec <= 300
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                  : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30'
                }`}
            >
              <Clock size={14} className={isOverdue ? 'animate-spin' : ''} />
              <span>
                {isOverdue ? `-${timeStr}` : timeStr}
              </span>
            </div>
          ) : (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 ${status === 'Served'
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
            >
              {status === 'Served' ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {status}
            </span>
          )}
        </div>

        {/* Items List */}
        <div className="py-3 space-y-2">
          {order.items.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No line items detailed.</p>
          ) : (
            order.items.map((it) => (
              <div key={it.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="w-6 h-6 rounded-lg bg-yellow-400/20 text-yellow-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {it.quantity}x
                  </span>
                  <span className="font-semibold text-zinc-100 truncate">{it.item_name}</span>
                </div>
                <span className="text-xs font-bold text-zinc-400 shrink-0">
                  {formatPKR(Number(it.item_price) * it.quantity)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Order Instructions in KDS */}
        {order.instructions && order.instructions.trim().length > 0 && (
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-2.5 mb-3 text-xs">
            <span className="font-bold text-yellow-400 text-[10px] uppercase tracking-wider block mb-0.5">
              Special Instructions:
            </span>
            <p className="text-zinc-200 font-medium whitespace-pre-wrap">
              {order.instructions.trim()}
            </p>
          </div>
        )}
      </div>

      {/* Card Footer & Financial Summary */}
      <div className="pt-3 border-t border-zinc-800 space-y-3">
        <div className="space-y-0.5 text-xs text-zinc-400">
          {displaySubtotal > 0 && (displaySubtotal !== order.total_amount || displayDiscountAmount > 0) && (
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPKR(displaySubtotal)}</span>
            </div>
          )}
          {displayDiscountAmount > 0 ? (
            <div className="flex justify-between text-green-400">
              <span>
                Discount {displayDiscountPercent > 0 ? `(${displayDiscountPercent}%)` : ''}
              </span>
              <span>-{formatPKR(displayDiscountAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm font-bold text-white pt-1">
            <span>Total</span>
            <span className="text-yellow-400 font-black">{formatPKR(order.total_amount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {status === 'Being Prepared' ? (
              <>
                <button
                  onClick={() => onUpdateStatus(order.id, 'Served')}
                  className="flex-1 bg-green-500 hover:bg-green-400 text-black font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-green-500/20"
                >
                  <CheckCircle size={16} /> Serve Order
                </button>
                <button
                  onClick={() => onUpdateStatus(order.id, 'Cancelled')}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <XCircle size={16} /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => onUpdateStatus(order.id, 'Being Prepared')}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={14} /> Move back to Preparation
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onEditOrder(order)}
              className="flex-1 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Pencil size={14} /> Edit
            </button>

            <button
              onClick={() => onReprintReceipt(order)}
              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
              title="Print / Reprint receipt"
            >
              <Printer size={14} /> Receipt
            </button>

            {status === 'Cancelled' && (
              <button
                onClick={() => onDeleteOrder(order)}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                title="Delete order permanently"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= VISUAL TABLE FLOOR GRAPHIC COMPONENT ================= */
interface TableFloorGraphicProps {
  orders: KDSOrder[];
  selectedTable?: string;
  onSelectTable?: (tableNum: string) => void;
  compact?: boolean;
}

function TableFloorGraphic({ orders, selectedTable, onSelectTable, compact = false }: TableFloorGraphicProps) {
  const DEFAULT_TABLES = Array.from({ length: 8 }, (_, i) => `Table ${i + 1}`);
  const activeOrders = orders.filter((o) => (o.status || 'Being Prepared') === 'Being Prepared');
  const normalize = (val?: string | null) => (val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return (
    <div className={`bg-zinc-950 border border-zinc-800/80 rounded-2xl ${compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2.5'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Utensils className="text-yellow-400" size={compact ? 13 : 15} />
          <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold text-zinc-300 uppercase tracking-wider`}>
            Table Floor Map
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-extrabold">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            Free
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse" />
            Reserved
          </span>
        </div>
      </div>

      <div className={`grid ${compact ? 'grid-cols-4 gap-1.5' : 'grid-cols-2 sm:grid-cols-4 gap-2'}`}>
        {DEFAULT_TABLES.map((tName, idx) => {
          const normT = normalize(tName);
          const activeOrd = activeOrders.find(
            (o) => normalize(o.table_number) === normT || normalize(o.table_number) === `t${idx + 1}` || normalize(o.table_number) === `${idx + 1}`
          );
          const isOccupied = !!activeOrd;
          const isSelected =
            normalize(selectedTable) === normT ||
            normalize(selectedTable) === `t${idx + 1}` ||
            normalize(selectedTable) === `${idx + 1}` ||
            selectedTable === tName;

          if (compact) {
            return (
              <button
                key={tName}
                type="button"
                onClick={() => onSelectTable && onSelectTable(tName)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-center transition-all ${
                  isSelected
                    ? 'bg-yellow-400/20 border-yellow-400 ring-1 ring-yellow-400/50 shadow-sm scale-[1.02]'
                    : isOccupied
                    ? 'bg-rose-950/40 border-rose-500/40 hover:border-rose-400'
                    : 'bg-emerald-950/25 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/40'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] font-black font-mono ${
                      isSelected ? 'text-yellow-400' : isOccupied ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    T-{idx + 1}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOccupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                {isOccupied ? (
                  <span className="text-[8px] font-mono font-bold text-rose-300 truncate max-w-full">
                    {activeOrd?.order_number || formatOrderDisplayNumber(activeOrd!)}
                  </span>
                ) : (
                  <span className="text-[8px] text-emerald-400/70 font-medium">Free</span>
                )}
              </button>
            );
          }

          return (
            <button
              key={tName}
              type="button"
              onClick={() => onSelectTable && onSelectTable(tName)}
              className={`relative flex flex-col items-center justify-between p-2 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-yellow-400/20 border-yellow-400 ring-2 ring-yellow-400/50 shadow-md shadow-yellow-400/20 scale-[1.02]'
                  : isOccupied
                  ? 'bg-rose-950/40 border-rose-500/50 hover:border-rose-400'
                  : 'bg-emerald-950/25 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/40'
              }`}
            >
              <div className="w-full flex items-center justify-between gap-1">
                <span
                  className={`text-[11px] font-extrabold font-mono ${
                    isSelected ? 'text-yellow-400' : isOccupied ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  T-{idx + 1}
                </span>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                    isOccupied
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isOccupied ? 'Reserved' : 'Free'}
                </span>
              </div>

              {/* Graphic Representation of Restaurant Table */}
              <div className="my-1 flex items-center justify-center">
                <div
                  className={`w-9 h-6 rounded-lg border flex items-center justify-center transition-all ${
                    isOccupied
                      ? 'bg-rose-900/50 border-rose-500/60 text-rose-300'
                      : 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  <Utensils size={12} className={isOccupied ? 'text-rose-400' : 'text-emerald-400'} />
                </div>
              </div>

              {isOccupied ? (
                <div className="w-full text-center truncate">
                  <p className="text-[10px] font-mono font-bold text-white truncate">
                    {activeOrd?.order_number || formatOrderDisplayNumber(activeOrd!)}
                  </p>
                  {activeOrd?.customer_name && (
                    <p className="text-[9px] text-zinc-400 truncate">{activeOrd.customer_name}</p>
                  )}
                </div>
              ) : (
                <p className="text-[9px] text-emerald-400 font-semibold text-center">Available</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
