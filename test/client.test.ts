import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ENotEionClient } from '../src/client';

// Minimal Logging stub — the client only takes it; tests don't assert on logs.
const log = { info() {}, warn() {}, error() {}, debug() {}, success() {}, log() {} } as never;

let originalFetch: typeof fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ENotEionClient', () => {
  it('setAction tolerates a plain-text body and sends the right request', async () => {
    let captured: { url: string; opts: RequestInit } | undefined;
    globalThis.fetch = (async (url: string, opts: RequestInit) => {
      captured = { url, opts };
      return new Response('Discarded', { status: 200 }); // plain text, not JSON
    }) as unknown as typeof fetch;

    const client = new ENotEionClient('http://board:8080', 'sched-secret', 'state-secret', log);
    await client.setAction('quiet'); // must not throw on the plain-text body

    assert.ok(captured);
    assert.equal(captured.opts.method, 'POST');
    assert.match(String(captured.url), /\/webhook\/scheduler$/);
    assert.equal((captured.opts.headers as Record<string, string>)['X-Webhook-Secret'], 'sched-secret');
    assert.deepEqual(JSON.parse(captured.opts.body as string), { action: 'quiet' });
  });

  it('getModes parses the modes object using the state secret', async () => {
    let header: string | undefined;
    globalThis.fetch = (async (_url: string, opts: RequestInit) => {
      header = (opts.headers as Record<string, string>)['X-Webhook-Secret'];
      return new Response(JSON.stringify({ modes: { quiet: true, public: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const client = new ENotEionClient('http://board:8080', 'sched-secret', 'STATE', log);
    assert.deepEqual(await client.getModes(), { quiet: true, public: false });
    assert.equal(header, 'STATE');
  });

  it('getModes tolerates a non-JSON body (returns null)', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 200 })) as unknown as typeof fetch;
    const client = new ENotEionClient('http://board:8080', 's', 'st', log);
    assert.equal(await client.getModes(), null);
  });

  it('throws on a non-OK status', async () => {
    globalThis.fetch = (async () => new Response('Unauthorized', { status: 401 })) as unknown as typeof fetch;
    const client = new ENotEionClient('http://board:8080', 's', 'st', log);
    await assert.rejects(() => client.setAction('wake'));
  });
});
