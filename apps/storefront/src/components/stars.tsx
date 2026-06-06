/**
 * Star rating display — fractional fill via gradient clip. Server-safe.
 */

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      aria-label={`Hodnocení ${value} z 5`}
      style={{
        position: 'relative',
        display: 'inline-block',
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '1px',
      }}
    >
      <span style={{ color: 'rgba(128,128,128,0.35)' }}>★★★★★</span>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          width: `${pct}%`,
          color: '#f5a623',
        }}
      >
        ★★★★★
      </span>
    </span>
  );
}

/** Compact 'avg (count)' summary; renders nothing when there are no reviews. */
export function RatingBadge({
  average,
  count,
  size = 14,
}: {
  average: number | null;
  count: number;
  size?: number;
}) {
  if (count === 0 || average === null) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Stars value={average} size={size} />
      <span style={{ fontSize: size - 1, color: 'var(--sf-muted, #666)' }}>
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}
