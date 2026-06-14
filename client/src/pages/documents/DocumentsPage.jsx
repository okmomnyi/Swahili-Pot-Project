import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ExternalLink, Ban, Search } from 'lucide-react';
import { getDepartmentDocuments, revokeDocument } from '../../api/verification';
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

export default function DocumentsPage() {
  const { show } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (type) params.document_type = type;
      if (status === 'active') params.is_revoked = 'false';
      if (status === 'revoked') params.is_revoked = 'true';
      if (search.trim()) params.search = search.trim();
      const res = await getDepartmentDocuments(params);
      setDocs(res.data.documents);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  const stats = useMemo(() => {
    const total = docs.length;
    const revoked = docs.filter((d) => d.is_revoked).length;
    return { total, active: total - revoked, revoked };
  }, [docs]);

  async function handleRevoke(e) {
    e.preventDefault();
    if (reason.trim().length < 20) return;
    setRevoking(true);
    try {
      await revokeDocument(revokeTarget.document_id, reason.trim());
      show('Document revoked');
      setRevokeTarget(null);
      setReason('');
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to revoke', 'error');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <ShieldCheck size={22} className="text-brand-600" /> Issued Documents
        </h2>
        <p className="mt-1 text-sm text-subtle">
          Cryptographically signed documents issued in your department. Each can be verified by anyone via its QR code.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-subtle">Total Issued</p><p className="mt-1 font-display text-2xl font-bold text-ink">{stats.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-subtle">Active</p><p className="mt-1 font-display text-2xl font-bold text-[#16a34a]">{stats.active}</p></Card>
        <Card className="p-4"><p className="text-xs text-subtle">Revoked</p><p className="mt-1 font-display text-2xl font-bold text-[#dc2626]">{stats.revoked}</p></Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1" style={{ minWidth: 220 }}>
          <Search size={15} className="pointer-events-none absolute left-3 top-9 -translate-y-1/2 text-subtle" />
          <Input label="Search recipient" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()} className="pl-9" placeholder="Recipient name…" />
        </div>
        <div style={{ minWidth: 180 }}>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div style={{ minWidth: 140 }}>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : docs.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No documents yet" description="Documents you generate (certificates, letters, reports) will be registered and listed here." />
      ) : (
        <Table>
          <THead>
            <TH>Document ID</TH>
            <TH>Type</TH>
            <TH>Issued To</TH>
            <TH>Issued By</TH>
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
                <TD className="text-subtle">{d.issued_by_name}</TD>
                <TD className="whitespace-nowrap text-xs text-subtle">{formatEAT(d.issued_at)}</TD>
                <TD><Badge status={d.is_revoked ? 'inactive' : 'active'}>{d.is_revoked ? 'Revoked' : 'Active'}</Badge></TD>
                <TD className="text-right">
                  <div className="inline-flex items-center justify-end gap-3">
                    <a href={`/verify/${d.document_id}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline" title="Verify">
                      <ExternalLink size={14} /> Verify
                    </a>
                    {!d.is_revoked && (
                      <button onClick={() => { setRevokeTarget(d); setReason(''); }}
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
      )}

      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleRevoke} disabled={revoking || reason.trim().length < 20}>
              {revoking ? 'Revoking…' : 'Revoke Document'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-[#92400e]">
            Revoking this document immediately makes it show as invalid to anyone who scans its QR code. This
            cannot be undone without System Administrator access.
          </p>
          <p className="text-sm text-ink">
            <span className="font-medium">{revokeTarget?.recipient_name}</span> ·{' '}
            <span className="font-mono text-xs">{revokeTarget?.document_id}</span>
          </p>
          <Textarea
            label="Reason for revocation (min 20 characters)"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Issued in error — incorrect attachment dates."
          />
        </div>
      </Modal>
    </div>
  );
}
