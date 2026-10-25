# Interface changes (CHG-N)

> Lives at `docs/contracts/CHANGES.md` · One entry per change to an `agreed` CON card, **including behavioural
> changes that leave the OpenAPI schema the same**. Procedure: `.claude/skills/ux-pipeline/references/ui-contracts.md`.
> While a change is open, the card's status is `changing (CHG-N)`. Only work citing that CON waits; everything else continues.

## Log
| Change | Date | Contract | Aspect | Kind | Decided by | Status |
|---|---|---|---|---|---|---|
| CHG-1 | YYYY-MM-DD | CON-N | operation · field · state · permission · error · recovery · guarantee · timing | presentation-only · behavioural | both sides · Innocent (product meaning) | open · reconciled |

### CHG-1 · <the changed promise in one line>
1. **Identify:** CON-N, aspect: <…>, kind: presentation-only | behavioural.
   Before: <the old promise> · After: <the new promise> · Why: <what forced it, with the real example>
2. **Reviewed by:** UX side <name/session, date> · System side <name/session, date> · Innocent <date, his words> (if product meaning changed)
3. **Sources updated:**
   - [ ] `INTERFACE.md` card
   - [ ] `interface.openapi.yaml` (or "schema unchanged: behavioural only")
   - [ ] §6 DO-4 links
   - [ ] screen specs: <SCR-N…>
4. **Reconcile marks** (each item carries `reconcile: CHG-1` until ticked):
   | Item | Kind (design section · ticket · code · evidence) | Reconciled (date) |
   |---|---|---|
   | | | |
5. **Waiting work:** only items citing CON-N: <list>. Unrelated work continues.
