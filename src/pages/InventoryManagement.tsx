import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { InventoryItem, AdminTab } from '../types';
import { Plus, Minus, Pencil, Trash2, Search, AlertTriangle, Utensils, Package, Users, BarChart3, Wallet } from 'lucide-react';
import Modal from '../components/Modal';
import ThemeToggle from '../components/ThemeToggle';

interface InventoryManagementProps {
  onLogout: () => void;
  onNavigate: (tab: AdminTab) => void;
  activeTab: AdminTab;
}

interface EditForm {
  name: string;
  unit: string;
  quantity: string;
  low_stock_threshold: string;
}

const emptyForm: EditForm = {
  name: '',
  unit: 'pcs',
  quantity: '',
  low_stock_threshold: '',
};

const UNIT_OPTIONS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'packs', 'boxes'];

export default function InventoryManagement({
  onLogout,
  onNavigate,
  activeTab,
}: InventoryManagementProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setItems(data as InventoryItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      low_stock_threshold: String(item.low_stock_threshold),
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    setError('');
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const qtyNum = parseFloat(form.quantity);
    if (isNaN(qtyNum) || qtyNum < 0) {
      setError('Enter a valid quantity');
      return;
    }
    const thresholdNum = parseFloat(form.low_stock_threshold || '0');
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      setError('Enter a valid low stock threshold');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      unit: form.unit.trim() || 'pcs',
      quantity: qtyNum,
      low_stock_threshold: thresholdNum,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase
        .from('inventory_items')
        .update(payload)
        .eq('id', editing.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('inventory_items').insert(payload);
      if (error) setError(error.message);
    }
    setSaving(false);
    if (!error) {
      setModalOpen(false);
      load();
    }
  }

  async function handleDelete(item: InventoryItem) {
    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
    if (!error) {
      setConfirmDelete(null);
      load();
    }
  }

  async function adjustQuantity(item: InventoryItem, delta: number) {
    const newQty = Math.max(0, item.quantity + delta);
    setAdjusting(item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i)),
    );
    const { error } = await supabase
      .from('inventory_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    setAdjusting(null);
    if (error) {
      console.error(error);
      load();
    }
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStockCount = items.filter((i) => i.quantity <= i.low_stock_threshold).length;

  const step = (unit: string) => (unit === 'kg' || unit === 'ltr' ? 0.5 : 1);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black">
              SMASH <span className="text-yellow-400">DADDY</span>
            </span>
            <span className="text-xs text-zinc-500 hidden sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium"
            >
              Logout
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-none">
          {(
            [
              { key: 'menu', label: 'Menu Management', icon: Utensils },
              { key: 'inventory', label: 'Inventory', icon: Package },
              { key: 'staff', label: 'Staff', icon: Users },
              { key: 'analytics', label: 'Analytics', icon: BarChart3 },
              { key: 'expenses', label: 'Expenses', icon: Wallet },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-yellow-400 text-yellow-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Inventory</h1>
            {lowStockCount > 0 && (
              <p className="text-amber-400 text-sm flex items-center gap-1.5 mt-1">
                <AlertTriangle size={14} />
                {lowStockCount} item{lowStockCount > 1 ? 's' : ''} low on stock
              </p>
            )}
          </div>
          <button
            onClick={openAdd}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-yellow-400/30 active:scale-95"
          >
            <Plus size={18} /> Add Stock Item
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory items..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400/50 outline-none transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p>No inventory items found. Click "Add Stock Item" to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((item) => {
              const isLow = item.quantity <= item.low_stock_threshold;
              return (
                <div
                  key={item.id}
                  className={`group bg-zinc-900 border rounded-xl p-4 transition-all animate-[fadeIn_0.3s_ease-out] ${
                    isLow
                      ? 'border-amber-500/50 hover:border-amber-400/70'
                      : 'border-zinc-800 hover:border-yellow-400/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        Low stock alert at {item.low_stock_threshold} {item.unit}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(item)}
                        className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div>
                      <p
                        className={`text-2xl font-black ${
                          isLow ? 'text-amber-400' : 'text-white'
                        }`}
                      >
                        {item.quantity}{' '}
                        <span className="text-sm font-medium text-zinc-500">{item.unit}</span>
                      </p>
                      {isLow && (
                        <p className="text-amber-400 text-xs flex items-center gap-1 mt-0.5">
                          <AlertTriangle size={12} /> Low stock
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => adjustQuantity(item, -step(item.unit))}
                        disabled={adjusting === item.id || item.quantity <= 0}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 transition-colors active:scale-95"
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        onClick={() => adjustQuantity(item, step(item.unit))}
                        disabled={adjusting === item.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40 transition-colors active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Stock Item' : 'Add Stock Item'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Burger Buns"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white focus:border-yellow-400 outline-none"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Quantity</label>
              <input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Low Stock Alert Threshold</label>
            <input
              type="number"
              step="0.01"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              placeholder="e.g. 10"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
            />
            <p className="text-zinc-600 text-xs mt-1">
              You'll be flagged when quantity drops to or below this amount.
            </p>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Stock Item"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-zinc-300">
            Delete <span className="font-bold text-white">{confirmDelete?.name}</span>? This
            cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 rounded-xl active:scale-95"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
