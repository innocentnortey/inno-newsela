# Newsela brief: legal audit (adversarial reading)

- **Date:** 2026-10-24
- **Role:** legal auditor, one of three adversarial auditors (the others: technical, ethics)
- **Input:** `Gauntlet AI/artifacts/2026-10-13-partner-briefs/newsela-project-brief.md` (brief v1, last updated 10/19/2026), the public sample outline sheet (fetched as CSV), the example lesson page and its course page on `ca-2026-review.newsela.com` (two page loads only), Newsela's Terms of Use, and the CDE's 2026 ELA/ELD adoption reports.
- **Not legal advice.** This is an engineer's risk read to shape guardrails and questions. A lawyer should check anything we act on.
- **Markers:** **[F]** means a fact I checked at the cited source. **[I]** means my inference or reading, which needs confirming.

## Summary

1. **Top risk 1: anchor-text copyright at bulk scale.** The outline tells "the writer" to "SELECT AND WRITE TO AN EXCERPT" of texts that are mostly still in copyright: Riordan's *The Lightning Thief*, Coolidge's *Greek Myths* (renewed 1977), a Guardian interview, Britannica Kids, and modern Homer/Virgil translations. An AI acting as that writer, across 160 lessons per grade, turns one rights mistake into hundreds (L-1, L-2).
2. **Top risk 2: the example site holds pre-adoption state-review material.** It is almost certainly the reviewer copy of *Threads & Themes*, which the CDE has recommended but the State Board has not yet adopted (action expected November 2026). The sample outline is that program's own Unit 4. Crawled copies must not reach a public repo or video, and the tool must not quietly rewrite adopted lessons (L-3, L-4).
3. **Top risk 3: "standards-aligned" claims we cannot back up.** The outline already pairs ELD standard codes with the wrong descriptions. A generator that trusts those labels produces false alignment claims that feed a state procurement process (L-8, L-9).
4. **Worst to miss:** in the outline, the excerpt choice is a **rights decision**, not a content decision. If the model picks and reproduces excerpts on its own, it does the one thing a human rights-clearance step exists to stop, and it does it at bulk scale.
5. **Net:** no finding is a reason to refuse. Each one becomes a design guardrail. The biggest are: reference rather than reproduce, keep crawled content out of git, use a canonical standards list, and keep an authorship and provenance ledger.

## Context facts that change the reading

