# Web activity

Inbox's web traffic (`inbox.oxy.so`, Worker `oxy-inbox`) is measured keylessly by Oxy from Cloudflare's own analytics — see OxyHQ/oxy `docs/operations/cloudflare-web-activity.md`. Mailbox, SMTP and webhook activity belongs to the Oxy API; this repository has no backend.

This app holds no Oxy activity secret and runs no activity code: the Worker passes every request straight to its `ASSETS` binding. The `OXY_EDGE_ACTIVITY_*` bindings of the retired edge observer were never provisioned and nothing reads them now; if an operator ever finds one on a deployment, delete it.

The Worker's pass-through behaviour (response, stream, headers and error propagation) is checked by `scripts/worker.test.mjs`, which runs with the frontend test command.
