import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  QrCode, Copy, Download, Check, ClipboardCheck, Trash2, Eye, CalendarRange,
} from 'lucide-react';
import {
  createSession, getSessions, deleteSession, getRecordsRange,
} from '../../api/attendance';
import { getPrograms } from '../../api/programs';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import { exportTablePdf } from '../../lib/pdf';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function attendUrl(token) {
  return `${window.location.origin}/attend/${token}`;
}

function useCountdown(expiresAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `Expires in ${hours}h ${minutes}m`;
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();
  const qrRef = useRef(null);

  const [label, setLabel] = useState('');
  const [programId, setProgramId] = useState('');
  const [programs, setPrograms] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // The session whose QR is currently shown — derived from server data so it
  // survives a page refresh and only clears when the session expires/deleted.
  const [qrSession, setQrSession] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState('');

  const countdown = useCountdown(qrSession?.expires_at);

  async function load() {
    setLoading(true);
    try {
      const res = await getSessions();
      setSessions(res.data.sessions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    getPrograms().then((res) => setPrograms(res.data.programs.filter((p) => p.is_active))).catch(() => {});
  }, []);

  // Keep the QR pointed at a still-valid active session (default: latest active).
  useEffect(() => {
    setQrSession((prev) => {
      if (prev) {
        const fresh = sessions.find((s) => s.id === prev.id);
        if (fresh && !fresh.is_expired) return fresh;
      }
      return sessions.find((s) => !s.is_expired) || null;
    });
  }, [sessions]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await createSession({ session_label: label.trim(), program_id: programId || null });
      setQrSession(res.data.session);
      setLabel('');
      setProgramId('');
      show('Attendance session created');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to create session', 'error');
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    if (!qrSession) return;
    navigator.clipboard.writeText(attendUrl(qrSession.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas || !qrSession) return;
    const link = document.createElement('a');
    link.download = `attendance-qr-${qrSession.token.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSession(deleteTarget.id);
      show('Session deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to delete', 'error');
    }
  }

  async function exportCombined(period) {
    setExporting(period);
    try {
      const res = await getRecordsRange(period);
      const records = res.data.records || [];
      if (records.length === 0) {
        show(`No attendance recorded this ${period}.`, 'error');
        return;
      }

      const dayKey = (iso) => formatEAT(iso, 'yyyy-MM-dd');
      const dayLabel = (k) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
      const dates = [...new Set(records.map((r) => dayKey(r.check_in)))].sort();

      const byTrainee = new Map();
      for (const r of records) {
        const key = `${r.trainee_name.toLowerCase().trim()}|${(r.trainee_phone || '').trim()}`;
        if (!byTrainee.has(key)) {
          byTrainee.set(key, { name: r.trainee_name, phone: r.trainee_phone, days: {} });
        }
        const t = byTrainee.get(key);
        const dk = dayKey(r.check_in);
        if (!t.days[dk]) t.days[dk] = formatEAT(r.check_in, 'HH:mm'); // earliest check-in that day
      }
      const list = [...byTrainee.values()].sort((a, b) => a.name.localeCompare(b.name));

      const baseMeta = [
        `Trainees: ${list.length}`,
        `Attendance days: ${dates.length} (${dayLabel(dates[0])} – ${dayLabel(dates[dates.length - 1])})`,
      ];

      if (dates.length <= 8) {
        // Matrix: trainee × day, cell = first check-in time
        const columns = ['#', 'Trainee', 'Phone', ...dates.map(dayLabel), 'Days'];
        const rows = list.map((t, i) => [
          i + 1,
          t.name,
          t.phone,
          ...dates.map((d) => t.days[d] || '—'),
          Object.keys(t.days).length,
        ]);
        await exportTablePdf({
          title: 'Combined Attendance Sheet',
          subtitle: `${user.department_name} · ${period === 'week' ? 'This Week' : 'This Month'}`,
          meta: baseMeta,
          columns,
          rows,
          filename: `attendance-${period}`,
        });
      } else {
        // Many days → summary
        const columns = ['#', 'Trainee', 'Phone', 'Days Present', 'Dates'];
        const rows = list.map((t, i) => [
          i + 1,
          t.name,
          t.phone,
          Object.keys(t.days).length,
          Object.keys(t.days).sort().map(dayLabel).join(', '),
        ]);
        await exportTablePdf({
          title: 'Combined Attendance Summary',
          subtitle: `${user.department_name} · ${period === 'week' ? 'This Week' : 'This Month'}`,
          meta: baseMeta,
          columns,
          rows,
          filename: `attendance-${period}`,
        });
      }
    } catch (err) {
      show(err.response?.data?.error || 'Export failed', 'error');
    } finally {
      setExporting('');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Left: generate + persistent QR */}
      <div className="space-y-5 lg:col-span-2">
        <Card className="p-5">
          <h3 className="font-display text-base font-semibold text-ink">Generate New Session</h3>
          <div className="mt-4 space-y-4">
            <Input
              label="Session Label (optional)"
              placeholder="e.g. Morning Session — June 3"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            {programs.length > 0 && (
              <Select
                label="Program (optional)"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
              >
                <option value="">No program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              <QrCode size={16} />
              {generating ? 'Generating…' : 'Generate QR Code'}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          {qrSession ? (
            <div className="flex flex-col items-center text-center" ref={qrRef}>
              <p className="mb-3 w-full truncate font-medium text-ink">
                {qrSession.session_label || 'Unnamed Session'}
              </p>
              <div className="rounded-xl bg-white p-2">
                <QRCodeCanvas value={attendUrl(qrSession.token)} size={220} includeMargin level="M" />
              </div>
              <p className="mt-3 text-sm font-medium text-brand-600">{countdown}</p>

              <div className="mt-3 flex w-full items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
                <span className="flex-1 truncate text-left text-xs text-subtle">
                  {attendUrl(qrSession.token)}
                </span>
                <button onClick={handleCopy} className="text-brand-600 hover:text-brand-700" title="Copy link">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <Button variant="secondary" className="mt-4 w-full" onClick={handleDownload}>
                <Download size={16} /> Download QR
              </Button>
            </div>
          ) : (
            <div className="py-8 text-center">
              <QrCode size={40} className="mx-auto text-subtle" />
              <p className="mt-3 text-sm text-subtle">
                No active session. Generate one and its QR code stays here until it expires (3 hours).
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Right: export + compact sessions list */}
      <div className="space-y-4 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-ink">Sessions</h3>
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => exportCombined('week')} disabled={!!exporting}>
              <CalendarRange size={15} /> {exporting === 'week' ? 'Exporting…' : 'Export Week'}
            </Button>
            <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => exportCombined('month')} disabled={!!exporting}>
              <CalendarRange size={15} /> {exporting === 'month' ? 'Exporting…' : 'Export Month'}
            </Button>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No sessions yet"
            description="Generate a QR code to start collecting attendance."
          />
        ) : (
          <Card className="divide-y divide-line">
            {sessions.map((s) => {
              const isShown = qrSession?.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${isShown ? 'bg-accentSoft' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {s.session_label || 'Unnamed Session'}
                    </p>
                    <p className="text-xs text-subtle">
                      {formatEAT(s.created_at)} · {s.record_count}{' '}
                      {s.record_count === 1 ? 'response' : 'responses'}
                    </p>
                  </div>
                  <Badge status={s.is_expired ? 'expired' : 'active'} />
                  <div className="flex items-center gap-1">
                    {!s.is_expired && (
                      <button
                        onClick={() => setQrSession(s)}
                        title="Show QR"
                        aria-label="Show QR"
                        className={`rounded-md p-1.5 hover:bg-hover ${isShown ? 'text-brand-600' : 'text-subtle hover:text-ink'}`}
                      >
                        <QrCode size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/attendance/${s.id}`)}
                      title="View responses"
                      aria-label="View responses"
                      className="rounded-md p-1.5 text-subtle hover:bg-hover hover:text-ink"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(s)}
                      title="Delete session"
                      aria-label="Delete session"
                      className="rounded-md p-1.5 text-[#dc2626] hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Session"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Delete <span className="font-medium">{deleteTarget?.session_label || 'this session'}</span> and
          its {deleteTarget?.record_count || 0} attendance record(s)? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
