import { Fragment, type ReactNode } from 'react';

/** Renders inline **bold**, *italic*, ~~strike~~ and `code` as React elements (no HTML injection). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith('**')) out.push(<strong key={k}>{inline(t.slice(2, -2), k)}</strong>);
    else if (t.startsWith('~~')) out.push(<s key={k} className="text-red-600 dark:text-red-400">{t.slice(2, -2)}</s>);
    else if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else out.push(<em key={k}>{inline(t.slice(1, -1), k)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Minimal markdown: ## headings, - bullet lists, paragraphs. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="prose-lesson">
      {blocks.map((b, bi) => {
        const lines = b.split('\n');
        if (lines[0].startsWith('## ')) {
          return (
            <Fragment key={bi}>
              <h2>{inline(lines[0].slice(3), `h${bi}`)}</h2>
              {lines.length > 1 && <Markdown text={lines.slice(1).join('\n')} />}
            </Fragment>
          );
        }
        if (lines.every((l) => l.startsWith('- ') || l.startsWith('  '))) {
          return (
            <ul key={bi}>
              {lines.filter((l) => l.startsWith('- ')).map((l, li) => <li key={li}>{inline(l.slice(2), `l${bi}-${li}`)}</li>)}
            </ul>
          );
        }
        const listStart = lines.findIndex((l) => l.startsWith('- '));
        if (listStart > 0) {
          return (
            <Fragment key={bi}>
              <p>{inline(lines.slice(0, listStart).join(' '), `p${bi}`)}</p>
              <ul>{lines.slice(listStart).filter((l) => l.startsWith('- ')).map((l, li) => <li key={li}>{inline(l.slice(2), `l${bi}-${li}`)}</li>)}</ul>
            </Fragment>
          );
        }
        return <p key={bi}>{inline(lines.join(' '), `p${bi}`)}</p>;
      })}
    </div>
  );
}
