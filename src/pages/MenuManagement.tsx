import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MenuItem, InventoryItem } from '../types';
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react';
import Modal from '../components/Modal';
import { formatPKR } from '../lib/format';

type AdminTab = 'menu' | 'inventory' | 'analytics' | 'staff';

interface MenuManagementProps {
  onLogout: () => void;
  onNavigate: (tab: AdminTab) => void;
  activeTab: AdminTab;
}

interface EditIngredient {
  inventory_item_id: string;
  quantity_required: number;
}

interface EditForm {
  name: string;
  category: string;
  price: string;
  description: string;
  is_available: boolean;
  ingredients: EditIngredient[];
}

const emptyForm: EditForm = {
  name: '',
  category: 'General',
  price: '',
  description: '',
  is_available: true,
  ingredients: [],
};

export default function MenuManagement({ onLogout, onNavigate, activeTab }: MenuManagementProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const loadInventory = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });
    if (!error && data) {
      setInventoryItems(data as InventoryItem[]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setItems(data as MenuItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    loadInventory();
  }, [load, loadInventory]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  async function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      description: item.description ?? '',
      is_available: item.is_available,
      ingredients: [],
    });
    setError('');
    setModalOpen(true);

    const { data, error: ingErr } = await supabase
      .from('menu_item_ingredients')
      .select('*')
      .eq('menu_item_id', item.id);

    if (!ingErr && data) {
      const mapped = data.map((ing) => ({
        inventory_item_id: ing.inventory_item_id,
        quantity_required: Number(ing.quantity_required) || 1,
      }));
      setForm((prev) => ({ ...prev, ingredients: mapped }));
    }
  }

  function addIngredientRow() {
    if (inventoryItems.length === 0) return;
    const selectedIds = new Set(form.ingredients.map((i) => i.inventory_item_id));
    const available = inventoryItems.find((i) => !selectedIds.has(i.id)) || inventoryItems[0];
    setForm((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { inventory_item_id: available.id, quantity_required: 1 },
      ],
    }));
  }

  function updateIngredientRow(index: number, field: keyof EditIngredient, value: any) {
    setForm((prev) => {
      const next = [...prev.ingredients];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, ingredients: next };
    });
  }

  function removeIngredientRow(index: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function handleSave() {
    setError('');
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Enter a valid price');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || 'General',
      price: priceNum,
      description: form.description.trim() || null,
      is_available: form.is_available,
    };

    let savedItemId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('menu_items').update(payload).eq('id', editing.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase.from('menu_items').insert(payload).select().single();
      if (error || !data) {
        setError(error ? error.message : 'Failed to save menu item');
        setSaving(false);
        return;
      }
      savedItemId = data.id;
    }

    if (savedItemId) {
      await supabase
        .from('menu_item_ingredients')
        .delete()
        .eq('menu_item_id', savedItemId);

      if (form.ingredients.length > 0) {
        const ingredientsPayload = form.ingredients.map((ing) => ({
          menu_item_id: savedItemId,
          inventory_item_id: ing.inventory_item_id,
          quantity_required: ing.quantity_required,
        }));
        const { error: ingInsErr } = await supabase
          .from('menu_item_ingredients')
          .insert(ingredientsPayload);

        if (ingInsErr) {
          console.warn('Failed to insert ingredients:', ingInsErr);
        }
      }
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(item: MenuItem) {
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (!error) {
      setConfirmDelete(null);
      load();
    }
  }

  async function toggleAvailability(item: MenuItem) {
    await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);
    load();
  }

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()),
  );

  const categories = [...new Set(items.map((i) => i.category))].sort();

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
          <button
            onClick={onLogout}
            className="text-sm text-zinc-400 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
        {/* Tabs */}
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
          <h1 className="text-2xl font-bold">Menu Management</h1>
          <button
            onClick={openAdd}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-yellow-400/30 active:scale-95"
          >
            <Plus size={18} /> Add Item
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu items..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400/50 outline-none transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p>No menu items found. Click "Add Item" to create one.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((cat) => {
              const catItems = filtered.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;
              return (
                <div key={cat}>
                  <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">
                    {cat}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className="group bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-yellow-400/40 transition-all animate-[fadeIn_0.3s_ease-out]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{item.name}</h3>
                            <p className="text-yellow-400 font-bold mt-0.5">
                              {formatPKR(item.price)}
                            </p>
                            {item.description && (
                              <p className="text-zinc-500 text-sm mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
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
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={`mt-3 w-full text-xs font-medium py-1.5 rounded-lg transition-colors ${
                            item.is_available
                              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                              : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                          }`}
                        >
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </button>
                      </div>
                    ))}
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
        title={editing ? 'Edit Item' : 'Add Menu Item'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Triple Smash Burger"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Burgers"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Price (Rs.)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
              className="w-4 h-4 accent-yellow-400"
            />
            <span className="text-sm text-zinc-300">Available for ordering</span>
          </label>

          {/* Linked Inventory Items / Recipe Ingredients */}
          <div className="border-t border-zinc-800 pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} className="text-yellow-400" /> Linked Inventory Items
                </label>
                <p className="text-[11px] text-zinc-500">
                  Select items from inventory consumed when 1 unit of this product is served.
                </p>
              </div>
              {inventoryItems.length > 0 && (
                <button
                  type="button"
                  onClick={addIngredientRow}
                  className="text-xs text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1 bg-yellow-400/10 px-2.5 py-1 rounded-lg border border-yellow-400/20 transition-all"
                >
                  <Plus size={14} /> Add Item
                </button>
              )}
            </div>

            {inventoryItems.length === 0 ? (
              <p className="text-xs text-zinc-500 italic bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                No inventory items found. Please create items in the Inventory tab first.
              </p>
            ) : form.ingredients.length === 0 ? (
              <p className="text-xs text-zinc-500 italic bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-center py-3">
                No inventory items linked yet. Click "Add Item" to link ingredients (e.g. buns, patties, sauce).
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {form.ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-xs"
                  >
                    <select
                      value={ing.inventory_item_id}
                      onChange={(e) => updateIngredientRow(idx, 'inventory_item_id', e.target.value)}
                      className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2.5 py-1.5 focus:border-yellow-400 outline-none truncate"
                    >
                      {inventoryItems.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name} ({inv.unit})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 w-28 shrink-0">
                      <span className="text-zinc-500 text-[11px]">Qty:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={ing.quantity_required}
                        onChange={(e) =>
                          updateIngredientRow(
                            idx,
                            'quantity_required',
                            Math.max(0.01, parseFloat(e.target.value) || 1),
                          )
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold rounded-lg px-2 py-1.5 text-center focus:border-yellow-400 outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeIngredientRow(idx)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                      title="Remove ingredient"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
        title="Delete Item"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-zinc-300">
            Delete <span className="font-bold text-white">{confirmDelete?.name}</span>? This cannot be
            undone.
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
