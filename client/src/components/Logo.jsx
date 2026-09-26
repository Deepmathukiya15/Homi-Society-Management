export default function Logo({ variant = 'full', className = '' }) {
  if (variant === 'icon') {
    return (
      <img
        src="/homi-icon.svg"
        alt="HOMI Emblem"
        className={`object-contain ${className}`}
        draggable="false"
      />
    );
  }
  return (
    <img
      src="/homi-logo.svg"
      alt="HOMI - Integrated Home & Community Management Solutions"
      className={`w-full object-contain select-none ${className}`}
      draggable="false"
    />
  );
}

export function LogoBadge({ className = '' }) {
  return (
    <div className={`rounded-2xl overflow-hidden bg-slate-950 border border-blue-500/40 p-1 flex items-center justify-center shadow-xs ${className}`}>
      <Logo variant="icon" className="w-full h-full" />
    </div>
  );
}
