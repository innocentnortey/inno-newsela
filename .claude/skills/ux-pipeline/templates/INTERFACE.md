# Interface spec — behavioural contracts (UX-3a, Joint track)

> Lives at `docs/contracts/INTERFACE.md`. The one canonical spec for the project · Date: YYYY-MM-DD
> Machine form: `docs/contracts/interface.openapi.yaml` (each operation carries `x-con: CON-N`) · Changes: `docs/contracts/CHANGES.md`
> Card format, ownership and change procedure: `.claude/skills/ux-pipeline/references/ui-contracts.md`
> Statuses: `draft` → `proposed` → `agreed` · `changing` (open CHG-N). Nothing relies on a card before it is `agreed`.
> UX side owns needs · System side owns support · both review · Innocent decides product behaviour.

## Contract map
| Contract | Status | Screens | Operations | Backend owner | Open questions |
|---|---|---|---|---|---|
| CON-1 | draft | SCR-N | | | UXP-N |

## Open behaviour questions (from UX-1, decided by Innocent)
| ID | Question | Affects | Decision (Innocent, date) |
|---|---|---|---|
| UXP-1 | | CON-N, FLOW-N | awaiting |

### CON-1 · <promise in one line>
- Status: draft | proposed | agreed | changing (CHG-N)
- UX review (needs): <session or name, date> · System review (support): <session or name, date>
- Screens: <SCR-N> · Flows: <FLOW-N> · Stories: <US-N>
- Requirements: <IDs> · Backend owner: <component / ticket area>
- Operations (operationId):
- Fields (reads / writes, with data class):
- States the UI must be able to show:
- Permissions (who may; what others see):
- Errors (code → screen response):
- Recovery (what the user can do after each error; what is kept):
- Guarantees (what is promised):
- Timing (budgets, freshness, expiry):
- Data class and where it may go:
- Open questions: <UXP-N → decision> or none
- Mock examples: <synthetic responses, one per error>
- Presentation notes (not part of the contract): <layout choices that do not change behaviour>
