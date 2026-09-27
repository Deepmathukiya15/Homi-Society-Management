export default function Logo({ variant = 'full', className = '' }) {
  if (variant === 'icon') {
    return (
      <img
        src={`${import.meta.env.BASE_URL}homi-icon.png`}
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
    <div className={`flex items-center justify-center ${className}`}>
      <Logo variant="icon" className="w-full h-full" />
    </div>
  );
}
