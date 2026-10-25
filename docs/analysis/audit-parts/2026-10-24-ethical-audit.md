# Newsela Brief — Ethical Audit (adversarial, "malicious owner" stance)

- **Date:** 2026-10-24
- **Auditor role:** ethics, one of three adversarial audits of the issued brief
- **Input:** `Gauntlet AI/artifacts/2026-10-13-partner-briefs/newsela-project-brief.md` (verbatim brief, Version 1, last updated 10/19/2026)
- **Status:** PROPOSED. Findings and requirements feed the PRD; none of them is a decision until Innocent accepts it.
- **Convention:** **[Sourced]** means a cited source states it. **[Inference]** means it is our reasoning from the brief or sources. Quotes from the brief are exact.

## Summary

1. **Top risk 1: one invented fact reaches every classroom for a year.** A made-up quote, page number or "text evidence" in one generated lesson becomes the lesson every teacher in an adopting district is told to follow (E-1, E-2, E-13).
2. **Top risk 2: the approve button becomes a rubber stamp that launders liability.** With ~160 lessons per program and throughput pressure, "approved" can come to mean "a person clicked", while the product and its buyers read it as "an expert checked this" (E-3, E-4, E-11).
3. **Top risk 3: generic or watered-down content is sold as expert, standards-aligned, culturally responsive curriculum.** This covers "improvise", standards that are claimed but not taught, simplified ELD tasks and stereotyped prompts (E-5, E-6, E-7, E-9).
4. **The one principle:** *the system may only say what it can show.* Every claim the product makes ("aligned to RI.6.4", "quote from p. 42", "reviewed", "approved") must be backed by a recorded check a person can open. Where no check exists, the product says so instead of implying one.
5. Most of the fixes are cheap to build in a 1–2 day prototype: provenance records, blocking checks before approval, quote verification against the source text, no bulk approve, and an honest demo. They also make a better product, not only a safer one.

---

## How to read the "malicious reading"

The stance is deliberately cynical. We assume an owner who wants the *appearance* of rigorous, expert, human-reviewed curriculum while cutting the cost of rigor. We do not believe that is Newsela's intent. The point of the exercise is narrower: anything a cynical owner *could* do with the tool, an ordinary owner under deadline pressure will drift toward. The guardrails we design have to hold against drift, not only against bad actors.

