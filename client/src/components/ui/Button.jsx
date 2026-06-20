const VARIANTS = {
  primary:
    'bg-brand-600 bg-gradient-to-r from-brand-600 to-sea-600 text-white border border-transparent shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0',
  secondary:
    'bg-card text-brand-600 border border-brand-600 hover:bg-accentSoft disabled:opacity-50',
  danger:
    'bg-[#dc2626] text-white hover:bg-red-700 border border-transparent disabled:opacity-50',
  ghost: 'bg-transparent text-ink hover:bg-hover border border-transparent',
};

export default function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sea-300 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
