import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { SidebarNav } from './Sidebar';
import TopBar from './TopBar';
import { useTheme } from '../../context/ThemeContext';

export default function Layout() {
  const { isDark } = useTheme();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={`${isDark ? 'dark ' : ''}flex h-screen overflow-hidden bg-canvas text-ink`}>
      {/* Desktop rail */}
      <Sidebar />

      {/* Mobile slide-in drawer (kept mounted for smooth transitions) */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${navOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!navOpen}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            navOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setNavOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 w-64 max-w-[82%] shadow-2xl transition-transform duration-300 ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
