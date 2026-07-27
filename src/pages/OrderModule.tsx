import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MenuItem, CartLine, Order, OrderItem, OrderStatus } from '../types';
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
} from 'lucide-react';
import Logo from '../components/Logo';
import Modal from '../components/Modal';

interface OrderModuleProps {
  onBack: () => void;
}

type CheckoutStep = 'cart' | 'payment' | 'receipt';
type PortalSection = 'menu' | 'kds';

interface KDSOrder extends Order {
  items: OrderItem[];
}

export default function OrderModule({ onBack }: OrderModuleProps) {
  const [activeSection, setActiveSection] = useState<PortalSection>('menu');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [orderInstructions, setOrderInstructions] = useState<string>('');
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | null>(null);
  const [placing, setPlacing] = useState(false);
  const [receipt, setReceipt] = useState<{
    orderId: string;
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    total: number;
    method: 'cash' | 'card';
    lines: CartLine[];
    instructions?: string | null;
    timestamp: string;
  } | null>(null);

  // KDS State
  const [kdsOrders, setKdsOrders] = useState<KDSOrder[]>([]);
  const [kdsLoading, setKdsLoading] = useState(false);
  const [kdsFilter, setKdsFilter] = useState<OrderStatus | 'All'>('Being Prepared');
  const [nowMs, setNowMs] = useState<number>(Date.now());

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

  const subtotal = cart.reduce((s, l) => s + Number(l.item.price) * l.quantity, 0);
  const validDiscountPercent = Math.max(0, Math.min(100, isNaN(discountPercent) ? 0 : discountPercent));
  const discountAmount = Math.round((subtotal * validDiscountPercent) / 100);
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

    const fullPayload = {
      total_amount: cartTotal,
      subtotal: subtotal,
      discount_percent: validDiscountPercent,
      discount_amount: discountAmount,
      payment_method: paymentMethod,
      status: 'Being Prepared',
      instructions: orderInstructions.trim() || null,
    };

    let orderRes = await supabase.from('orders').insert(fullPayload).select().single();

    // Fallback 1: Try without instructions if DB schema lacks 'instructions' column
    if (orderRes.error) {
      console.warn('Full payload insert failed, trying without instructions:', orderRes.error);
      const { instructions, ...payloadWithoutInstructions } = fullPayload;
      orderRes = await supabase
        .from('orders')
        .insert(payloadWithoutInstructions)
        .select()
        .single();
    }

    // Fallback 2: Try basic payload with status if discount columns don't exist
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

    // Fallback 3: Minimum payload
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
      subtotal: subtotal,
      discountPercent: validDiscountPercent,
      discountAmount: discountAmount,
      total: cartTotal,
      method: paymentMethod,
      lines: cart,
      instructions: orderInstructions.trim() || null,
      timestamp: order.created_at || new Date().toISOString(),
    });
    setPlacing(false);
    setCheckoutStep('receipt');
  }

  function resetOrder() {
    setCart([]);
    setDiscountPercent(0);
    setOrderInstructions('');
    setReceipt(null);
    setPaymentMethod(null);
    setCheckoutStep('cart');
    setCartOpen(false);
  }

  async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    setKdsOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      console.error('Failed to update status:', error);
      loadKdsOrders();
    }
  }

  // Count active orders currently Being Prepared
  const preparingCount = kdsOrders.filter((o) => (o.status || 'Being Prepared') === 'Being Prepared').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur border-b border-zinc-800">
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
            {/* Section Switcher Tabs */}
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
                            className="group relative text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-yellow-400/50 hover:bg-zinc-800/50 transition-all active:scale-95 animate-[fadeIn_0.3s_ease-out]"
                          >
                            <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                            {item.description && (
                              <p className="text-zinc-500 text-xs mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <p className="text-yellow-400 font-bold mt-2">{formatPKR(item.price)}</p>
                            {inCart && (
                              <span className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center animate-[scaleIn_0.2s_ease-out]">
                                {inCart.quantity}
                              </span>
                            )}
                            <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="text-yellow-400" size={18} />
                            </span>
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
            {/* KDS Header & Status Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <ChefHat className="text-yellow-400" size={24} /> Kitchen Display System (KDS)
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Live kitchen order queue with 25-minute countdown timers.
                </p>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={loadKdsOrders}
                  disabled={kdsLoading}
                  className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl transition-all"
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
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${kdsFilter === st ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-300'
                          }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KDS Orders Grid */}
            {kdsLoading ? (
              <div className="flex justify-center py-20">
                <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
              </div>
            ) : (
              <KDSOrdersGrid
                orders={kdsOrders.filter((o) =>
                  kdsFilter === 'All' ? true : (o.status || 'Being Prepared') === kdsFilter,
                )}
                nowMs={nowMs}
                onUpdateStatus={updateOrderStatus}
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
              : 'Your Order'
        }
        maxWidth="max-w-lg"
      >
        {checkoutStep === 'cart' && (
          <div className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">Your cart is empty. Add items from the menu.</p>
            ) : (
              <>
                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {cart.map((line) => (
                    <div
                      key={line.item.id}
                      className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3 animate-[fadeIn_0.2s_ease-out]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{line.item.name}</p>
                        <p className="text-zinc-500 text-xs">{formatPKR(line.item.price)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(line.item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-bold">{line.quantity}</span>
                        <button
                          onClick={() => updateQty(line.item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-yellow-400 text-black hover:bg-yellow-300 flex items-center justify-center transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="w-20 text-right font-bold text-sm">
                        {formatPKR(Number(line.item.price) * line.quantity)}
                      </span>
                      <button
                        onClick={() => removeLine(line.item.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Discount Section */}
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Percent size={14} className="text-yellow-400" /> Apply Discount
                    </label>
                    <span className="text-xs text-zinc-400">
                      {validDiscountPercent > 0 ? `-${formatPKR(discountAmount)}` : 'No Discount'}
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[0, 5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${validDiscountPercent === pct
                          ? 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/20'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Custom Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-zinc-500">Custom Discount (%):</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent === 0 ? '' : discountPercent}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setDiscountPercent(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                        }}
                        placeholder="0"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-yellow-400 outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">%</span>
                    </div>
                  </div>
                </div>

                {/* Order Instructions Section */}
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <FileText size={14} className="text-yellow-400" /> Order Instructions
                    </label>
                    {orderInstructions.trim() && (
                      <button
                        type="button"
                        onClick={() => setOrderInstructions('')}
                        className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors font-medium"
                      >
                        Clear instructions
                      </button>
                    )}
                  </div>
                  <textarea
                    value={orderInstructions}
                    onChange={(e) => setOrderInstructions(e.target.value)}
                    placeholder="Add order instructions (e.g. Extra spicy, no onions, sauce on side)..."
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-white placeholder-zinc-600 focus:border-yellow-400 outline-none transition-colors resize-none"
                  />
                </div>

                {/* Price Breakdown */}
                <div className="border-t border-zinc-800 pt-3 space-y-1.5">
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
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-white">Order Total</span>
                    <span className="text-2xl font-black text-yellow-400">{formatPKR(cartTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setCheckoutStep('payment')}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
                >
                  Proceed to Checkout
                </button>
              </>
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
              <p className="text-xs text-yellow-400 font-semibold mt-1 bg-yellow-400/10 inline-block px-3 py-1 rounded-full border border-yellow-400/20">
                Pushed to Kitchen (Being Prepared)
              </p>
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

              {/* Order Info Details Box */}
              <div className="bg-zinc-100 border border-zinc-300 rounded-lg p-2.5 my-2 space-y-1 text-xs font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-medium">Order Number:</span>
                  <span className="font-black font-mono text-sm text-black">#{receipt.orderId.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-medium">Date & Time:</span>
                  <span className="font-medium text-zinc-800">{formatDateTime(receipt.timestamp)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-600 font-medium">Status:</span>
                  <span className="font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[10px] uppercase">BEING PREPARED</span>
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
    </div>
  );
}

/* ================= KDS ORDERS GRID COMPONENT ================= */

function KDSOrdersGrid({
  orders,
  nowMs,
  onUpdateStatus,
}: {
  orders: KDSOrder[];
  nowMs: number;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
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
        />
      ))}
    </div>
  );
}

function KDSCard({
  order,
  nowMs,
  onUpdateStatus,
}: {
  order: KDSOrder;
  nowMs: number;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
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
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-base text-yellow-400">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.payment_method === 'cash'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}
              >
                {order.payment_method === 'cash' ? 'Cash' : 'Card'}
              </span>
            </div>
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
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={14} /> Move back to Preparation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
