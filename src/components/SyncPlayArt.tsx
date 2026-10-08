import type { JSX } from "react";

/**
 * Inline illustration of SyncPlay's lyric overlay with one word highlighted.
 * SyncPlay has no screenshot yet, so this is captioned "Illustration" and is
 * never presented as one.
 */
export default function SyncPlayArt({ className }: { className?: string }): JSX.Element {
  return (
    <figure className={className}>
      <svg
        role="img"
        aria-label="Illustration of a lyric overlay with one word highlighted"
        viewBox="0 0 640 360"
        width={640}
        height={360}
        className="h-auto w-full rounded"
      >
        <rect width="640" height="360" fill="#0a0f0c" />
        <rect x="40" y="40" width="560" height="40" rx="8" fill="#16201a" />
        <circle cx="64" cy="60" r="8" fill="#2f4f3a" />
        <rect x="84" y="54" width="180" height="12" rx="6" fill="#2f4f3a" />
        <rect x="40" y="130" width="560" height="150" rx="16" fill="#000000" fillOpacity="0.7" />
        <text x="320" y="190" textAnchor="middle" fontFamily="monospace" fontSize="28" fill="#8aa596">
          <tspan>words </tspan>
          <tspan fill="#00ff66" fontWeight="bold">
            light
          </tspan>
          <tspan> up in time</tspan>
        </text>
        <text x="320" y="236" textAnchor="middle" fontFamily="monospace" fontSize="22" fill="#5f7a6b">
          one at a time
        </text>
        <g fill="#2f4f3a">
          <rect x="40" y="310" width="8" height="20" />
          <rect x="56" y="300" width="8" height="30" />
          <rect x="72" y="305" width="8" height="25" />
          <rect x="88" y="295" width="8" height="35" />
          <rect x="104" y="308" width="8" height="22" />
        </g>
      </svg>
      <figcaption className="text-muted mt-2 text-xs">Illustration</figcaption>
    </figure>
  );
}
