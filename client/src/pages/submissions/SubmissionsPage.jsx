import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Paperclip, ChevronDown, ChevronRight, Download, FileDown } from 'lucide-react';
import {
  getSubmissions,
  acknowledgeSubmission,
  returnSubmission,
  fileUrl,
} from '../../api/submissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import { exportTablePdf } from '../../lib/pdf';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const TABS = ['All', 'Submitted', 'Acknowledged', 'Returned'];

export default function SubmissionsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const isSupervisor = user.role === 'supervisor';

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');
  const [expanded, setExpanded] = useState(null);

  // Action modal state (supervisor)
  const [action, setAction] = useState(null); // { type: 'acknowledge'|'return', submission }
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getSubmissions();
      setSubmissions(res.data.submissions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAction(type, submission) {
    setAction({ type, submission });
    setNote('');
    setNoteError('');
  }

  async function handleSubmitAction() {
    if (!action) return;
    if (action.type === 'return' && !note.trim()) {
      setNoteError('A note is required when returning a submission');
      return;
    }
    setSubmitting(true);
    try {
      if (action.type === 'acknowledge') {
        await acknowledgeSubmission(action.submission.id, { supervisor_note: note.trim() });
        show('Submission acknowledged');
      } else {
        await returnSubmission(action.submission.id, { supervisor_note: note.trim() });
        show('Submission returned');
      }
      setAction(null);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Action failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = submissions.filter((s) =>
    tab === 'All' ? true : s.status === tab.toLowerCase()
  );

  function handleExport() {
    const cols = isSupervisor
      ? ['#', 'Title', 'Form Type', 'Instructor', 'Submitted', 'Status']
      : ['#', 'Title', 'Form Type', 'Submitted', 'Status'];
    const rows = filtered.map((s, i) =>
      isSupervisor
        ? [i + 1, s.title, s.form_type, s.instructor_name || '—', formatEAT(s.submitted_at), s.status]
        : [i + 1, s.title, s.form_type, formatEAT(s.submitted_at), s.status]
    );
    exportTablePdf({
      title: 'Submissions',
      subtitle: `${user.department_name} Department · ${tab}`,
      meta: [`Total: ${filtered.length}`],
      columns: cols,
      rows,
      filename: 'submissions',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-accentSoft text-brand-600'
                  : 'text-subtle hover:bg-hover'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={filtered.length === 0}>
            <FileDown size={16} /> Export PDF
          </Button>
          {!isSupervisor && (
            <Link to="/submissions/new">
              <Button>
                <Plus size={16} /> New Submission
              </Button>
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No submissions"
          description={
            isSupervisor
              ? 'Submissions from your department will appear here.'
              : 'Submissions you file will appear here.'
          }
          action={
            !isSupervisor
              ? { label: 'New Submission', onClick: () => (window.location.href = '/submissions/new') }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const isOpen = expanded === s.id;
            return (
              <Card key={s.id} className="overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
                >
                  {isOpen ? (
                    <ChevronDown size={16} className="shrink-0 text-subtle" />
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-subtle" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{s.title}</p>
                    <p className="text-xs text-subtle">
                      {s.form_type}
                      {isSupervisor && s.instructor_name ? ` · ${s.instructor_name}` : ''} ·{' '}
                      {formatEAT(s.submitted_at)}
                    </p>
                  </div>
                  {s.file_url && <Paperclip size={14} className="shrink-0 text-subtle" />}
                  <Badge status={s.status} />
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-line px-4 py-4">
                    {s.description && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-subtle">Description</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                          {s.description}
                        </p>
                      </div>
                    )}

                    {s.file_url && (
                      <a
                        href={fileUrl(s.id)}
                        className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
                      >
                        <Download size={14} /> {s.file_original_name || 'Download attachment'}
                      </a>
                    )}

                    {s.supervisor_note && (
                      <div className="rounded-lg bg-canvas p-3">
                        <p className="text-xs font-semibold uppercase text-subtle">
                          Supervisor Note
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                          {s.supervisor_note}
                        </p>
                      </div>
                    )}

                    {isSupervisor && s.status === 'submitted' && (
                      <div className="flex gap-3 pt-1">
                        <Button onClick={() => openAction('acknowledge', s)}>Acknowledge</Button>
                        <Button variant="secondary" onClick={() => openAction('return', s)}>
                          Return
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!action}
        onClose={() => setAction(null)}
        title={action?.type === 'acknowledge' ? 'Acknowledge Submission' : 'Return Submission'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAction} disabled={submitting}>
              {submitting ? 'Saving…' : action?.type === 'acknowledge' ? 'Acknowledge' : 'Return'}
            </Button>
          </>
        }
      >
        <Textarea
          label={action?.type === 'return' ? 'Reason for return (required)' : 'Note (optional)'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={noteError}
          placeholder={
            action?.type === 'return'
              ? 'Explain what needs to be corrected…'
              : 'Add an optional note for the instructor…'
          }
        />
      </Modal>
    </div>
  );
}
