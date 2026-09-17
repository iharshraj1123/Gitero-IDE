/**
 * JSON-RPC 2.0 Streaming Protocol Handler for Language Server Protocol
 * Handles byte-accurate Content-Length framing, request/response tracking, and notifications.
 */

import { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './lspTypes';

export type NotificationHandler = (method: string, params: any) => void;
export type RequestHandler = (method: string, params: any) => Promise<any> | any;

export class JsonRpcStreamDecoder {
  private buffer: Uint8Array = new Uint8Array(0);
  private encoder = new TextEncoder();
  private decoder = new TextDecoder('utf-8');

  /**
   * Appends incoming string chunk from stdout, decodes complete JSON-RPC messages.
   */
  push(chunk: string): (JsonRpcResponse | JsonRpcNotification | JsonRpcRequest)[] {
    const chunkBytes = this.encoder.encode(chunk);
    const newBuf = new Uint8Array(this.buffer.length + chunkBytes.length);
    newBuf.set(this.buffer, 0);
    newBuf.set(chunkBytes, this.buffer.length);
    this.buffer = newBuf;

    const messages: (JsonRpcResponse | JsonRpcNotification | JsonRpcRequest)[] = [];

    while (true) {
      // Find \r\n\r\n (bytes: 13, 10, 13, 10)
      const headerEndIndex = this.findHeaderEnd(this.buffer);
      if (headerEndIndex === -1) break;

      // Extract headers
      const headerBytes = this.buffer.subarray(0, headerEndIndex);
      const headerText = this.decoder.decode(headerBytes);
      const match = headerText.match(/Content-Length:\s*(\d+)/i);

      if (!match) {
        // Skip malformed header up past the delimiter
        this.buffer = this.buffer.subarray(headerEndIndex + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStartIndex = headerEndIndex + 4;
      const totalRequired = bodyStartIndex + contentLength;

      // Wait until we have the entire message body
      if (this.buffer.length < totalRequired) {
        break;
      }

      const bodyBytes = this.buffer.subarray(bodyStartIndex, totalRequired);
      const bodyText = this.decoder.decode(bodyBytes);
      this.buffer = this.buffer.subarray(totalRequired);

      try {
        const parsed = JSON.parse(bodyText);
        messages.push(parsed);
      } catch (err) {
        console.warn('[LSP JSON-RPC] Failed to parse message body:', err, bodyText);
      }
    }

    return messages;
  }

  private findHeaderEnd(buf: Uint8Array): number {
    for (let i = 0; i <= buf.length - 4; i++) {
      if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
        return i;
      }
    }
    return -1;
  }

  clear() {
    this.buffer = new Uint8Array(0);
  }
}

export class JsonRpcConnection {
  private nextId = 1;
  private pendingRequests = new Map<number | string, {
    resolve: (res: any) => void;
    reject: (err: any) => void;
    timer: any;
    method: string;
  }>();

  private notificationHandlers: NotificationHandler[] = [];
  private requestHandlers = new Map<string, RequestHandler>();
  private decoder = new JsonRpcStreamDecoder();
  private encoder = new TextEncoder();

  constructor(private readonly sendRaw: (data: string) => Promise<void>) {}

  /**
   * Feeds raw string received from the language server process stdout.
   */
  handleIncomingChunk(chunk: string) {
    const messages = this.decoder.push(chunk);
    for (const msg of messages) {
      this.dispatch(msg);
    }
  }

  private dispatch(msg: any) {
    // Response to a client request (has id, result or error, no method)
    if ('id' in msg && ('result' in msg || 'error' in msg) && !('method' in msg)) {
      const id = msg.id;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(id);
        if (msg.error) {
          pending.reject(new Error(`[LSP ${pending.method}] ${msg.error.message || JSON.stringify(msg.error)}`));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Server-to-client request (has id and method)
    if ('id' in msg && 'method' in msg) {
      const handler = this.requestHandlers.get(msg.method);
      if (handler) {
        Promise.resolve(handler(msg.method, msg.params))
          .then((res) => {
            this.sendResponse(msg.id, res);
          })
          .catch((err) => {
            this.sendError(msg.id, -32603, err?.message || String(err));
          });
      } else {
        // Method not found
        this.sendError(msg.id, -32601, `Method '${msg.method}' not implemented`);
      }
      return;
    }

    // Notification (has method, no id)
    if ('method' in msg && !('id' in msg)) {
      for (const handler of this.notificationHandlers) {
        try {
          handler(msg.method, msg.params);
        } catch (err) {
          console.error('[LSP JSON-RPC] Notification handler error:', err);
        }
      }
    }
  }

  /**
   * Sends a request to the language server and waits for response.
   */
  async request<T = any>(method: string, params?: any, timeoutMs = 12000): Promise<T> {
    const id = this.nextId++;
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`[LSP Request Timeout] Method '${method}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer, method });
      this.sendPayload(req).catch((err) => {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      });
    });
  }

  /**
   * Sends a notification to the language server (no response expected).
   */
  async notify(method: string, params?: any): Promise<void> {
    const notif: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params
    };
    await this.sendPayload(notif);
  }

  /**
   * Registers a listener for server notifications (e.g. diagnostics, logs).
   */
  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.push(handler);
    return () => {
      const idx = this.notificationHandlers.indexOf(handler);
      if (idx !== -1) this.notificationHandlers.splice(idx, 1);
    };
  }

  /**
   * Registers a handler for server-to-client requests.
   */
  onRequest(method: string, handler: RequestHandler) {
    this.requestHandlers.set(method, handler);
  }

  private async sendResponse(id: number | string, result: any): Promise<void> {
    const res: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result
    };
    await this.sendPayload(res);
  }

  private async sendError(id: number | string, code: number, message: string): Promise<void> {
    const res: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message }
    };
    await this.sendPayload(res);
  }

  private async sendPayload(payload: any): Promise<void> {
    const json = JSON.stringify(payload);
    const byteLength = this.encoder.encode(json).length;
    const framed = `Content-Length: ${byteLength}\r\n\r\n${json}`;
    await this.sendRaw(framed);
  }

  /**
   * Rejects all pending requests and resets connection state.
   */
  dispose() {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error(`[LSP Connection Closed] Request '${req.method}' aborted.`));
    }
    this.pendingRequests.clear();
    this.decoder.clear();
  }
}
