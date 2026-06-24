import { useEffect, useState } from 'react';
import { ShieldCheck, ExternalLink, Ban, RotateCcw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getAdminDocuments, getAdminDocumentStats, revokeDocument, unrevokeDocument,
} from '../../api/verification';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Textarea from '../../components/ui/Textarea';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Table, THead, TH, TBody, TR, TD } from '../../components/ui/Table';

const TYPE_LABELS = {
  attachment_letter: 'Attachment Letter',
  completion_certificate: 'Completion Certificate',
  progress_report: 'Progress Report',
  completion_letter: 'Completion Letter',
  trainee_certificate: 'Trainee Certificate',
  general: 'Document',
};

export default function AdminDocumentsPage() {
  const { show } = useToast();
  const [stats, setStats] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [type, setType] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState(null); // { mode: 'revoke'|'unrevoke', doc }
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminDocumentStats().then((r) => setStats(r.data)).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (type) params.document_type = type;
      if (statusFilter === 'active') params.is_revoked = 'false';
      if (statusFilter === 'revoked') params.is_revoked = 'true';
      if (search.trim()) params.search = search.trim();
      const res = await getAdminDocuments(params);
      setDocs(res.data.documents);
      setPages(res.data.pages);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, type, statusFilter]);

  async function submitAction(e) {
    e.preventDefault();
    if (reason.trim().length < 20) return;
    setBusy(true);
    try {
      if (modal.mode === 'revoke') await revokeDocument(modal.doc.document_id, reason.trim());
      else await unrevokeDocument(modal.doc.document_id, reason.trim());
      show(modal.mode === 'revoke' ? 'Document revoked' : 'Revocation reversed');
      setModal(null);
      setReason('');
      await load();
      getAdminDocumentStats().then((r) => setStats(r.data)).catch(() => {});
    } catch (err) {
      show(err.response?.data?.error || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  const maxType = stats ? Math.max(1, ...Object.values(stats.by_type)) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <ShieldCheck size={22} className="text-brand-600" /> Document Registry
        </h2>
        <p className="mt-1 text-sm text-subtle">Every signed document issued across all departments.</p>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-subtle">Total Documents</p><p className="mt-1 font-display text-2xl font-bold text-ink">{stats.total_documents}</p></Card>
            <Card className="p-4"><p className="text-xs text-subtle">Issued This Month</p><p className="mt-1 font-display text-2xl font-bold text-ink">{stats.this_month}</p></Card>
            <Card className="p-4"><p className="text-xs text-subtle">Revoked</p><p className="mt-1 font-display text-2xl font-bold text-[#dc2626]">{stats.revoked_count}</p></Card>
          </div>
          <Card className="p-5">
            <h3 className="font-display text-base font-semibold text-ink">By type</h3>
            <div className="mt-4 space-y-2">
              {Object.entries(stats.by_type).map(([t, n]) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-xs text-subtle">{TYPE_LABELS[t] || t}</span>
                  <div className="h-2.5 flex-1 rounded-full bg-hover overflow-hidden">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round((n / maxType) * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold text-ink">{n}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1" style={{ minWidth: 220 }}>
          <Search size={15} className="pointer-events-none absolute left-3 top-9 -translate-y-1/2 text-subtle" />
          <Input label="Search recipient" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())} className="pl-9" placeholder="Recipient name…" />
        </div>
        <div style={{ minWidth: 180 }}>
          <Select label="Type" value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div style={{ minWidth: 140 }}>
          <Select label="Status" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : docs.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No documents found" description="Try adjusting the filters." />
      ) : (
        <>
          <Table>
            <THead>
              <TH>Document ID</TH>
              <TH>Type</TH>
              <TH>Issued To</TH>
              <TH>Department</TH>
              <TH>Date</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {docs.map((d, i) => (
                <TR key={d.document_id} index={i}>
                  <TD className="font-mono text-xs">{d.document_id}</TD>
                  <TD>{TYPE_LABELS[d.document_type] || d.document_type}</TD>
                  <TD className="font-medium">{d.recipient_name}</TD>
                  <TD className="text-subtle">{d.department_name}</TD>
                  <TD className="whitespace-nowrap text-xs text-subtle">{formatEAT(d.issued_at)}</TD>
                  <TD><Badge status={d.is_revoked ? 'inactive' : 'active'}>{d.is_revoked ? 'Revoked' : 'Active'}</Badge></TD>
                  <TD className="text-right">
                    <div className="inline-flex items-center justify-end gap-3">
                      <a href={`/verify/${d.document_id}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline" title="Verify">
                        <ExternalLink size={14} />
                      </a>
                      {d.is_revoked ? (
                        <button onClick={() => { setModal({ mode: 'unrevoke', doc: d }); setReason(''); }}
                          className="inline-flex items-center gap-1 text-sm text-[#16a34a] hover:underline" title="Unrevoke">
                          <RotateCcw size={14} /> Unrevoke
                        </button>
                      ) : (
                        <button onClick={() => { setModal({ mode: 'revoke', doc: d }); setReason(''); }}
                          className="inline-flex items-center gap-1 text-sm text-[#dc2626] hover:underline" title="Revoke">
                          <Ban size={14} /> Revoke
                        </button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-subtle">Page {page} of {pages} · {total} documents</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft size={16} /> Prev</Button>
                <Button variant="secondary" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Next <ChevronRight size={16} /></Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'revoke' ? 'Revoke Document' : 'Reverse Revocation'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant={modal?.mode === 'revoke' ? 'danger' : 'primary'} onClick={submitAction} disabled={busy || reason.trim().length < 20}>
              {busy ? 'Working…' : modal?.mode === 'revoke' ? 'Revoke Document' : 'Unrevoke'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink">
            <span className="font-medium">{modal?.doc.recipient_name}</span> ·{' '}
            <span className="font-mono text-xs">{modal?.doc.document_id}</span>
          </p>
          <Textarea
            label="Reason (min 20 characters)"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
