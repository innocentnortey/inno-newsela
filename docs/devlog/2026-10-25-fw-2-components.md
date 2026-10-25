# FW-2 basic accessible components (ticket/FW-2)

**Changed.** Added 16 owned components in `apps/web/src/components/ui/` (Button incl. `sm`, Link, TextInput/Textarea, Select, Checkbox/Radio/RadioGroup/RadioCard, StatusPill + badges, Banner, Card/MetricTile, Table, Tabs, Stepper, DialogShell, Toast) and 14 test files plus a jest-dom typing shim in `apps/web/tests/unit/ui/`. Area-map FW row updated.

**Why.** Statuses, issues and actions must read the same everywhere in text and shape, never colour alone (design.md §2, §3; PE-4..PE-8).

**Checked.** `npm run lint` clean; `npm run typecheck` clean; `npm test -- tests/unit` 17 files, 282 tests pass (ui: 151, one case per §2 state = 33, plus negative colour-only cases). Segmented control not built (not in ticket).

**Remaining.** Merge; FW-4 gallery consumes these; segmented control for a later FW record refinement.
