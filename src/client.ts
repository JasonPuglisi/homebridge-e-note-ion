import { Logging } from 'homebridge';

export type SchedulerAction = 'quiet' | 'wake' | 'public' | 'private';

export interface ModeState {
  quiet: boolean;
  public: boolean;
}

/**
 * Thin HTTP client for the e-note-ion webhook API.
 *
 *  - setAction() → POST /webhook/scheduler  (scheduler credential)
 *  - getModes()  → GET  /state              (state credential)
 *
 * Uses the global fetch (Node 20+). All requests are bounded by a timeout so a
 * slow/unreachable board can never stall the platform.
 */
export class ENotEionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly schedulerSecret: string,
    private readonly stateSecret: string,
    private readonly log: Logging,
    private readonly timeoutMs = 5000,
  ) {}

  async setAction(action: SchedulerAction): Promise<void> {
    await this.request('POST', '/webhook/scheduler', this.schedulerSecret, { action });
  }

  async getModes(): Promise<ModeState | null> {
    const data = await this.request('GET', '/state', this.stateSecret);
    if (data && typeof data === 'object' && 'modes' in data) {
      const modes = (data as { modes: { quiet?: unknown; public?: unknown } }).modes;
      return { quiet: Boolean(modes.quiet), public: Boolean(modes.public) };
    }
    return null;
  }

  private async request(
    method: string,
    path: string,
    secret: string,
    body?: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (secret) {
        headers['X-Webhook-Secret'] = secret;
      }
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      return text ? (JSON.parse(text) as unknown) : null;
    } finally {
      clearTimeout(timer);
    }
  }
}
