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
      // 1. Locate "Content-Length:" header case-insensitively
      const clIndex = this.findContentLengthIndex(this.buffer);
      if (clIndex === -1) {
        // Retain only the trailing 15 bytes in case "Content-Length:" was split across chunks
        if (this.buffer.length > 15) {
          this.buffer = this.buffer.slice(this.buffer.length - 15);
        }
        break;
      }

      // If there was any non-LSP output or noise before Content-Length, safely discard it
      if (clIndex > 0) {
        this.buffer = this.buffer.subarray(clIndex);
      }

      // 2. Locate header delimiter: \r\n\r\n (standard LSP) or \n\n (fallback)
      const delim = this.findHeaderDelimiter(this.buffer);
      if (!delim) {
        // Headers are incomplete; wait for more incoming chunks
        break;
      }

      // 3. Extract and parse Content-Length
      const headerBytes = this.buffer.subarray(0, delim.index);
      const headerText = this.decoder.decode(headerBytes);
      const match = headerText.match(/Content-Length:\s*(\d+)/i);

      if (!match) {
        // Malformed header; advance past delimiter to seek next header
        this.buffer = this.buffer.subarray(delim.index + delim.length);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStartIndex = delim.index + delim.length;
      const totalRequired = bodyStartIndex + contentLength;

      // 4. Wait until the entire message body has arrived in the buffer
      if (this.buffer.length < totalRequired) {
        break;
      }

      // 5. Slice exact body bytes and advance buffer
      const bodyBytes = this.buffer.subarray(bodyStartIndex, totalRequired);
      const bodyText = this.decoder.decode(bodyBytes);
      this.buffer = this.buffer.subarray(totalRequired);

      try {
        const parsed = JSON.parse(bodyText);
        messages.push(parsed);
      } catch (err) {
        console.warn('[LSP JSON-RPC] Failed to parse message body:', err, 'Body length:', bodyText.length);
      }
    }

    return messages;
  }

  private findContentLengthIndex(buf: Uint8Array): number {
    // ASCII codes for "content-length:" (lowercase)
    const target = [99, 111, 110, 116, 101, 110, 116, 45, 108, 101, 110, 103, 116, 104, 58];
    const len = target.length;
    for (let i = 0; i <= buf.length - len; i++) {
      let matched = true;
      for (let j = 0; j < len; j++) {
        let b = buf[i + j];
        if (b >= 65 && b <= 90) b += 32; // case-insensitive ASCII
        if (b !== target[j]) {
          matched = false;
          break;
        }
      }
      if (matched) return i;
    }
    return -1;
  }

  private findHeaderDelimiter(buf: Uint8Array): { index: number; length: number } | null {
    for (let i = 0; i <= buf.length - 2; i++) {
      if (i <= buf.length - 4 && buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) {
        return { index: i, length: 4 };
      }
      if (buf[i] === 10 && buf[i + 1] === 10) {
        return { index: i, length: 2 };
      }
    }
    return null;
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
