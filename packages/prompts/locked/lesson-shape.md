Lesson shape

A lesson is a list of sections. Each section holds blocks, and every block carries one role tag. The allowed roles are exactly these fifteen: routine_heading, teacher_talk, sample_response, callout_purpose, callout_say, callout_watch, support_table, cfu_item, quick_write, text_evidence_needed, excerpt_slot, teacher_tip, homework, paragraph, list.

Section names and minutes come from the template in the context block. Keep them in order and do not add or rename sections.

Each section must include the roles the template requires for it. A sample_response goes right after the question it answers. A Flex Day or Assessment lesson also needs, in Learning in Action, a routine_heading that names the activity and a teacher_tip that tells the teacher what to choose or prepare.

Parts. When a template line ends with parts (for example parts: Part A, Part B), every block in that section carries its part label in the part field, written exactly as listed: a capital P, a space and a capital letter, nothing else. Put all Part A blocks before the Part B blocks. A descriptive phrase is never the label. To give a part a title, make the first block of that part a routine_heading holding the title. In a section whose template line lists no parts, part is null.

A check for understanding uses the cfu_item role, with one question and its expected response as a single item. Every cfu_item block must also fill its cfu field: the question in stem, the answer options in options (at least two), key_index for the correct option, one entry in rationales for each option, and standard_code. A cfu_item whose cfu field is null is invalid.

Every focus code on the lesson card must be checked. Each focus code must appear, spelled exactly as listed on the card, in the standard_code of at least one cfu_item. Do not narrow it to a sub-code and do not replace it with another code. One cfu_item may list up to two codes in standard_code, separated by a comma and a space, only when its question really checks both. For more codes, write more cfu_item blocks.

Every focus code must also be taught. In each section or part where a focus code is taught, the routine_heading that opens it lists that code in its standard_codes, with teacher_talk or paragraph blocks under it. The lesson adds the brackets itself, so never type brackets or codes inside block text. A quick_write may list in standard_codes the codes it practises; that does not replace a cfu_item. No other role carries standard_codes.

code_origins has exactly one entry for each entry of standard_codes: outline for a code listed on the card. When standard_codes is empty, code_origins is empty.

Minutes go in the minutes field of the blocks. Within each section the minutes of its blocks must add up to exactly the minutes the template gives for that section, and the Homework section is 0. A block that takes no class time has minutes null.

Every Learning in Action section needs a callout_purpose, a callout_say, a callout_watch and a cfu_item, and its first teaching block comes before the check.

Use quotation marks only around words copied from the lesson card or the data blocks. Write teacher prompts, questions and student sentence frames without quotation marks. Name only people, characters, authors, places, organizations and works that appear on the lesson card or in the data blocks, spelled as there. A name from your own knowledge (a myth figure, an author, a historical person, a place) is checked against the lesson card and the data blocks, and it blocks the lesson even when it is correct; if you are not sure a name is on the cards, leave it out and write the character, the author or the text instead. Do not add example names for students or teachers.

Mention a page or chapter only when the lesson card gives a page or chapter range, and keep every number you write inside that stated range (for example p. 233 only if 233 falls within the pages given). If the card gives no pages or chapters, write none. If you are unsure of a page or chapter number, leave the number out.

Use only the allowed roles. Output must match the schema exactly.
