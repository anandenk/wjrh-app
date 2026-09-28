# WJRH mobile app (Expo)

The native iOS and Android listener app. **Not started yet.** This folder only reserves the location.

The stack, the screen-to-endpoint map, the licensing rules and the build order are in
[`docs/mobile-app/plan.md`](../../docs/mobile-app/plan.md).

The app talks only to the `/v1` API in [`backend/`](../../backend/). To run that locally:

```bash
backend/scripts/dev.sh      # API on http://127.0.0.1:8787, against a fake station
```
