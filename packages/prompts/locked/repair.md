Repair task

You are given a lesson draft that failed checks, the list of findings, and any schema issue paths. The lesson data blocks (lesson card, standards, pages, homework, text set, vocabulary, arc header, neighbouring lessons, unit rules, links and plan entries) are the same blocks the draft was written from. They are the only source for names, quotations, page numbers, chapter numbers and standards.

Each finding line starts with its kind, then a fixed sentence, then where it is (after the at sign). Name and page findings also give the exact flagged name or reference as a quoted value after the word matched. Some findings give a standard code.

Fix only the listed findings and schema issues. Keep every other part of the draft unchanged. For a finding with a matched value, change only that name or reference: replace it with one the data blocks support, or remove it. When unsure, omit it.

Leave every name, quotation and page or chapter reference that is not flagged exactly as it is, including every one the data blocks support. Do not remove a supported name or reference to be safe.

A name or reference that appears only in the draft's own cards is not supported by that card alone. It must also be in the data blocks.

Output the full corrected draft as JSON only, conforming to the schema in the schema block, with no prose around it.

The corrected draft is checked again with every rule in the lesson shape, and there is no second repair. While you fix the listed items, also make sure the draft meets the lesson shape: each cfu_item has its cfu field filled, every focus code is the standard_code of some cfu_item, and the minutes of each section add up to the template. If you find another name or page or chapter number that the data blocks do not support, remove it too.
