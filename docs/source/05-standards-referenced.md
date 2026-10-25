# 05 — Standards Referenced in the Sample Outline

**Rank:** DERIVED (our analysis), quoting PRIMARY official text. **Written:** 2026-10-24.
**Input:** every standard code in columns J, K, L and P of the sample outline
([`02-sample-unit-outline.md`](02-sample-unit-outline.md)).

## Official sources

| Set | Official document | URL | Where grade 6 is |
|---|---|---|---|
| CA CCSS for ELA/Literacy (columns J, K) | *California Common Core State Standards: English Language Arts & Literacy in History/Social Studies, Science, and Technical Subjects* (CDE) | https://www.cde.ca.gov/be/st/ss/documents/finalelaccssstandards.pdf | Each strand's grades 6–8 pages come first: RL from printed p. 47, RI from p. 51, W from p. 56, SL from p. 66, L from p. 71 (footer "English Language Arts 6–12 \| n") |
| CA ELD Standards (column P) | *California English Language Development Standards, Kindergarten Through Grade 12* (CDE, 2014) | https://www.cde.ca.gov/sp/el/er/documents/eldstndspublication14.pdf | Grade 6, PDF pages 95–100 |
| CA Model School Library Standards (column L, headed "CA Media Literacy Standards") | *Model School Library Standards for California Public Schools, K–12* (SBE, 2010) | https://www.cde.ca.gov/be/st/ss/documents/librarystandards.pdf | Grade Six, printed pp. 19–22 |

**How the text below was obtained.** All three PDFs were downloaded from cde.ca.gov on 2026-10-24.
The CCSS PDF prints grades 6, 7 and 8 side by side, so text extraction interleaves columns. For each
code we took the description Newsela's review site stores for it and checked it against the
official PDF (6-word overlap check, then a by-eye read of the grade 6 column for every low score);
all matched. Parent standards (the stems, e.g. `W.6.2`) were read from the grade 6 column directly.
`[CA]` marks California's own additions to the Common Core.

**How to read codes.** `RL.6.4` = Reading Literature, grade 6, standard 4. `RI` = Reading
Informational Text, `W` = Writing, `SL` = Speaking and Listening, `L` = Language. A trailing letter
(`W.6.2.a`) is a sub-part. ELD codes: `ELD.PI.6.6` = ELD Part I, grade 6, strand 6; Part II is
"Learning About How English Works". The official ELD text differs by proficiency level, which
Newsela writes as a suffix: `.Em` Emerging, `.Ex` Expanding, `.Br` Bridging.

## Summary of problems found

| # | Code as written | Problem | Likely intent |
|---|---|---|---|
| 1 | `6.2 L.6.4` (row 8, J) | Malformed: no strand prefix, no comma | `RL.6.2, L.6.4` (the row's lesson is about the narrator's voice in a novel) |
| 2 | `RL.6.9.a` (rows 30 J/K; 34, 39 K) | **Does not exist.** Grade 6 RL.9 has no sub-parts | `RL.6.9` (or `W.6.9.a`, which does exist and quotes RL.6.9) |
| 3 | `SL.6.1.a–d`, `W.6.2.a–f`, `W.6.3.a–e`, `L.6.2.a–b` | Ranges, not codes; en dash | Expand to the listed sub-parts (all exist) |
| 4 | Parents used as codes: `L.6.1`–`L.6.5`, `SL.6.1`, `SL.6.4`, `W.6.2`, `W.6.3`, `W.6.9` | Valid, but Newsela's published lessons cite only the lettered sub-parts | Decide which sub-part(s) each lesson targets |
| 5 | Every ELD code (`ELD.PI.6.6`, …) | No sub-part letter where one exists (`6a/6b/6c`, `10a/10b`) and no proficiency level | e.g. `ELD.PI.6.6a.Em/.Ex/.Br` |
| 6 | 7 of the 12 ELD codes | The sheet's short description belongs to a **different strand** (table below) | Re-map by the description, or by the code, with a reviewer |
| 7 | `2.1.a`, `2.1.b`, `2.2.a`, `3.3.a`, `4.3.a` (column L) | No prefix; the column says "Media Literacy" but these are **Model School Library Standards** grade six codes. Newsela's own lessons write them `MSLS 2.2b-c` | `MSLS 2.1a` etc. |

No CCSS code in the sheet is from the wrong grade, and apart from #1 and #2 every code exists.

## CA CCSS for ELA/Literacy — every code in columns J and K

