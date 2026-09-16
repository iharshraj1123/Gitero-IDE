import { marked } from 'marked';

export class MarkdownViewerComponent {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render(markdownText: string, filePath?: string): Promise<void> {
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
