import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, OrderItem } from '../types';
import { formatPKR, formatDateTime } from '../lib/format';
import { TrendingUp, ShoppingBag, Receipt, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import Modal from '../components/Modal';
import { CLEAR_SALES_PASSWORD } from '../lib/auth';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

interface AnalyticsProps {
  onLogout: () => void;
  onNavigate: (tab: 'menu' | 'inventory' | 'analytics' | 'staff') => void;
  activeTab: 'menu' | 'inventory' | 'analytics' | 'staff';
}

interface ItemSold {
  item_name: string;
  total_qty: number;
  revenue: number;
}

export default function Analytics({ onLogout, onNavigate, activeTab }: AnalyticsProps) {
  const [period, setPeriod] = useState<Period>('day');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: oi } = await supabase.from('order_items').select('*');
    setOrders((o as Order[]) ?? []);
    setOrderItems((oi as OrderItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function getStartOfPeriod(p: Period): Date {
    const now = new Date();
    const start = new Date(now);
    if (p === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (p === 'week') {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday start
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
    } else if (p === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }
    return start;
  }

  let periodOrders: Order[] = [];
  if (period === 'custom') {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    periodOrders = orders.filter((o) => {
      const created = new Date(o.created_at);
      return created >= start && created <= end;
    });
  } else {
    const periodStart = getStartOfPeriod(period);
    periodOrders = orders.filter((o) => new Date(o.created_at) >= periodStart);
  }

  // Revenue is only registered after order status is updated to Served
  const servedOrders = periodOrders.filter((o) => !o.status || o.status === 'Served');
  const servedOrderIds = new Set(servedOrders.map((o) => o.id));
  const filteredItems = orderItems.filter((oi) => servedOrderIds.has(oi.order_id));

  const totalRevenue = servedOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalOrders = servedOrders.length;
  const totalItemsSold = filteredItems.reduce((s, oi) => s + oi.quantity, 0);

  // Per-item aggregation
  const itemMap = new Map<string, ItemSold>();
  for (const oi of filteredItems) {
    const existing = itemMap.get(oi.item_name) ?? { item_name: oi.item_name, total_qty: 0, revenue: 0 };
    existing.total_qty += oi.quantity;
    existing.revenue += Number(oi.item_price) * oi.quantity;
    itemMap.set(oi.item_name, existing);
  }
  const itemsSold = [...itemMap.values()].sort((a, b) => b.total_qty - a.total_qty);

  // Payment breakdown
  const cashRevenue = servedOrders
    .filter((o) => o.payment_method === 'cash')
    .reduce((s, o) => s + Number(o.total_amount), 0);
  const cardRevenue = servedOrders
    .filter((o) => o.payment_method === 'card')
    .reduce((s, o) => s + Number(o.total_amount), 0);

  async function handleClearSales() {
    setClearError('');
    if (clearPassword !== CLEAR_SALES_PASSWORD) {
      setClearError('Incorrect password');
      return;
    }
    setClearing(true);
    // Delete order_items first (FK), then orders
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setClearing(false);
    setClearOpen(false);
    setClearPassword('');
    load();
  }

  const periodLabels: Record<Period, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    custom: 'Custom Range',
  };
  const periodLabel = period === 'custom' ? `${startDate} to ${endDate}` : periodLabels[period];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black">
              SMASH <span className="text-yellow-400">DADDY</span>
            </span>
            <span className="text-xs text-zinc-500 hidden sm:inline">Admin</span>
          </div>
          <button
            onClick={onLogout}
            className="text-sm text-zinc-400 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {(
            [
              { key: 'menu', label: 'Menu Management' },
              { key: 'inventory', label: 'Inventory' },
              { key: 'staff', label: 'Staff' },
              { key: 'analytics', label: 'Analytics' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'border-yellow-400 text-yellow-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analytics & Revenue</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Track sales performance</p>
          </div>
          <button
            onClick={() => setClearOpen(true)}
            className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95"
          >
            <Trash2 size={18} /> Clear All Sales
          </button>
        </div>

        {/* Period selector */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['day', 'week', 'month', 'year', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  period === p
                    ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/10 font-bold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker Bar */}
          {period === 'custom' && (
            <div className="bg-zinc-900 border border-zinc-800/90 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <Calendar size={18} className="text-yellow-400 shrink-0" />
                <span className="font-semibold">Custom Date Filter:</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-yellow-400 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-yellow-400 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <StatCard
                icon={<TrendingUp />}
                label="Total Revenue"
                value={formatPKR(totalRevenue)}
                accent
              />
              <StatCard
                icon={<Receipt />}
                label="Orders"
                value={String(totalOrders)}
              />
              <StatCard
                icon={<ShoppingBag />}
                label="Items Sold"
                value={String(totalItemsSold)}
              />
            </div>

            {/* Payment breakdown */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-500 text-sm">Cash Revenue</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{formatPKR(cashRevenue)}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-500 text-sm">Card / Online Revenue</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{formatPKR(cardRevenue)}</p>
              </div>
            </div>

            {/* Items sold breakdown */}
            <div className="mb-8">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <ShoppingBag size={20} className="text-yellow-400" /> Items Sold ({periodLabel})
              </h2>
              {itemsSold.length === 0 ? (
                <p className="text-zinc-500 text-sm bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  No items sold in this period.
                </p>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-800/50 text-zinc-400">
                        <th className="text-left px-4 py-3 font-medium">Item</th>
                        <th className="text-right px-4 py-3 font-medium">Qty Sold</th>
                        <th className="text-right px-4 py-3 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsSold.map((it, idx) => {
                        const maxQty = itemsSold[0].total_qty;
                        const pct = (it.total_qty / maxQty) * 100;
                        return (
                          <tr
                            key={it.item_name}
                            className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-zinc-600 text-xs w-5">{idx + 1}</span>
                                <div className="flex-1">
                                  <p className="font-medium">{it.item_name}</p>
                                  <div className="mt-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-yellow-400">
                              {it.total_qty}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-300">
                              {formatPKR(it.revenue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent orders */}
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Calendar size={20} className="text-yellow-400" /> Recent Orders ({periodLabel})
              </h2>
              {periodOrders.length === 0 ? (
                <p className="text-zinc-500 text-sm bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  No orders in this period.
                </p>
              ) : (
                <div className="space-y-2">
                  {periodOrders.slice(0, 20).map((o) => {
                    const st = o.status || 'Being Prepared';
                    return (
                      <div
                        key={o.id}
                        className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 animate-[fadeIn_0.3s_ease-out]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{formatPKR(Number(o.total_amount))}</p>
                            {o.discount_percent && o.discount_percent > 0 ? (
                              <span className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">
                                {o.discount_percent}% OFF
                              </span>
                            ) : null}
                          </div>
                          <p className="text-zinc-500 text-xs">{formatDateTime(o.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              st === 'Served'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : st === 'Being Prepared'
                                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {st}
                          </span>
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              o.payment_method === 'cash'
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}
                          >
                            {o.payment_method === 'cash' ? 'Cash' : 'Card'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Clear sales modal */}
      <Modal open={clearOpen} onClose={() => setClearOpen(false)} title="Clear All Sales Data">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-red-200">
              This will permanently delete ALL orders and order items. This action cannot be undone.
            </p>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">
              Enter the clear-sales password to confirm:
            </label>
            <input
              type="password"
              value={clearPassword}
              onChange={(e) => setClearPassword(e.target.value)}
              autoFocus
              placeholder="Password"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-red-400 outline-none"
            />
          </div>
          {clearError && <p className="text-red-400 text-sm">{clearError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setClearOpen(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleClearSales}
              disabled={clearing || !clearPassword}
              className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl active:scale-95"
            >
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
          <p className="text-zinc-600 text-xs text-center">
            Default clear-sales password: clearsales2026
          </p>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 border transition-all hover:scale-[1.02] animate-[fadeIn_0.4s_ease-out] ${
        accent
          ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 border-yellow-300 text-black'
          : 'bg-zinc-900 border-zinc-800 text-white'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={accent ? 'text-black/70' : 'text-yellow-400'}>{icon}</span>
        <span className={`text-sm font-medium ${accent ? 'text-black/70' : 'text-zinc-400'}`}>
          {label}
        </span>
      </div>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}
