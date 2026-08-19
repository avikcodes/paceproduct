declare module "ws" {
  export class WebSocket {
    static OPEN: number;
    constructor(url: string | URL, protocols?: string | string[]);
    send(data: string | ArrayBuffer | ArrayBufferView): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: (...args: never[]) => void): void;
    onopen: ((event: unknown) => void) | null;
    onmessage: ((event: unknown) => void) | null;
    onerror: ((event: unknown) => void) | null;
    onclose: ((event: unknown) => void) | null;
  }
  export const WebSocketClient: typeof WebSocket;
}