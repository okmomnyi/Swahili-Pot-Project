import { useState } from 'react';
import Papa from 'papaparse';
import { bulkImportTrainees } from '../../api/trainees';
import { useToast } from '../ui/Toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const TEMPLATE = 'name,phone\nAmina Hassan,0712345678\n';

export default function BulkImportModal({ isOpen, onClose, onImported }) {
  const { show } = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  function reset() {
    setFile(null);
    setPreview([]);
    setRowCount(0);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attachees-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    setResult(null);
    if (!f) {
      reset();
      return;
    }
    setFile(f);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        setRowCount(res.data.length);
        setPreview(res.data.slice(0, 5));
      },
      error: () => show('Could not read CSV file', 'error'),
    });
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const res = await bulkImportTrainees(file);
      setResult(res.data);
      if (onImported) onImported();
    } catch (err) {
      show(err.response?.data?.error || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Import Attachees"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? 'Importing…' : 'Import'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-subtle">
          Upload a CSV file with columns: <span className="font-medium text-ink">name</span>,{' '}
          <span className="font-medium text-ink">phone</span>. Phone numbers must be Kenyan format
          (07xxxxxxxx or 01xxxxxxxx).
        </p>

        <button onClick={downloadTemplate} className="text-sm text-brand-600 underline">
          Download CSV template
        </button>

        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-accentSoft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-600"
        />

        {!result && preview.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-ink">{rowCount} rows found · preview</p>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs uppercase text-subtle">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-lg border border-line bg-canvas p-3 text-sm">
            <p className="text-ink">
              <span className="font-semibold text-[#16a34a]">{result.imported}</span> attachees imported
              successfully. <span className="font-semibold">{result.skipped}</span> skipped (already
              exist). <span className="font-semibold">{result.errors.length}</span> rows had errors.
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-line bg-card p-2">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-[#dc2626]">
                    Row {e.row}: {e.reason} {e.name ? `(${e.name})` : ''}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
