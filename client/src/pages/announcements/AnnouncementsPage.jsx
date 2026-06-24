import { useEffect, useState } from 'react';
import { Megaphone, Pin, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../api/announcements';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatEAT } from '../../lib/datetime';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY = { title: '', body: '', is_pinned: false, expires_at: '' };

function AnnouncementCard({ a, canManage, onEdit, onDelete }) {
  return (
    <Card
      className={`p-5 ${a.is_pinned ? 'border-l-4 border-l-[#1e40af]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink">{a.title}</h3>
        {a.is_pinned && <Pin size={18} className="shrink-0 text-brand-600" />}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{a.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
        <span>{a.posted_by_name}</span>
        <span>·</span>
        <span>{formatEAT(a.created_at, 'dd MMM yyyy')}</span>
        {a.expires_at && (
          <span className="text-[#d97706]">Expires {formatEAT(a.expires_at, 'dd MMM yyyy')}</span>
        )}
      </div>
      {canManage && (
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onEdit(a)}>
            <Pencil size={14} /> Edit
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs text-[#dc2626]"
            onClick={() => onDelete(a)}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const isSupervisor = user.role === 'supervisor';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bannerOpen, setBannerOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getAnnouncements();
      setItems(res.data.announcements);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      is_pinned: a.is_pinned,
      expires_at: a.expires_at ? a.expires_at.slice(0, 10) : '',
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.body.trim()) e.body = 'Body is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      is_pinned: form.is_pinned,
      expires_at: form.expires_at || null,
    };
    try {
      if (editing) {
        await updateAnnouncement(editing.id, payload);
        show('Announcement updated');
      } else {
        await createAnnouncement(payload);
        show('Announcement posted');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAnnouncement(deleteTarget.id);
      show('Announcement deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      show(err.response?.data?.error || 'Failed to delete', 'error');
    }
  }

  if (loading) return <Spinner />;

  const pinned = items.filter((a) => a.is_pinned);
  const unpinned = items.filter((a) => !a.is_pinned);
  const topPinned = pinned[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">Announcements</h2>
        {isSupervisor && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Post Announcement
          </Button>
        )}
      </div>

      {/* Non-supervisor banner for the most recently pinned announcement */}
      {!isSupervisor && topPinned && (
        <div className="rounded-xl bg-brand-600 px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <Pin size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-semibold">{topPinned.title}</p>
              {bannerOpen ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/90">{topPinned.body}</p>
              ) : (
                <button
                  className="mt-1 text-sm text-white/80 underline"
                  onClick={() => setBannerOpen(true)}
                >
                  Read more
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="space-y-3">
          {pinned.map((a) => (
            <AnnouncementCard
              key={a.id}
              a={a}
              canManage={isSupervisor}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
          {unpinned.map((a) => (
            <AnnouncementCard
              key={a.id}
              a={a}
              canManage={isSupervisor}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Announcement' : 'Post Announcement'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : editing ? 'Save' : 'Post'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={errors.title}
          />
          <Textarea
            label="Body"
            rows={5}
            className="min-h-[120px]"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            error={errors.body}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
            />
            Pin this announcement
          </label>
          <Input
            label="Expiry date (optional)"
            type="date"
            value={form.expires_at}
            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
          />
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Delete <span className="font-medium">{deleteTarget?.title}</span>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
