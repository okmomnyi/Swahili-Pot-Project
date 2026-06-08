import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { getTaskComments, postTaskComment } from '../../api/tasks';
import { useToast } from '../ui/Toast';
import { formatEAT } from '../../lib/datetime';
import Spinner from '../ui/Spinner';

const ROLE_LABEL = { supervisor: 'Supervisor', instructor: 'Instructor', attachee: 'Attachee', admin: 'Admin' };

function initials(name) {
  return name
    ? name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';
}

export default function TaskComments({ taskId }) {
  const { show } = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getTaskComments(taskId)
      .then((res) => setComments(res.data.comments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await postTaskComment(taskId, text);
      setComments((prev) => [...prev, res.data.comment]);
      setBody('');
    } catch (err) {
      show(err.response?.data?.error || 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-subtle">No comments yet.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {initials(c.author_name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{c.author_name}</span>
                    <span className="rounded-full bg-accentSoft px-2 py-0.5 text-[10px] font-medium text-brand-600">
                      {ROLE_LABEL[c.author_role] || c.author_role}
                    </span>
                    <span className="text-[11px] text-subtle">{formatEAT(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{c.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-200"
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          onClick={submit}
          disabled={sending || !body.trim()}
          className="rounded-lg bg-brand-600 p-2 text-white hover:bg-brand-700 disabled:opacity-50"
          aria-label="Send comment"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
