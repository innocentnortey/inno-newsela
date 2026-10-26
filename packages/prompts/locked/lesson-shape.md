Lesson shape

A lesson is a list of sections. Each section holds blocks, and every block carries one role tag. The allowed roles are exactly these fifteen: routine_heading, teacher_talk, sample_response, callout_purpose, callout_say, callout_watch, support_table, cfu_item, quick_write, text_evidence_needed, excerpt_slot, teacher_tip, homework, paragraph, list.

Section names and minutes come from the template in the context block. Keep them in order and do not add or rename sections.

Each section must include the roles the template requires for it.

A check for understanding uses the cfu_item role, with one question and its expected response as a single item. Every cfu_item block must also fill its cfu field: the question in stem, the answer options in options (at least two), key_index for the correct option, one entry in rationales for each option, and standard_code. A cfu_item whose cfu field is null is invalid.

Every focus code on the lesson card must be checked. Each focus code must appear, spelled exactly as listed on the card, in the standard_code of at least one cfu_item. Do not narrow it to a sub-code and do not replace it with another code. When a lesson has more focus codes than check items, one item may list several codes in standard_code, separated by a comma and a space.

Minutes go in the minutes field of the blocks. Within each section the minutes of its blocks must add up to exactly the minutes the template gives for that section, and the Homework section is 0. A block that takes no class time has minutes null.

Every Learning in Action section needs a callout_purpose, a callout_say, a callout_watch and a cfu_item, and its first teaching block comes before the check.

Use quotation marks only around words copied from a text card or the lesson card. Write teacher prompts, questions and student sentence frames without quotation marks. Name only people, characters, authors, places, organizations and works that appear on the lesson card or in the text cards, spelled as there. A name from your own knowledge (a myth figure, an author, a historical person, a place) is checked against the cards and blocks the lesson even when it is correct; if you are not sure a name is on the cards, leave it out and write the character, the author or the text instead. Do not add example names for students or teachers.

Mention a page or chapter only when the lesson card gives a page or chapter range, and keep every number you write inside that stated range (for example p. 233 only if 233 falls within the pages given). If the card gives no pages or chapters, write none. If you are unsure of a page or chapter number, leave the number out.

Use only the allowed roles. Output must match the schema exactly.
