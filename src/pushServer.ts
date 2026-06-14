import { createServer, Server } from 'node:http';

import { Logging } from 'homebridge';

export type ModeCharacteristic = 'quiet' | 'public';

/**
 * Optional HTTP receiver for instant push updates from e-note-ion.
 *
 * e-note-ion's `[homebridge].url` points here; on a quiet/public transition it
 * POSTs `{"characteristic": "quiet"|"public", "value": true|false}`. Updates are
 * applied immediately, avoiding poll latency. Authenticated with an optional
 * shared secret via the X-Webhook-Secret header.
 */
export class PushServer {
  private server?: Server;

  constructor(
    private readonly port: number,
    private readonly secret: string,
    private readonly log: Logging,
    private readonly onUpdate: (characteristic: ModeCharacteristic, value: boolean) => void,
  ) {}

  start(): void {
    this.server = createServer((req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405).end('Method Not Allowed');
        return;
      }
      if (this.secret && req.headers['x-webhook-secret'] !== this.secret) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 4096) {
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body) as { characteristic?: unknown; value?: unknown };
          if (data.characteristic === 'quiet' || data.characteristic === 'public') {
            this.onUpdate(data.characteristic, Boolean(data.value));
          }
          res.writeHead(200).end('OK');
        } catch {
          res.writeHead(400).end('Bad Request');
        }
      });
    });
    this.server.on('error', (e) => this.log.error(`Push server error: ${e.message}`));
    this.server.listen(this.port, () => this.log.info(`Push server listening on port ${this.port}`));
  }

  stop(): void {
    this.server?.close();
  }
}
