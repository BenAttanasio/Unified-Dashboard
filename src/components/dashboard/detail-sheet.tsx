"use client";
import type { ReactNode } from "react";

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small text shown next to the title, e.g. a status. */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Touch-friendly bottom sheet with a dimmed backdrop. Tap the backdrop or the
 * ✕ to dismiss. Used for the live-log drawer and the service error detail.
 */
export function DetailSheet({ open, onClose, title, badge, children }: DetailSheetProps) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <span className="sheet-title">
            {title}
            {badge != null ? <span className="sheet-badge">{badge}</span> : null}
          </span>
          <button className="sheet-close tappable" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
