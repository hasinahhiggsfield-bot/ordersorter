# Operation Assist

Operation Assist is a full-stack prototype for a Zid-connected fashion fulfillment operation. It is designed around forced worker assignment: workers never browse orders, skip work, or manually select a queue item. The backend assigns one locked order at a time and records every status change in the order timeline.

## Features

- Login system with exactly three seeded accounts
- Role-based admin and worker experiences
- Automatic queue assignment and order locking
- Worker forced-order workflow
- Product missing reporting with item-level reasons and notes
- Ready-to-ship flow with simulated shipping label generation
- AJEX-style mock shipping policy generation
- Mock auto-print queue for connected-printer testing
- Admin dashboard with live operational metrics
- Missing Products Center with stock arrival, queue return, reassignment, notes, escalation, and unlock actions
- Worker monitoring with processing time, idle state, completion stats, and stuck-order detection
- Full order timeline for imported, assigned, missing, stock, label, and admin override events
- Mock Zid sync every 5 minutes plus manual Sync Now
- Mock Zid app activation, fulfillment webhooks, and order-status dictionary
- Responsive premium dark UI for desktop, tablet, and mobile
- Persisted local JSON database with mock seed data

## Requirements

- Node.js 20 or newer

No npm packages are required for the prototype. It uses Node built-ins for the server, auth, storage, and static file serving.

## Setup

```bash
cd operation-assist
copy .env.example .env
npm start
```

Open:

```text
http://localhost:4310
```

## Test Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@operation.local` | `Admin123!` |
| Worker 1 | `worker1@operation.local` | `Worker123!` |
| Worker 2 | `worker2@operation.local` | `Worker123!` |

## Useful Commands

```bash
npm start
npm run reset:data
```

`npm run reset:data` recreates the local JSON database from the seed data.

## Environment Variables

See `.env.example`.

Important local values:

- `PORT`: default `4310`
- `DATA_FILE`: optional override for the JSON database path. By default, Windows stores it under `%LOCALAPPDATA%\OperationAssist\db.json`.
- `ZID_SYNC_INTERVAL_MS`: default `300000`
- `WORKER_INACTIVITY_WARNING_MS`: default `600000`
- `STUCK_ORDER_MS`: default `2700000`

The Zid credential variables are included as placeholders so a real API adapter or webhook receiver can be added later.

## Zid Activation And Sync Prototype

The Admin area includes a Zid connection tester. It is currently mock-only, but it follows the shape needed for a real Zid fulfillment app:

- Stores mock activation state for app install/uninstall
- Tracks dispatch-orders activation and deactivation
- Tracks product-sync activation and deactivation
- Lists required fulfillment webhooks
- Receives mock webhook payloads at `/api/zid/webhooks`
- Shows a Zid status dictionary and maps it to Operation Assist workflow states
- Stops importing new orders into worker flow when dispatch is inactive

Current status mapping:

| Zid Status | Operation Assist Status | Worker Flow |
| --- | --- | --- |
| `new` | `Queued` | Yes |
| `preparing` | `New` | No |
| `ready` | `Ready To Ship` | No |
| `inDelivery` | `Shipped` | No |
| `delivered` | `Shipped` | No |
| `cancelled` | `Cancelled` | No |

## Shipping And Auto Print Prototype

The Admin area includes a Shipping and Auto Print tester. It does not connect to AJEX or any physical printer yet.

Current mock behavior:

- Creates an AJEX-style mock AWB when a worker marks an order ready
- Generates a printable 4x6 HTML label preview
- Records an automatic mock print job
- Stores printer settings and sender details locally
- Provides a test-print button for admin validation

Future real integration points:

- Replace the mock AJEX adapter with AJEX create shipment and get label APIs
- Replace the mock printer adapter with a Windows print service, browser print flow, QZ Tray, WebUSB/WebSerial, or another local print bridge
- Keep the same order workflow and event timeline

## Data Model

The JSON database stores:

- `users`
- `orders`
- `orderItems`
- `orderEvents`
- `workerStats`

Order states used by the prototype include:

`New`, `Queued`, `Assigned`, `Picking / Packing`, `Ready To Ship`, `Label Printed`, `Product Missing`, `Awaiting Stock`, `Stock Arrived`, `Returned To Queue`, `Escalated`, `Shipped`, and `Cancelled`.

Some flows use `status_tag` to preserve a secondary visible state. For example, a missing order is currently `Awaiting Stock` with a `Product Missing` tag, and a completed order is `Label Printed` with a `Ready To Ship` tag.
