import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileText,
  Radio,
  UserCog,
  ShieldCheck,
  Globe,
  ListTodo,
  GraduationCap,
  MessageSquare,
  AlarmClock,
  Megaphone,
  BookOpen,
  Layers,
  BarChart2,
  Award,
  Building2,
  ScrollText,
  Settings,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from '../ui/Logo';

const ROLE_LABEL = {
  admin: 'System Admin',
  supervisor: 'Supervisor',
  instructor: 'Instructor',
  attachee: 'Attachee',
};

function buildNav(user) {
  const items = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];

  // System admin: global account management only.
  if (user.role === 'admin') {
    items.push({ to: '/users', label: 'User Management', icon: ShieldCheck });
    items.push({ to: '/departments', label: 'Departments', icon: Building2 });
    items.push({ to: '/site', label: 'Website Content', icon: Globe });
    items.push({ to: '/certificates', label: 'Certificates', icon: Award });
    items.push({ to: '/audit', label: 'Audit Log', icon: ScrollText });
    items.push({ to: '/admin/documents', label: 'Documents', icon: ShieldCheck });
    items.push({ to: '/admin/ai-usage', label: 'AI Usage', icon: Sparkles });
    items.push({ to: '/platform-settings', label: 'Platform Settings', icon: Settings });
    return items;
  }

  // Announcements — directly below Dashboard for all department roles.
  items.push({ to: '/announcements', label: 'Announcements', icon: Megaphone });

  // Attachee (intern) portal.
  if (user.role === 'attachee') {
    items.push({ to: '/tasks', label: 'My Tasks', icon: ListTodo });
    items.push({ to: '/submissions', label: 'Submissions', icon: FileText });
    items.push({ to: '/reminders', label: 'Reminders', icon: AlarmClock });
    items.push({ to: '/inquiries', label: 'Inquiries', icon: MessageSquare });
    return items;
  }

  // Instructor / supervisor — grouped so trainees (community learners) and
  // attachees (university students) are clearly separate.

  // TRAINEES — community learners, attendance only.
  if ((user.role === 'instructor' && user.has_trainees) || user.role === 'supervisor') {
    items.push({ section: 'Trainees' });
    if (user.role === 'instructor' && user.has_trainees) {
      items.push({ to: '/trainees', label: 'Trainees', icon: Users });
      items.push({ to: '/attendance', label: 'Attendance', icon: ClipboardCheck });
    }
    if (user.role === 'supervisor') {
      items.push({ to: '/dept-attendance', label: 'Attendance', icon: ClipboardCheck });
    }
  }

  // ATTACHEES — university students, full management.
  items.push({ section: 'Attachees' });
  items.push({ to: '/attachees', label: 'Attachees', icon: GraduationCap });
  items.push({ to: '/tasks', label: 'Tasks', icon: ListTodo });
  items.push({ to: '/programs', label: 'Programs', icon: Layers });
  if (user.role === 'supervisor') {
    items.push({ to: '/performance', label: 'Performance', icon: BarChart2 });
    items.push({ to: '/ai/assistant', label: 'AI Assistant', icon: Sparkles });
  }

  // DEPARTMENT — shared department tooling.
  items.push({ section: 'Department' });
  items.push({ to: '/submissions', label: 'Submissions', icon: FileText });
  items.push({ to: '/session-logs', label: 'Session Logs', icon: BookOpen });
  items.push({ to: '/inquiries', label: 'Inquiries', icon: MessageSquare });
  if (user.has_radio_report) {
    items.push({ to: '/downtime', label: 'Downtime Reports', icon: Radio });
  }

  // TEAM — supervisor management.
  if (user.role === 'supervisor') {
    items.push({ section: 'Team' });
    items.push({ to: '/instructors', label: 'Instructors', icon: UserCog });
    items.push({ to: '/certificates', label: 'Certificates', icon: Award });
    items.push({ to: '/documents', label: 'Documents', icon: ShieldCheck });
  }

  return items;
}

// The sidebar's contents (header + nav + footer). Shared by the fixed desktop
// rail and the mobile slide-in drawer. `onNavigate` fires on link taps so the
// drawer can close itself.
export function SidebarNav({ onNavigate }) {
  const { user, logout } = useAuth();
  const nav = buildNav(user);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="relative overflow-hidden border-b border-line bg-ocean-deep px-5 py-4">
        <div className="swahili-weave pointer-events-none absolute inset-0 opacity-40" />
        {/* Brass waterline accent under the header. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-sun-brass" />
        <Link
          to="/"
          aria-label="SwahiliPot Hub Foundation — home"
          className="relative inline-flex rounded-lg bg-white/95 px-3 py-1.5 shadow-sm outline-none transition-transform duration-200 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-sea-300"
        >
          <Logo size={18} />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) =>
          item.section ? (
            <p
              key={`s-${item.section}`}
              className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-subtle first:pt-0"
            >
              {item.section}
            </p>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  isActive
                    ? 'bg-accentSoft font-semibold text-brand-600 shadow-sm'
                    : 'text-ink hover:translate-x-0.5 hover:bg-hover'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-sea-400 to-brand-600 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <item.icon size={18} className={isActive ? 'text-sea-600' : ''} />
                  {item.label}
                </>
              )}
            </NavLink>
          )
        )}
      </nav>

      <div className="border-t border-line px-4 py-4">
        <div className="mb-2">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <span className="mt-1 inline-block rounded-full bg-lagoon px-2.5 py-0.5 text-xs font-medium text-white shadow-sm">
            {ROLE_LABEL[user.role]}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink transition-colors hover:bg-red-50 hover:text-[#dc2626]"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );
}

// Fixed desktop rail (hidden below md — phones use the drawer in Layout).
export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line md:block">
      <SidebarNav />
    </aside>
  );
}
