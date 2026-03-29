/**
 * Minimal Cloudflare Workers type shims.
 * Used when @cloudflare/workers-types is not installed locally.
 * Run `npm install` to get full types; this file provides fallback coverage.
 */

interface KVNamespace {
  get(key: string, options?: { type?: string }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// Ensure global Web API types are available for the worker runtime
declare function fetch(input: string | Request, init?: RequestInit): Promise<Response>;

declare class Request {
  constructor(input: string | Request, init?: RequestInit);
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

declare class Response {
  constructor(body?: BodyInit | null, init?: ResponseInit);
  readonly status: number;
  readonly headers: Headers;
  readonly body: ReadableStream | null;
}

interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
}

type BodyInit = string | Blob | ArrayBuffer | ReadableStream | null;
type HeadersInit = Record<string, string> | [string, string][] | Headers;

declare class Headers {
  constructor(init?: HeadersInit);
  get(name: string): string | null;
  set(name: string, value: string): void;
}

interface RequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit;
}

interface ReadableStream {
  readonly locked: boolean;
}

interface Blob {
  readonly size: number;
  readonly type: string;
}
