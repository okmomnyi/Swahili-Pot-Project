import { useEffect, useMemo, useState } from 'react';
import { BarChart2, FileDown } from 'lucide-react';
import { getPerformance, exportPerformance } from '../../api/performance';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

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

function rateColor(rate) {
  if (rate == null) return '#9ca3af';
  if (rate >= 80) return '#16a34a';
  if (rate >= 40) return '#d97706';
  return '#dc2626';
}

function CompletionBar({ rate }) {
  const pct = rate == null ? 0 : Math.min(100, rate);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-hover">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: rateColor(rate) }} />
      </div>
      <span className="text-xs text-subtle">{rate == null ? 'N/A' : `${rate}%`}</span>
    </div>
  );
}

const COLUMNS = [
  { key: 'name', label: 'Name', numeric: false },
  { key: 'days_attended', label: 'Days Attended', numeric: true },
  { key: 'tasks_assigned', label: 'Tasks Assigned', numeric: true },
  { key: 'tasks_submitted', label: 'Tasks Submitted', numeric: true },
  { key: 'tasks_reviewed', label: 'Tasks Reviewed', numeric: true },
  { key: 'completion_rate', label: 'Completion Rate', numeric: true },
];

export default function PerformancePage() {
  const { show } = useToast();
  const months = useMemo(lastSixMonths, []);

  const [period, setPeriod] = useState('monthly');
  const [month, setMonth] = useState(months[0].value);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ key: 'days_attended', dir: 'desc' });
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => ({ period, month }), [period, month]);

  async function load() {
    setLoading(true);
    try {
      const res = await getPerformance(params);
      setRows(res.data.summary);
    } catch (err) {
      show(err.response?.data?.error || 'Failed to load performance', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, month]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp;
      if (typeof av === 'string') cmp = av.localeCompare(bv);
      else cmp = Number(av) - Number(bv);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await exportPerformance(params);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      show(err.response?.data?.error || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Attachee Performance</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-32">
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </Select>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-44">
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={handleExport} disabled={exporting || rows.length === 0}>
            <FileDown size={16} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={BarChart2} title="No attachees" description="No attachees in your department yet." />
      ) : (
        <Table>
          <THead>
            {COLUMNS.map((c) => (
              <TH key={c.key}>
                <button
                  className="inline-flex items-center gap-1 hover:text-ink"
                  onClick={() => toggleSort(c.key)}
                >
                  {c.label}
                  {sort.key === c.key && <span>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              </TH>
            ))}
          </THead>
          <TBody>
            {sorted.map((r, i) => (
              <TR key={r.id} index={i}>
                <TD className="font-medium">{r.name}</TD>
                <TD>{r.days_attended}</TD>
                <TD>{r.tasks_assigned}</TD>
                <TD>{r.tasks_submitted}</TD>
                <TD>{r.tasks_reviewed}</TD>
                <TD><CompletionBar rate={r.completion_rate == null ? null : Number(r.completion_rate)} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
