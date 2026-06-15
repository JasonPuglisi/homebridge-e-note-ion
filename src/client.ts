import type { Logging } from 'homebridge';

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
    // /state returns JSON; the scheduler webhook (setAction) returns a plain
    // text body ("Discarded"/"Enqueued"), so only this path parses JSON.
    const text = await this.request('GET', '/state', this.stateSecret);
    try {
      const data = JSON.parse(text) as { modes?: { quiet?: unknown; public?: unknown } };
      if (data && data.modes) {
        return { quiet: Boolean(data.modes.quiet), public: Boolean(data.modes.public) };
      }
    } catch {
      // Ignore a malformed/non-JSON body — treat as "unknown state".
    }
    return null;
  }

  private async request(
    method: string,
    path: string,
    secret: string,
    body?: unknown,
  ): Promise<string> {
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
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }
}