**Context that raises the stakes [Sourced]:** California's 2026 ELA/ELD follow-up adoption covers TK–8 programs. Complete programs were due May 15, 2026, reviewer deliberations ran July 20–24, 2026, and the State Board's final action is planned for **November 2026** (CDE schedule, via search summary: https://www.cde.ca.gov/CI/rl/im/elaeldfupsigevents.asp and https://www.cde.ca.gov/Ci/rl/im/elaeldadopttimeline.asp). The brief's example lesson is hosted at `ca-2026-review.newsela.com`. **[Inference]** Newsela's program is probably in, or aimed at, this adoption cycle, so the tool's output may face state reviewers and district adoption committees within weeks. That is a question for Newsela, not a fact.

---

## Findings

### E-1 — Invented text evidence from the anchor novel

- **Brief:** "aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet … referencing text/novel indicated in the provided unit outline sheet."
- **Malicious reading:** generate lessons that *look* text-grounded, with quotations, page numbers and "evidence from the text" sections, without ever giving the model the text. It looks expert and costs nothing.
- **Who is harmed and how:** students are taught a sentence the author never wrote and asked to "cite evidence" that doesn't exist. Teachers lose credibility when a student with the book can't find page 97. Districts adopt a program with errors built in. Reviewers are blamed for missing something only a side-by-side text check would catch.
- **Severity / likelihood:** High / High. Language models are well documented inventing plausible quotations and page references for real books, including widely read ones **[Sourced, anecdotal reports]**. One reviewer found invented quotes with page numbers in a book only 68 pages long (search summary of https://undsoc.org/2023/03/27/chatgpt-makes-stuff-up/ and similar reports). These are reports, not a controlled study. The mechanism (GP-6: "the model confabulates; facts come from tools") is well established.
- **Honest reading:** Newsela wants the lessons tied to the novel because ELA standards (e.g. RL.x.1, "cite textual evidence") require it. They did not ask for invented quotations; they probably didn't think about where the text would come from.
- **Our response:**
  - **Guardrail (deterministic):** every quotation in a generated lesson is checked by string match against a source text Newsela supplies. A quote that doesn't match is flagged as a *blocking issue*, and the lesson cannot be approved while it stands.
  - **PRD requirement:** if no source text is loaded for a lesson, the generator does not write quotations or page numbers. It writes an explicit placeholder: `[TEXT EVIDENCE — teacher/author selects passage: chapter 3, the scene where …]`.
  - **Product feature:** an evidence pane that shows the matched passage next to each quote.
  - **Question for Newsela:** do you hold licensed digital text for the novels in the outline, and may the tool store and search it? (See E-15 on copyright.)
- **Sources:** GP-6 (`docs/principles/engineering-stance.md`); anecdotal fabrication reports as above.

### E-2 — A standard claimed but not taught

- **Brief:** "aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet (e.g., RI.6.4 …)" and "what's important is that we generate standard aligned content to fill out the lesson."
- **Malicious reading:** copy the standard codes from the outline into the lesson header and call it aligned. The label is what buyers and reviewers scan; the activities underneath can be anything.
- **Who is harmed and how:** students never practise the skill the program says they were taught. Teachers trust the header and skip checking. Districts report coverage that isn't real. State reviewers are misled about what the program does.
- **Severity / likelihood:** High / High. A code in a header costs nothing; real alignment needs an activity that teaches the skill and a check that assesses it.
- **Honest reading:** the outline's expert already chose the standards. Newsela wants the generator to *teach* them, not just name them.
- **Our response:**
  - **PRD requirement:** each lesson carries an alignment map. For every standard code it names which section *teaches* it and which task *checks* it. A code with no teaching section is a blocking issue.
  - **Eval:** an LLM judge, with a published rubric and a human-labelled calibration set, scores alignment per standard. The judge's verdict is advisory. The *human* reviewer confirms the map before approval.
  - **Honest labelling:** the UI distinguishes "standard named by outline", "alignment proposed by generator" and "alignment confirmed by [reviewer name]". We never display an unqualified "standards-aligned" badge.
  - **Our conduct:** we do not say "standards-aligned" in the demo or docs without reporting the eval number and its sample size.
- **Sources:** EdReports (Sept 2026) found "limited information about how AI-generated or adapted resources fit within the standards, pacing, sequence, and instructional design of the broader curriculum" **[Sourced]**: https://cdn.edreports.org/media/2026/09/EdReports_AIReport_Sept2026_8.5x11_090126.pdf

### E-3 — The approve button as a rubber stamp and liability laundering

- **Brief:** "Have a UI/UX for approval workflow for lessons within a unit, where once reviewed/updated it is flagged as complete in our system."
- **Malicious reading:** what a cynical owner wants from the button is a *record* that a human approved each lesson, so any later error is "reviewer error", not "product error". The ideal button for that owner is fast: "Approve all 40", approve without opening, approve from the list view. The approval flag becomes a liability shield.
- **Who is harmed and how:** reviewers carry blame for errors the workflow made impossible to catch. Students and teachers get content whose "reviewed" status means nothing. Districts and state reviewers rely on an approval process that is theatre.
- **Severity / likelihood:** High / High. Automation bias is the default, not the exception. In a 2,784-person randomized experiment, people checking AI-extracted values accepted more wrong suggestions when correcting was made more effortful. People favourable to automation caught fewer errors, and neither a bonus for accuracy nor the AI's early accuracy meaningfully changed performance **[Sourced]**: Beck, Eckman, Kern & Kreuter (2026), *Bias in the Loop*, Harvard Data Science Review, https://stepheckman.com/publication/hdsr_2026/. The classic split into errors of omission (missing what the AI missed) and errors of commission (following the AI's error) goes back to Mosier & Skitka **[Sourced, secondary]**.
- **Honest reading:** Newsela needs a clear "done" state to manage 20+ reviewers and publish. That is legitimate. The danger is in how "done" is reached.
- **Our response (what makes review meaningful):**
  - **No bulk approve.** Approval is per lesson, from inside the lesson.
  - **Blocking issues before approve.** Unverified quotes (E-1), unmapped standards (E-2), unaccepted AI edits (E-11) and open safety flags (E-7, E-8) disable the Approve button and say why.
  - **Forced checks, kept short.** A per-lesson checklist of 4–6 items ("quotes verified against text", "each standard has a teaching task", "ELD supports keep the grade-level task", "social-content check done"). Each item links to the evidence for it. It is short on purpose: long checklists get clicked through.
  - **Evidence pane.** The outline row, the source passage and the exemplar section sit beside the generated content, so the reviewer checks against the *source*, not just reads what is shown.
  - **Make correcting cheap.** Per the study above, friction suppresses corrections. Inline edit, a one-click "flag + reason", and "regenerate this section with my note" are easier than leaving an error in place.
  - **Attribution.** Approval records *who*, *when*, *which checks*, and *which version*. "Approved" is bound to a lesson version; any later edit reopens review.
  - **Second review by sampling.** A configurable share of approved lessons (e.g. 10%) goes to a second reviewer blind to the first's decision. Disagreement rates are reported per unit.
  - **Seeded known-error checks (with consent).** Optionally, lessons with planted errors measure the catch rate. Reviewers are told this exists. The data is used to calibrate the *process*, never to discipline individuals; see E-4.
- **Sources:** as above; GP-17 "Design human-in-the-loop for the human" (`docs/principles/guardrails-and-verification.md`).

### E-4 — Throughput pressure, review time and surveillance creep

- **Brief:** "be able to handle staff of 20+ reviewers"; programs of "4 sequential units of ~40 lessons each"; the goal of removing "prohibitively enormous manual authoring work".
- **Malicious reading:** generation is now nearly free, so the bottleneck moves to review, and the owner squeezes it. The owner sets lessons-per-day targets, ranks reviewers by speed, and uses time-on-task data to push faster approvals.
- **Who is harmed and how:** reviewers are pushed into rubber-stamping (E-3) and monitored by the very signals meant to protect quality. Students get the result.
- **Scale [Inference]:** 4 × ~40 = ~160 lessons per program. If one program is built per grade for TK–8, that is up to ~1,400–1,600 lessons, or ~70–80 per reviewer for 20 reviewers. The point is that review capacity, not generation, is the real constraint, and the product should show it.
- **Severity / likelihood:** Medium-High / Medium.
- **Honest reading:** Newsela wants staff to be productive. Productivity should mean less time *writing* and the same or more time *judging*.
- **Our response:**
  - **Product feature:** a unit-level quality dashboard (blocking issues found, second-review disagreement, median review minutes per lesson) aimed at *managers deciding whether the process is healthy*, not a per-person leaderboard.
  - **Guardrail:** a review-time signal (e.g. approval within N seconds of opening a 50-minute lesson) produces a *soft prompt to the reviewer* and an aggregate process metric. It is not shown per person by default.
  - **Question for Newsela:** what review time per lesson do you budget, and who signs off that the review process is adequate before a program ships?

### E-5 — "Improvise" vs expert instructional design

- **Brief:** "Since you may not be familiar with the specific activities to fill out each lesson sequence step, its OK to improvise what content goes in there based on the examples."
- **Malicious reading:** improvisation is permission to fill a 50-minute lesson with plausible generic filler ("Turn and talk", "Exit ticket: summarize"), presented under Newsela's brand as expert-designed curriculum. Nobody can tell generic from deliberate.
- **Who is harmed and how:** students get low-rigor, repetitive tasks across 160 days. Teachers who follow the adopted program can't fix it at scale. The expert outline author's design intent is diluted.
- **Severity / likelihood:** Medium-High / High. Generic output is the model's default when the instruction is underspecified.
- **Honest reading:** the line is addressed to *us, the builders*. It says we may make up example activities for the prototype because we aren't curriculum experts. It is not a statement that production content should be improvised. We should read it that way and say so.
- **Our response:**
  - **Framing (demo and docs):** our activity patterns are prototype placeholders derived from exemplars, and they need Newsela's instructional designers to define the real activity library.
  - **Product feature:** each generated section cites the exemplar pattern it follows ("Launch pattern from exemplar lesson X"). Reviewers can see when a section copies a pattern and when it departs from it.
  - **PRD requirement:** a small rigour rubric (text-based task, cognitive demand, writing demand, variation across the unit) runs per lesson and per unit. Repetition across lessons is flagged at unit level, because a whole-year program's weakness is sameness that no single-lesson review sees.
  - **Question for Newsela:** do your instructional designers maintain an activity/routine library we should generate from instead of improvising?

### E-6 — English learners get watered-down content

- **Brief:** "CA Core ELA/ELD standards".
- **Malicious reading:** produce an "ELD" box that swaps the grade-level task for a simpler one (shorter text, recall questions) because that is easy to generate and looks supportive. It ticks the ELD box for adoption.
- **Who is harmed and how:** English learners are tracked into lower-rigour work, which is the opposite of California's stated approach. The state framework moves "from simplified text to complex text" and says English learners should not be pulled out of core content to receive ELD **[Sourced]**. The ELD standards must be "comparable in rigor" to the ELA standards **[Sourced]**.
- **Severity / likelihood:** High / Medium-High. Simplifying is the model's natural reading of "support English learners".
- **Honest reading:** Newsela's existing brand is levelled text for access. The core-curriculum version has to give *access to the same task*, not a different one.
- **Our response:**
  - **PRD requirement:** ELD supports are scaffolds attached to the *same* text and task (sentence frames, vocabulary pre-teaching, structured partner talk, at Emerging / Expanding / Bridging levels). A support that replaces the task or text is a blocking issue.
  - **Eval:** a judge check, "Does the ELD support keep the grade-level task and text?", with human-labelled examples.
  - **Question for Newsela:** how do your exemplars split integrated vs designated ELD, and should the generator write designated ELD lessons at all?
- **Sources:** CDE guidance and framework summaries: https://www.cde.ca.gov/nr/el/le/yr22ltr0111.asp, https://www.cde.ca.gov:443/ci/cl/documents/elaeldwebsession3faqs.pdf, https://www.cde.ca.gov/ci/rl/cf/documents/elaeldfwsummaryoct15.pdf (via search summaries; check current CDE pages before quoting).

### E-7 — Bias, stereotypes and social-content compliance

- **Brief:** silent. The only quality language is "standard aligned" and the existing "fighting quality issues".
- **Malicious reading:** social-content review is someone else's problem (the state's), so the tool doesn't check. Discussion questions, example sentences, names and scenarios get generated by the thousand without a check.
- **Who is harmed and how:** students from stereotyped groups see themselves misrepresented in daily required materials. Districts inherit compliance risk. California requires a social content review of adopted materials under Education Code §§60040–60044 (accurate, equitable portrayal of diversity; avoiding stereotypes; no inappropriate brand references) **[Sourced]**: CDE *Standards for Evaluating Instructional Materials for Social Content*, 2013, https://www.cde.ca.gov/CI/cr/cf/documents/socialcontent2013.doc.
- **Severity / likelihood:** High / Medium. Common Sense Media's 2025 risk assessment of AI teacher assistants found generated lessons that sometimes leaned on stereotypes, repeated misinformation and softened controversial history. It recommends educators "always evaluate AI-generated material for accuracy, bias, and appropriateness before classroom use" **[Sourced]**: https://www.commonsensemedia.org/press-releases/ai-teacher-assistants-need-better-safety-measures-common-sense-media-report-finds; coverage at https://www.the74million.org/article/ai-teacher-assistants-are-useful-but-can-pose-risks-in-classroom-report-finds/.
- **Honest reading:** Newsela already runs content through social-content and DEI review for its articles (**[Inference]**, to confirm). The tool should feed that process, not bypass it.
- **Our response:**
  - **Product feature:** an advisory social-content screen per lesson (stereotyped roles, one-sided framing of contested topics, brand names) that raises flags for the reviewer. It is labelled "advisory, not clearance". A model screen cannot certify compliance.
  - **PRD requirement:** the "social-content check done" item on the approval checklist (E-3) is ticked by a person.
  - **Eval:** a small adversarial test set (outline rows likely to elicit stereotypes) is run on every prompt version (E-10).

