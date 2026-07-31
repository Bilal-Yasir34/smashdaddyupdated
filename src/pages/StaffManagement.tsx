import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Staff, AdminTab } from '../types';
import { Plus, Pencil, Trash2, Search, Phone, CreditCard, Calendar, Utensils, Package, Users, BarChart3, Wallet } from 'lucide-react';
import Modal from '../components/Modal';
import ThemeToggle from '../components/ThemeToggle';
import { formatPKR, formatDate } from '../lib/format';

interface StaffManagementProps {
  onLogout: () => void;
  onNavigate: (tab: AdminTab) => void;
  activeTab: AdminTab;
}

interface EditForm {
  name: string;
  cnic: string;
  phone: string;
  position: string;
  salary: string;
  joining_date: string;
  address: string;
  status: 'active' | 'inactive';
  notes: string;
}

const emptyForm: EditForm = {
  name: '',
  cnic: '',
  phone: '',
  position: '',
  salary: '',
  joining_date: new Date().toISOString().slice(0, 10),
  address: '',
  status: 'active',
  notes: '',
};

const POSITION_OPTIONS = [
  'Cashier',
  'Chef',
  'Kitchen Staff',
  'Delivery Rider',
  'Waiter',
  'Manager',
  'Cleaner',
  'Other',
];

// Formats digits into Pakistani CNIC pattern: 12345-1234567-1
function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  const p1 = digits.slice(0, 5);
  const p2 = digits.slice(5, 12);
  const p3 = digits.slice(12, 13);
  return [p1, p2, p3].filter(Boolean).join('-');
}

export default function StaffManagement({ onLogout, onNavigate, activeTab }: StaffManagementProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setStaff(data as Staff[]);
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

  function openEdit(member: Staff) {
    setEditing(member);
    setForm({
      name: member.name,
      cnic: member.cnic,
      phone: member.phone,
      position: member.position,
      salary: String(member.salary),
      joining_date: member.joining_date,
      address: member.address ?? '',
      status: member.status,
      notes: member.notes ?? '',
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
    const cnicDigits = form.cnic.replace(/\D/g, '');
    if (cnicDigits.length !== 13) {
      setError('Enter a valid 13-digit CNIC');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    const salaryNum = parseFloat(form.salary);
    if (isNaN(salaryNum) || salaryNum < 0) {
      setError('Enter a valid salary');
      return;
    }
    if (!form.joining_date) {
      setError('Joining date is required');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      cnic: formatCnic(form.cnic),
      phone: form.phone.trim(),
      position: form.position.trim() || 'Staff',
      salary: salaryNum,
      joining_date: form.joining_date,
      address: form.address.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from('staff').update(payload).eq('id', editing.id);
      if (error) setError(error.message.includes('duplicate') ? 'A staff member with this CNIC already exists' : error.message);
    } else {
      const { error } = await supabase.from('staff').insert(payload);
      if (error) setError(error.message.includes('duplicate') ? 'A staff member with this CNIC already exists' : error.message);
    }
    setSaving(false);
    if (!error) {
      setModalOpen(false);
      load();
    }
  }

  async function handleDelete(member: Staff) {
    const { error } = await supabase.from('staff').delete().eq('id', member.id);
    if (!error) {
      setConfirmDelete(null);
      load();
    }
  }

  const filtered = staff.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.cnic.includes(search) ||
      s.phone.includes(search) ||
      s.position.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = staff.filter((s) => s.status === 'active').length;
  const totalMonthlySalary = staff
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + s.salary, 0);

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
            <h1 className="text-2xl font-bold">Staff</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {activeCount} active staff member{activeCount === 1 ? '' : 's'} &middot; Monthly payroll{' '}
              <span className="text-yellow-400 font-semibold">{formatPKR(totalMonthlySalary)}</span>
            </p>
          </div>
          <button
            onClick={openAdd}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-yellow-400/30 active:scale-95"
          >
            <Plus size={18} /> Add Staff Member
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, CNIC, phone, or position..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400/50 outline-none transition-all"
            />
          </div>
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-yellow-400 text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p>No staff members found. Click "Add Staff Member" to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((member) => (
              <div
                key={member.id}
                className={`group bg-zinc-900 border rounded-xl p-4 transition-all animate-[fadeIn_0.3s_ease-out] ${
                  member.status === 'inactive'
                    ? 'border-zinc-800 opacity-60'
                    : 'border-zinc-800 hover:border-yellow-400/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{member.name}</h3>
                    <p className="text-zinc-500 text-xs mt-0.5">{member.position}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => openEdit(member)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-700 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(member)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-zinc-600 shrink-0" />
                    <span className="truncate">{member.cnic}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-zinc-600 shrink-0" />
                    <span className="truncate">{member.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-zinc-600 shrink-0" />
                    <span className="truncate">Joined {formatDate(member.joining_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet size={14} className="text-zinc-600 shrink-0" />
                    <span className="text-yellow-400 font-semibold">{formatPKR(member.salary)}/mo</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      member.status === 'active'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-zinc-700/50 text-zinc-400'
                    }`}
                  >
                    {member.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Staff Member' : 'Add Staff Member'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Full Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ahmed Raza"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">CNIC</label>
              <input
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: formatCnic(e.target.value) })}
                placeholder="12345-1234567-1"
                inputMode="numeric"
                maxLength={15}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="03xx-xxxxxxx"
                inputMode="tel"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Position</label>
              <select
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white focus:border-yellow-400 outline-none"
              >
                <option value="">Select position</option>
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white focus:border-yellow-400 outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Salary (PKR / month)</label>
              <input
                type="number"
                step="0.01"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                placeholder="e.g. 35000"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1.5">Joining Date</label>
              <input
                type="date"
                value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white focus:border-yellow-400 outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Address (optional)</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g. Model Town, Gujrat"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes about this staff member..."
              rows={2}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-600 focus:border-yellow-400 outline-none resize-none"
            />
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
        title="Delete Staff Member"
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
