import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getActivity } from '../../api/activity';
import { formatEAT } from '../../lib/datetime';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';

const DOT = {
  submission_filed: 'bg-brand-600',
  submission_acknowledged: 'bg-brand-600',
  submission_returned: 'bg-brand-600',
  attendance_session_created: 'bg-green-500',
  attendance_confirmed: 'bg-green-500',
  downtime_reported: 'bg-red-500',
  downtime_resolved: 'bg-red-500',
  downtime_escalated: 'bg-red-500',
  task_assigned: 'bg-amber-500',
  task_status_updated: 'bg-amber-500',
  task_reviewed: 'bg-amber-500',
  announcement_posted: 'bg-purple-500',
};
const dotColor = (type) => DOT[type] || 'bg-gray-400';

function groupLabel(iso) {
  const day = formatEAT(iso, 'yyyy-MM-dd');
  const today = formatEAT(new Date(), 'yyyy-MM-dd');
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = formatEAT(y, 'yyyy-MM-dd');
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return formatEAT(iso, 'EEE dd MMM');
}

export default function ActivityFeed() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);
  const seen = useRef(new Set());

  async function fetchFeed(lim) {
    try {
      const res = await getActivity(lim);
      const rows = res.data.activity;
      rows.forEach((r) => seen.current.add(r.id));
      setItems(rows);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeed(limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // Auto-refresh every 60 seconds.
  useEffect(() => {
    const id = setInterval(() => fetchFeed(limit), 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // Build grouped structure.
  const groups = [];
  let current = null;
  for (const it of items) {
    const label = groupLabel(it.created_at);
    if (!current || current.label !== label) {
      current = { label, items: [] };
      groups.push(current);
    }
    current.items.push(it);
  }

  return (
    <Card className="p-5">
      <h3 className="mb-4 font-display text-base font-semibold text-ink">Activity Feed</h3>

      {loading ? (
        <p className="text-sm text-subtle">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet in your department" />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="sticky top-0 mb-2 bg-card py-1 text-xs font-semibold uppercase tracking-wide text-subtle">
                {g.label}
              </p>
              <ul className="space-y-3">
                {g.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex gap-3 transition-opacity duration-500"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor(it.action_type)}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{it.description}</p>
                      <p className="text-xs text-subtle">
                        {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {items.length >= limit && limit < 100 && (
            <button
              onClick={() => setLimit(60)}
              className="text-sm text-brand-600 hover:underline"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
