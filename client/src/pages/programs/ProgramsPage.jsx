import { useEffect, useState } from 'react';
import { Layers, Plus, Pencil, Users } from 'lucide-react';
import {
  getPrograms,
  createProgram,
  updateProgram,
  getProgramEnrollments,
  enrollTrainees,
  removeEnrollment,
} from '../../api/programs';
import { getTrainees } from '../../api/trainees';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';

function dateRange(start, end) {
  const s = formatEAT(start, 'MMM yyyy');
  return end ? `${s} – ${formatEAT(end, 'MMM yyyy')}` : `${s} – Ongoing`;
}

const EMPTY = { name: '', description: '', start_date: '', end_date: '' };

export default function ProgramsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const isSupervisor = user.role === 'supervisor';

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // Enrollment modal
  const [enrollProgram, setEnrollProgram] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [selected, setSelected] = useState([]);
  const [enrollLoading, setEnrollLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getPrograms();
      setPrograms(res.data.programs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      start_date: p.start_date ? formatEAT(p.start_date, 'yyyy-MM-dd') : '',
      end_date: p.end_date ? formatEAT(p.end_date, 'yyyy-MM-dd') : '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.start_date) {
      show('Name and start date are required', 'error');
      return;
    }
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
    };
    try {
      if (editing) {
        await updateProgram(editing.id, payload);
        show('Program updated');
      } else {
        await createProgram(payload);
        show('Program created');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function openEnroll(p) {
    setEnrollProgram(p);
    setSelected([]);
    setEnrollLoading(true);
    try {
      const [enr, tr] = await Promise.all([getProgramEnrollments(p.id), getTrainees()]);
      setEnrollments(enr.data.enrollments);
      setTrainees(tr.data.trainees.filter((t) => t.is_active));
    } catch (err) {
      show(err.response?.data?.error || 'Failed to load enrollments', 'error');
    } finally {
      setEnrollLoading(false);
    }
  }

  async function refreshEnrollments() {
    const enr = await getProgramEnrollments(enrollProgram.id);
    setEnrollments(enr.data.enrollments);
  }

  async function handleEnroll() {
    if (selected.length === 0) return;
    try {
      await enrollTrainees(enrollProgram.id, selected);
      setSelected([]);
      await refreshEnrollments();
      await load();
      show('Trainees enrolled');
    } catch (err) {
      show(err.response?.data?.error || 'Failed to enroll', 'error');
    }
  }

  async function handleRemove(traineeId) {
    try {
      await removeEnrollment(enrollProgram.id, traineeId);
      await refreshEnrollments();
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to remove', 'error');
    }
  }

  const enrolledIds = new Set(enrollments.map((e) => e.trainee_id));
  const available = trainees.filter((t) => !enrolledIds.has(t.id));

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">Programs / Cohorts</h2>
        {isSupervisor && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Create Program
          </Button>
        )}
      </div>

      {programs.length === 0 ? (
        <EmptyState icon={Layers} title="No programs yet" description="Create a program to group attachees into cohorts." />
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-ink">{p.name}</h3>
                    <Badge variant={p.is_active ? 'green' : 'gray'}>{p.is_active ? 'Active' : 'Ended'}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-subtle">{dateRange(p.start_date, p.end_date)}</p>
                  {p.description && (
                    <p className="mt-2 text-sm text-ink">
                      {expanded[p.id] || p.description.length <= 100
                        ? p.description
                        : `${p.description.slice(0, 100)}… `}
                      {p.description.length > 100 && !expanded[p.id] && (
                        <button className="text-brand-600 underline" onClick={() => setExpanded((o) => ({ ...o, [p.id]: true }))}>
                          read more
                        </button>
                      )}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-subtle">{p.enrolled_count} attachees enrolled</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => openEnroll(p)}>
                  <Users size={14} /> Manage Enrollments
                </Button>
                {isSupervisor && (
                  <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => openEdit(p)}>
                    <Pencil size={14} /> Edit
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Program' : 'Create Program'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <Input label="End Date (optional)" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </form>
      </Modal>

      {/* Manage Enrollments modal */}
      <Modal
        isOpen={!!enrollProgram}
        onClose={() => setEnrollProgram(null)}
        title={`Enrollments — ${enrollProgram?.name || ''}`}
        footer={<Button variant="secondary" onClick={() => setEnrollProgram(null)}>Done</Button>}
      >
        {enrollLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Enrolled ({enrollments.length})</p>
              {enrollments.length === 0 ? (
                <p className="text-xs text-subtle">No trainees enrolled yet.</p>
              ) : (
                <div className="space-y-1">
                  {enrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-sm">
                      <span className="text-ink">{e.name} <span className="text-subtle">· {e.phone}</span></span>
                      {isSupervisor && (
                        <button className="text-xs text-[#dc2626] hover:underline" onClick={() => handleRemove(e.trainee_id)}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Add Trainees</p>
              {available.length === 0 ? (
                <p className="text-xs text-subtle">All active trainees are already enrolled.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                  {available.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 px-1 py-1 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={selected.includes(t.id)}
                        onChange={(e) =>
                          setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))
                        }
                      />
                      {t.name} <span className="text-subtle">· {t.phone}</span>
                    </label>
                  ))}
                </div>
              )}
              <Button className="mt-3" onClick={handleEnroll} disabled={selected.length === 0}>
                Enroll Selected ({selected.length})
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
