# Outline fixtures

Built by `packages/core/scripts/build-outline-fixtures.ts` from the issued and synthetic samples in `docs/data/samples` (SYN-1 and SYN-3 replace sheet rows 9 and 10). Run `npx tsx packages/core/scripts/build-outline-fixtures.ts`; output is byte-identical between runs (CSV and XLSX). SYN-2 is read from its original file. Formula text is never written: the total row carries the displayed value of the Days sum (47.0). Nothing here comes from `docs/source/restricted`.
