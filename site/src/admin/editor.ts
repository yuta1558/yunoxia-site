// Markdown editor for the CMS admin, in the spirit of Obsidian's live preview:
// headings, emphasis, links, code and quotes are styled in place as you write, and the Markdown
// marks (#, **, `, [](…)) are hidden except on the part the cursor is in, so the text reads like
// the published page while staying plain Markdown. Images show inline; pasting or dropping an image
// uploads it. Built by scripts/build-admin.mjs into public/admin/editor.js (same origin, so the
// admin's strict CSP holds) and driven from admin.js through window.YxEditor.

import { EditorSelection, EditorState, type Range } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  drawSelection,
  keymap,
  placeholder,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import { deleteMarkupBackward, insertNewlineContinueMarkup, markdownLanguage } from '@codemirror/lang-markdown';

type Options = {
  onChange: (value: string) => void;
  upload: (file: File) => Promise<string>;
  onStatus: (text: string) => void;
};

// ---- Live preview decorations --------------------------------------------------

class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM() {
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.className = 'yx-img';
    return img;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const dot = document.createElement('span');
    dot.className = 'yx-list';
    dot.textContent = '•';
    return dot;
  }
}

class RuleWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('span');
    hr.className = 'yx-hr';
    return hr;
  }
}

const hide = Decoration.replace({});
const mark = (cls: string) => Decoration.mark({ class: cls });
const line = (cls: string) => Decoration.line({ class: cls });

// Marks are shown while the selection touches the element they belong to
const touches = (view: EditorView, from: number, to: number) =>
  view.state.selection.ranges.some((r) => r.from <= to && r.to >= from);

// Line-level marks (> and list bullets) are shown while the selection is on that line
const onLine = (view: EditorView, pos: number) => {
  const l = view.state.doc.lineAt(pos);
  return touches(view, l.from, l.to);
};

function build(view: EditorView): DecorationSet {
  const out: Range<Decoration>[] = [];
  const doc = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const name = node.name;
        const heading = /^ATXHeading([1-6])$/.exec(name);
        if (heading) {
          out.push(line(`yx-h yx-h${heading[1]}`).range(doc.lineAt(node.from).from));
          const active = touches(view, node.from, node.to);
          const m = node.node.getChild('HeaderMark');
          // Hide "## " (the mark and the space after it) away from the cursor
          if (m && !active) out.push(hide.range(m.from, Math.min(m.to + 1, node.to)));
          return;
        }
        switch (name) {
          case 'StrongEmphasis':
          case 'Emphasis':
          case 'Strikethrough':
          case 'InlineCode': {
            const cls = { StrongEmphasis: 'yx-strong', Emphasis: 'yx-em', Strikethrough: 'yx-del', InlineCode: 'yx-code' }[name];
            out.push(mark(cls).range(node.from, node.to));
            if (!touches(view, node.from, node.to)) {
              const markName = name === 'InlineCode' ? 'CodeMark' : name === 'Strikethrough' ? 'StrikethroughMark' : 'EmphasisMark';
              for (const m of node.node.getChildren(markName)) out.push(hide.range(m.from, m.to));
            }
            return name === 'InlineCode' ? false : undefined;
          }
          case 'Link': {
            const marks = node.node.getChildren('LinkMark');
            const url = node.node.getChild('URL');
            if (marks.length >= 2) out.push(mark('yx-link').range(marks[0].to, marks[1].from));
            if (!touches(view, node.from, node.to) && marks.length >= 2) {
              out.push(hide.range(marks[0].from, marks[0].to));
              out.push(hide.range(marks[1].from, node.to)); // "](url)"
            }
            if (url) out.push(mark('yx-url').range(url.from, url.to));
            return false;
          }
          case 'Image': {
            const url = node.node.getChild('URL');
            const marks = node.node.getChildren('LinkMark');
            if (url && !touches(view, node.from, node.to)) {
              const alt = marks.length >= 2 ? doc.sliceString(marks[0].to, marks[1].from) : '';
              out.push(Decoration.replace({ widget: new ImageWidget(doc.sliceString(url.from, url.to), alt) }).range(node.from, node.to));
            } else {
              out.push(mark('yx-url').range(node.from, node.to));
            }
            return false;
          }
          case 'Blockquote': {
            for (let pos = node.from; pos <= node.to; ) {
              const l = doc.lineAt(pos);
              out.push(line('yx-quote').range(l.from));
              pos = l.to + 1;
            }
            return;
          }
          case 'QuoteMark': {
            if (onLine(view, node.from)) out.push(mark('yx-mark').range(node.from, node.to));
            else out.push(hide.range(node.from, doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to));
            return;
          }
          case 'ListMark': {
            const bullet = /^[-*+]$/.test(doc.sliceString(node.from, node.to));
            if (bullet && !onLine(view, node.from)) out.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
            else out.push(mark('yx-list').range(node.from, node.to));
            return;
          }
          case 'HorizontalRule':
            if (!touches(view, node.from, node.to)) out.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
            return;
          case 'FencedCode': {
            for (let pos = node.from; pos <= node.to; ) {
              const l = doc.lineAt(pos);
              out.push(line('yx-fence').range(l.from));
              pos = l.to + 1;
            }
            for (const m of node.node.getChildren('CodeMark')) out.push(mark('yx-mark').range(m.from, m.to));
            const info = node.node.getChild('CodeInfo');
            if (info) out.push(mark('yx-mark').range(info.from, info.to));
            return false;
          }
        }
      },
    });
  }
  return Decoration.set(out, true);
}

