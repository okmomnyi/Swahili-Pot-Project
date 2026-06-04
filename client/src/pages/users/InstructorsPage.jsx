import { useEffect, useState } from 'react';
import { UserCog, UserPlus, FileDown } from 'lucide-react';
import { getInstructors, createInstructor, toggleInstructor } from '../../api/users';
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InstructorsPage() {
  const { show } = useToast();
  const { user } = useAuth();
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await getInstructors();
      setInstructors(res.data.instructors);
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
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createInstructor({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setModalOpen(false);
      setForm({ name: '', email: '', password: '' });
      setErrors({});
      show('Instructor added');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to add instructor', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle() {
    if (!confirmTarget) return;
    try {
      await toggleInstructor(confirmTarget.id);
      show('Instructor status updated');
      setConfirmTarget(null);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to update', 'error');
    }
  }

  function handleExport() {
    exportTablePdf({
      title: 'Instructors',
      subtitle: `${user.department_name} Department`,
      meta: [`Total: ${instructors.length}`],
      columns: ['#', 'Name', 'Email', 'Status', 'Date Added'],
      rows: instructors.map((u, i) => [
        i + 1,
        u.name,
        u.email,
        u.is_active ? 'Active' : 'Inactive',
        formatDateEAT(u.created_at),
      ]),
      filename: 'instructors',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleExport} disabled={instructors.length === 0}>
          <FileDown size={16} /> Export PDF
        </Button>
        <Button onClick={() => setModalOpen(true)}>
          <UserPlus size={16} /> Add Instructor
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : instructors.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No instructors yet"
          description="Add an instructor to your department."
          action={{ label: 'Add Instructor', onClick: () => setModalOpen(true) }}
        />
      ) : (
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Status</TH>
            <TH>Date Added</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <TBody>
            {instructors.map((u, i) => (
              <TR key={u.id} index={i}>
                <TD className="font-medium">{u.name}</TD>
                <TD>{u.email}</TD>
                <TD>
                  <Badge status={u.is_active ? 'active' : 'inactive'} />
                </TD>
                <TD>{formatDateEAT(u.created_at)}</TD>
                <TD className="text-right">
                  <button
                    onClick={() => setConfirmTarget(u)}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Add instructor modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Instructor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? 'Saving…' : 'Add Instructor'}
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
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
        </form>
      </Modal>

      {/* Toggle confirmation */}
      <Modal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={confirmTarget?.is_active ? 'Deactivate Instructor' : 'Activate Instructor'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmTarget?.is_active ? 'danger' : 'primary'}
              onClick={handleToggle}
            >
              {confirmTarget?.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          {confirmTarget?.is_active
            ? `Deactivate ${confirmTarget?.name}? They will no longer be able to sign in.`
            : `Activate ${confirmTarget?.name}? They will regain access to the system.`}
        </p>
      </Modal>
    </div>
  );
}
