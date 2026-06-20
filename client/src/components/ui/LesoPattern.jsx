// Leso / kanga-inspired decoration — the printed cloth of the Swahili coast and
// inland East Africa. Two pieces, both pure SVG (no image assets):
//
//   <LesoRibbon/>    the bold border strip (the kanga "pindo" edge)
//   <LesoMedallion/> the floral central motif (the kanga "mji")
//
// They celebrate Swahili & African design and add colour + diversity to the
// landing page without hurting readability when placed in margins / low opacity.

// Warm coastal-market palette and a cooler one for dark bands.
const PALETTES = {
  warm: { ground: '#7c2d12', a: '#f8572b', b: '#e9c766', c: '#0e7490', d: '#ffffff' },
  cool: { ground: '#0a1654', a: '#06b6d4', b: '#e9c766', c: '#3b63d4', d: '#ffffff' },
  sand: { ground: '#e6d6ba', a: '#e23e16', b: '#a87c1c', c: '#0e7490', d: '#7c2d12' },
};

/**
 * A repeating kanga border ribbon: diamonds with inner gems, edge rules and
 * dot fillers. Tiles horizontally; height is fixed by the design (24px tile).
 */
export function LesoRibbon({ palette = 'warm', className = '', height = 22 }) {
  const p = PALETTES[palette] || PALETTES.warm;
  const id = `leso-ribbon-${palette}-${height}`;
  // Tile keeps the 48×24 design aspect (2:1) so the pattern scales to the
  // chosen height and repeats horizontally across the full pixel width.
  const tileW = height * 2;
  return (
    <div className={className} style={{ height, lineHeight: 0 }} aria-hidden="true">
      <svg width="100%" height={height}>
        <defs>
          <pattern
            id={id}
            width={tileW}
            height={height}
            patternUnits="userSpaceOnUse"
            viewBox="0 0 48 24"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect width="48" height="24" fill={p.ground} />
            {/* top & bottom edge rules */}
            <rect x="0" y="0" width="48" height="2.5" fill={p.b} />
            <rect x="0" y="21.5" width="48" height="2.5" fill={p.b} />
            {/* diamonds */}
            {[0, 24].map((x) => (
              <g key={x}>
                <polygon points={`${x + 12},4 ${x + 22},12 ${x + 12},20 ${x + 2},12`} fill={p.a} />
                <polygon points={`${x + 12},8 ${x + 18},12 ${x + 12},16 ${x + 6},12`} fill={p.b} />
                <circle cx={x + 12} cy={12} r="1.6" fill={p.ground} />
              </g>
            ))}
            {/* dot fillers between diamonds */}
            {[0, 24, 48].map((x) => (
              <g key={`d${x}`}>
                <circle cx={x} cy="12" r="2.4" fill={p.c} />
                <circle cx={x} cy="12" r="1" fill={p.d} />
              </g>
            ))}
          </pattern>
        </defs>
        <rect width="100%" height={height} fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

/**
 * A kanga central rosette (mji). Decorative only — place in corners / margins,
 * or low-opacity behind a section as a cultural watermark. `mono` renders a
 * single-tone watermark (uses currentColor) for placing behind text.
 */
export function LesoMedallion({ size = 120, palette = 'warm', mono = false, className = '', style }) {
  const p = PALETTES[palette] || PALETTES.warm;
  const col = mono
    ? { a: 'currentColor', b: 'currentColor', c: 'currentColor', d: 'currentColor', ground: 'transparent' }
    : p;
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  const inner = Array.from({ length: 8 }, (_, i) => i * 45 + 22.5);
  const dots = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden="true"
      fill="none"
    >
      {/* scalloped outer ring */}
      <circle cx="50" cy="50" r="46" stroke={col.c} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.8" />
      {dots.map((deg) => (
        <circle
          key={`o${deg}`}
          cx="50"
          cy="6"
          r="1.6"
          fill={col.b}
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="40" stroke={col.a} strokeWidth="1" opacity="0.6" />
      {/* outer petals */}
      {petals.map((deg) => (
        <ellipse key={`p${deg}`} cx="50" cy="22" rx="7" ry="18" fill={col.a} opacity="0.92" transform={`rotate(${deg} 50 50)`} />
      ))}
      {/* inner petals offset */}
      {inner.map((deg) => (
        <ellipse key={`i${deg}`} cx="50" cy="30" rx="5" ry="13" fill={col.c} opacity="0.9" transform={`rotate(${deg} 50 50)`} />
      ))}
      {/* centre */}
      <circle cx="50" cy="50" r="11" fill={col.b} />
      <circle cx="50" cy="50" r="6" fill={col.a} />
      <circle cx="50" cy="50" r="2.5" fill={col.d} />
    </svg>
  );
}

export default LesoMedallion;