const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// ---- Formatting commands --------------------------------------------------------

// Wrap the selection in `before`/`after` (with no selection, the cursor lands between them);
// unwrap if already wrapped
function wrap(view: EditorView, before: string, after = before) {
  view.dispatch(
    view.state.changeByRange((range) => {
      const { from, to } = range;
      const doc = view.state.doc;
      const wrapped = doc.sliceString(from - before.length, from) === before && doc.sliceString(to, to + after.length) === after;
      if (wrapped) {
        return {
          changes: [
            { from: from - before.length, to: from, insert: '' },
            { from: to, to: to + after.length, insert: '' },
          ],
          range: EditorSelection.range(from - before.length, to - before.length),
        };
      }
      return {
        changes: [
          { from, insert: before },
          { from: to, insert: after },
        ],
        range: EditorSelection.range(from + before.length, to + before.length),
      };
    }),
  );
  view.focus();
  return true;
}

// Set or toggle a prefix ("## ", "- ", "> ", "1. ") on every selected line
function prefix(view: EditorView, mark: string) {
  const { state } = view;
  const changes: { from: number; to?: number; insert: string }[] = [];
  const seen = new Set<number>();
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to; ) {
      const l = state.doc.lineAt(pos);
      if (!seen.has(l.from)) {
        seen.add(l.from);
        const existing = /^(#{1,6} |[-*+] |> |\d+\. )/.exec(l.text);
        if (existing?.[0] === mark) changes.push({ from: l.from, to: l.from + mark.length, insert: '' });
        else changes.push({ from: l.from, to: l.from + (existing?.[0].length ?? 0), insert: mark });
      }
      pos = l.to + 1;
    }
  }
  view.dispatch({ changes });
  view.focus();
  return true;
}

function link(view: EditorView) {
  const r = view.state.selection.main;
  const text = view.state.sliceDoc(r.from, r.to) || 'リンク';
  const insert = `[${text}](https://)`;
  view.dispatch({
    changes: { from: r.from, to: r.to, insert },
    // Select the URL so it can be typed over
    selection: EditorSelection.range(r.from + text.length + 3, r.from + insert.length - 1),
  });
  view.focus();
  return true;
}

// Enter on an empty top-level quote line or list item leaves the block with a blank line after it
// (CodeMirror would add another "> ", or leave the cursor where a paragraph continues the list)
function exitBlock(view: EditorView) {
  const r = view.state.selection.main;
  if (!r.empty) return false;
  const l = view.state.doc.lineAt(r.head);
  if (!/^(>|[-*+]|\d+[.)])\s*$/.test(l.text) || r.head !== l.to) return false;
  // The blank line keeps the next paragraph from continuing the block lazily
  view.dispatch({ changes: { from: l.from, to: l.to, insert: '\n' }, selection: { anchor: l.from + 1 } });
  return true;
}

function insertBlock(view: EditorView, text: string) {
  const r = view.state.selection.main;
  const l = view.state.doc.lineAt(r.from);
  const lead = l.text.trim() ? '\n\n' : '';
  view.dispatch({ changes: { from: r.to, insert: `${lead}${text}\n` }, selection: { anchor: r.to + lead.length + text.length } });
  view.focus();
  return true;
}

// ---- Theme ----------------------------------------------------------------------

