import { Fragment, type ReactNode } from "react";

/**
 * Renders the tiny subset of Markdown the assistant uses (**bold**, _italic_,
 * line breaks, "•" bullets) as React elements. No HTML is injected, so a
 * reply can never run script in the page.
 */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return <em key={i} className="text-muted">{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const bullet = line.match(/^\s*(?:[-*•])\s+(.*)$/);
        if (bullet) {
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden className="text-muted">•</span>
              <span>{inline(bullet[1])}</span>
            </p>
          );
        }
        return line.trim() ? <p key={i}>{inline(line)}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}
