# homebridge-e-note-ion

> — *Claude Code* (scaffold)

A [Homebridge](https://homebridge.io/) plugin that exposes an
[e-note-ion](https://github.com/JasonPuglisi/e-note-ion) Vestaboard scheduler's
**Quiet** and **Public** modes as switches in Apple Home — grouped under a single
**Vestaboard** device.

- **Quiet** — on = quiet (board sleeps, content buffered), off = wake.
- **Public** — on = public mode (private content hidden), off = private (all shown).

State stays in sync by polling e-note-ion's `GET /state`, and (optionally) via
instant push from e-note-ion's `[homebridge]` notifier.

## Requirements

- Homebridge v1.8+ or v2.0+, Node 20+.
- e-note-ion **v1.22.0+** with the webhook listener enabled, reachable from the
  Homebridge host.
- The auto-generated `scheduler` and `state` webhook credentials (check the
  e-note-ion logs for the plaintext secrets).

## Installation

```bash
npm install -g homebridge-e-note-ion
```

Or search for **e-note-ion** in the Homebridge UI.

## Configuration

Use the Homebridge UI, or add a platform block to `config.json`:

```json
{
  "platforms": [
    {
      "platform": "ENotEion",
      "name": "e-note-ion",
      "baseUrl": "http://e-note-ion.local:8080",
      "schedulerSecret": "<scheduler webhook secret>",
      "stateSecret": "<state webhook secret>",
      "pollInterval": 300,
      "pushPort": 51828
    }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `baseUrl` | yes | e-note-ion webhook listener base URL (no trailing slash). |
| `schedulerSecret` | yes | `scheduler` credential — used to toggle modes. |
| `stateSecret` | yes | `state` credential — used to read current mode state. |
| `pollInterval` | no | Seconds between `GET /state` polls (default 300, min 15). |
| `pushPort` | no | Port for instant push from e-note-ion. Omit to poll only. |
| `pushSecret` | no | Shared secret for push auth. Defaults to `stateSecret`. |

### Enabling instant push (optional)

Point e-note-ion at this plugin's push listener so toggles update instantly. In
e-note-ion's `config.toml`:

```toml
[homebridge]
url = "http://<homebridge-host>:51828/"
secret = "<same as pushSecret / stateSecret>"
```

Without push, the switches still stay in sync within one `pollInterval`.

## Networking

Keep both hosts on the same LAN — secrets travel in HTTP headers. For traffic
that leaves your network, front e-note-ion with TLS (see its
`docs/webhook-reverse-proxy.md`).

## Notes

- This is an early scaffold (v0.1.0). Apple's Home app may render the two switches
  as separate tiles that remain grouped under the one Vestaboard accessory.
- Issues and PRs: https://github.com/JasonPuglisi/homebridge-e-note-ion/issues

## License

MIT © Jason Puglisi