const theme = EditorView.theme({
  '&': { fontSize: '16px', border: '1px solid var(--line)', background: 'var(--paper)' },
  '&.cm-focused': { outline: 'none', borderColor: 'var(--ink)' },
  '.cm-scroller': { fontFamily: 'var(--sans)', lineHeight: '1.9', minHeight: '30rem' },
  '.cm-content': { padding: '1.25rem 1.5rem', caretColor: 'var(--pen)', maxWidth: '44rem' },
  '.cm-cursor': { borderLeftColor: 'var(--pen)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'color-mix(in srgb, var(--pen) 18%, transparent) !important' },
  '.cm-placeholder': { color: 'var(--muted)' },
  '.yx-h': { fontWeight: '300', letterSpacing: '-0.03em', lineHeight: '1.3' },
  '.yx-h1, .yx-h2': { fontSize: '1.6em', paddingTop: '0.9em' },
  '.yx-h3': { fontSize: '1.25em', paddingTop: '0.6em' },
  '.yx-h4, .yx-h5, .yx-h6': { fontSize: '1.05em', paddingTop: '0.4em' },
  '.yx-strong': { fontWeight: '700' },
  '.yx-em': { fontStyle: 'italic' },
  '.yx-del': { textDecoration: 'line-through' },
  '.yx-code': { fontFamily: 'var(--mono)', fontSize: '0.875em', background: 'var(--surface)', padding: '0.1em 0.3em' },
  '.yx-link': { color: 'var(--pen)', textDecoration: 'underline', textUnderlineOffset: '0.2em' },
  '.yx-url': { color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.85em' },
  '.yx-mark': { color: 'var(--muted)' },
  '.yx-list': { color: 'var(--pen)' },
  '.yx-quote': { borderLeft: '1.5px solid var(--ink)', paddingLeft: '1rem !important', color: 'var(--muted)' },
  '.yx-fence': { fontFamily: 'var(--mono)', fontSize: '0.875em', background: 'var(--surface)', lineHeight: '1.6' },
  '.yx-img': { display: 'block', maxWidth: '100%', maxHeight: '22rem', margin: '0.5rem 0' },
  '.yx-hr': { display: 'inline-block', width: '100%', borderTop: '1px solid var(--line)', verticalAlign: 'middle' },
});

// ---- Mount ----------------------------------------------------------------------

export function mount(host: HTMLElement, opts: Options) {
  let view: EditorView;

  const uploadAndInsert = async (files: File[], at: number) => {
    for (const file of files) {
      opts.onStatus('アップロード中…');
      try {
        const url = await opts.upload(file);
        const text = `![](${url})\n`;
        view.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length } });
        at += text.length;
        opts.onStatus('画像を入れました。');
      } catch (e) {
        opts.onStatus(`アップロードに失敗しました：${e instanceof Error ? e.message : e}`);
      }
    }
  };
  const imagesOf = (list: FileList | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'));

  const extensions = [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': '本文（Markdown）', 'aria-multiline': 'true' }),
    markdownLanguage, // GFM without the nested HTML/JS/CSS parsers, which would triple the bundle
    livePreview,
    theme,
    placeholder('本文を書く。見出しは「## 」、箇条書きは「- 」で始める。画像は貼り付けかドラッグで入る。'),
    keymap.of([
      // Enter continues a list or quote, Backspace at its start removes the mark (as in Obsidian)
      { key: 'Enter', run: (v) => exitBlock(v) || insertNewlineContinueMarkup(v) },
      { key: 'Backspace', run: deleteMarkupBackward },
      { key: 'Mod-b', run: (v) => wrap(v, '**') },
      { key: 'Mod-i', run: (v) => wrap(v, '*') },
      { key: 'Mod-k', run: link },
      { key: 'Mod-e', run: (v) => wrap(v, '`') },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) opts.onChange(u.state.doc.toString());
    }),
    EditorView.domEventHandlers({
      paste(event, v) {
        const files = imagesOf(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        uploadAndInsert(files, v.state.selection.main.head);
        return true;
      },
      drop(event, v) {
        const files = imagesOf(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const pos = v.posAtCoords({ x: event.clientX, y: event.clientY }) ?? v.state.selection.main.head;
        uploadAndInsert(files, pos);
        return true;
      },
    }),
  ];
  view = new EditorView({ parent: host, state: EditorState.create({ doc: '', extensions }) });

  return {
    getValue: () => view.state.doc.toString(),
    // Replaces the whole document without recording an undo step or firing onChange's "dirty"
    setValue(value: string) {
      view.setState(EditorState.create({ doc: value, extensions }));
    },
    insert(text: string) {
      const r = view.state.selection.main;
      view.dispatch({ changes: { from: r.from, to: r.to, insert: text }, selection: { anchor: r.from + text.length } });
      view.focus();
    },
    focus: () => view.focus(),
    command(name: string) {
      const commands: Record<string, () => boolean> = {
        h2: () => prefix(view, '## '),
        h3: () => prefix(view, '### '),
        bold: () => wrap(view, '**'),
        italic: () => wrap(view, '*'),
        code: () => wrap(view, '`'),
        link: () => link(view),
        bullet: () => prefix(view, '- '),
        number: () => prefix(view, '1. '),
        quote: () => prefix(view, '> '),
        rule: () => insertBlock(view, '---'),
        codeblock: () => insertBlock(view, '```\n\n```'),
      };
      return commands[name]?.() ?? false;
    },
  };
}

declare global {
  interface Window {
    YxEditor?: { mount: typeof mount };
  }
}
window.YxEditor = { mount };
