import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { generateCertificate } from '../../api/certificates';
import { getDeptAttachees } from '../../api/attachee';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

export default function CertificatesPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [attachees, setAttachees] = useState([]);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    certificate_type: 'attachment_letter',
    attachee_name: '',
    attachee_id_number: '',
    department_name: user.department_name || '',
    program_name: '',
    start_date: '',
    end_date: '',
    supervisor_name: user.name || '',
    supervisor_title: '',
  });

  useEffect(() => {
    getDeptAttachees().then((res) => setAttachees(res.data.attachees)).catch(() => {});
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerate(e) {
    e.preventDefault();
    const required = ['attachee_name', 'program_name', 'start_date', 'end_date', 'supervisor_name', 'supervisor_title'];
    for (const r of required) {
      if (!form[r] || !String(form[r]).trim()) {
        show('Please fill in all required fields', 'error');
        return;
      }
    }
    setGenerating(true);
    try {
      const res = await generateCertificate(form);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.attachee_name.replace(/[^a-z0-9]+/gi, '-')}-${form.certificate_type}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      show('Certificate generated');
    } catch (err) {
      show(err.response?.data?.error || 'Failed to generate', 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold text-ink">Generate Certificate / Letter</h2>

      <Card className="mx-auto max-w-[600px] p-6">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Certificate Type</p>
            <div className="flex gap-4">
              {[
                ['attachment_letter', 'Attachment Letter'],
                ['completion_certificate', 'Completion Certificate'],
              ].map(([value, lbl]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="certificate_type"
                    checked={form.certificate_type === value}
                    onChange={() => set('certificate_type', value)}
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Attachee Name</label>
            <input
              list="attachee-options"
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-200"
              value={form.attachee_name}
              onChange={(e) => set('attachee_name', e.target.value)}
              placeholder="Start typing a name…"
            />
            <datalist id="attachee-options">
              {attachees.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
          </div>

          <Input
            label="National ID / Student ID (optional)"
            value={form.attachee_id_number}
            onChange={(e) => set('attachee_id_number', e.target.value)}
          />
          <Input label="Department Name" value={form.department_name} readOnly />
          <Input
            label="Program Name"
            placeholder="e.g. Web Development Bootcamp"
            value={form.program_name}
            onChange={(e) => set('program_name', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            <Input label="End Date" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </div>
          <Input label="Supervisor Name" value={form.supervisor_name} onChange={(e) => set('supervisor_name', e.target.value)} />
          <Input
            label="Supervisor Title"
            placeholder="e.g. Tech Department Supervisor"
            value={form.supervisor_title}
            onChange={(e) => set('supervisor_title', e.target.value)}
          />

          <Button type="submit" disabled={generating} className="w-full">
            <Award size={16} /> {generating ? 'Generating…' : 'Generate PDF'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
