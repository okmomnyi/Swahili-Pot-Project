import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Edit3, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { generateReport, saveReport } from '../api/ai';
import { useToast } from '../components/ui/Toast';

export default function AIReportsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const attacheeId = searchParams.get('attacheeId');
  const type = searchParams.get('type') || 'progress';

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [narrative, setNarrative] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await generateReport(attacheeId, type);
      setReport(data.report);
      setNarrative(data.report.supervisor_edits || data.report.ai_narrative);
    } catch (err) {
      show(err.response?.data?.error || 'Failed to generate report', 'error');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (attacheeId) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const { data } = await saveReport(report.id, { supervisor_edits: narrative });
      setReport(data.report);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      show(err.response?.data?.error || 'Failed to save edits', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isCompletion = type === 'completion';

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isCompletion ? 'Completion Letter' : 'Progress Report'}
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-generated via NVIDIA NIM — review and edit before exporting
          </p>
        </div>
      </div>

      {generating && (
        <div className="flex items-center justify-center h-48 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generating {isCompletion ? 'completion letter' : 'progress report'}…
          </p>
        </div>
      )}

      {report && !generating && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              Review the narrative below. Edit directly before exporting.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              AI Narrative — edit as needed
            </h2>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={14}
              className="w-full text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 leading-relaxed resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved ? <CheckCircle className="w-4 h-4" />
                : <Edit3 className="w-4 h-4" />}
              {saved ? 'Saved' : 'Save Edits'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
