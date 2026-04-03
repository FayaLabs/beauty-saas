---
name: Multi-project workspace
description: User works across 3 sibling projects under /Users/fayalabs/dev/ — saas-core, beauty-saas, resto-saas
type: project
---

The user works across 3 related projects simultaneously:
- `/Users/fayalabs/dev/saas-core/` — shared core package (@fayz/saas-core)
- `/Users/fayalabs/dev/beauty-saas/` — beauty salon SaaS app
- `/Users/fayalabs/dev/resto-saas/` — restaurant SaaS app

Both beauty-saas and resto-saas consume saas-core via `createSaasApp` and related utilities.

**Why:** These are sibling SaaS verticals sharing a common framework.
**How to apply:** When asked to work on any of the 3 projects, navigate to the correct directory. Changes to saas-core may affect both consumer apps.