### E-8 — Sensitive topics and age-appropriateness in novel-based lessons

- **Brief:** "referencing text/novel indicated in the provided unit outline sheet."
- **Malicious reading:** let the generator write discussion prompts on whatever the novel contains (violence, racism, self-harm, family trauma) with no care, because care costs review time.
- **Who is harmed and how:** a generated prompt can ask a 6th-grader to "describe a time you felt like [the character who was abused]". That pushes personal disclosure in a whole-class setting, every class, every school. Teachers are left handling it unprepared.
- **Severity / likelihood:** High / Medium.
- **Honest reading:** the novels are chosen by experts and difficult themes are often the point. The issue is how prompts handle them.
- **Our response:**
  - **PRD requirement:** the generator does not write prompts that ask students to disclose personal trauma or experiences on sensitive themes. Sensitive passages get a teacher note (content advisory, framing guidance).
  - **Product feature:** sensitive-topic tags per lesson, visible to reviewers and carried to the published lesson.

### E-9 — Disclosure: do teachers, districts and state reviewers know?

- **Brief:** "generating the lessons with AI based on CA standards" and "unlock our ability to sell full programs to users who already love us."
- **Malicious reading:** market the program as "written by Newsela's expert team" and keep AI generation an internal detail. Present the human approval flag (E-3) as proof of human authorship.
- **Who is harmed and how:** districts and state reviewers make adoption decisions with incomplete information. Teachers can't calibrate how much to trust the material. If it comes out later, the trust damage lands on Newsela's whole brand (E-14).
- **Legal position:** our search found **no** California requirement to label AI-generated instructional materials. AB 2876 (2024) is about teaching AI literacy, not labelling materials **[Sourced, absence-of-evidence]**: https://calmatters.digitaldemocracy.org/bills/ca_202320240ab2876. This needs a lawyer's check, and adoption-process rules or district contracts may differ.
- **Ethical position [Inference]:** disclosure is owed whether or not it is legally required. The people trusting the content (districts, teachers, state reviewers) are deciding *how much checking they need to do themselves*, and that depends on how it was made. EdReports reports that districts lack "consistent, independent information about what their AI features actually do" **[Sourced]** (EdReports Sept 2026, above).
- **Honest reading:** Newsela may well plan to disclose. Public disclosure is their decision, not ours.
- **Our response:**
  - **PRD requirement (ours to build):** a per-lesson provenance record covering outline row, model and version, prompt version, generation time, every edit marked human or AI-assisted, every check and its result, and the approver. It can be exported as a provenance report per unit.
  - **Product default:** the internal record always exists and cannot be turned off. What is shown *externally* is a Newsela setting.
  - **Question for Newsela:** what will you disclose to districts and to the state about AI's role, and does the 2026 adoption process ask?

