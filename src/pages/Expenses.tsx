import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense, Order, AdminTab } from '../types';
import { formatPKR, formatDateTime } from '../lib/format';
import {
  Wallet,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  Search,
  TrendingDown,
  TrendingUp,
  Receipt,
  Tag,
  DollarSign,
  PieChart as PieChartIcon,
  AlertTriangle,
} from 'lucide-react';
import Modal from '../components/Modal';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

interface ExpensesProps {
  onLogout: () => void;
  onNavigate: (tab: AdminTab) => void;
  activeTab: AdminTab;
}

const CATEGORIES = [
  'Ingredients',
  'Utilities',
  'Rent',
  'Salaries',
  'Supplies & Packaging',
  'Maintenance & Repairs',
  'Marketing',
  'Miscellaneous',
];

export default function Expenses({ onLogout, onNavigate, activeTab }: ExpensesProps) {
  const [period, setPeriod] = useState<Period>('day');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and category filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: '',
    category: 'Ingredients',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().slice(0, 16),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: expData } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    setExpenses((expData as Expense[]) ?? []);
    setOrders((orderData as Order[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Business day start calculation matching Analytics tab (2:00 AM cutoff)
  function getStartOfPeriod(p: Period, currentTime: Date): Date {
    const baseDate = new Date(currentTime);
    if (currentTime.getHours() < 2) {
      baseDate.setDate(baseDate.getDate() - 1);
    }

    if (p === 'day') {
      baseDate.setHours(2, 0, 0, 0);
    } else if (p === 'week') {
      const day = baseDate.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday start
      baseDate.setDate(baseDate.getDate() - diff);
      baseDate.setHours(2, 0, 0, 0);
    } else if (p === 'month') {
      baseDate.setDate(1);
      baseDate.setHours(2, 0, 0, 0);
    } else {
      baseDate.setMonth(0, 1);
      baseDate.setHours(2, 0, 0, 0);
    }
    return baseDate;
  }

  // Filter expenses and orders based on period
  const now = new Date();
  let periodExpenses: Expense[] = [];
  let periodOrders: Order[] = [];

  if (period === 'custom') {
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 2, 0, 0, 0);

    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay + 1, 1, 59, 59, 999);

    periodExpenses = expenses.filter((e) => {
      const expDate = new Date(e.expense_date);
      return expDate >= start && expDate <= end;
    });

    periodOrders = orders.filter((o) => {
      const created = new Date(o.created_at);
      return created >= start && created <= end;
    });
  } else {
    const periodStart = getStartOfPeriod(period, now);
    periodExpenses = expenses.filter((e) => new Date(e.expense_date) >= periodStart);
    periodOrders = orders.filter((o) => new Date(o.created_at) >= periodStart);
  }

  // Revenue calculation for comparison (Only Served orders)
  const servedOrders = periodOrders.filter((o) => !o.status || o.status === 'Served');
  const totalRevenue = servedOrders.reduce((s, o) => s + Number(o.total_amount), 0);

  // Total Expenses calculation
  const totalExpenses = periodExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

  // Apply search and category filter to displayed table list
  const filteredExpenses = periodExpenses.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Category breakdown stats
  const categoryTotals = new Map<string, number>();
  for (const exp of periodExpenses) {
    const current = categoryTotals.get(exp.category) || 0;
    categoryTotals.set(exp.category, current + Number(exp.amount));
  }

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Open modal for add
  function openAddModal() {
    setEditingExpense(null);
    setForm({
      title: '',
      category: 'Ingredients',
      amount: '',
      description: '',
      expense_date: new Date().toISOString().slice(0, 16),
    });
    setModalOpen(true);
  }

  // Open modal for edit
  function openEditModal(expense: Expense) {
    setEditingExpense(expense);
    const d = new Date(expense.expense_date);
    // Format to YYYY-MM-THH:mm for datetime-local input
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setForm({
      title: expense.title,
      category: expense.category || 'General',
      amount: expense.amount.toString(),
      description: expense.description || '',
      expense_date: localIso,
    });
    setModalOpen(true);
  }

  // Save Expense (Add or Update)
  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.amount || Number(form.amount) <= 0) return;

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category,
      amount: Number(form.amount),
      description: form.description.trim() || null,
      expense_date: new Date(form.expense_date).toISOString(),
    };

    if (editingExpense) {
      await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
    } else {
      await supabase.from('expenses').insert(payload);
    }

    setSaving(false);
    setModalOpen(false);
    loadData();
  }

  // Delete Expense
  async function handleDeleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id);
    setConfirmDelete(null);
    loadData();
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
      {/* Header Navigation */}
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
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-none">
          {(
            [
              { key: 'menu', label: 'Menu Management' },
              { key: 'inventory', label: 'Inventory' },
              { key: 'staff', label: 'Staff' },
              { key: 'analytics', label: 'Analytics' },
              { key: 'expenses', label: 'Expenses' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
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
        {/* Title and Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="text-yellow-400" size={26} />
              Expense Tracking
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Monitor, categorize and control business expenditures for{' '}
              <span className="text-yellow-400 font-medium">{periodLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-zinc-950 font-bold rounded-xl hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/10 text-sm"
            >
              <Plus size={18} />
              Add Expense
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {(
              [
                { id: 'day', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'year', label: 'This Year' },
                { id: 'custom', label: 'Custom Range' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  period === p.id
                    ? 'bg-yellow-400 text-zinc-950 shadow'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar size={16} className="text-yellow-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-yellow-400"
              />
              <span className="text-zinc-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
          )}
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total Expenses */}
          <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Total Expenses</span>
              <div className="p-2 bg-red-500/10 text-red-400 rounded-xl">
                <TrendingDown size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-red-400 mt-2">
              {loading ? '...' : formatPKR(totalExpenses)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {periodExpenses.length} transaction records
            </p>
          </div>

          {/* Card 2: Total Revenue (for context) */}
          <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Total Revenue</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <TrendingUp size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-400 mt-2">
              {loading ? '...' : formatPKR(totalRevenue)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {servedOrders.length} served orders
            </p>
          </div>

          {/* Card 3: Net Profit */}
          <div
            className={`bg-zinc-900 border rounded-2xl p-4 relative overflow-hidden ${
              netProfit >= 0 ? 'border-yellow-400/30' : 'border-red-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Net Profit / Loss</span>
              <div
                className={`p-2 rounded-xl ${
                  netProfit >= 0
                    ? 'bg-yellow-400/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                <DollarSign size={18} />
              </div>
            </div>
            <p
              className={`text-2xl font-black mt-2 ${
                netProfit >= 0 ? 'text-yellow-400' : 'text-red-400'
              }`}
            >
              {loading ? '...' : formatPKR(netProfit)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Margin:{' '}
              <span
                className={`font-semibold ${
                  Number(profitMargin) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {profitMargin}%
              </span>
            </p>
          </div>

          {/* Card 4: Average Expense */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Avg Expense / Item</span>
              <div className="p-2 bg-zinc-800 text-zinc-400 rounded-xl">
                <Receipt size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-zinc-200 mt-2">
              {loading
                ? '...'
                : formatPKR(
                    periodExpenses.length > 0 ? totalExpenses / periodExpenses.length : 0
                  )}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">Per recorded voucher</p>
          </div>
        </div>

        {/* Category Breakdown Section */}
        {categoryBreakdown.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
              <PieChartIcon size={18} className="text-yellow-400" />
              Expense Distribution by Category
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-300">{item.category}</span>
                    <span className="text-zinc-400 font-mono">
                      {formatPKR(item.amount)}{' '}
                      <span className="text-zinc-500 text-[10px]">
                        ({item.percentage.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-yellow-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Search title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Tag size={16} className="text-zinc-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-400 w-full sm:w-auto"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expense List Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200">
              Recorded Expenses ({filteredExpenses.length})
            </h2>
            <span className="text-xs text-zinc-500">
              Showing expenses for {periodLabel}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">
              Loading expense records...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">
              No expense records found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/50 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Date & Time</th>
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-xs">
                  {filteredExpenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="hover:bg-zinc-800/40 transition-colors group"
                    >
                      <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                        {formatDateTime(exp.expense_date)}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {exp.title}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400 max-w-xs truncate">
                        {exp.description || <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-red-400 font-mono text-sm">
                        {formatPKR(exp.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(exp)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800 transition-colors"
                            title="Edit Expense"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(exp)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Expense Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingExpense ? 'Edit Expense Record' : 'Add New Expense'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Expense Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Gas Cylinder, Fresh Vegetables, Electricity Bill"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Price / Amount (PKR) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400 font-mono"
              />
            </div>
          </div>

          {/* Quick preset category pills */}
          <div>
            <span className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Quick Categories:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    form.category === cat
                      ? 'bg-yellow-400 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Description <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Add extra details, vendor name, or invoice numbers..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-yellow-400 text-zinc-950 font-bold rounded-xl hover:bg-yellow-300 transition-colors text-xs shadow-lg shadow-yellow-400/10 disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editingExpense
                ? 'Update Expense'
                : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Expense Deletion"
        maxWidth="max-w-sm"
      >
        {confirmDelete && (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-red-500/10 text-red-400 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Delete "{confirmDelete.title}"?
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                This will remove the expense entry of{' '}
                <span className="text-red-400 font-bold">
                  {formatPKR(confirmDelete.amount)}
                </span>{' '}
                permanently.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteExpense(confirmDelete.id)}
                className="px-5 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-xs"
              >
                Delete Expense
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
