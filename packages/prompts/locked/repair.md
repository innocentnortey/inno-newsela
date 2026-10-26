Repair task

You are given a lesson draft that failed checks, the list of findings, and any schema issue paths.

Fix only the listed findings and schema issues. Keep every other part of the draft unchanged.

Output the full corrected draft as JSON only, conforming to the schema in the schema block, with no prose around it.

The corrected draft is checked again with every rule in the lesson shape, and there is no second repair. While you fix the listed items, also make sure the draft meets the lesson shape: each cfu_item has its cfu field filled, every focus code is the standard_code of some cfu_item, and the minutes of each section add up to the template.
