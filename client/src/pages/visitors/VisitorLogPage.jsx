import { useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { getVisitors, logVisitor, checkoutVisitor } from '../../api/visitors';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const today = () => formatEAT(new Date(), 'yyyy-MM-dd');
const EMPTY = { visitor_name: '', visitor_phone: '', purpose: '', person_visiting: '' };

export default function VisitorLogPage() {
  const { show } = useToast();
  const [date, setDate] = useState(today());
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getVisitors(date);
      setVisitors(res.data.visitors);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleLog(e) {
    e.preventDefault();
    if (!form.visitor_name.trim() || !form.purpose.trim()) {
      show('Visitor name and purpose are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await logVisitor({
        visitor_name: form.visitor_name.trim(),
        visitor_phone: form.visitor_phone.trim() || null,
        purpose: form.purpose.trim(),
        person_visiting: form.person_visiting.trim() || null,
      });
      setModalOpen(false);
      setForm(EMPTY);
      show('Visitor logged');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to log visitor', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout(id) {
    try {
      const res = await checkoutVisitor(id);
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, ...res.data.visitor } : v)));
      show('Checked out');
    } catch (err) {
      show(err.response?.data?.error || 'Failed to check out', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink">Visitor Log</h2>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Log Visitor
          </Button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : visitors.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No visitors" description="No visitors logged for this date." />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Visitor</TH>
              <TH>Phone</TH>
              <TH>Purpose</TH>
              <TH>Visiting</TH>
              <TH>Time In</TH>
              <TH>Time Out</TH>
              <TH>Logged By</TH>
              <TH className="text-right">Action</TH>
            </THead>
            <TBody>
              {visitors.map((v, i) => (
                <TR key={v.id} index={i}>
                  <TD className="font-medium">{v.visitor_name}</TD>
                  <TD>{v.visitor_phone || '—'}</TD>
                  <TD className="max-w-[200px] whitespace-pre-wrap">{v.purpose}</TD>
                  <TD>{v.person_visiting || '—'}</TD>
                  <TD>{formatEAT(v.time_in, 'HH:mm')}</TD>
                  <TD>
                    {v.time_out ? (
                      formatEAT(v.time_out, 'HH:mm')
                    ) : (
                      <span className="text-[#d97706]">Still here</span>
                    )}
                  </TD>
                  <TD>{v.logged_by_name || '—'}</TD>
                  <TD className="text-right">
                    {!v.time_out && (
                      <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => handleCheckout(v.id)}>
                        Check Out
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="text-sm text-subtle">{visitors.length} visitor{visitors.length === 1 ? '' : 's'} today</p>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log Visitor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleLog} disabled={submitting}>
              {submitting ? 'Saving…' : 'Log Entry'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleLog} className="space-y-4" noValidate>
          <Input label="Visitor Name" value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} />
          <Input label="Phone (optional)" value={form.visitor_phone} onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} />
          <Textarea label="Purpose of Visit" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          <Input label="Person They Are Visiting (optional)" value={form.person_visiting} onChange={(e) => setForm({ ...form, person_visiting: e.target.value })} />
          <p className="text-xs text-subtle">Check-in time is recorded automatically.</p>
        </form>
      </Modal>
    </div>
  );
}