Rows are sheet rows (row 4 = Lesson 1). Ranges were expanded before counting.

| Code | Official text (CA CCSS, grade 6) | Focus rows (J) | Supporting rows (K) | Flag |
|---|---|---|---|---|
| `RL.6.1` | Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text. | 8, 10, 12, 13, 14, 17, 18, 19, 21, 29, 33, 36, 38, 41, 42 | 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 28, 29, 30, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42 |  |
| `RL.6.2` | Determine a theme or central idea of a text and how it is conveyed through particular details; provide a summary of the text distinct from personal opinions or judgments. | 8, 11, 37, 40, 41, 42 | 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 29, 30, 33, 34, 36, 38, 39, 40, 41, 42 | row 8 written as `6.2 L.6.4` |
| `RL.6.3` | Describe how a particular story’s or drama’s plot unfolds in a series of episodes as well as how the characters respond or change as the plot moves toward a resolution. | 37, 40 | 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 29, 30, 33, 36, 38, 40, 41, 42 |  |
| `RL.6.4` | Determine the meaning of words and phrases as they are used in a text, including figurative and connotative meanings; analyze the impact of a specific word choice on meaning and tone. | 12, 16, 28, 35 | 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 29, 30, 33, 34, 35, 36, 38, 39, 40, 41, 42 |  |
| `RL.6.5` | Analyze how a particular sentence, chapter, scene, or stanza fits into the overall structure of a text and contributes to the development of the theme, setting, or plot. | 13, 17, 18, 21, 29, 33, 36, 38 | 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 29, 30, 33, 36, 38, 40, 41 |  |
| `RL.6.6` | Explain how an author develops the point of view of the narrator or speaker in a text. | 40 | 8, 10, 11, 12, 13, 14, 16, 17, 18, 20, 21, 28, 29, 30, 33, 36, 38, 40, 41 |  |
| `RL.6.7` | Compare and contrast the experience of reading a story, drama, or poem to listening to or viewing an audio, video, or live version of the text, including contrasting what they “see” and “hear” when reading the text to what they perceive when they listen or watch. | 16, 21, 43 | 43 |  |
| `RL.6.9` | Compare and contrast texts in different forms or genres (e.g., stories and poems; historical novels and fantasy stories) in terms of their approaches to similar themes and topics. | 20, 22, 23, 30, 31, 32, 42, 43 | 9, 15, 19, 20, 22, 23, 30, 31, 32, 34, 39, 42, 43 |  |
| `RL.6.9.a` | **Does not exist.** Grade 6 RL.9 has no lettered sub-parts. RL.6.9 reads: “Compare and contrast texts in different forms or genres (e.g., stories and poems; historical novels and fantasy stories) in terms of their approaches to similar themes and topics.” | 30 | 30, 34, 39 | invalid code |
| `RL.6.10` | By the end of the year, read and comprehend literature, including stories, dramas, and poems, in the grades 6–8 text complexity band proficiently, with scaffolding as needed at the high end of the range. |  | 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 29, 30, 33, 34, 36, 38, 39, 40, 41, 42 |  |
| `RI.6.1` | Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text. | 4, 5 | 20 |  |
| `RI.6.2` | Determine a central idea of a text and how it is conveyed through particular details; provide a summary of the text distinct from personal opinions or judgments. |  | 20 |  |
| `RI.6.3` | Analyze in detail how a key individual, event, or idea is introduced, illustrated, and elaborated in a text (e.g., through examples or anecdotes). |  | 20 |  |
| `RI.6.4` | Determine the meaning of words and phrases as they are used in a text, including figurative, connotative, and technical meanings. | 4, 6 | 20 |  |
| `RI.6.7` | Integrate information presented in different media or formats (e.g., visually, quantitatively) as well as in words to develop a coherent understanding of a topic or issue. | 5 |  |  |
| `RI.6.9` | Compare and contrast one author’s presentation of events with that of another (e.g., a memoir written by and a biography on the same person). | 5 |  |  |
| `W.6.2` | Write informative/explanatory texts to examine a topic and convey ideas, concepts, and information through the selection, organization, and analysis of relevant content. | 9, 22, 34, 39, 42, 48, 49, 50, 52 | 9, 15, 19, 22 | parent code (has lettered sub-parts) |
| `W.6.2.a` | Introduce a topic or thesis statement; organize ideas, concepts, and information, using strategies such as definition, classification, comparison/contrast, and cause/effect; include formatting (e.g., headings), graphics (e.g., charts, tables), and multimedia when useful to aiding comprehension. | 48 | 9, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `W.6.2.b` | Develop the topic with relevant facts, definitions, concrete details, quotations, or other information and examples. | 49 | 9, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `W.6.2.c` | Use appropriate transitions to clarify the relationships among ideas and concepts. | 15, 49 | 15, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `W.6.2.d` | Use precise language and domain-specific vocabulary to inform about or explain the topic. | 15, 49 | 15, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `W.6.2.e` | Establish and maintain a formal style. | 15, 50 | 15, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `W.6.2.f` | Provide a concluding statement or section that follows from the information or explanation presented. | 50 | 9, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `W.6.3` | Write narratives to develop real or imagined experiences or events using effective technique, relevant descriptive details, and well-structured event sequences. | 31, 32 |  | parent code (has lettered sub-parts) |
| `W.6.3.a` | Engage and orient the reader by establishing a context and introducing a narrator and/or characters; organize an event sequence that unfolds naturally and logically. |  | 31, 32 |  |
| `W.6.3.b` | Use narrative techniques, such as dialogue, pacing, and description, to develop experiences, events, and/or characters. |  | 31, 32 |  |
| `W.6.3.c` | Use a variety of transition words, phrases, and clauses to convey sequence and signal shifts from one time frame or setting to another. |  | 31, 32 |  |
| `W.6.3.d` | Use precise words and phrases, relevant descriptive details, and sensory language to convey experiences and events. |  | 31, 32 |  |
| `W.6.3.e` | Provide a conclusion that follows from the narrated experiences or events. |  | 31, 32 |  |
| `W.6.4` | Produce clear and coherent writing in which the development, organization, and style are appropriate to task, purpose, and audience. | 31, 32, 34, 42, 52 | 9, 15, 19, 22, 31, 32, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `W.6.5` | With some guidance and support from peers and adults, develop and strengthen writing as needed by planning, revising, editing, rewriting, or trying a new approach. | 48, 51 | 9, 15, 19, 22, 31, 32, 34, 39, 42, 48, 51 |  |
| `W.6.6` | Use technology, including the Internet, to produce and publish writing as well as to interact and collaborate with others; demonstrate sufficient command of keyboarding skills to type a minimum of three pages in a single sitting. | 52 | 48, 49, 50, 51, 52 |  |
| `W.6.8` | Gather relevant information from multiple print and digital sources; assess the credibility of each source; and quote or paraphrase the data and conclusions of others while avoiding plagiarism and providing basic bibliographic information for sources. | 48, 52 | 48, 52 |  |
| `W.6.9` | Draw evidence from literary or informational texts to support analysis, reflection, and research. | 15, 19, 22, 52 | 9, 15, 19, 22, 31, 32, 34, 39, 42, 48, 49, 50, 51, 52 | parent code (sub-parts a, b) |
| `W.6.9.a` | Apply grade 6 Reading standards to literature (e.g., “Compare and contrast texts in different forms or genres [e.g., stories and poems; historical novels and fantasy stories] in terms of their approaches to similar themes and topics”). | 52 | 48, 49, 50, 51, 52 |  |
| `W.6.10` | Write routinely over extended time frames (time for research, reflection, and revision) and shorter time frames (a single sitting or a day or two) for a range of discipline-specific tasks, purposes, and audiences. | 52 | 31, 32, 34, 39, 42, 48, 49, 50, 51, 52 |  |
| `SL.6.1` | Engage effectively in a range of collaborative discussions (one-on-one, in groups, and teacher-led) with diverse partners on grade 6 topics, texts, and issues, building on others’ ideas and expressing their own clearly. | 23, 43, 53 | 4, 5, 6 | parent code (has lettered sub-parts) |
| `SL.6.1.a` | Come to discussions prepared, having read or studied required material; explicitly draw on that preparation by referring to evidence on the topic, text, or issue to probe and reflect on ideas under discussion. | 4 | 23, 43, 53 |  |
| `SL.6.1.b` | Follow rules for collegial discussions, set specific goals and deadlines, and define individual roles as needed. |  | 23, 43, 53 |  |
| `SL.6.1.c` | Pose and respond to specific questions with elaboration and detail by making comments that contribute to the topic, text, or issue under discussion. |  | 23, 43, 53 |  |
| `SL.6.1.d` | Review the key ideas expressed and demonstrate understanding of multiple perspectives through reflection and paraphrasing. |  | 23, 43, 53 |  |
| `SL.6.2` | Interpret information presented in diverse media and formats (e.g., visually, quantitatively, orally) and explain how it contributes to a topic, text, or issue under study. | 43, 53 | 43, 53 |  |
| `SL.6.4` | Present claims and findings (e.g., argument, narrative, informative, response to literature presentations), sequencing ideas logically and using pertinent descriptions, facts, and details and nonverbal elements to accentuate main ideas or themes; use appropriate eye contact, adequate volume, and clear pronunciation. [CA] | 53 | 53 | parent code; `[CA]` = California addition |
| `SL.6.4.a` | Plan and deliver an informative/explanatory presentation that: develops a topic with relevant facts, definitions, and concrete details; uses appropriate transitions to clarify relationships; uses precise language and domain specific vocabulary; and provides a strong conclusion. |  | 53 |  |
| `SL.6.5` | Include multimedia components (e.g., graphics, images, music, sound) and visual displays in presentations to clarify information. | 48, 53 | 53 |  |
| `SL.6.6` | Adapt speech to a variety of contexts and tasks, demonstrating command of formal English when indicated or appropriate. | 23, 43, 53 | 23, 43, 53 |  |
| `L.6.1` | Demonstrate command of the conventions of standard English grammar and usage when writing or speaking. | 19, 40, 42 | 9, 15, 19, 22, 31, 32, 34, 39, 42 | parent code (has lettered sub-parts) |
| `L.6.1.a` | Ensure that pronouns are in the proper case (subjective, objective, possessive). | 19 |  |  |
| `L.6.1.b` | Use all pronouns, including intensive pronouns (e.g., myself, ourselves), correctly. |  | 22 |  |
| `L.6.1.c` | Recognize and correct inappropriate shifts in pronoun number and person. |  | 34 |  |
| `L.6.1.d` | Recognize and correct vague pronouns (i.e., ones with unclear or ambiguous antecedents). |  | 39 |  |
| `L.6.1.e` | Recognize variations from standard English in their own and others’ writing and speaking, and identify and use strategies to improve expression in conventional language. | 42 | 42 |  |
| `L.6.2` | Demonstrate command of the conventions of standard English capitalization, punctuation, and spelling when writing. | 51 | 9, 15, 19, 22, 31, 32, 34, 39, 42 | parent code (has lettered sub-parts) |
| `L.6.2.a` | Use punctuation (commas, parentheses, dashes) to set off nonrestrictive/parenthetical elements. | 51 | 51 |  |
| `L.6.2.b` | Spell correctly. | 51 | 51 |  |
| `L.6.3` | Use knowledge of language and its conventions when writing, speaking, reading, or listening. | 49, 50 | 9, 15, 19, 22, 31, 32, 34, 39, 42, 49, 50 | parent code (has lettered sub-parts) |
| `L.6.3.a` | Vary sentence patterns for meaning, reader/listener interest, and style. | 49 | 49 |  |
| `L.6.3.b` | Maintain consistency in style and tone. | 50 | 50 |  |
| `L.6.4` | Determine or clarify the meaning of unknown and multiple-meaning words and phrases based on grade 6 reading and content, choosing flexibly from a range of strategies. | 8, 12, 13, 14, 18, 20, 21, 30, 33, 40, 41 | 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 29, 30, 33, 36, 38, 40, 41 | parent code (has lettered sub-parts); row 8 written as `6.2 L.6.4` |
| `L.6.4.a` | Use context (e.g., the overall meaning of a sentence or paragraph; a word’s position or function in a sentence) as a clue to the meaning of a word or phrase. | 5, 28 | 8 |  |
| `L.6.4.b` | Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word (e.g., audience, auditory, audible). | 4, 6, 12 | 12, 35 |  |
| `L.6.4.c` | Consult reference materials (e.g., dictionaries, glossaries, thesauruses), both print and digital, to find the pronunciation of a word or determine or clarify its precise meaning or its part of speech. |  | 10 |  |
| `L.6.4.d` | Verify the preliminary determination of the meaning of a word or phrase (e.g., by checking the inferred meaning in context or in a dictionary). |  | 8 |  |
| `L.6.5` | Demonstrate understanding of figurative language, word relationships, and nuances in word meanings. | 21 | 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 29, 30, 33, 36, 38, 40, 41 | parent code (has lettered sub-parts) |
| `L.6.5.a` | Interpret figures of speech (e.g., personification) in context. | 17, 20, 30 | 16, 17, 20, 30 |  |
| `L.6.5.b` | Use the relationship between particular words (e.g., cause/effect, part/whole, item/category) to better understand each of the words. |  | 11 |  |
| `L.6.5.c` | Distinguish among the connotations (associations) of words with similar denotations (definitions) (e.g., stingy, scrimping, economical, unwasteful, thrifty). | 35 | 11 |  |
| `L.6.6` | Acquire and use accurately grade-appropriate general academic and domain-specific words and phrases; gather vocabulary knowledge when considering a word or phrase important to comprehension or expression. | 14, 18, 30, 37, 41 | 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42 |  |
## CA ELD Standards — every code in column P

