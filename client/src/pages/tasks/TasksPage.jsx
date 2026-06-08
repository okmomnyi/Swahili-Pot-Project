import { useEffect, useState } from 'react';
import { ListTodo, Plus, FileDown, MessageSquare } from 'lucide-react';
import { getTasks, createTask, updateTaskStatus, reviewTask } from '../../api/tasks';
import { getDeptAttachees } from '../../api/attachee';
import { getPrograms } from '../../api/programs';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatDateEAT, formatEAT } from '../../lib/datetime';
import { exportTablePdf } from '../../lib/pdf';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import TaskComments from '../../components/tasks/TaskComments';

// Treat the legacy 'open' state as 'pending' for display/filtering.
const norm = (s) => (s === 'open' ? 'pending' : s);
const TASK_VARIANT = {
  pending: 'gray',
  in_progress: 'blue',
  submitted: 'amber',
  reviewed: 'green',
  completed: 'green',
};
const label = (s) => norm(s).replace('_', ' ');

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewed', label: 'Reviewed' },
];

// Valid next status an attachee may set (norm'd current → next).
const NEXT_STATUS = { pending: 'in_progress', in_progress: 'submitted' };

export default function TasksPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const isStaff = user.role === 'instructor' || user.role === 'supervisor';

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [openComments, setOpenComments] = useState({});

  const [attachees, setAttachees] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ assigned_to: '', title: '', description: '', priority: 'medium', due_date: '', program_id: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Review modal (staff)
  const [reviewTarget, setReviewTarget] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [reviewing, setReviewing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getTasks();
      setTasks(res.data.tasks);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (isStaff) {
      getDeptAttachees().then((res) => setAttachees(res.data.attachees)).catch(() => {});
      getPrograms().then((res) => setPrograms(res.data.programs.filter((p) => p.is_active))).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    const e = {};
    if (!form.assigned_to) e.assigned_to = 'Select an attachee';
    if (!form.title.trim()) e.title = 'Title is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createTask({
        assigned_to: form.assigned_to,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        due_date: form.due_date || null,
        program_id: form.program_id || null,
      });
      setModalOpen(false);
      setForm({ assigned_to: '', title: '', description: '', priority: 'medium', due_date: '', program_id: '' });
      setErrors({});
      show('Task assigned');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to assign task', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(task, status) {
    try {
      await updateTaskStatus(task.id, status);
      show('Task updated');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Update failed', 'error');
    }
  }

  async function handleReview() {
    if (feedback.trim().length < 50) {
      show('Feedback must be at least 50 characters', 'error');
      return;
    }
    setReviewing(true);
    try {
      const res = await reviewTask(reviewTarget.id, feedback.trim());
      setTasks((prev) => prev.map((t) => (t.id === reviewTarget.id ? res.data.task : t)));
      setReviewTarget(null);
      setFeedback('');
      show('Review submitted');
    } catch (err) {
      show(err.response?.data?.error || 'Review failed', 'error');
    } finally {
      setReviewing(false);
    }
  }

  function handleExport() {
    const cols = isStaff
      ? ['#', 'Title', 'Attachee', 'Priority', 'Status', 'Due']
      : ['#', 'Title', 'Assigned By', 'Priority', 'Status', 'Due'];
    exportTablePdf({
      title: isStaff ? 'Attachee Tasks' : 'My Tasks',
      subtitle: `${user.department_name} Department`,
      meta: [`Total: ${tasks.length}`],
      columns: cols,
      rows: tasks.map((t, i) => [
        i + 1,
        t.title,
        isStaff ? t.attachee_name : t.assigned_by_name,
        t.priority,
        label(t.status),
        t.due_date ? formatDateEAT(t.due_date) : '—',
      ]),
      filename: 'tasks',
    });
  }

  const visible = tab === 'all' ? tasks : tasks.filter((t) => norm(t.status) === tab);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">
          {isStaff ? 'Attachee Tasks' : 'My Tasks'}
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={tasks.length === 0}>
            <FileDown size={16} /> Export PDF
          </Button>
          {isStaff && (
            <Button onClick={() => setModalOpen(true)} disabled={attachees.length === 0}>
              <Plus size={16} /> Assign Task
            </Button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-accentSoft text-brand-600 hover:bg-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isStaff && attachees.length === 0 && !loading && (
        <p className="text-sm text-subtle">
          No attachees in your department yet — ask an administrator to create attachee accounts.
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks"
          description={isStaff ? 'Assign a task to an attachee to get started.' : 'No tasks in this view.'}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((t) => {
            const cur = norm(t.status);
            const next = NEXT_STATUS[cur];
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{t.title}</p>
                      <Badge status={t.priority} />
                      <Badge variant={TASK_VARIANT[cur]}>{label(t.status)}</Badge>
                    </div>
                    {t.description && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-subtle">{t.description}</p>
                    )}
                    <p className="mt-2 text-xs text-subtle">
                      {isStaff ? `Assigned to ${t.attachee_name}` : `From ${t.assigned_by_name}`}
                      {t.due_date ? ` · due ${formatDateEAT(t.due_date)}` : ''}
                    </p>
                  </div>
                </div>

                {/* Feedback box for reviewed tasks */}
                {t.status === 'reviewed' && t.feedback && (
                  <div
                    className="mt-3 rounded-lg border-l-4 border-l-[#16a34a] bg-[#f0fdf4] px-4 py-3"
                  >
                    <p className="font-display text-sm font-semibold text-[#166534]">Feedback</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{t.feedback}</p>
                    {t.feedback_by_name && (
                      <p className="mt-1.5 text-xs text-subtle">
                        {t.feedback_by_name} · {formatEAT(t.feedback_at)}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {!isStaff && next && (
                    <Button
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      onClick={() => changeStatus(t, next)}
                    >
                      Move to {label(next)}
                    </Button>
                  )}
                  {isStaff && t.status === 'submitted' && (
                    <Button className="px-3 py-1 text-xs" onClick={() => { setReviewTarget(t); setFeedback(''); }}>
                      Leave Feedback
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="px-3 py-1 text-xs"
                    onClick={() => setOpenComments((o) => ({ ...o, [t.id]: !o[t.id] }))}
                  >
                    <MessageSquare size={14} /> {openComments[t.id] ? 'Hide Comments' : 'View Comments'}
                  </Button>
                </div>

                {openComments[t.id] && <TaskComments taskId={t.id} />}
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign task modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign Task"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={submitting}>
              {submitting ? 'Assigning…' : 'Assign'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssign} className="space-y-4" noValidate>
          <Select
            label="Attachee"
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            error={errors.assigned_to}
          >
            <option value="">Select an attachee…</option>
            {attachees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={errors.title}
          />
          <Textarea
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
            <Input
              label="Due date (optional)"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          {programs.length > 0 && (
            <Select
              label="Program (optional)"
              value={form.program_id}
              onChange={(e) => setForm({ ...form, program_id: e.target.value })}
            >
              <option value="">No program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}
        </form>
      </Modal>

      {/* Review modal (staff) */}
      <Modal
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title="Leave Feedback"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button onClick={handleReview} disabled={reviewing}>
              {reviewing ? 'Submitting…' : 'Submit Review'}
            </Button>
          </>
        }
      >
        <Textarea
          label="Feedback for attachee"
          rows={5}
          placeholder="Provide detailed feedback (minimum 50 characters)…"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <p className="mt-1 text-xs text-subtle">{feedback.trim().length}/50 characters minimum</p>
      </Modal>
    </div>
  );
}
