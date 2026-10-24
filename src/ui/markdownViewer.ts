import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { isExternalUrl, openExternal } from '../services/externalLinkService';

export interface MarkdownViewerOptions {
  onOpenFile?: (path: string) => void;
}

let markedExtensionsConfigured = false;

function ensureMarkedExtensionsConfigured(): void {
  if (markedExtensionsConfigured) return;
  markedExtensionsConfigured = true;

  // 1. Official marked-katex-extension for inline ($...$) and block ($$...$$) math
  marked.use(
    markedKatex({
      throwOnError: false
    })
  );

  // 2. Custom extensions for \( ... \) inline, \[ ... \] display, and ```math / ```katex code blocks
  const inlineLatexParenRule = /^\\\(([\s\S]+?)\\\)/;
  const blockLatexBracketRule = /^\\\[([\s\S]+?)\\\]/;

  marked.use({
    extensions: [
      {
        name: 'inlineLatexParen',
        level: 'inline',
        start(src: string) {
          return src.indexOf('\\(');
        },
        tokenizer(src: string) {
          const match = src.match(inlineLatexParenRule);
          if (match) {
            return {
              type: 'inlineLatexParen',
              raw: match[0],
              text: match[1].trim()
            };
          }
        },
        renderer(token: any) {
          try {
            return katex.renderToString(token.text, {
              displayMode: false,
              throwOnError: false
            });
          } catch {
            return token.raw;
          }
        }
      },
      {
        name: 'blockLatexBracket',
        level: 'block',
        start(src: string) {
          return src.indexOf('\\[');
        },
        tokenizer(src: string) {
          const match = src.match(blockLatexBracketRule);
          if (match) {
            return {
              type: 'blockLatexBracket',
              raw: match[0],
              text: match[1].trim()
            };
          }
        },
        renderer(token: any) {
          try {
            return `<div class="katex-display-block">${katex.renderToString(token.text, {
              displayMode: true,
              throwOnError: false
            })}</div>\n`;
          } catch {
            return token.raw;
          }
        }
      }
    ],
    renderer: {
      code(token: any) {
        const lang = (token.lang || '').trim().toLowerCase();
        if (lang === 'math' || lang === 'katex') {
          try {
            return `<div class="katex-display-block">${katex.renderToString(token.text, {
              displayMode: true,
              throwOnError: false
            })}</div>\n`;
          } catch (e) {
            return `<div class="katex-error">${e}</div>\n`;
          }
        }
        return false;
      }
    }
  });
}

export class MarkdownViewerComponent {
  private container: HTMLElement;
  private options?: MarkdownViewerOptions;
  private currentFilePath?: string;

  constructor(container: HTMLElement, options?: MarkdownViewerOptions) {
    this.container = container;
    this.options = options;
    ensureMarkedExtensionsConfigured();
    this.setupListeners();
  }

  private setupListeners() {
    this.container.addEventListener('click', (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // 1. External URLs -> open in OS default browser
      if (isExternalUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        openExternal(href);
        return;
      }

      // 2. In-document fragment hash links -> scroll into view
      if (href.startsWith('#')) {
        e.preventDefault();
        e.stopPropagation();
        const targetId = decodeURIComponent(href.slice(1));
        if (targetId) {
          const targetEl =
            this.container.querySelector(`[id="${CSS.escape(targetId)}"]`) ||
            this.container.querySelector(`[name="${CSS.escape(targetId)}"]`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        }
        return;
      }

      // 3. Local relative file links -> open in Gitero IDE editor
      if (this.options?.onOpenFile && this.currentFilePath) {
        e.preventDefault();
        e.stopPropagation();
        const normalizedBase = this.currentFilePath.replace(/[\\/][^\\/]+$/, '');
        const targetRel = href.replace(/^\.\//, '');
        const separator = this.currentFilePath.includes('\\') ? '\\' : '/';
        const resolvedPath = `${normalizedBase}${separator}${targetRel}`;
        this.options.onOpenFile(resolvedPath);
      }
    });
  }

  async render(markdownText: string, filePath?: string): Promise<void> {
    this.currentFilePath = filePath;
    try {
      const parsedHtml = await marked.parse(markdownText, {
        gfm: true,
        breaks: true
      });

      this.container.innerHTML = `
        <div class="markdown-preview-container">
          <div class="markdown-content">
            ${parsedHtml}
          </div>
        </div>
      `;

      // Tag all external links with rel and target attributes for security and clarity
      const anchors = this.container.querySelectorAll('a');
      anchors.forEach((a) => {
        const href = a.getAttribute('href');
        if (isExternalUrl(href)) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          a.setAttribute('title', `${href} (Opens in OS default browser)`);
        }
      });
    } catch (err) {
      this.container.innerHTML = `
        <div class="markdown-error">
          <p>Failed to render Markdown content.</p>
          <code>${err}</code>
        </div>
      `;
    }
  }

  clear() {
    this.container.innerHTML = '';
  }
}