The sheet gives each ELD code a short description of its own. The table compares it with the
official strand, and quotes the official **Expanding**-level text for grade 6 (Emerging and Bridging
differ mainly in the amount of support). Rows = sheet rows.

| Code (sheet) | Sheet's description (examples) | Official grade 6 strand | Official text, Expanding level | Match? | Rows |
|---|---|---|---|---|---|
| `ELD.PI.6.1` | "Participate in collaborative discussions" | Part I.A.1 *Exchanging information/ideas* | "Contribute to class, group, and partner discussions by following turn-taking rules, asking relevant questions, affirming others, adding relevant information, and paraphrasing key ideas." | yes | 5, 23, 43, 53 |
| `ELD.PI.6.2` | "Summarize key ideas accurately" | Part I.A.2 *Interacting via written English* | "Engage in longer written exchanges with peers and collaborate on more detailed written texts on a variety of topics, using technology when appropriate." | **no** (summarizing is closer to PI.10b) | 11 |
| `ELD.PI.6.4` | "Present ideas clearly" | Part I.A.4 *Adapting language choices* | "Adjust language choices according to purpose (e.g., explaining, persuading, entertaining), task, and audience." | **no** (presenting is PI.9 *Presenting*) | 53 |
| `ELD.PI.6.5` | "Revise writing for clarity" | Part I.B.5 *Listening actively* | "Demonstrate active listening in oral presentation activities by asking and answering detailed questions, with occasional prompting and moderate support." | **no** (revising writing fits PI.10 or PII) | 51 |
| `ELD.PI.6.6` | "Explain ideas using evidence", "Explain mood using evidence", but also "Exchange information and ideas orally" (row 4) and "Maintain formal style" (row 50) | Part I.B.6 *Reading/viewing closely*, which has three sub-parts | 6a: "Explain ideas, phenomena, processes, and text relationships (e.g., compare/contrast, cause/effect, problem/solution) based on close reading of a variety of grade-level texts and viewing of multimedia, with moderate support." 6b: "Express inferences and conclusions drawn based on close reading of grade-level texts and viewing of multimedia using a variety of verbs (e.g., suggests that, leads to)." 6c: morphology, context and reference materials for unknown words | mostly (fits 6a/6b); rows 4 and 50 **no** | 26 rows: 4, 5, 6, 8, 10, 12, 13, 14, 16, 17, 18, 20, 21, 23, 28, 29, 30, 33, 36, 38, 40, 41, 48, 49, 50, 52 |
| `ELD.PI.6.7` | "Analyze how language creates meaning", "Compare ideas across texts", "Apply archetypal ideas" | Part I.B.7 *Evaluating language choices* | "Explain how well writers and speakers use specific language to present ideas or support arguments and provide detailed evidence (e.g., showing the clarity of the phrasing used to present an argument), with moderate support." | partly (language-analysis labels fit; "compare ideas across texts" fits PI.6a; "apply archetypal ideas" fits neither) | 31 rows, 4–43 |
| `ELD.PI.6.10` | "Write explanatory texts", "Write narrative texts" | Part I.C.10 *Writing*, sub-parts 10a (texts) and 10b (summaries) | 10a: "Write longer literary and informational texts (e.g., an argument for protecting the rainforests) collaboratively (e.g., with peers) and independently using appropriate text organization." | yes (10a) | 14 rows: 9, 15, 19, 22, 31, 32, 34, 39, 42, 48–52 |
| `ELD.PII.6.1` | "Use collaborative discussion strategies" | Part II.A.1 *Understanding text structure* | "Apply growing understanding of how different text types are organized to express ideas (e.g., how a narrative is organized sequentially with predictable stages versus how arguments are structured logically around reasons and evidence) to comprehending texts and writing texts with increasing cohesion." | **no** (discussion strategies are PI.1/PI.3) | 23 |
| `ELD.PII.6.3` | "Use precise descriptive vocabulary", "Use content-specific vocabulary accurately" | Part II.B.3 *Using verbs and verb phrases* | "Use various verb types (e.g., doing, saying, being/having, thinking/feeling, reporting), tenses (e.g., present, past, future, simple, progressive, perfect) appropriate to the task, text type, and discipline (e.g., simple present for literary analysis) on an increasing variety of topics." | **no** (precise vocabulary is PI.12a) | 5, 12, 16, 20, 28, 33, 40 |
| `ELD.PII.6.4` | "Expand noun phrases and descriptive language", "Produce expanded … summaries" | Part II.B.4 *Using nouns and noun phrases* | "Expand noun phrases in a variety of ways (e.g., adding comparative/superlative adjectives to noun phrases or simple clause embedding) in order to enrich the meaning of sentences and add details about ideas, people, things, and the like." | yes (loosely for "expanded summaries") | 4, 6, 11, 14, 17, 30, 41, 43, 49, 51 |
| `ELD.PII.6.5` | "Use transitions to connect ideas", "Use cohesive comparison language" | Part II.B.5 *Modifying to add details* | "Expand sentences with an increasing variety of adverbials (e.g., adverbs, adverb phrases, prepositional phrases) to provide details (e.g., time, manner, place, cause) about a familiar or new activity or process." | **no** (transitions and cohesion are PII.2b *Understanding cohesion*; joining clauses is PII.6) | 20 rows, 8–52 |
| `ELD.PII.6.6` | "Adjust language to task and audience" | Part II.C.6 *Connecting ideas* | "Combine clauses in an increasing variety of ways (e.g., creating compound and complex sentences) to make connections between and join ideas…" | **no** (adjusting to audience is PI.4) | 53 |

