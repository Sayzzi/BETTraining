import type { SymbolId } from "@/engine/symbol-digit";

// Drawn in SVG so every device shows the same shapes.
const SHAPES: Record<SymbolId, React.ReactNode> = {
  circle: <circle cx="12" cy="12" r="8" />,
  square: <rect x="4.5" y="4.5" width="15" height="15" />,
  triangle: <path d="M12 3.5 21 19.5H3Z" />,
  diamond: <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />,
  cross: <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5Z" />,
  star: <path d="m12 2.5 2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7Z" />,
  ring: <path fillRule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />,
  half: <path d="M3 13a9 9 0 0 1 18 0Z" />,
  hexagon: <path d="M7.5 3.5h9L21 12l-4.5 8.5h-9L3 12Z" />,
};

export function SymbolGlyph({ symbol, className }: { symbol: SymbolId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {SHAPES[symbol]}
    </svg>
  );
}