- **[F]** Newsela submitted **"Threads & Themes ELA for California"** (Program Type 1, grades 6–8) and **"Threads & Themes ELA and ELD for California"** (Program Type 2, grades 6–8) to California's 2026 ELA/ELD follow-up adoption. Review panels recommended both for adoption, with conditions: the CDE's August 2026 report lists "edits and corrections [that] must be made as a condition of adoption". The CDE page says "these advisory recommendations have not been approved by the Instructional Quality Commission or the State Board of Education." Sources: [CDE Reports of Findings](https://www.cde.ca.gov/ci/rl/im/elaeldimrofs2026.asp), [Type 1 report](https://www.cde.ca.gov/ci/rl/im/documents/newsela6thru8.docx), [Type 2 report](https://www.cde.ca.gov/ci/rl/im/documents/newselathdsths6thru8.docx), [participants](https://www.cde.ca.gov/ci/rl/im/elaeldparticipants2026.asp).
- **[F]** The brief's example lesson is "ELA Core 6th Grade, Unit 1, Lesson 1 … Learning in Action Part A … RI.6.1 RI.6.2". The Type 2 report cites the same lesson as an exemplar: "Grade 6, Unit 1, Lesson 1, Learning in Action Part A — RI.6.1, RI.6.2". The page is served with `robots: noindex, nofollow`, needs no login, and sits on the host `ca-2026-review`.
- **[F]** The course page lists "Unit 4: Myths, Monsters & Modern Stories". The sample outline's header reads "G6, U4: The Lightning Thief by Rick Riordan, ISBN 9780786838653", though its filenames say `U3`. The CDE report cites G6.U3.L18 and G6.U3.L22 as exemplars, and those lesson numbers match rows in the sheet.
- **[I]** So the "new market" program already exists and is in late-stage state review. The sample outline is for a unit that has already been written, so the tool is being tested against content with a known answer. Read honestly, this is a strong evaluation set. Read adversarially, it is a request to regenerate, and possibly replace, state-reviewed content.
- **[F]** Newsela's [Terms of Use](https://newsela.com/legal/terms) (updated October 2026) contain these clauses. §3 prohibits "any robot, spider … to 'screen scrape,' monitor, 'mine,' or copy". §3 also prohibits "post or otherwise disclose Newsela Content publicly without approval from a Newsela authorized representative". §1 says content "may not be copied … without the prior written permission of Newsela". §9(b) bars using it to "develop, train or improve any machine learning or other artificial intelligence models". §6 says: "We will not be required to treat any Feedback as confidential."

---

## Findings

### L-1 Copyright in the anchor and companion texts: reproducing them at bulk scale

- **Brief:** "referencing text/novel indicated in the provided unit outline sheet"; "feel free to crawl as many examples as needed … to examine content and build AI instructions to generate". **Sheet:** "WRITER MUST SLECT AND WRITE TO AN EXCERPT OF THE TEXT"; "3 passages from Coolidge's Prometheus/Pandora myths"; "Rick Riordan: 'I'm hardly the first to modernise Greek myths' (The Guardian interview)"; "'Delphi – Kids' (Britannica Kids)"; "Translated excerpt from Virgil's Aeneid Book 6, lines 295–336"; "Teacher-chosen clips from the movie version of The Lightning Thief".
- **Malicious reading:** the brief hands the rights decision to the AI ("improvise", "the writer must select") while it supplies none of the source texts. A model will fill the gap from memory: reconstructed passages of *The Lightning Thief*, a remembered Fagles or Fitzgerald translation, a paraphrase close enough to count as a copy. If a rightsholder objects later, Newsela can say "the vendor's tool wrote that".
- **Who is harmed and who bears it:** the rightsholders are harmed: Disney-Hyperion and Riordan, HMH for Coolidge, Guardian News & Media, Britannica, and the translators' publishers. Newsela, as publisher, bears the infringement exposure. At scale, the 17 U.S.C. §504 statutory damages per work add up. We bear reputational exposure, plus contractual exposure if a later engagement includes an IP warranty. **[I]**
- **Severity:** high. **Likelihood:** high without guardrails. A 40-lesson unit has roughly a dozen excerpt slots, and a 160-lesson grade has several dozen.
- **Facts:**
  - **[F]** *Greek Myths* by Olivia Coolidge was copyrighted 1949 and renewed 1977, and current reprints carry "by permission of Houghton Mifflin Harcourt" ([search result: reprint credit lines](https://www.exodusbooks.com/olivia-coolidge/940/)). **[I]** Under the 95-year term for renewed 1909-Act works, it enters the US public domain on 2045-01-01.
  - **[F]** The sheet marks several texts as public domain: Baldwin (*Old Greek Stories*), Judson (*Myths and Legends of Alaska*), the Spence Popol Vuh (Gutenberg) and Bateman (*Zanzibar Tales*, 1901).
  - **[I]** Homer and Virgil are public domain, but the translation is the copyrighted layer. Butler, Lang/Leaf/Myers and Dryden are safe. Fagles, Fitzgerald, Lombardo and Wilson are not.
- **Fair use:** **[F]** fair use is decided case by case under 17 U.S.C. §107 ([text](https://www.law.cornell.edu/uscode/text/17/107)). **[F]** *Cambridge Univ. Press v. Patton*, 769 F.3d 1232 (11th Cir. 2014), treated nonprofit educational use as favouring fair use, but it is the weak case to lean on: the use was non-transformative and the court analysed each excerpt separately ([USCO summary](https://www.copyright.gov/fair-use/summaries/cambridgeuniv-patton-11thcir2014.pdf)). **[I]** A for-profit publisher selling a statewide program for tens of millions in ARR is a commercial user. The "classroom guidelines" protect teachers, not publishers. Short quotation for commentary inside a lesson is defensible. Reproducing reading passages is a licensing matter.
- **Film clips:** **[F]** 17 U.S.C. §110(1) allows performance in face-to-face teaching at a nonprofit educational institution, using a lawfully made copy ([text](https://www.law.cornell.edu/uscode/text/17/110)). **[I]** That exemption covers the teacher. It does not cover a lesson that embeds or links a pirated clip.
- **Vendor cover does not cover this:** **[F]** Anthropic's [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) (eff. 2025-06-17) indemnify against claims that outputs infringe, but §K.3 excludes "the combination of the Services or Outputs with technology or content not provided by Anthropic", customer-provided inputs, and use the customer "knows or should reasonably know" infringes. **[F]** *Bartz v. Anthropic* (N.D. Cal., June 2025) addressed fair use in *training*, not reproduction in outputs, and was settled for at least $1.5B ([KTS summary](https://ktslaw.com/insights/alert/2025/9/parties-reach-a-landmark-settlement-in-the-bartz-v-anthropic-litigation)).
- **Honest reading:** the brief expects lesson *instructions* that point at a text the school buys, just as the human-written lessons do. The example lesson quotes only one short line (a Jason Reynolds quote inside a Newsela article).
- **Our response (design guardrails):**
  1. **Reference, don't reproduce.** Anchor and companion texts appear as citations: title, edition and ISBN, chapter and page range, plus a placeholder such as `[[EXCERPT: The Lightning Thief ch. 9, pp. 141–143, ISBN 9780786838653 | rights: TO CLEAR]]`. The model never writes the passage itself.
  2. **Public-domain allowlist with provenance.** Verbatim excerpts are allowed only from a fixed list of public-domain sources that we supply (Gutenberg ebook IDs), and only by copying from the fetched source text, never from model memory. Each excerpt records its source URL and a hash.
  3. **Output filter.** Flag any quoted run longer than about 25 words, or longer than 2 sentences, that is not copied from a supplied source. Flagged lessons cannot reach "Approved" until a reviewer clears the rights field.
  4. **Rights field per excerpt** (`public-domain | Newsela-owned | licensed | to-clear | short-quote-commentary`), required before approval.
  5. **Media links** only from an allowlist (Newsela-licensed media). Otherwise use "teacher-selected clip from a licensed copy".
  6. **Demo** uses only public-domain or Newsela-article excerpts.
- **Sources:** as cited inline.

### L-2 Made-up quotations and facts attributed to real people and real sources

- **Brief:** "its OK to improvise what content goes in there based on the examples". **Sheet:** "Students read a short excerpt from Riordan's interview"; the example lesson quotes Jason Reynolds.
- **Malicious reading:** "improvise" invites the model to write plausible Riordan or Reynolds quotes, Britannica facts, and "Mini Morphology" etymologies. The output looks authoritative, and in bulk no one checks it.
- **Who is harmed and who bears it:** students and teachers get false facts. Real people are misquoted (low defamation risk, real reputational risk). **[F]** State-adopted materials must be "factually accurate" (Ed Code §60200(c), [text](https://california.public.law/codes/education_code_section_60200)). Newsela bears the adoption and edits-and-corrections exposure.
- **Severity:** med. **Likelihood:** high. Models confabulate quotes reliably when no source text is supplied.
- **Honest reading:** "improvise" means the classroom activities (routines, discussion prompts), not facts.
- **Our response:**
  1. A direct quotation attributed to a person or publication is allowed only when its source text was supplied as input. Otherwise the generator writes `[[QUOTE NEEDED: Riordan on modernising myths — source: Guardian interview]]`.
  2. Factual claims about real people, places and history get a "verify" marker in the editor, which the reviewer clears.
  3. Etymologies are checked against a supplied reference, or flagged.

### L-3 Crawling the reviewer site: pre-adoption content, the Terms of Use, and the public repo

- **Brief:** "feel free to crawl as many examples as needed via that link"; "these are legitimate lessons already created". Required deliverables: "Source Code, Technical Documentation, Demo Video".
- **Malicious reading:** two traps. (a) The site is the review copy for a state adoption the board has not yet decided. If our public GitHub repo, our demo video, or a submission to a hiring-partner portal republishes its lessons, *we* are the ones who disclosed pre-adoption material. (b) The Terms forbid robots and public disclosure "without approval from a Newsela authorized representative". If a crawl becomes a dispute, the brief is the only approval we hold, and it was issued through Gauntlet's portal, not under a signed agreement.
- **Who is harmed and who bears it:** Newsela's competitive position (competitors such as EL Education/Kiddom are in the same adoption), possibly the integrity of the review if content is altered or leaked, and Innocent personally for a Terms breach or for disclosure. **[I]**
- **Severity:** high if republished, low if kept private. **Likelihood:** med. The default Gauntlet flow is a public GitHub mirror plus a demo video.
- **Facts:** **[F]** The site has no login, serves `noindex, nofollow`, and its `robots.txt` returns S3 `AccessDenied` (so there is no machine-readable crawl policy). The footer reads "© 2026 Newsela Inc." and links the Terms. **[F]** The Terms clauses are quoted under *Context*. **[I]** Being public and unindexed means "not secret, but not meant for search engines". It is consistent with a reviewer-access site.
- **Honest reading:** Newsela authorises this crawl in writing for this project ("feel free to crawl"). The brief comes from their product team and names a technical contact, so it plausibly counts as approval from an authorised representative.
- **Our response:**
  1. Crawl narrowly: cap the page count, wait at least 1 s between requests, send an identifying User-Agent, and stay inside the course paths linked from the example.
  2. Store crawled HTML and extracted lessons in a git-ignored `data/private/newsela-crawl/`. They never go in the repo, the GitLab mirror, Render or the video.
  3. The repo ships only our derived **structure schema** (section names, front-matter fields, durations), which is not their expression, plus our own generated samples.
  4. The demo video shows generated lessons, not crawled ones. Their page may appear briefly as a cited reference only if Andrew approves.
  5. Delete the crawl copy after the review, and record the deletion in the dev log.
  6. Ask Andrew whether the repo and video may be public, and whether the site is the state-reviewer copy (Questions Q1, Q2).

### L-4 Regenerating a unit that is already state-reviewed: post-adoption change rules

- **Brief:** "Newsela is entering a new market this year"; "generate the lessons in bulk … and ultimately published to our application". The sample outline is the existing Unit 4 (see *Context*).
- **Malicious reading:** state reviewers recommended human-authored lessons. After the board adopts them, the tool regenerates and republishes lessons in that adopted program, so districts receive content no state reviewer ever saw, under the adopted program's name.
- **Who is harmed and who bears it:** districts that bought "adopted" materials, and students. Newsela bears the compliance exposure. **[F]** Title 5 defines "edits and corrections" as changes "minimal in number" made to meet social content, accuracy or clarity requirements (5 CCR §9510(h), [text](https://www.law.cornell.edu/regulations/california/5-CCR-9510)). **[I, from a CDE summary, verify]** 5 CCR §9529 allows a replacement edition only when the changes are minimal enough that the old and new editions can be used together, and "no new content" is added. Our exposure is low, unless we designed the tool to overwrite silently.
- **Severity:** med. **Likelihood:** low to med. **[I]** The likelier use is future units, new grades, other states, or local adoption under Ed Code §60210 (a district review whose participants are a majority of classroom teachers; [text](https://california.public.law/codes/education_code_section_60210)).
- **Honest reading:** they chose a unit with a known answer so they can judge our output against it. That is good evaluation practice.
- **Our response:**
  1. **Version lineage:** every lesson keeps its program, unit and lesson ID, its version, and a status of `draft | in-review | approved | published | adopted-locked`.
  2. Editing an `adopted-locked` lesson creates a new version that requires a **change classification**: an edit or correction (typo, accuracy, clarity, social content) versus new content. New content is blocked from overwriting the adopted version.
  3. **Eval note for the technical auditor:** keep Unit 4's real lessons *out* of the few-shot prompts and use them only as a held-out comparison. Otherwise the model can copy the answer.

### L-5 Copyright ownership of AI-generated lessons: the human-authorship record

- **Brief:** "supplant the manual lesson writing step"; "review, edit/update (via direct wysiwyg editing and even AI tools as needed), and then mark the content as approve/finalized".
- **Malicious reading:** this is not really an attack on us. The trap is for Newsela: lessons a reviewer only approves may have **no copyright at all**, so a competitor could copy the adopted program. The tool's design decides whether Newsela can prove human authorship.
- **Facts:**
  - **[F]** The USCO registration guidance (88 FR 16190, 2023-03-16) requires applicants to disclose AI-generated material that is more than de minimis and to claim only the human contribution ([Federal Register](https://www.federalregister.gov/documents/2023/03/16/2023-05321/copyright-registration-guidance-works-containing-material-generated-by-artificial-intelligence)).
  - **[F]** The USCO *Copyright and AI, Part 2: Copyrightability* report (2025-01-29) found that prompts alone do not make the user the author. Human selection, arrangement and modification of AI output, and human-authored inputs that remain perceptible in the output, can be protected ([report](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf); [summary](https://copyrightalliance.org/ai-report-part-2-copyrightability/)).
  - **[F]** *Thaler v. Perlmutter* (D.C. Cir. 2025-03-18) affirmed the human-authorship requirement ([IPWatchdog](https://ipwatchdog.com/2025/03/24/d-c-circuit-upholds-human-authorship-requirement-thaler-v-perlmutter/)). Reported but not checked on the docket: the Supreme Court denied certiorari on 2026-03-02.
  - **[F]** Anthropic's Commercial Terms say the customer "owns its Outputs". OpenAI's terms similarly assign outputs to the user. **[I]** Ownership of a thing that may not be protected at all gives Newsela no exclusivity.
- **Who is harmed and who bears it:** Newsela (its IP moat). Severity med, likelihood high.
- **Honest reading:** the brief already includes the human steps that matter: an expert-written outline (a human-authored input that stays perceptible in the output), editing and approval.
- **Our response (PRD requirements):**
  1. An **authorship ledger** per lesson: the AI baseline snapshot, each human edit (stored Yjs updates plus a snapshot at each status change), the editor's identity, timestamps, and any AI-assist calls (who invoked them, the instruction, accepted or rejected).
  2. A computed **human-contribution summary** (share of characters changed and sections rewritten) that can be exported per unit for a registration filing.
  3. The outline sheet is stored as a versioned, attributed human input.
  4. Approval alone is never recorded as authorship.

### L-6 Sending Newsela content, and the anchor texts, to OpenAI or Anthropic

- **Brief:** "AI Generate lessons … using an agent/LLM"; "OpenAI or Anthropic APIs"; "build AI instructions to generate".
- **Malicious reading:** we put their pre-adoption lessons into *our* API account, which makes Innocent the "customer" holding their content at a third party. If we also paste novel text, we have uploaded a copyrighted book to a vendor. And Terms §9(b) forbids using Newsela content to "train or improve" AI models, so a fine-tune would breach it.
- **Facts:**
  - **[F]** OpenAI: API data "is not used to train or improve OpenAI models unless you explicitly opt in". Abuse-monitoring logs are kept up to 30 days, and zero data retention requires approval ([your data](https://developers.openai.com/api/docs/guides/your-data), [API data privacy](https://openai.com/api-data-privacy)).
  - **[F]** Anthropic: "Anthropic may not train models on Customer Content from Services" ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms)). Inputs and outputs are deleted "within 30 days". Flagged content is kept up to 2 years and classifier scores up to 7 years ([privacy center, updated 2026-07-01](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)).
- **Severity:** med. **Likelihood:** med.
- **Honest reading:** they explicitly authorise using their examples to build prompts. Using them as in-context examples is not training.
- **Our response:**
  1. In-context examples only: **no fine-tuning**, no Files API or vector stores holding their lessons.
  2. A dedicated API project and key for Newsela work, deleted after the review.
  3. **What prompts may contain:** our derived structure schema, one or two short lesson excerpts as format examples, the official standards text (public), outline rows, and supplied public-domain excerpts.
  4. **What prompts must not contain:** full copyrighted novels or chapters, student data, freelancer names or emails, credentials.
  5. In the PRD's production section: Newsela should run it on its own enterprise account, with zero data retention and a DPA.

### L-7 Social content standards and age-appropriateness of generated material

- **Brief:** "aligned to teach the CA Core ELA/ELD standards". **Sheet:** "excerpt from the Popol Vuh … (K'iche' Maya sacred narrative)"; "Raven … (Indigenous Alaskan traditions)"; "'The Hare and the Lion' in *Zanzibar Tales: Told by Natives of the East Coast of Africa*" (1901); "Homer's Odyssey Book 8 … Hephaestus traps Aphrodite and Ares in a net"; "clips from the movie version".
- **Malicious reading:** the brief names the academic standards and never mentions California's *legal* content rules. A bulk generator writing about sacred Indigenous and Maya narratives, a colonial-era translation, and an adultery story for 11-year-olds is the content most likely to fail social-content review or draw a parent complaint. The brief makes the tool's output the first draft of exactly that content.
- **Facts:**
  - **[F]** Materials must comply with Ed Code §§60040–60044, 60048, 60200.5 and 60200.6, and with the SBE's social content guidelines (§60200(c)).
  - **[F]** §60044: a board "shall not adopt any instructional materials" that portray people adversely because of race or ethnicity, gender, religion, disability, nationality, sexual orientation or occupation, or that contain sectarian doctrine "contrary to law" ([text](https://california.public.law/codes/education_code_section_60044)).
  - **[F]** §60048 restricts commercial brand names and logos, with an exception for identifying third-party content sources ([text](https://california.public.law/codes/education_code_section_60048)).
  - **[F]** The SBE *Standards for Evaluating Instructional Materials for Social Content* (2013 edition) apply ([CDE doc](https://www.cde.ca.gov/CI/cr/cf/documents/socialcontent2013.doc)).
- **Who is harmed and who bears it:** students from the portrayed communities. Newsela bears it: social-content citations become edits and corrections, or a district rejects the material.
- **Severity:** med. **Likelihood:** med.
- **Honest reading:** the human designers chose these texts deliberately, for diversity (the CDE report praises the program's "Indigenous texts"). The tool must write about them respectfully.
- **Our response:**
  1. A **social-content check** as a required review step, using the 2013 categories (ethnic and cultural groups, religion, gender, disability, age, brand names, diet and exercise). The step is pre-filled by an LLM pre-screen that flags and quotes lines.
  2. A reviewer attests to the check on approval.
  3. Generation instructions: present sacred narratives as a culture's stories, in a respectful frame, without disparagement. Modernise dated translation language and note that you did. Keep summaries of mature mythological content grade-appropriate.
  4. A brand-name detector, so references like "the 2010 Disney film" are flagged.

### L-8 "Standards-aligned" claims, and an outline that already mislabels the standards

- **Brief:** "aligned to teach the CA Core ELA/ELD standards numbers indicated in the sheet (e.g., RI.6.4, -- standards and definitions can be found online)"; "what's important is that we generate standard aligned content".
- **Malicious reading:** the brief makes alignment our deliverable and leaves the definitions for us to scrape "online". If the program is sold as "standards-aligned" on the strength of the AI's labels, and those labels are wrong, the misstatement traces back to our tool.
- **Facts:**
  - **[F]** The outline pairs codes with wrong descriptions. Lesson 1 says "ELD.PI.6.6 – Exchange information and ideas orally" and lesson 2 says "ELD.PII.6.3 – Use content-specific vocabulary accurately".
  - **[F]** In the CA ELD Standards, PI.6.1 is "Exchanging information and ideas" and PI.6.6 is "Reading/viewing closely" ([CDE ELD standards grade 6](https://www.cde.ca.gov/CI/rl/im/documents/eldstandards6.docx); [CDE standards search](https://www2.cde.ca.gov/cacs/eld?c2=2&c3=8)).
  - **[I, verify]** PII.6.3 is "Using verbs and verb phrases", not vocabulary.
- **Who is harmed and who bears it:** districts buying on the alignment claim. Newsela is exposed under FTC Act §5 and California's UCL/FAL (Bus. & Prof. Code §§17200, 17500). **[I]** Where a district buys with state money on a certified false claim, the California False Claims Act (Gov. Code §12650 et seq.) is the remote, worst-case theory. **[F]** The FTC is actively pursuing unsubstantiated AI claims ([Operation AI Comply, H&K 2026 update](https://www.hklaw.com/en/insights/publications/2026/08/operation-ai-comply-2-years-later-continued-enforcement)).
- **Severity:** med. **Likelihood:** high for errors, low for enforcement.
- **Our response:**
  1. A **canonical standards table** loaded from the CDE source (CA CCSS ELA and CA ELD, with code, official text and grade). Every code in the sheet and in the output is checked against it.
  2. The sheet's own descriptions are shown next to the official text, with a mismatch flag ("outline says X; CDE says Y").
  3. Each focus standard is tied to the specific activity and the check that addresses it (evidence).
  4. Labels read "AI-proposed alignment, confirmed by {reviewer}". Nothing is labelled "aligned" automatically.
  5. Unknown or malformed codes block generation of that lesson.

### L-9 Disclosing AI use to the state and to districts

- **Brief:** says nothing about disclosure. It talks only about getting through "a rigorous state approval process".
- **Malicious reading:** the silence is the point. The AI involvement disappears behind "staff reviewed it", and that becomes a problem if a district's AI policy or a procurement questionnaire later asks.
- **Facts:**
  - **[F]** I found no California statute that requires instructional-materials publishers to disclose AI generation.
  - **[F]** AB 2876 (2024) adds AI literacy to frameworks and materials at their next revision ([Berman release](https://berman.asmdc.org/press-releases/20241003-california-teach-ai-literacy-every-grade)).
  - **[F]** SB 1288 (2024, Ch. 893) created a working group that must produce guidance by 2026-01-01, a model policy by 2026-07-01, and a report by 2027-01-01 ([bill text](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240SB1288)). **[I]** District AI policies built on that model may ask vendors about AI.
  - **[I]** SB 942 / SB 1000 (latent disclosures in AI image, video and audio) and AB 2013 (training-data disclosure by developers of generative AI systems) do not reach text lessons or a tool that does not train models. Check this if we add generated images.
  - **[F]** The 2026 adoption pages I reached say nothing about AI. I could not read Publisher Bulletin 3, because the CDE's bot wall blocked it ([link](https://www.cde.ca.gov/ci/rl/im/pubbulletin3elaeldfup.asp)).
- **Severity:** low today, rising. **Likelihood:** med.
- **Our response:**
  1. Store provenance per lesson (model, prompt version, generation date, human-edit summary) so that any disclosure Newsela chooses is truthful.
  2. Export it per unit.
  3. Whether to disclose is Newsela's decision. We make sure the record exists (Question Q4).

### L-10 Accessibility of the generated lessons and of the staff tool

- **Brief:** "ultimately published to our application"; "Have a UI/UX for content experts …"; "ProseMirror and Yjs".
- **Malicious reading:** accessibility is never mentioned. Inaccessible lesson structure published to districts makes Newsela the vendor whose content breaks the districts' Title II compliance.
- **Facts:**
  - **[F]** The DOJ Title II rule (28 CFR part 35, subpart H, April 2024) requires WCAG 2.1 AA for state and local government web content, including content provided "through contractual, licensing, or other arrangements".
  - **[F]** The DOJ's interim final rule of 2026-04-20 moved compliance to **2027-04-26** for entities serving 50,000 or more people and **2028-04-26** for smaller entities and special districts. The standard is unchanged. DOJ also signalled a possible separate K-12 rulemaking ([Duane Morris](https://www.duanemorris.com/alerts/doj_extends_ada_title_ii_digital_accessibility_deadlines_one_year_0426.html), [EDUCAUSE](https://er.educause.edu/articles/2026/6/doj-and-hhs-extend-web-accessibility-deadlines-to-2027-2028), [AASA](https://www.aasa.org/resources/blog/doj-delays-website-accessibility-compliance-for-1-year)).
  - **[F]** Ed Code §60061.8 requires braille-compatible electronic files on request ([FindLaw](https://codes.findlaw.com/ca/education-code/edc-sect-60061-8/)).
  - **[I]** Section 508 binds federal agencies, not Newsela. For the staff tool, employees' rights to accommodation (ADA Title I, California FEHA) make an accessible editor the safe default.
- **Severity:** med for content, low for the staff UI. **Likelihood:** med.
- **Our response:**
  1. The generated lesson schema produces semantic structure: heading levels, real tables with headers, lists, alt-text fields that are required for any image, and no meaning carried by colour alone.
  2. An automated accessibility lint runs on the rendered lesson before approval.
  3. The staff UI targets WCAG 2.1 AA: keyboard-operable editor and approval flow, labelled controls, and an axe run in CI.

### L-11 Student data privacy

- **Brief:** "an interface for our review staff"; "staff of 20+ reviewers"; "ultimately published to our application" (Newsela also has "assessment and district analytics").
- **Malicious reading:** an "internal" tool that later gets wired into the student platform, or whose AI assist receives a pasted real student response ("make the exemplar like this kid's answer"), takes in student records without the contracts and safeguards those require.
- **Facts:**
  - **[F]** FERPA (20 U.S.C. §1232g).
  - **[F]** The amended COPPA Rule has a compliance date of **2026-04-22** and adds written security programs and retention policies ([Federal Register](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule)).
  - **[F]** SOPIPA (Bus. & Prof. Code §22584) covers operators of K-12 services ([text](https://california.public.law/codes/business_and_professions_code_section_22584)).
  - **[F]** Ed Code §49073.1 (AB 1584) sets the contract terms required when a district shares pupil records with a vendor ([chaptered](https://www.leginfo.ca.gov/pub/13-14/bill/asm/ab_1551-1600/ab_1584_bill_20140929_chaptered.htm)).
  - **[I]** A staff-only content tool with no student data is outside all four laws.
- **Severity:** high if it happens. **Likelihood:** low.
- **Our response:**
  1. No student or teacher-of-record fields in the schema.
  2. A separate database from any student system. The publish step is one-way and carries content only.
  3. A notice in the AI-assist panel ("no student work or names") plus a simple detector for names, emails and IDs that warns before sending.
  4. Generated "sample student responses" are synthetic and labelled as synthetic.
  5. Staff authentication only.

### L-12 The "army of freelancers" being "supplanted" (short; passed to the ethics auditor)

- **Brief:** "Our content creators (an army of freelancers who write lessons) …"; "The goal here would be to supplant the manual lesson writing step".
- **Malicious reading:** nothing unlawful is being asked of *us*. Ending freelance engagements is lawful. Two legal edges remain. (a) **[F]** California's freelance writer and editor exemption from the ABC test (AB 2257, Labor Code §2778) requires a written contract that specifies pay, payment deadline and **IP rights** ([DWT](https://www.dwt.com/blogs/employment-labor-and-benefits/2020/09/california-ab-2257-independent-contractor-law)). **[I]** If freelancers move to reviewing AI drafts under Newsela's direction and tools, the classification facts change. (b) **[I]** The example lessons we would mine were written by freelancers. Using them as prompt material depends on Newsela holding assignments from those writers.
- **Severity:** low for us. **Likelihood:** n/a.
- **Our response:** ask Newsela to confirm it owns the example lessons (Q6). Keep any wording about "replacing writers" out of our deliverables. Pass the human-impact framing to the ethics auditor.

### L-13 The take-home itself: unpaid work on live content and a live market entry

- **Brief:** "1-2 days"; "Submit directly from this page. Your submission is tied to this project version."; deliverables "Source Code, Technical Documentation, Demo Video".
- **Malicious reading:** a ready-made production tool for a market they are entering this quarter, built for free, with Terms §6 saying feedback need not be kept confidential. Newsela could ship our design without hiring or paying anyone.
- **Who bears it:** Innocent (his IP and time). **[I]** It is legal, because the work is voluntary and there is no assignment, but the IP position should be deliberate rather than accidental.
- **Severity:** low to med. **Likelihood:** med.
- **Our response:**
  1. Put an explicit `LICENSE` in the repo that Innocent chooses ("All rights reserved; evaluation use permitted" or an open licence on purpose).
  2. No Newsela content in the repo (see L-3), so the repo is cleanly his.
  3. Do not sign anything, or click through anything, that assigns rights without reading it first.
  4. Treat the brief and the crawled content as confidential by default, even though neither is marked confidential.
  5. Do not contact anyone. Questions go to Andrew only when Innocent decides to send them.

### L-14 Ingesting the Google Sheet

- **Brief:** "a google spreadsheet of ~40 lessons"; "upload the spreadsheet/link for a Unit".
- **Malicious reading:** a public "anyone with the link" sheet of unpublished instructional design is itself a leak waiting to happen. A tool that requires public links trains staff to make their IP public.
- **Facts:** **[F]** The sample sheet exports as CSV without authentication. It contains no emails or personal data (checked). It has data-quality defects: the header says U4 while filenames say U3; there is a merged filename `L35_…L30_…`; there is a `L309` filename.
- **Severity:** low to med. **Likelihood:** med.
- **Our response:**
  1. For the demo, read public links read-only.
  2. In the PRD's production path, use Google OAuth or a service account with `spreadsheets.readonly` on restricted-sharing sheets. No public-link requirement.
  3. Store an immutable snapshot of the sheet plus its hash for each generation run (this also supports L-5).
  4. Validate the sheet's structure and show defects before generation starts.
  5. Treat cell text as untrusted data, never as instructions (prompt injection; passed to the technical auditor).

### L-15 Prompts that content authors can edit

- **Brief:** "bonus points if you allow the editing of the prompt so content authors can tweak the output".
- **Malicious reading:** an editable prompt is a way around every guardrail above. "Include the full text of chapter 9", or "ignore the social-content rules": in each case the record shows a staff member did it, not the system.
- **Severity:** med. **Likelihood:** med.
- **Our response:**
  1. Split the prompt into a **locked guardrail layer** (the copyright, quotation, social-content and standards rules) and an **editable style layer**.
  2. Version every prompt edit with its author and a diff, and record which prompt version produced each lesson.
  3. The output filters (L-1, L-2, L-8) run regardless of the prompt.

---

## Questions for Newsela (for Andrew Parker; Innocent decides whether and when to send)

1. Is `ca-2026-review.newsela.com` the access site you gave state reviewers for the 2026 ELA/ELD follow-up adoption? Is its content confidential until the State Board acts?
2. May our repository and demo video be public? If so, may they show any crawled lesson content, or only our generated output?
3. How far does the crawl authorisation reach: which courses and how many pages? Should we delete the copies after review?
4. Do you disclose AI involvement to the state, to districts or to teachers? Should the tool keep provenance records for that purpose?
5. For anchor and companion texts (*The Lightning Thief*, Coolidge, the Guardian interview, Britannica Kids, modern translations), what does your rights team clear? Should generated lessons reference texts only and never reproduce excerpts?
6. Does Newsela hold IP assignments from the freelancers who wrote the example lessons and outlines, so that using them as prompt examples is within your rights?
7. Will the generated lessons ever replace or modify lessons in the adopted *Threads & Themes* program, or only feed new units, grades and states?
8. Which LLM accounts would production use: your enterprise account, with zero data retention and a DPA?
9. Is there an official, machine-readable standards source you use (codes plus official text), or should we load it from the CDE?
10. What accessibility conformance target applies to published lessons (WCAG 2.1 AA, VPAT)?

## Requirements this adds to our PRD

- Reference anchor texts by edition, chapter and page. Never generate their passages.
- Allow verbatim excerpts only from a public-domain allowlist, copied from the fetched source with its URL and hash.
- Flag any quote over 25 words that has no supplied source, and block approval until it is cleared.
- Require a rights status on every excerpt before a lesson can be approved.
- Allow quotes attributed to real people or publications only from supplied source text. Otherwise insert a `QUOTE NEEDED` placeholder.
- Mark real-world factual claims "verify" for reviewer sign-off.
- Validate every standard code against a canonical CDE table, and show the official text.
- Flag mismatches between outline descriptions and the official standard text.
- Tie each focus standard to the activity and the check that address it.
- Never auto-label a lesson "aligned". Record "AI-proposed, confirmed by {reviewer}".
- Run a social-content check (2013 SBE categories) as a required, attested review step.
- Detect brand names in output.
- Keep an authorship ledger per lesson: AI baseline, human edits, AI-assist calls, editor identities and timestamps.
- Export a human-contribution summary per unit.
- Store provenance per lesson: model, prompt version, outline snapshot hash, generation time.
- Version every lesson, and make `adopted-locked` lessons immutable. Edits to them create classified new versions.
- Keep the guardrail prompt layer locked. Version the editable style layer with its author.
- Hold the real Unit 4 lessons out of the few-shot prompts and use them only as an evaluation reference.
- Keep crawled Newsela content in a git-ignored private folder. Never commit, deploy or record it.
- Rate-limit and cap the crawler, and give it an identifying User-Agent.
- Use in-context examples only: no fine-tuning, no vendor-side file or vector storage of Newsela content.
- Put no student data, freelancer PII or full copyrighted works in prompts.
- Warn on likely student data in AI-assist input.
- Give the lesson output semantic, accessible structure, and lint it before approval.
- Build the staff UI to WCAG 2.1 AA, with an axe check in CI.
- Use authenticated, read-only Google access in production, and snapshot the sheet for each run.
- Validate the outline's structure before generation, and treat its text as data, not instructions.
- Ship an explicit LICENSE that Innocent chooses.
