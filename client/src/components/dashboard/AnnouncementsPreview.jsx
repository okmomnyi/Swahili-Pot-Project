import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAnnouncements } from '../../api/announcements';
import { formatEAT } from '../../lib/datetime';
import Card from '../ui/Card';

export default function AnnouncementsPreview() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getAnnouncements()
      .then((res) => setItems(res.data.announcements.slice(0, 3)))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">Latest Announcements</h3>
        <Link to="/announcements" className="text-sm text-brand-600 hover:underline">
          View all
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink">{a.title}</p>
            <span className="shrink-0 text-xs text-subtle">{formatEAT(a.created_at, 'dd MMM yyyy')}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
