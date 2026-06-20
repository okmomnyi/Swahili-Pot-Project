import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationsBell from './NotificationsBell';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/trainees': 'Trainees',
  '/attendance': 'Attendance',
  '/submissions': 'Submissions',
  '/submissions/new': 'New Submission',
  '/downtime': 'Downtime Reports',
  '/instructors': 'Instructors',
  '/users': 'User Management',
  '/announcements': 'Announcements',
  '/dept-attendance': 'Attendance',
  '/session-logs': 'Session Logs',
  '/performance': 'Attachee Performance',
  '/certificates': 'Certificates',
  '/programs': 'Programs',
  '/profile': 'My Profile',
  '/settings': 'Account Settings',
};

function pageTitle(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/attendance/')) return 'Session Details';
  if (pathname.startsWith('/users/')) return 'User Profile';
  return 'SwahiliPot IMS';
}

function greeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const ROLE_LABEL = { admin: 'System Admin', supervisor: 'Supervisor', instructor: 'Instructor' };

export default function TopBar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hour = new Date().getHours();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(path) {
    setMenuOpen(false);
    navigate(path);
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-card px-5">
      <h1 className="font-display text-base font-semibold text-ink">{pageTitle(pathname)}</h1>

      <div className="flex items-center gap-2">
        <div className="mr-1 hidden text-right sm:block">
          <p className="text-sm font-medium text-ink">
            {greeting(hour)}, {user.name.split(' ')[0]}
          </p>
          <p className="text-xs text-subtle">{user.department_name || ROLE_LABEL[user.role]}</p>
        </div>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-subtle hover:bg-hover hover:text-ink"
          aria-label="Toggle theme"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationsBell />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-hover"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lagoon text-sm font-semibold text-white shadow-sm ring-2 ring-sea-200/40">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <ChevronDown size={16} className="text-subtle" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-card shadow-lg">
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-subtle">{user.email}</p>
                <span className="mt-1.5 inline-block rounded-full bg-accentSoft px-2 py-0.5 text-[11px] font-medium text-brand-600">
                  {ROLE_LABEL[user.role]}
                </span>
              </div>
              <button
                onClick={() => go('/profile')}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-hover"
              >
                <User size={16} /> My Profile
              </button>
              <button
                onClick={() => go('/settings')}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-hover"
              >
                <Settings size={16} /> Account Settings
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-sm text-[#dc2626] hover:bg-hover"
              >
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
