---
name: Map runtime resilience
description: Environment constraints affecting the mobilization map and its API seed data.
---

The mobilization map must remain usable when the browser preview cannot initialize WebGL; the interactive Mapbox layer should degrade to clickable real pins instead of crashing the page.

**Why:** The Replit preview browser did not expose WebGL, and the Mapbox constructor threw before the page could render. The API workflow also runs with the package directory as its working directory in development, while production can start from the repository root.

**How to apply:** Keep a non-WebGL pin visualization for this artifact, and resolve the Markdown seed file using paths compatible with both `artifacts/api-server` and the repository root working directories.