**Count:** of 12 distinct ELD codes, 3 match (PI.1, PI.10, PII.4), 2 match in part (PI.6, PI.7) and
**7 carry another strand's meaning** (PI.2, PI.4, PI.5, PII.1, PII.3, PII.5, PII.6). PII.5 alone
appears on 20 lessons. This looks like the author worked from strand *numbers* without the strand
*names*: the descriptions read like sensible lesson goals, but the codes do not say what the
descriptions say. A generator that trusts the code and one that trusts the description will produce
different ELD supports for the same row, so this needs a rule (and probably a reviewer flag).

## Model School Library Standards (column L, "CA Media Literacy Standards")

All five codes exist in the Grade Six section and match the sheet's content (e.g. row 49's craft
focus "visual language creates an impression" is 2.2.a almost word for word).

| Code (sheet) | Official text (Grade Six) | Rows |
|---|---|---|
| `2.1.a` | Standard 2 *Students evaluate information*, 2.1 Determine the relevance of the information: "a. Analyze information from illustrations, photographs, charts, graphs, maps, tables, and captions." | 48 |
| `2.1.b` | 2.1: "b. Analyze evidence to support a research question." | 48 |
| `2.2.a` | 2.2 Assess the comprehensiveness, currency, credibility, authority, and accuracy of resources: "a. Identify how visual language creates an impression for the viewer (e.g., angle, lighting, special effects, camera movement)." | 49 |
| `3.3.a` | Standard 3 *Students use information*, 3.3 Use information and technology creatively to answer a question, solve a problem, or enrich understanding: "a. Choose an appropriate format to produce, communicate, and present information (e.g., written report, multimedia presentation, graphic presentation)." | 52 |
| `4.3.a` | Standard 4 *Students integrate information literacy skills into all areas of learning*, 4.3 Appreciate and respond to creative expressions of information: "a. Demonstrate a variety of methods to engage the audience when presenting information (e.g., voice modulation, gestures, questions)." | 53 |

California has no separate state "media literacy standards" document that uses these numbers; the
column header is a label, not a code system. *Assumption, to confirm with Newsela:* the column is
meant to hold MSLS codes, as their published research lessons do.

## What a generator needs from this

1. A **standards lookup table** keyed by code (CCSS grade 6, ELD grade 6 by level and sub-part,
   MSLS grade six), loaded from the official text, so every lesson's front matter can carry the
   description the way Newsela's lessons do.
2. A **normaliser** for the sheet: expand ranges, fix `6.2 L.6.4`, reject `RL.6.9.a`, prefix MSLS
   codes, and report every change to the reviewer rather than fixing silently.
3. A **policy** for parent codes and bare ELD codes (resolve to leaves and tiers, or keep and flag).
4. A **conflict flag** when an ELD code's official strand and the sheet's description disagree.
