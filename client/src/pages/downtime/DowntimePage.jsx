import { useEffect, useState } from 'react';
import { Radio, Plus, FileDown } from 'lucide-react';
import {
  getDowntimeReports,
  createDowntimeReport,
  resolveDowntimeReport,
} from '../../api/downtime';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
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

export default function DowntimePage() {
  const { user } = useAuth();
  const { show } = useToast();
  const isSupervisor = user.role === 'supervisor';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Report modal (instructor)
  const [reportOpen, setReportOpen] = useState(false);
  const [form, setForm] = useState({ frequency_band: '', description: '', severity: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Resolve modal (supervisor)
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveError, setResolveError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await getDowntimeReports();
      setReports(res.data.reports);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Only the radio (Communication) department can load reports.
    if (user.has_radio_report) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If not in the radio department, show a full-page empty state.
  if (!user.has_radio_report) {
    return (
      <EmptyState
        icon={Radio}
        title="Downtime reporting unavailable"
        description="Downtime reporting is available for the Communication department only."
      />
    );
  }

  function validate() {
    const e = {};
    if (!form.frequency_band.trim()) e.frequency_band = 'Frequency band is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.severity) e.severity = 'Severity is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleReport(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createDowntimeReport({
        frequency_band: form.frequency_band.trim(),
        description: form.description.trim(),
        severity: form.severity,
      });
      setReportOpen(false);
      setForm({ frequency_band: '', description: '', severity: '' });
      setErrors({});
      show('Downtime reported');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to report downtime', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve() {
    if (!resolutionNote.trim()) {
      setResolveError('A resolution note is required');
      return;
    }
    try {
      await resolveDowntimeReport(resolveTarget.id, { resolution_note: resolutionNote.trim() });
      setResolveTarget(null);
      setResolutionNote('');
      setResolveError('');
      show('Report resolved');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to resolve', 'error');
    }
  }

  function handleExport() {
    const cols = isSupervisor
      ? ['#', 'Frequency', 'Severity', 'Status', 'Instructor', 'Reported']
      : ['#', 'Frequency', 'Severity', 'Status', 'Reported'];
    exportTablePdf({
      title: 'Downtime Reports',
      subtitle: `${user.department_name} Department`,
      meta: [`Total: ${reports.length}`],
      columns: cols,
      rows: reports.map((r, i) =>
        isSupervisor
          ? [i + 1, r.frequency_band, r.severity, r.status, r.instructor_name || '—', formatEAT(r.reported_at)]
          : [i + 1, r.frequency_band, r.severity, r.status, formatEAT(r.reported_at)]
      ),
      filename: 'downtime-reports',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleExport} disabled={reports.length === 0}>
          <FileDown size={16} /> Export PDF
        </Button>
        {!isSupervisor && (
          <Button onClick={() => setReportOpen(true)}>
            <Plus size={16} /> Report Downtime
          </Button>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No downtime reports"
          description={
            isSupervisor
              ? 'Reports filed by your instructors will appear here.'
              : 'Report a frequency outage to get started.'
          }
        />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{r.frequency_band}</p>
                    <Badge status={r.severity} />
                    <Badge status={r.status} />
                  </div>
                  {isSupervisor && r.instructor_name && (
                    <p className="mt-1 text-xs text-subtle">Reported by {r.instructor_name}</p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{r.description}</p>
                  <p className="mt-2 text-xs text-subtle">Reported {formatEAT(r.reported_at)}</p>

                  {r.status === 'resolved' && r.resolution_note && (
                    <div className="mt-3 rounded-lg bg-canvas p-3">
                      <p className="text-xs font-semibold uppercase text-subtle">Resolution</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                        {r.resolution_note}
                      </p>
                      {r.resolved_at && (
                        <p className="mt-1 text-xs text-subtle">
                          Resolved {formatEAT(r.resolved_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {isSupervisor && r.status === 'open' && (
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      setResolveTarget(r);
                      setResolutionNote('');
                      setResolveError('');
                    }}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Report modal */}
      <Modal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report Downtime"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReport} disabled={submitting}>
              {submitting ? 'Saving…' : 'Submit Report'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleReport} className="space-y-4" noValidate>
          <Input
            label="Frequency Band"
            placeholder="e.g. 88.9 FM"
            value={form.frequency_band}
            onChange={(e) => setForm({ ...form, frequency_band: e.target.value })}
            error={errors.frequency_band}
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            error={errors.description}
          />
          <Select
            label="Severity"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            error={errors.severity}
          >
            <option value="">Select severity…</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </form>
      </Modal>

      {/* Resolve modal */}
      <Modal
        isOpen={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        title="Resolve Report"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolveTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolve}>Mark Resolved</Button>
          </>
        }
      >
        <Textarea
          label="Resolution Note (required)"
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          error={resolveError}
          placeholder="Describe how the issue was resolved…"
        />
      </Modal>
    </div>
  );
}
