import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, Ban, XCircle, CheckCircle2, Loader2, Upload, ChevronDown, KeyRound,
} from 'lucide-react';
import { getDocumentRecord, checkDocumentFile, publicKeyUrl } from '../../api/verification';
import { formatEAT } from '../../lib/datetime';

const DOC_TYPE_LABELS = {
  attachment_letter: 'Attachment Letter',
  completion_certificate: 'Completion Certificate',
  progress_report: 'Progress Report',
  completion_letter: 'Completion Letter',
  trainee_certificate: 'Trainee Certificate',
  general: 'Document',
};

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-2 sm:flex-row sm:gap-4">
      <span className="w-44 shrink-0 text-sm font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default function VerifyPage() {
  const { document_id: documentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [manualId, setManualId] = useState('');

  const fileRef = useRef(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setData(null);
    setCheckResult(null);
    getDocumentRecord(documentId)
      .then((res) => active && setData(res.data))
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 404) setNotFound(true);
        else setNotFound(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [documentId]);

  async function handleFile(file) {
    if (!file) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_id', documentId);
      const res = await checkDocumentFile(fd);
      setCheckResult(res.data);
    } catch {
      setCheckResult({ result: 'ERROR', message: 'Could not check the file. Please try again.' });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header strip */}
      <div className="bg-brand-700" style={{ backgroundColor: '#1e40af' }}>
        <div className="mx-auto max-w-3xl px-4 py-6 text-center">
          <h1 className="font-display text-2xl font-bold text-white">SwahiliPot Hub Foundation</h1>
          <p className="mt-1 text-sm text-blue-100">Document Verification Portal</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm text-gray-500">Verifying document…</p>
            </div>
          ) : notFound ? (
            <NotFound documentId={documentId} manualId={manualId} setManualId={setManualId} navigate={navigate} />
          ) : data?.revoked ? (
            <Revoked data={data} />
          ) : (
            <Authentic
              data={data}
              fileRef={fileRef}
              handleFile={handleFile}
              checking={checking}
              checkResult={checkResult}
              advancedOpen={advancedOpen}
              setAdvancedOpen={setAdvancedOpen}
            />
          )}
        </div>

        <footer className="mt-8 text-center text-xs text-gray-500">
          <p>Swahilipot Hub Foundation · swahilipothub.co.ke · info@swahilipothub.co.ke</p>
          <p className="mt-1">Swahili Cultural Centre, Sir Mbarak Hinawy Road, Old Town, Mombasa, Kenya</p>
        </footer>
      </div>
    </div>
  );
}

function Authentic({ data, fileRef, handleFile, checking, checkResult, advancedOpen, setAdvancedOpen }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
        <div>
          <p className="font-semibold text-green-800">Authentic Document</p>
          <p className="mt-0.5 text-sm text-green-700">
            This document was issued by Swahilipot Hub Foundation and its record exists in the official system.
          </p>
        </div>
      </div>

      <div>
        <Row label="Document ID" value={<span className="font-mono">{data.document_id}</span>} />
        <Row label="Document Type" value={DOC_TYPE_LABELS[data.document_type] || data.document_type} />
        <Row label="Issued To" value={data.recipient_name} />
        <Row label="Department" value={data.department_name} />
        <Row label="Issued By" value={`${data.issued_by_name} (${data.issued_by_role})`} />
        <Row label="Issue Date" value={`${formatEAT(data.issued_at)} EAT`} />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">Digital Signature (partial)</p>
        <code className="block overflow-x-auto rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700">
          {String(data.signature).slice(0, 32)}…
        </code>
      </div>

      {/* File integrity check */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-800">Check the PDF for alterations</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Upload the document PDF to verify its content has not been changed since it was issued.
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center hover:border-brand-400 hover:bg-brand-50/40"
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Click to upload the PDF</span>
          <span className="text-xs text-gray-400">The file is checked in memory and never stored.</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            handleFile(f);
          }}
        />

        {checking && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking integrity…
          </div>
        )}

        {checkResult && !checking && <CheckResult result={checkResult} />}
      </div>

      {/* Advanced */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          Advanced verification
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <a
              href={publicKeyUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <KeyRound className="h-4 w-4" /> Download public key
            </a>
            <p className="text-xs text-gray-500">
              You can use the public key above to verify the document signature locally with OpenSSL or any
              Ed25519 verification tool, without relying on this server.
            </p>
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Full signature</p>
              <code className="block max-h-24 overflow-auto rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-gray-700">
                {data.signature}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckResult({ result }) {
  const authentic = result.result === 'AUTHENTIC';
  const tampered = result.result === 'TAMPERED' || result.result === 'SIGNATURE_INVALID';
  if (authentic) {
    return (
      <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="flex items-center gap-2 font-semibold text-green-800">
          <CheckCircle2 className="h-5 w-5" /> Content Verified
        </p>
        <p className="mt-1 text-sm text-green-700">
          Hash match: ✓ &nbsp;|&nbsp; Signature: ✓<br />
          The PDF content matches the original exactly. No alterations detected.
        </p>
      </div>
    );
  }
  if (tampered) {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 font-semibold text-red-800">
          <AlertTriangle className="h-5 w-5" /> Warning — Document Altered
        </p>
        <p className="mt-1 text-sm text-red-700">
          {result.message} Contact info@swahilipothub.co.ke immediately.
        </p>
      </div>
    );
  }
  // NOT_FOUND / REVOKED / ERROR
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-800">{result.message}</p>
    </div>
  );
}

function Revoked({ data }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <Ban className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
        <div>
          <p className="font-semibold text-red-800">Document Revoked</p>
          <p className="mt-0.5 text-sm text-red-700">
            This document has been officially revoked by Swahilipot Hub Foundation and is no longer valid or accepted.
          </p>
        </div>
      </div>
      <div>
        <Row label="Document ID" value={<span className="font-mono">{data.document_id}</span>} />
        <Row label="Document Type" value={DOC_TYPE_LABELS[data.document_type] || data.document_type} />
        <Row label="Issued To" value={data.recipient_name} />
        <Row label="Original Issue Date" value={`${formatEAT(data.issued_at)} EAT`} />
        <Row label="Revoked On" value={data.revoked_at ? `${formatEAT(data.revoked_at)} EAT` : '—'} />
        <Row label="Reason" value={data.revocation_reason || '—'} />
      </div>
    </div>
  );
}

function NotFound({ documentId, manualId, setManualId, navigate }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
        <div>
          <p className="font-semibold text-red-800">Document Not Found</p>
          <p className="mt-0.5 text-sm text-red-700">
            No document with ID <span className="font-mono">{documentId}</span> exists in the SwahiliPot IMS
            records. This document was not issued by Swahilipot Hub Foundation, or the ID has been entered
            incorrectly.
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualId.trim()) navigate(`/verify/${manualId.trim()}`);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="Enter a Document ID (e.g. SPH-2026-ATT-A7F3K9)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Verify
        </button>
      </form>
    </div>
  );
}