### E-10 — Prompt editing by content authors silently changes a unit

- **Brief:** "bonus points if you allow the editing of the prompt so content authors can tweak the output."
- **Malicious reading (or careless reading):** anyone can edit the prompt, regenerate 40 lessons and leave no trace of what changed. A prompt edit can also remove the guardrail instructions ("don't invent quotes") to get output that "reads better".
- **Who is harmed and how:** approved lessons and new lessons come from different instructions without anyone knowing. A guardrail removed in the prompt removes it for a whole unit. When an error is found, nobody can say who caused it.
- **Severity / likelihood:** High / Medium.
- **Honest reading:** prompt editing is a good feature. It puts content experts in control of the output instead of engineers.
- **Our response:**
  - **PRD requirement:** prompts are versioned. Each edit records author, time, a diff and a reason. Each lesson is pinned to the prompt version that produced it.
  - **Guardrail:** the prompt has a locked part (safety and grounding rules, output schema) and an editable part (tone, activity preferences). Authors edit only the editable part. Deterministic checks (E-1, E-2) run after generation regardless of the prompt, so a prompt edit can't switch them off.
  - **Product feature:** a changed prompt runs against a small fixed regression set (including E-7's adversarial rows) and shows the results before it can be used for a full unit. Lessons regenerated under a new prompt lose their approval and re-enter review.

### E-11 — AI edits slipped in after review

- **Brief:** "review, edit/update (via direct wysiwyg editing and even AI tools as needed)"; "ProseMirror and Yjs for the frontend/collaborative editor".
- **Malicious reading:** the reviewer clicks "AI: improve this section", skims, approves. The approved lesson now contains AI text that no check and no careful human read covered, but the record says "human-reviewed".
- **Who is harmed:** the same people as E-1 and E-3; the AI assist reintroduces the risks the review was meant to remove.
- **Severity / likelihood:** Medium-High / High.
- **Our response:**
  - **PRD requirement:** AI-assisted edits are tracked at span level (Yjs/ProseMirror marks attributed to "AI-assist, requested by X") and shown as suggestions until a human accepts each one. Unaccepted AI spans block approval. Accepted ones still re-run the deterministic checks.
  - **Provenance:** the record keeps the AI-vs-human diff, so "how much of this lesson did a person write or change?" has an answer.

### E-12 — Displacing freelance writers and deskilling reviewers

- **Brief:** "Our content creators (an army of freelancers who write lessons) … The goal here would be to supplant the manual lesson writing step."
- **Malicious reading:** replace the writers, keep a thin review layer at low cost, and claim the same expertise.
- **Who is harmed and how:** freelance curriculum writers lose work. Reviewers become checkers of machine output instead of designers, which also erodes the expertise that makes review meaningful (the "ironies of automation" problem: people who stop doing the task lose the skill to judge it **[Sourced, practitioner summary]**: https://www.koji.so/docs/ironies-of-automation-research-analysis).
- **Severity / likelihood:** Medium (to people's livelihoods, real) / High (it is the stated goal).
- **Honest reading:** the brief is candid about the problem: freelance writing is slow, hard to coordinate and full of quality issues that Newsela already reviews and revises. The cost of manual authoring is a real barrier to a market dominated by large incumbents. The tool still depends on experts: experts write the outline, and experts judge the lessons.
- **Our response (no moralizing, but named):**
  - **Framing:** we build a tool where expert judgement drives the output. Outline authors set the design, reviewers' edits and flags feed back into regeneration and prompt improvements, and both are credited in the provenance record.
  - **Product feature:** reviewer notes become reusable instructions ("always pre-teach Tier 2 vocabulary in Launch"), so reviewer skill compounds instead of being consumed.
  - **Question for Newsela:** we don't assume an answer. Are former writers expected to move into outline authoring and review? That affects who the review UI is designed for.

### E-13 — No recall path once an error is published to every classroom

- **Brief:** "ultimately published to our application"; "adopted by the State/District for all teachers to follow".
- **Malicious reading:** once published, errors are quietly patched, or not at all. Teachers who already taught or printed a lesson are never told.
- **Who is harmed:** every classroom on the same day, as in E-1. Teachers can't correct what they don't know is wrong.
- **Severity / likelihood:** High / Medium. One error multiplies across every adopting district for a year **[Inference, from the brief's adoption model]**.
- **Our response:**
  - **PRD requirement:** published lessons are versioned. A post-publication fix creates an errata entry (what changed, why, severity) and can notify teachers assigned that lesson. For the prototype this is a data-model field and an errata log, not a notification system.
  - **Feature:** "report a problem" from the published lesson routes back into the review queue with provenance attached.

### E-14 — Brand and trust: "users who already love us"

- **Brief:** "unlock our ability to sell full programs to users who already love us."
- **Malicious reading:** use earned trust from levelled articles to sell a new, AI-generated product category without changing the quality bar or telling customers it is different.
- **Who is harmed:** teachers who trust the brand check less (automation bias moves from the tool to the brand). Newsela's long-term reputation takes the hit.
- **Severity / likelihood:** High (business) / Medium.
- **Honest reading:** existing trust is a legitimate go-to-market advantage. It has to be backed by the quality evidence in E-2 and E-3, which are also exactly what a district adoption committee will ask for.
- **Our response:** the unit-level quality report (checks passed, second-review agreement, eval scores) serves both purposes: it protects trust and gives sales something real to show. **Interview framing:** quality evidence is the sales asset.

### E-15 — Copyright of novel text and exemplar content

- **Brief:** "referencing text/novel indicated in the provided unit outline sheet"; "feel free to crawl as many examples as needed via that link".
- **Malicious reading:** scrape or paste whole copyrighted novels into prompts and storage, and reproduce long excerpts in lessons.
- **Who is harmed:** authors and publishers; Newsela's legal exposure.
- **Severity / likelihood:** Medium / Medium.
- **Honest reading:** crawling Newsela's *own* example lessons is explicitly permitted by the brief. Novel text is a different matter.
- **Our response:** for the prototype we use only text Newsela supplies, or public-domain text or short excerpts, and we say which. Generated lessons quote short passages. We do not crawl or store full copyrighted novels. **Question for Newsela:** what text licences do you hold for the outline's novels?

### E-16 — Gaming the state review

- **Brief:** "a rigorous state approval process."
- **Malicious reading [Inference]:** polish the lessons state reviewers are likely to sample and let the bulk run at a lower bar, or generate most of the program after the review window.
- **Who is harmed:** the integrity of the adoption process, and every district that relies on it.
- **Severity / likelihood:** High / Low-Medium. We have no evidence of this; it is the stance exercise.
- **Our response:** the product applies the same blocking checks and sampling to every lesson. There is no "priority" or "showcase" lane with a different bar. Quality reports cover the whole program, not a sample chosen by the author. **Question for Newsela:** which parts of the program are submitted for review, and when relative to generation?

### E-17 — Our own conduct: the demo and the claims

- **Brief:** "Required Deliverables: Source Code, Technical Documentation, Demo Video."
- **Malicious reading (of us):** cherry-pick the best generated lesson for the video, call the system "standards-aligned" and "classroom-ready", and hide the failures.
- **Who is harmed:** Newsela's evaluators, and our credibility in the interview the moment someone asks "how often does it do that?"
- **Our response:**
  - **Demo framing:** show a lesson picked *at random* from a full generated unit, say that it was random, and show at least one caught error (a flagged quote, a blocked approval) in the demo.
  - **Claims:** report eval results with their sample size and method. Say "aligned per our judge on N lessons, human-checked on M", never a bare "aligned".
  - **Limits section** in the technical docs: no licensed text, improvised activity patterns, a judge not validated against Newsela's experts, no real social-content certification, no load test of 20 concurrent reviewers beyond what we actually ran.
  - **No student data:** the system handles no student information, and the docs say so, so nobody assumes privacy work that wasn't done.
- **Sources:** GP-1 (precise terms, not marketing terms), GP-18 (say when evidence doesn't answer; cite what you used).

---

## Requirements this adds to our PRD

1. Verify every quotation and page reference against a supplied source text; block approval on any mismatch.
2. Without source text, write explicit evidence placeholders; never invent quotes or page numbers.
3. Give every lesson an alignment map (standard → teaching section → checking task); block approval on an unmapped standard.
4. Label alignment by who asserted it: outline, generator, judge, or named reviewer. Never show a bare "standards-aligned" badge.
5. Approve one lesson at a time, from inside the lesson; no bulk approve.
6. Disable Approve while blocking issues exist, and list them.
7. Show the outline row, source passage and exemplar beside the content being reviewed.
8. Keep the approval checklist to 4–6 items, each linked to its evidence.
9. Make corrections cheaper than acceptance: inline edit, one-click flag, regenerate-with-note.
10. Bind approval to a lesson version; any edit reopens review.
11. Route a configurable sample of approved lessons to a blind second reviewer; report disagreement per unit.
12. Track AI-assist edits at span level as suggestions; block approval on unaccepted AI spans.
13. Keep a non-optional provenance record per lesson (outline row, model, prompt version, edits by human or AI, checks, approver) and export it per unit.
14. Version prompts with author, diff and reason; pin lessons to their prompt version; lock the safety, grounding and schema part.
15. Run a regression set, adversarial bias rows included, on every prompt change before full-unit use.
16. Keep ELD supports on the same text and task; block supports that replace them.
17. Flag sensitive topics; never generate prompts asking students to disclose personal trauma.
18. Run an advisory social-content screen labelled "advisory, not clearance"; require a human tick.
19. Flag repetition and low rigour at unit level, not only per lesson.
20. Version published lessons, keep an errata log, and route "report a problem" back to review.
21. Show process-health metrics to managers in aggregate; no per-reviewer speed leaderboard by default.
22. Apply the same checks to every lesson; no showcase lane.
23. Demo a randomly chosen lesson, show a caught error, report evals with sample sizes, and publish a limits section.

## How we talk about this in the interview

- "The generator is cheap; trust is the expensive part. So the product is really a *verification and accountability* system, and generation is one step in it."
- "Our rule is that the system only says what it can show. A quote has a matched passage, an alignment has a mapped task, and 'approved' records who checked what, on which version."
- "Human review fails by default at this volume, and the research on automation bias says so. We designed for that: blocking checks, evidence beside the content, cheap corrections, sampling, no bulk approve."
- "We improvised activity patterns because the brief allowed it for the prototype. In production, your instructional designers own that library, and the tool cites which pattern each section used."
- "We tracked AI versus human edits from day one, so whatever Newsela decides to disclose to districts and the state, the record to back it up already exists."
