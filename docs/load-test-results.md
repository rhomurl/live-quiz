# Load-test results

No deployed-build capacity run has been recorded yet.

## Planned command

```bash
LIVE_QUIZ_URL=https://quiz.example HOST_SECRET='host-only-secret' node scripts/load-test.js 50
```

Run this only against the deployed build. Do not place the secret or credentials in this document.

## Result record

| Field | Record |
| --- | --- |
| Date and local time | |
| Release tag / commit | |
| Target URL | |
| Load generator host / network | |
| Node version | |
| Players requested / joined | |
| Reconnects completed | |
| Join acknowledgement p50 / p95 | |
| Answer acknowledgement p50 / p95 | |
| Unexpected errors or leaked-event checks | |
| Result | |

Pass requires 50 successful valid joins, no unexpected server errors or leaked events, and answer acknowledgement p95 below 500 ms on the test network. This synthetic result does not verify venue Wi-Fi.

## Local harness verification

On September 15, 2026 the harness ran against the integrated server on
localhost with 50 Socket.IO clients. All 50 joined, five clients completed a
valid resume after disconnect, no unexpected errors or credential-leak events
were reported, join p50/p95 were 4.90/15.80 ms, and answer acknowledgement
p50/p95 were 2.98/5.12 ms. This validates the harness and local implementation;
it is not a VPS capacity result and does not replace the required deployed run
or venue network test.

The run used Node.js 23.10.0 because that is the runtime available in this
workspace. The project declares Node.js 24 LTS, so the same checks must be
repeated under Node 24 before the release tag.
