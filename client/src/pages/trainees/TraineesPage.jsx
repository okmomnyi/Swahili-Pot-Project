import { useEffect, useState } from 'react';
import { UserPlus, Users, Trash2, FileDown, Upload } from 'lucide-react';
import { getTrainees, createTrainee, deactivateTrainee } from '../../api/trainees';
import BulkImportModal from '../../components/trainees/BulkImportModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatDateEAT } from '../../lib/datetime';
import { exportTablePdf } from '../../lib/pdf';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const KENYAN_PHONE_RE = /^0(7|1)\d{8}$/;

export default function TraineesPage() {
  const { show } = useToast();
  const { user } = useAuth();
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getTrainees();
      setTrainees(res.data.trainees);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    else if (!KENYAN_PHONE_RE.test(form.phone.trim()))
      e.phone = 'Enter a valid Kenyan number (e.g. 0712345678)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createTrainee({ name: form.name.trim(), phone: form.phone.trim() });
      setModalOpen(false);
      setForm({ name: '', phone: '' });
      setErrors({});
      show('Trainee added');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to add trainee', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!confirmTarget) return;
    try {
      await deactivateTrainee(confirmTarget.id);
      show('Trainee deactivated');
      setConfirmTarget(null);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to deactivate', 'error');
    }
  }

  const visible = trainees.filter((t) => (showInactive ? true : t.is_active));

  function handleExport() {
    exportTablePdf({
      title: 'Trainees',
      subtitle: `${user.department_name} Department`,
      meta: [`Total: ${visible.length}`],
      columns: ['#', 'Name', 'Phone', 'Date Added', 'Status'],
      rows: visible.map((t, i) => [
        i + 1,
        t.name,
        t.phone,
        formatDateEAT(t.created_at),
        t.is_active ? 'Active' : 'Inactive',
      ]),
      filename: 'trainees',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-200"
          />
          Show deactivated
        </label>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={visible.length === 0}>
            <FileDown size={16} /> Export PDF
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> Import CSV
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <UserPlus size={16} /> Add Trainee
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No trainees yet"
          description="Add your first trainee to get started."
          action={{ label: 'Add Trainee', onClick: () => setModalOpen(true) }}
        />
      ) : (
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Phone Number</TH>
            <TH>Date Added</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <TBody>
            {visible.map((t, i) => (
              <TR key={t.id} index={i}>
                <TD className="font-medium">{t.name}</TD>
                <TD>{t.phone}</TD>
                <TD>{formatDateEAT(t.created_at)}</TD>
                <TD>
                  <Badge status={t.is_active ? 'active' : 'inactive'} />
                </TD>
                <TD className="text-right">
                  {t.is_active && (
                    <button
                      onClick={() => setConfirmTarget(t)}
                      className="inline-flex items-center gap-1 text-sm text-[#dc2626] hover:underline"
                    >
                      <Trash2 size={14} /> Deactivate
                    </button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Add trainee modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Trainee"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? 'Saving…' : 'Add Trainee'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAdd} className="space-y-4" noValidate>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />
          <Input
            label="Phone Number"
            placeholder="0712345678"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            error={errors.phone}
          />
        </form>
      </Modal>

      {/* Deactivate confirmation */}
      <Modal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Deactivate Trainee"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeactivate}>
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Are you sure you want to deactivate{' '}
          <span className="font-medium">{confirmTarget?.name}</span>? They will be hidden from the
          active list.
        </p>
      </Modal>

      <BulkImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
    </div>
  );
}
