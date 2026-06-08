import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Pencil, FileDown } from 'lucide-react';
import { getSessionRecords, confirmRecord, renameSession } from '../../api/attendance';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import { exportTablePdf } from '../../lib/pdf';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();

  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [renaming, setRenaming] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getSessionRecords(sessionId);
      setSession(res.data.session);
      setRecords(res.data.records);
    } catch (err) {
      show(err.response?.data?.error || 'Failed to load session', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleConfirm(id) {
    setConfirmingId(id);
    try {
      const res = await confirmRecord(id);
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...res.data.record } : r)));
      show('Attendance confirmed');
    } catch (err) {
      show(err.response?.data?.error || 'Failed to confirm', 'error');
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleRename() {
    setRenaming(true);
    try {
      const res = await renameSession(sessionId, label.trim());
      setSession((s) => ({ ...s, session_label: res.data.session.session_label }));
      setRenameOpen(false);
      show('Session renamed');
    } catch (err) {
      show(err.response?.data?.error || 'Rename failed', 'error');
    } finally {
      setRenaming(false);
    }
  }

  function handleExport() {
    const name = session?.session_label || 'Attendance Session';
    exportTablePdf({
      title: 'Attendance Record',
      subtitle: name,
      meta: [
        `Date: ${formatEAT(session?.created_at)}`,
        `Total: ${records.length}  ·  Confirmed: ${records.filter((r) => r.is_confirmed).length}`,
      ],
      columns: ['#', 'Trainee Name', 'Phone', 'Check-in (EAT)', 'Confirmed'],
      rows: records.map((r, i) => [
        i + 1,
        r.trainee_name,
        r.trainee_phone,
        formatEAT(r.check_in),
        r.is_confirmed ? 'Yes' : 'No',
      ]),
      filename: `attendance-${name}`,
    });
  }

  if (loading) return <Spinner />;

  const confirmed = records.filter((r) => r.is_confirmed).length;
  const pending = records.length - confirmed;
  const isInstructor = user.role === 'instructor';

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-subtle hover:text-ink"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-ink">
              {session?.session_label || 'Unnamed Session'}
            </h2>
            {isInstructor && (
              <button
                onClick={() => { setLabel(session?.session_label || ''); setRenameOpen(true); }}
                className="text-subtle hover:text-brand-600"
                title="Rename session"
                aria-label="Rename session"
              >
                <Pencil size={16} />
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-subtle">{formatEAT(session?.created_at)}</p>
        </div>
        <Button variant="secondary" onClick={handleExport} disabled={records.length === 0}>
          <FileDown size={16} /> Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold text-ink">{records.length}</p>
          <p className="text-xs text-subtle">Total Entries</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold text-[#16a34a]">{confirmed}</p>
          <p className="text-xs text-subtle">Confirmed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-display text-2xl font-bold text-[#d97706]">{pending}</p>
          <p className="text-xs text-subtle">Pending</p>
        </Card>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance yet"
          description="Records appear here as trainees check in via the QR code."
        />
      ) : (
        <Table>
          <THead>
            <TH>Trainee Name</TH>
            <TH>Phone</TH>
            <TH>Check-in (EAT)</TH>
            <TH>Check-out (EAT)</TH>
            <TH>Confirmed</TH>
            {isInstructor && <TH className="text-right">Action</TH>}
          </THead>
          <TBody>
            {records.map((r, i) => (
              <TR key={r.id} index={i}>
                <TD className="font-medium">{r.trainee_name}</TD>
                <TD>{r.trainee_phone}</TD>
                <TD>{r.check_in ? formatEAT(r.check_in, 'dd MMM yyyy, HH:mm') : '—'}</TD>
                <TD>
                  {r.check_out ? (
                    formatEAT(r.check_out, 'dd MMM yyyy, HH:mm')
                  ) : (
                    <span className="text-[#6b7280]">Not yet</span>
                  )}
                </TD>
                <TD>
                  <Badge status={r.is_confirmed ? 'confirmed' : 'pending'} />
                </TD>
                {isInstructor && (
                  <TD className="text-right">
                    {!r.is_confirmed && (
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        onClick={() => handleConfirm(r.id)}
                        disabled={confirmingId === r.id}
                      >
                        {confirmingId === r.id ? 'Confirming…' : 'Confirm'}
                      </Button>
                    )}
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename Session"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming}>
              {renaming ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <Input
          label="Session name"
          placeholder="e.g. Morning Session — June 3"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Modal>
    </div>
  );
}
