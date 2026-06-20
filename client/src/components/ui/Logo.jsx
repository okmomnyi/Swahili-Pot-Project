import { Link } from 'react-router-dom';

// SwahiliPot wordmark. `size` historically referred to the text size of the
// placeholder; here it maps to a sensible rendered logo height so existing
// call sites (sidebar=18, login/attend=24) keep working without changes.
//
// Like the official Swahilipot site, the logo doubles as a "home" link: pass
// `to` (e.g. "/" or "/dashboard") to make it clickable. Without `to` it renders
// a plain image (for places where a link would be redundant or nested).
const HEIGHTS = {
  18: 28,
  24: 40,
};

export default function Logo({ size = 18, height, className = '', to }) {
  const h = height || HEIGHTS[size] || Math.round(size * 1.6);
  const img = (
    <img
      src="/sph-logo.png"
      alt="SwahiliPot Hub Foundation"
      height={h}
      style={{ height: h, width: 'auto' }}
      className={className}
    />
  );

  if (!to) return img;

  return (
    <Link
      to={to}
      aria-label="SwahiliPot Hub Foundation — home"
      className="inline-flex shrink-0 rounded-md outline-none transition-transform duration-200 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-sea-400"
    >
      {img}
    </Link>
  );
}
