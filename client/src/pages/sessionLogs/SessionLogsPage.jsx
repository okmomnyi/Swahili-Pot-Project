import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getSessionLogs,
  createSessionLog,
  updateSessionLog,
  deleteSessionLog,
} from '../../api/sessionLogs';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

// Last 6 months as { value: 'YYYY-MM', label: 'June 2024' }.
function lastSixMonths() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: formatEAT(d, 'MMMM yyyy') });
  }
  return out;
}

const todayStr = () => formatEAT(new Date(), 'yyyy-MM-dd');
const EMPTY = () => ({
  session_date: todayStr(),
  topics_covered: '',
  challenges: '',
  next_session_plan: '',
  attendance_count: '',
});

function LogCard({ log, isInstructor, onEdit, onDelete }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink">
            {formatEAT(log.session_date, 'EEEE, dd MMMM yyyy')}
          </h3>
          {!isInstructor && <p className="text-sm text-subtle">{log.instructor_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          {log.attendance_count != null && (
            <span className="rounded-full bg-accentSoft px-2.5 py-0.5 text-xs font-medium text-brand-600">
              {log.attendance_count} attended
            </span>
          )}
          {isInstructor && (
            <>
              <button className="text-subtle hover:text-brand-600" onClick={() => onEdit(log)} aria-label="Edit">
                <Pencil size={16} />
              </button>
              <button className="text-[#dc2626] hover:opacity-80" onClick={() => onDelete(log)} aria-label="Delete">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="font-medium text-ink">Topics Covered</p>
          <p className="mt-0.5 whitespace-pre-wrap text-subtle">{log.topics_covered}</p>
        </div>
        {log.challenges && (
          <div>
            <p className="font-medium text-ink">Challenges</p>
            <p className="mt-0.5 whitespace-pre-wrap text-subtle">{log.challenges}</p>
          </div>
        )}
        {log.next_session_plan && (
          <div>
            <p className="font-medium text-ink">Next Session Plan</p>
            <p className="mt-0.5 whitespace-pre-wrap text-subtle">{log.next_session_plan}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SessionLogsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const isInstructor = user.role === 'instructor';
  const months = useMemo(lastSixMonths, []);

  const [month, setMonth] = useState(months[0].value);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instructorFilter, setInstructorFilter] = useState('all');
  const [instructors, setInstructors] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await getSessionLogs({ month });
      setLogs(res.data.logs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Build instructor filter options from loaded logs (supervisor view).
  useEffect(() => {
    if (isInstructor) return;
    const map = new Map();
    logs.forEach((l) => map.set(l.instructor_id, l.instructor_name));
    setInstructors([...map.entries()].map(([id, name]) => ({ id, name })));
  }, [logs, isInstructor]);

  const hasTodayLog = isInstructor && logs.some((l) => formatEAT(l.session_date, 'yyyy-MM-dd') === todayStr());

  const visible =
    isInstructor || instructorFilter === 'all'
      ? logs
      : logs.filter((l) => String(l.instructor_id) === String(instructorFilter));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY());
    setModalOpen(true);
  }

  function openEdit(log) {
    setEditing(log);
    setForm({
      session_date: formatEAT(log.session_date, 'yyyy-MM-dd'),
      topics_covered: log.topics_covered,
      challenges: log.challenges || '',
      next_session_plan: log.next_session_plan || '',
      attendance_count: log.attendance_count != null ? String(log.attendance_count) : '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.session_date || !form.topics_covered.trim()) {
      show('Session date and topics covered are required', 'error');
      return;
    }
    setSubmitting(true);
    const payload = {
      topics_covered: form.topics_covered.trim(),
      challenges: form.challenges.trim() || null,
      next_session_plan: form.next_session_plan.trim() || null,
      attendance_count: form.attendance_count === '' ? null : Number(form.attendance_count),
    };
    try {
      if (editing) {
        await updateSessionLog(editing.id, payload);
        show('Log updated');
      } else {
        await createSessionLog({ ...payload, session_date: form.session_date });
        show('Log saved');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSessionLog(deleteTarget.id);
      show('Log deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to delete', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Session Logs</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-44">
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          {!isInstructor && instructors.length > 0 && (
            <Select
              value={instructorFilter}
              onChange={(e) => setInstructorFilter(e.target.value)}
              className="w-48"
            >
              <option value="all">All Instructors</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </Select>
          )}
          {isInstructor && (
            <Button onClick={openCreate} disabled={hasTodayLog} title={hasTodayLog ? 'Log already written' : ''}>
              <Plus size={16} /> Write Today&apos;s Log
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState icon={BookOpen} title="No session logs" description="No logs for the selected filters." />
      ) : (
        <div className="space-y-3">
          {visible.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              isInstructor={isInstructor}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Session Log' : "Write Session Log"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Log'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Session Date"
            type="date"
            value={form.session_date}
            disabled={!!editing}
            onChange={(e) => setForm({ ...form, session_date: e.target.value })}
          />
          <Textarea
            label="Topics Covered"
            value={form.topics_covered}
            onChange={(e) => setForm({ ...form, topics_covered: e.target.value })}
          />
          <Textarea
            label="Challenges (optional)"
            value={form.challenges}
            onChange={(e) => setForm({ ...form, challenges: e.target.value })}
          />
          <Textarea
            label="Next Session Plan (optional)"
            value={form.next_session_plan}
            onChange={(e) => setForm({ ...form, next_session_plan: e.target.value })}
          />
          <Input
            label="Attendance Count (optional)"
            type="number"
            min="0"
            value={form.attendance_count}
            onChange={(e) => setForm({ ...form, attendance_count: e.target.value })}
          />
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Log"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink">Delete this session log? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
