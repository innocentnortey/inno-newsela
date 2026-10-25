# Newsela: website features and value map

**Date:** 2026-10-24
**Method:** I read newsela.com and its sitemap (about 900 URLs), help.newsela.com (Intercom help center), contributors.newsela.com (the freelance contributor site), formative.com, Newsela's Greenhouse job board, the California Department of Education (CDE) review reports, and the Threads & Themes PDFs. Tools were curl, WebFetch and WebSearch only, with no browser. Almost every newsela.com page is server-rendered (Webflow), so the page text was readable directly.
**Status:** research, not decisions. Anything marked *Inference* is my reading of the evidence. Newsela does not say it.

---

## 1. Summary

1. **Newsela already has the product the brief describes.** **Newsela Threads & Themes** is a "blended core curriculum for grades 6–8, designed specifically to meet the rigor and intent of California's ELA and ELD standards." It has 4 units per grade and a 180-day year. Every lesson follows the same 50-minute flow: **Launch (5) → Literacy Lab (10) → Learning in Action (30) → Look Back (5)**. Grades 9–12 are "coming 2027."
2. **It is mid-way through state approval.** CDE review panels recommended both submissions (Program Type 1, ELA, and Program Type 2, ELA/ELD) in August 2026. The State Board's final vote is expected in **November 2026**. That is weeks from today.
3. **The business story is a move from supplement to core.** Newsela's own job ad says "Core ELA is a key growth area for Newsela as we expand beyond supplemental digital resources into a full core curriculum."
4. **The core program reuses existing strengths.** These are the leveled library (18,000+ texts, 5 levels, Lexile bands), the per-question standards tagging, Formative (it runs the "Digital Core Lessons"), Luna AI, Newsela Writing with SBAC rubrics, and the usage-to-efficacy reporting.
5. **Newsela already makes lessons with AI and freelancers.** A 2026 "Learning Experience Designer, Core" posting says the role will "own the review of contributor- and AI-generated lessons, activities, and assessments" and refine "AI prompts and specifications that power lesson production." Freelancers work through internal tools called the **Wire**, **Alexandria** and **Bundles**.
6. **What this means for us (Inference).** The tool Newsela asked for is very likely a version of their real Threads & Themes production line. That line has to finish 9–12 by 2027 (4 grades × ELA + ELD × about 180 lessons), and any later state editions would add to it. Our tool should produce lessons in *their* shape and slot into their staff review. It should not invent its own lesson format.

---

## 2. Feature inventory by product line

"Who" means: **T** = teacher, **S** = student, **A** = school or district admin.

### 2.1 Newsela Threads & Themes (the new core ELA/ELD curriculum, CA grades 6–8)

| Feature | What it does, in plain words | Who | URL |
|---|---|---|---|
| Core ELA program (Program Type 1) | A full-year ELA course for grades 6, 7 and 8. Each grade has 4 units, each unit runs 6–8 weeks and is anchored by a full novel. | T, S | https://newsela.com/products/threads-and-themes · https://media.newsela.com/core/pdfs/cfdybf0xo84aw4s7p57hvu1p.pdf |
| ELA + ELD program (Program Type 2) | The same course plus "180 days of parallel designated ELD instruction." The ELD course uses the same essential questions and anchor texts as the ELA course. | T, S | https://media.newsela.com/core/pdfs/cybm3fxyvcdjiwr9kbd282sy.pdf |
| Year themes and unit titles | Grade 6 "Self & Story", grade 7 "Belonging & Witness", grade 8 "Systems & Stewardship". Example grade 6 units: "Setting Out: Voice, Self & Agency" and "Curiosity, Evidence & Discovery: Hidden Figures". | T | https://ca-2026-review.newsela.com/ · brochure (§6) |
| Fixed daily lesson flow | Launch 5 min → Literacy Lab 10 → Learning in Action 30 → Look Back 5. In D-ELD the same four slots have language-focused meanings (for example, Launch "activates prior language"). | T | brochure p.12 · submission PDF p.3 |
| Lesson types | Spark, Reading, Writing, Research & Inquiry, Academic Discussion (Socratic Seminar, Fishbowl), Presentation, Flex Day, and Language Analysis (D-ELD only). | T | brochure p.12 · submission PDF p.4 |
| Unit structure | Spark Lesson → Investigation Arc lessons → Flex Days and small groups → Performance Task. There are also separate Research Units that students lead. | T | brochure p.10 |
| Flex Days and "Huddles" | Every 5–7 days the teacher has a day to regroup students using formative data, in small "Huddles" organised by the 5 CA Framework themes. | T | submission PDF p.5–6 |
| Dual objectives in every lesson | Each lesson states an ELA Content Objective (CA CCSS) and an ELD Language Objective (CA ELD). It includes sentence frames, "If/Then" teacher prompts, and "Look-Fors / Listen-Fors". | T | submission PDF p.6 · research base §6, §8 |
| Assessment system | Checks for Understanding, Look-Fors and Listen-Fors, and Confidence Continuum polls every day. End-of-Investigation assessments. **Two summative assessments per unit** that use "tech-enhanced items" to mirror CAASPP (California's state test). One performance task per unit. | T, S | brochure p.14 · submission PDF p.4–5 |
| Program resources | ELA Design Framework, D-ELD Design Framework, a Scope and Sequence per grade, Assessment Playbook, Differentiation Playbook, Universal Access Handbook, a dyslexia guide, OPTEL observation tool and family engagement guides. | T, A | CDE report https://www.cde.ca.gov/ci/rl/im/documents/newselathdsths6thru8.docx |
| Print + digital components | Print Student Editions (2 volumes) and Teacher's Editions (2 volumes). Digital Teacher Guide. "Digital Core Lessons (powered by Formative)". Assessment & Reporting Suite. Newsela Writing. Novels supplied through Mackin and Booksource. | T, S, A | brochure p.16 |
| Research base | An 8-pillar research document covering the Science of Reading, ELSF briefs for English learners, morphology and more. It was "informed by research and analysis developed by Student Achievement Partners." | A | https://media.newsela.com/core/pdfs/ctu4q9kg5erelomn5mqt5ag3.pdf |

### 2.2 Newsela subject products (ELA, Social Studies, STEM) and the shared platform

| Feature | What it does, in plain words | Who | URL |
|---|---|---|---|
| Leveled library | "18,000+" texts and videos from "175+" partners, including the Washington Post, AP, Smithsonian and Scientific American. Most nonfiction comes at 5 levels. MAX is the original article. | T, S | https://newsela.com/products/ela · https://help.newsela.com/en/articles/13656128-newsela-s-content |
| Leveling method | "Newsela staff take the original version of each nonfiction text and rewrite four simplified versions." Each level maps to a grade band: Lexile, the standard text-difficulty score, from 300 to 500 at grade 2 up to over 1260 at grades 11–12. The bands never overlap, and Flesch-Kincaid correlates at r > .8. | T | https://help.newsela.com/en/articles/13656260-newsela-s-approach-to-leveling-nonfiction-texts |
| Adaptive level and Level Control | The student's level adjusts from their quiz scores. A teacher can instead lock one level for the class or hide it. | T, S | https://help.newsela.com/en/articles/13656047-level-control |
| Maturity bands | Topic maturity is separate from reading level, so a high-school topic can be offered at a low reading level. | T | leveling article above |
| Quizzes | Four questions per level, each tagged to a grade-level standard. ELA nonfiction quizzes align to the "state standards, based on the location of the school." | T, S | https://help.newsela.com/en/articles/13656229-quizzes-and-reviewing-quiz-scores |
| How standards are shown | The standard appears under each quiz question. In Social Studies and Science the standard sits under the article image, with hover for full text and a click-through to a standard page. Teachers can search by code, for example `SOC.5-8.RH.10`. | T | https://help.newsela.com/en/articles/13656317-standards-alignment |
| Write prompts | A write prompt on every article, which teachers can customise and score by hand or with the Luna Autograder. | T, S | https://help.newsela.com/en/articles/13656070-review-and-grade-a-write-prompt-activity-manually-or-with-luna-autograder |
| Power Words | 3–5 Tier II words per level, defined in context and read aloud, with practice and reports. The words come from Newsela's own grade-level Academic Word List. | S, T | https://help.newsela.com/en/articles/13656262-power-words-and-tier-iii-vocabulary |
| Spanish articles | "Over 5,000" texts in English and Spanish, each at 5 levels with Spanish quizzes and write prompts. "Our whole-article Spanish texts are always human reviewed." | S, T | https://help.newsela.com/en/articles/13656193-spanish-language-articles · https://newsela.com/luna |
| Collections and Curriculum Complements | Text sets mapped to other publishers' core programs (Wonders, myPerspectives, StudySync, CKLA, EL Education), plus novel studies for "over 500" books, paired texts and debates. | T | https://help.newsela.com/en/articles/13656162-newsela-ela · https://newsela.com/lausd |
| Lesson Sparks | Teacher guidance attached to collections, such as how to teach a novel or run a debate. They became printable in September 2026. | T | https://help.newsela.com/en/articles/13656267-lesson-sparks |
| Decodables for older readers | StoryShares decodable texts for older students who still need phonics practice, each with a Lesson Spark. | T, S | https://help.newsela.com/en/articles/13656128-newsela-s-content |
| Printing | Print any article with its quiz, write prompt and Power Words, with or without answers. July 2026 added printable fluency sheets that include a WCPM (words correct per minute) box. | T | https://help.newsela.com/en/articles/13656216-print-newsela-content |
| Generation Genius video lessons | Videos for ELA (K–5), science and math. Acquired February 2025. | T, S | https://newsela.com/products/ela · https://newsela.com/press |
| STEM toolkit | 100+ PhET simulations paired with NSTA lessons, Tuva data sets and Claim-Evidence-Reasoning prompts. | T, S | https://newsela.com/products/stem · https://help.newsela.com/en/articles/15862371-newsela-updates-july-2026 |
| Social Studies state editions | State-specific collections for about 30 states. California examples include CA Ethnic Studies, CA Financial Literacy and the Geography of California. | T | https://newsela.com/state/california · https://newsela.com/products/social-studies |
| Free tier and trial | Newsela Lite is free, with a 45-day premium trial. | T | https://newsela.com/products/lite |
| Add-ons | SEL Collection, **Custom Collections** (Newsela publishes "your collection at 5 different reading levels" aligned to the district's "scope and sequence documents"), Respondus LockDown Browser, Formative Item Bank. | A | https://newsela.com/products/add-ons · https://newsela.com/blog/read/core-resource-gap |
| Student iOS app | Students only. Updated October 2026. There is no Android app. | S | https://help.newsela.com/en/articles/13656146-mobile-apps |

### 2.3 Luna (the AI assistant inside every product)

| Feature | What it does, in plain words | Who | URL |
|---|---|---|---|
| AI Lesson Planner | Input: one Newsela article, a learning objective, up to 3 standards and an optional length. Output: Objective, Reading instructions, Activity Ideas, Lesson Breakdown, and optional Project Ideas and "Supports for Multilingual Learners." The teacher can edit it, copy it or download a PDF. All plans get it. | T | https://help.newsela.com/en/articles/13656312-ai-powered-lesson-planner |
| Saved standards set → planner | August 2026: admins and teachers can save their preferred standards set and use it in the planner. | T, A | https://help.newsela.com/en/articles/16201814-newsela-updates-august-2026 |
| AI Text Leveler | Paste any text and get versions for grades 3–12, viewable side by side with the source. It "can only be leveled down." The help page warns "Luna… isn't perfect, please review." | T | https://help.newsela.com/en/articles/13656313-ai-powered-text-leveler · https://newsela.com/blog/read/luna-ai-faqs |
| AI Checks for Understanding | 1–4 "AI-generated, recall questions embedded within the text." A student must answer correctly to continue. Available in English and Spanish. | S, T | https://help.newsela.com/en/articles/13656036-checks-for-understanding |
| Guided highlighting | Prompts the student to highlight a passage that shows a given reading skill. | S | https://newsela.com/luna |
| AI graphic organizers | Pre-filled, editable PDFs built from an article. | T, S | https://help.newsela.com/en/articles/13656316-ready-to-use-and-ai-powered-graphic-organizers |
| AI article supports | Main idea, key terms, before-reading activities, discussion questions and extra write prompts. | T | https://help.newsela.com/en/articles/13656210-ai-powered-article-support |
| AI Tier III vocabulary | Subject-specific words and definitions "generated by AI." Teachers can turn them off for an article. | S, T | Power Words article above |
| Text Translator | Paragraph-by-paragraph translation into about 40 languages, with read-aloud for some. Only works if the teacher enables it, and not on quizzes. | S | https://help.newsela.com/en/articles/13656219-text-translation |
| Luna Autograder | Scores write prompts, gives its rationale and drafts student feedback. The teacher can override and must approve before students see it. July 2026. | T | autograder article above |
| Luna in Formative | Generates activities from a prompt or a PDF, turns worksheets into digital activities, writes standards-aligned questions with answer explanations, gives hints, translates, and runs **Luna Next Steps**: after a test, it suggests follow-up work. | T | https://newsela.com/blog/read/introducing-luna-ai · https://www.formative.com/balanced-assessment |
| **Luna Configuration Studio** | Lets a district build custom Luna configurations that "shape how Luna behaves when generating, reviewing, or editing content… similar to Gemini Gems or custom GPTs." These are district-level AI guardrails. | A | https://help.newsela.com/en/articles/13656326-balanced-assessment-by-formative-overview |
| AI policy | "We don't put anything AI-generated in front of students that teachers don't have the ability to see." "We also do not use student personal data to train our AI models." | all | https://newsela.com/blog/read/our-philosophy-on-ai-tools-for-education |

### 2.4 Newsela Writing

| Feature | What it does, in plain words | Who | URL |
|---|---|---|---|
| AI writing feedback | Real-time feedback lined up to a rubric, with "Glows and Grows" and a Sentence Checklist. Teachers can show or hide each one. | S, T | https://newsela.com/products/writing · https://help.newsela.com/en/articles/15860394-newsela-updates-june-2026 |
| State rubrics | Rubrics for all 50 states, plus SBAC rubrics (the Smarter Balanced test that California uses) in simple and extended versions. Rubrics cannot be edited, but a custom one can be added within 10 days. | T | https://help.newsela.com/en/articles/13656252-newsela-writing-rubrics |
| Genres | Expository, Opinion, Narrative, Argumentative, Informational, Main/Central Idea, Inference/Conclusion, Literary Analysis. | T | rubrics article |
| District writing report and PDF export | Admins see writing data, and teachers can export student work. | A, T | https://help.newsela.com/en/articles/13656237-newsela-writing-report-for-district-admins |
| Limits | Feedback is English-only. The only LMS integration for Writing is Google Classroom. | — | https://newsela.com/blog/read/luna-ai-faqs |

### 2.5 Formative and Balanced Assessment (acquired 2023)

| Feature | What it does, in plain words | Who | URL |
|---|---|---|---|
| Lessons and assessments | Lessons, bell ringers and exams with "20+ tech-enhanced item types" and live response data. | T, S | https://www.formative.com/balanced-assessment |
| Item Bank | Thousands of items tagged to standards and Depth of Knowledge (DOK). Newsela's contributor network writes Formative items as well. | T, A | https://newsela.com/products/add-ons · https://contributors.newsela.com/contributor-groups/formative-assessments |
| Common and district assessments, test prep | District-built libraries of shared tests, previously released state test items, and "CAASPP item types." | A | https://newsela.com/state/california |
| Pricing (the only public prices) | About $249 a year per teacher and about $3,125 a year per school. District pricing is by quote. | — | https://www.formative.com/plans |
| Assessment Services | For qualifying districts, a partner manages the move of old assessments into Formative and the rollout. | A | Balanced Assessment overview article |

### 2.6 Data, analytics and admin

| Feature | What it does, in plain words | Who | URL |
|---|---|---|---|
| Classroom Data report | Average level, texts read at, below or above grade, and results on 8 "Anchor Skills" (for example Main Idea, Arguments & Claims), with CSV export and External ID. | T, A | https://help.newsela.com/en/articles/13928499-classroom-data-report |
| Usage Report (dosage) | Shows weekly views and quizzes against "our dosage recommendations" from the efficacy studies (2 articles and a quiz a week). Refreshes every 5 minutes. Still marked Beta. | A | https://help.newsela.com/en/articles/13656325-usage-report |
| Admin impersonation | Admins can view any teacher's reports in read-only mode. | A | https://help.newsela.com/en/articles/13656306-newsela-reports-for-admins |
| Content Promotion | District admins push preferred complements, novels or skills to the top of teachers' homepages. | A | https://help.newsela.com/en/articles/13656291-content-promotion |
| NWEA MAP integration | Uses MAP reading scores to set levels and report. | A, T | https://help.newsela.com/en/articles/13656240-nwea-and-newsela |
| Schoolytics + EveryDay Labs | A 2026 acquisition: one data hub, attendance and MTSS (the tiered student-support system). | A | https://newsela.com/company · https://newsela.com/press |

### 2.7 Integrations

Clever, ClassLink, Google and Google Classroom (including an add-on), Canvas, Schoology (automatic sync at LAUSD), Microsoft, D2L Brightspace, itslearning, Nearpod, Pear Deck, NWEA, IMS standards, and Project Unicorn. Sources: https://help.newsela.com/en/collections/18271028-help-for-admins-it, https://help.newsela.com/en/collections/18412605-integrations-for-teachers, https://newsela.com/partners, https://newsela.com/lausd.

### 2.8 Professional learning

PD Pass, the free Newsela Certified Educator program, premium PL, and custom sessions. For Threads & Themes, "Professional Learning experts will work closely with educators… taking the unique needs of the district… into account." Sources: https://help.newsela.com/en/articles/13944229-newsela-learning-suite, https://newsela.com/certifications, brochure p.16.

---

## 3. Feature → value → business outcome map

The quoted value lines are Newsela's own words. Every outcome column is **Inference** unless it says otherwise.

| Feature | Value proposition (their words) | Plausible business outcome (Inference) |
|---|---|---|
| Threads & Themes core curriculum | "New Core Literacy Curriculum… Same Newsela Promise"; "Instruction teachers can sustain." | **A new, larger kind of purchase.** A core adoption is a multi-year contract for the whole grade span, usually bundled with print. Supplements are a smaller line in the budget. The job ad confirms the strategy: "expand beyond supplemental digital resources into a full core curriculum." |
| CA adoption submission (Type 1 + 2) | Recommended because it "meets… category 1 and shows strengths in categories 2–5" (CDE). | **State approval.** Districts that buy from the adopted list find purchasing easier. The November 2026 SBE vote is the gate. The 9–12 version due in 2027 and any other states would each need their own submission evidence. |
| Fixed lesson flow + Flex Days | "A focused, intentional approach reduces curriculum bloat"; "reduce planning time." | **Retention and renewal.** If teachers follow the lessons faithfully, the efficacy results hold up and teachers do not drift away from the program. |
| Integrated + Designated ELD | "Parallel ELA and ELD programs connect learning with shared essential questions, novels and anchor texts." | **Wins the bid in California.** English learners are a large share of CA students, and Program Type 2 needs ELD. Reviewers singled out "explicit designated ELD lessons (Literacy Lab)" as a strength. |
| 5-level leveled library + Lexile bands | "Every student works with grade-level texts"; "Access without compromise." | **Differentiation.** The library is something the core program inherits and competitors cannot copy cheaply. It feeds the "connected short-form texts" in each unit. |
| Standards tagging on every item | "Our team tags every article, quiz, and lesson activity with the standards it supports." | **Admin trust and adoption evidence.** It powers district standards reports and the CDE "standards maps." |
| Quizzes linked to state tests | Quizzes are "a robust indicator of ELA achievement"; written "as they will be assessed on end-of-year… state assessments." | **Renewal.** Admins can predict state-test results and justify the spend. |
| Usage Report tied to efficacy dosage | "See how your usage aligns with recommendations from our efficacy studies." | **Renewal and upsell.** Customer success can show low-usage schools and push them toward the "2× a week" dosage. |
| Luna Lesson Planner / Leveler / Autograder | "Save teachers time while still personalizing instruction"; "teachers… keep complete control." | **Adoption and daily use.** The planner is free on every plan, so it also pulls Lite users toward paid. |
| Luna Configuration Studio | "Ensure rigor and consistency in AI-generated assessments by setting guardrails." | **District upsell** to Balanced Assessment, and an answer to districts' AI-governance worries. |
| Newsela Writing + SBAC rubrics | "AI-powered, rubric-aligned feedback delivered in real time"; 2025 CODiE winner. | **Add-on revenue** and a writing component inside the core program ("Newsela Writing & Feedback"). |
| Formative / Balanced Assessment | "From assessment to action, accelerating student growth district-wide." | **District upsell and platform lock-in.** It is the delivery engine for Digital Core Lessons, so an assessment customer is a short step from a core customer. |
| Schoolytics / EveryDay Labs | "Turn fragmented student data into insight and action." | **A bigger district deal** (data, attendance, MTSS) and more ways to stay embedded in a district. |
| ESSA-tier efficacy studies | "Proven to be effective for all learners by rigorous studies aligned to ESSA tiers." | **Approval and funding.** ESSA evidence tiers unlock federal funding, and the CA study (Tier II: +4 percentiles on SBA, +5 for Hispanic/Latino students) suits CA buyers. |
| Integrations (Clever, ClassLink, LMS) | "Play nice with your existing technologies." | **Meets the buying bar.** Rostering and LMS sync are expected before a district will buy. |
| Custom Collections | Built "in partnership with your district… aligned to… scope and sequence documents." | **District upsell**, and proof Newsela already sells district-specific content builds. |

---

## 4. What carries over to core curriculum, and what does not

### 4.1 Strengths the core program inherits (with evidence that it uses them)

- **Content library and partners.** Units "anchor each unit in a full-length novel or short text supported by a comprehensive set of connected Newsela content spanning science, social studies, and the arts" (research base §4).
- **Leveling know-how.** Their method weighs Lexile and much more, keeps content maturity separate from reading level, and uses trained human levelers. Threads & Themes promises grade-level text for all students, with supports.
- **Standards tagging.** An existing contributor group tags "articles/lesson sparks" in Alexandria. The CDE panel praised that the program "uses the terms from the CA CCSS for ELA and the CA ELD Standards appropriately and consistently."
- **Formative.** It runs "Digital Core Lessons (powered by Formative)" and the TEI items in the CAASPP-style summatives. Reviewers cited "Checks for Understanding and Progress Checks."
- **Writing and rubrics.** "Newsela Writing & Feedback" is a listed program component, and the SBAC rubrics already exist.
- **Spanish and translation.** These cover home-language supports and translanguaging. ELD is a curriculum, though, not just translated text.
- **Reporting and dosage habits.** The Assessment & Reporting Suite, MTSS exports and External IDs.
- **Professional learning and customer success**, through PD Pass and the certification programs.

### 4.2 Gaps a core program has to fill (and what Threads & Themes did)

| Gap | Why the supplement model does not cover it | How T&T fills it / what remains |
|---|---|---|
| A full-year scope and sequence | The supplement library is a menu teachers pick from, not a planned year. | A 180-day year: 4 units, arcs, Flex Days, plus a scope and sequence and D-ELD standards maps per grade. **9–12 is not built yet (2027).** |
| Daily teacher-facing lessons | Lesson Sparks and the AI planner are *ideas*, written one article at a time. | The full Launch/Literacy Lab/Learning in Action/Look Back lesson with teacher guide, If/Then prompts, Look-Fors and dual objectives. That comes to about 180 ELA and 180 D-ELD lessons per grade. *Inference:* CDE citations reach "Unit 1, Lesson 45", which suggests about 40–45 lessons per unit. |
| Pacing | Supplements have no pacing. | Fixed minutes in each lesson, Flex Days every 5–7 days, 6–8 week units. |
| An assessment system | Quizzes measure one article, not a unit or a year. | Formative checks, end-of-investigation tests, 2 CAASPP-style summatives per unit, performance tasks, the Assessment Playbook and OPTEL. |
| ELD as its own course | Translation and Spanish texts are supports, not instruction. | Designated ELD lessons at Emerging, Expanding and Bridging levels, plus Language Analysis lessons. |
| Foundational skills and dyslexia | Decodables exist, but as an add-on. | The Literacy Lab teaches morphology, syntax and fluency, plus a dyslexia guide. CA AB 121 requires materials to "align with program guidelines for dyslexia" (CDE guidance). |
| Print | Article printing is per page. | 2-volume Student and Teacher Editions, plus novels through Mackin and Booksource. Print must be identical to digital, so lesson content must be ready to lay out. |
| State-approval evidence | Supplements do not go through state adoption. | Standards maps, criterion-by-criterion citations, a research base, an ISBN per grade and a public review site (ca-2026-review.newsela.com). **Each new grade band or state needs this again.** |
| Novel rights and logistics | The library is licensed articles. | Full novels ordered through partners. Rights to novels and excerpts limit what a generator can quote. |

---

## 5. How Newsela makes content today, and what a lesson-generation tool must fit into

### 5.1 Signals

1. **Small in-house staff, freelance network at scale.** The contributor site says "We have contributors from all over who work with us on a freelance basis… educators, editors, writers, content creators." Its groups are Newsela Quizzes, Spanish Assessments, STEM Question Bank, Formative Assessments (TEI), Leveling, Proofreading, Standards, **Units**, Spanish, Top Editing and Translation (https://contributors.newsela.com/onboarding).
2. **Named internal tools.** These are the **Wire** (where contributors claim and submit assignments), the **Alexandria Article Editor** (where article and assessment work is done) and **Bundles** (where collections and units are built), plus a Lesson Spark editor, Google Workspace, and Ramp for invoicing. A "Content Operations team" runs it all (https://contributors.newsela.com/resources-faqs/contributor-systems-tools, https://contributors.newsela.com/contributor-groups/units).
3. **Staged work with rubrics.** New contributors get a "first guided assignment and receive feedback" before "full assignments." Assessment work splits into "quiz writers, quiz editors and quiz copy editors," with written expectations, an "Assessment Feedback Form" and a "Bias, Sensitivity and Accessibility in Assessment Items" guide. Unit work has its own "rubric for editing units" (https://contributors.newsela.com/contributor-groups/newsela-quizzes).
4. **Units are built against a scope and sequence.** Unit contributors handle "creating, reviewing and editing units and content collections that align to scope & sequence, refreshing old collections."
5. **AI is already part of lesson production, with human review.** The Learning Experience Designer, Core posting (mid-2026) says the designer will "Serve as a grade-level lead in the design and production", "Hold final grade-level responsibility for verifying that all materials align to the relevant state ELA standards", "Own the review of contributor- and AI-generated lessons, activities, and assessments at your grade", and refine "AI prompts and specifications that power lesson production". It also mentions rubrics and checklists "that guide contributors and AI tools." A companion "ELA Multilingual Learning" designer posting covers ELD scopes and sequences, AI prompts and external contributors for grades 9–12 (via https://www.workingnomads.com/jobs/learning-experience-designer-core-remote-us-newsela and the WebSearch summary of edtech.com mirrors, §6). *Caveat:* I read these from third-party mirrors. The listing is no longer on Newsela's Greenhouse board.
6. **Go-to-market is staffed now.** "Senior Product Marketing Manager, Core" is open (updated 2026-10-16) for "national and state-level core curriculum launches", "print sample kits" and "state-level adoptions" (https://job-boards.greenhouse.io/newsela/jobs/8278660). *Inference:* they plan to take Threads & Themes beyond California.
7. **Editorial standards that the content must keep.** These include the content guidelines (bias, the AllSides-style source mix via the Adfontes chart, the anti-racism style rules such as "enslaved person", maturity bands) and the leveling rules ("not to alter the meaning and intent of the original") (https://help.newsela.com/en/articles/13656207-newsela-s-content-guidelines).
8. **The human/AI line is deliberate.** Whole-article Spanish is "always human reviewed." AI vocabulary and checks for understanding can be switched off. Teachers approve Autograder scores. Districts set guardrails in Luna Configuration Studio.

### 5.2 What a lesson-generation tool must fit into (Inference, built on the signals above)

1. **Output the Threads & Themes lesson schema, not a generic plan.** That means unit → investigation arc → lesson, the lesson type, the four timed sections (5/10/30/5), the ELA Content Objective and ELD Language Objective with their CA CCSS and ELD codes, the anchor text and connected texts, sentence frames, If/Then prompts, Look-Fors and Listen-Fors, the exit ticket in Look Back, and Huddle groupings on Flex Days. Each Designated ELD lesson should come with its integrated ELA lesson, sharing the same essential question and text.
2. **Fit the staff review roles.** The reviewer is a grade-level Learning Experience Designer working through rubrics and checklists. The tool should give each lesson a status (draft, in review, changes requested, approved), keep reviewer comments, track versions, and show which rubric criterion each flag relates to. It must never publish a lesson without approval.
3. **Use their standards vocabulary and ID format.** Use codes like RL.7.1, W.7.2a and PI.7.6c. CDE reviewers check that terms are used "consistently in all guidance for teachers," so the tool should check that automatically.
4. **Draw on their library and respect licences.** Connected texts should be Newsela articles at named levels. Some partners block translation ("some content partners have restrictions"), and novel excerpts have rights limits.
5. **Produce adoption evidence as a by-product.** The tool should be able to export standards maps and criterion citations ("Grade 7, Unit 3, Lesson 25, Learning in Action") because each new grade band or state submission needs them.
6. **Stay consistent across print and digital.** Content should be structured so it lays out cleanly in 2-volume print editions and in Formative's digital lessons.
7. **Leave room for their guardrails.** Treat prompts and specifications as configuration that designers edit, as in Luna Configuration Studio, rather than hard-coded behaviour. Follow the house AI policy: humans can see everything, and no student data is used for training.

### 5.3 Caveats on the evidence

- **The headline numbers disagree across pages.** Products says "47 million learners… 4 million teachers"; the FAQ says "3.3 million teachers and 40 million students"; Careers says "20 million students and 1.5 million teachers." Texts appear as "18,000+" and "15,000+," and partners as "175+," "over 100," and "hundreds." Newsela Writing is listed as grades 3–12 on one page and 4–12 on another. Treat every count as marketing.
- **Some pages still show placeholder copy.** The Products page has Lorem ipsum under "10% writing scores growth" and "2x social studies outcomes." The Luna page FAQ answers every question with Formative text ("Every day! Teachers love that Formative…").
- **The CDE status is a recommendation, not a final adoption.** Every report says it "has not been approved by the Instructional Quality Commission or the State Board of Education." The SBE vote is expected in November 2026. I could not open the CDE participants page because of a Radware bot-wall.
- There is no public price for Newsela or Threads & Themes. Only Formative publishes prices.

---

## 6. Sources

**Newsela marketing site**
- Products overview: https://newsela.com/products
- Threads & Themes: https://newsela.com/products/threads-and-themes
- ELA: https://newsela.com/products/ela · Social Studies: https://newsela.com/products/social-studies · STEM: https://newsela.com/products/stem · Writing: https://newsela.com/products/writing · Lite: https://newsela.com/products/lite · Add-ons: https://newsela.com/products/add-ons
- Luna: https://newsela.com/luna · What's new: https://newsela.com/whats-new
- Research & efficacy: https://newsela.com/research-and-efficacy · CA study: https://newsela.com/resource/newsela-ela-for-middle-school-students-in-california
- California: https://newsela.com/state/california · States: https://newsela.com/states · LAUSD: https://newsela.com/lausd
- Company: https://newsela.com/company · Press: https://newsela.com/press · Partners: https://newsela.com/partners · FAQ: https://newsela.com/faq · Careers: https://newsela.com/careers · Sitemap: https://newsela.com/sitemap.xml
- CA Writing webinar: https://newsela.com/resource/writing-for-success-how-newsela-writing-prepares-california-classrooms-for-end-of-year-assessments

**Threads & Themes documents**
- Brochure (10 pp.): https://go.newsela.com/rs/628-ZPE-510/images/Threads%20and%20Themes%20Brochure?version=0
- Research Base: https://media.newsela.com/core/pdfs/ctu4q9kg5erelomn5mqt5ag3.pdf
- Program Type 2 (ELA/ELD) description: https://media.newsela.com/core/pdfs/cybm3fxyvcdjiwr9kbd282sy.pdf
- Program Type 1 (ELA) description: https://media.newsela.com/core/pdfs/cfdybf0xo84aw4s7p57hvu1p.pdf
- CA review site: https://ca-2026-review.newsela.com/

**California Department of Education**
- Panel report, Type 2 ELA/ELD: https://www.cde.ca.gov/ci/rl/im/documents/newselathdsths6thru8.docx
- Panel report, Type 1 ELA: https://www.cde.ca.gov/ci/rl/im/documents/newsela6thru8.docx
- Participants list (bot-walled): https://www.cde.ca.gov/Ci/rl/im/elaeldparticipants2026.asp
- Adoption timeline and notice: https://www.cde.ca.gov/be/cc/cd/elaeldfupadopttimeline.asp · https://www.cde.ca.gov/CI/rl/im/elaeldfupnoticeintent.asp · Guidance: https://www.cde.ca.gov/CI/rl/cf/documents/elaeldguidancefinal.docx

**Help center (help.newsela.com)**
- Leveling: https://help.newsela.com/en/articles/13656260-newsela-s-approach-to-leveling-nonfiction-texts
- Content: https://help.newsela.com/en/articles/13656128-newsela-s-content · Guidelines: https://help.newsela.com/en/articles/13656207-newsela-s-content-guidelines
- Standards: https://help.newsela.com/en/articles/13656317-standards-alignment · Quizzes: https://help.newsela.com/en/articles/13656229-quizzes-and-reviewing-quiz-scores
- Lesson Planner: https://help.newsela.com/en/articles/13656312-ai-powered-lesson-planner · Text Leveler: https://help.newsela.com/en/articles/13656313-ai-powered-text-leveler · Article supports: https://help.newsela.com/en/articles/13656210-ai-powered-article-support · Translation: https://help.newsela.com/en/articles/13656219-text-translation · CFUs: https://help.newsela.com/en/articles/13656036-checks-for-understanding · Autograder: https://help.newsela.com/en/articles/13656070-review-and-grade-a-write-prompt-activity-manually-or-with-luna-autograder
- Spanish: https://help.newsela.com/en/articles/13656193-spanish-language-articles · Power Words: https://help.newsela.com/en/articles/13656262-power-words-and-tier-iii-vocabulary · Level Control: https://help.newsela.com/en/articles/13656047-level-control · Lesson Sparks: https://help.newsela.com/en/articles/13656267-lesson-sparks · Print: https://help.newsela.com/en/articles/13656216-print-newsela-content
- Writing rubrics: https://help.newsela.com/en/articles/13656252-newsela-writing-rubrics
- Admin reports: https://help.newsela.com/en/articles/13656306-newsela-reports-for-admins · Usage report: https://help.newsela.com/en/articles/13656325-usage-report · Content promotion: https://help.newsela.com/en/articles/13656291-content-promotion · Classroom data: https://help.newsela.com/en/articles/13928499-classroom-data-report
- Learning Suite: https://help.newsela.com/en/articles/13944229-newsela-learning-suite · Balanced Assessment: https://help.newsela.com/en/articles/13656326-balanced-assessment-by-formative-overview · Subject overview: https://help.newsela.com/en/articles/13656264-newsela-subject-products-overview · Mobile: https://help.newsela.com/en/articles/13656146-mobile-apps
- Updates: June https://help.newsela.com/en/articles/15860394-newsela-updates-june-2026 · July https://help.newsela.com/en/articles/15862371-newsela-updates-july-2026 · August https://help.newsela.com/en/articles/16201814-newsela-updates-august-2026 · September https://help.newsela.com/en/articles/17344734-newsela-updates-september-2026
- Integrations collections: https://help.newsela.com/en/collections/18271028-help-for-admins-it · https://help.newsela.com/en/collections/18412605-integrations-for-teachers

**Blog**
- Introducing Luna: https://newsela.com/blog/read/introducing-luna-ai · Luna FAQs: https://newsela.com/blog/read/luna-ai-faqs · AI philosophy: https://newsela.com/blog/read/our-philosophy-on-ai-tools-for-education · Core resource gap (Custom Collections): https://newsela.com/blog/read/core-resource-gap · ELL best practices: https://newsela.com/solutions/english-language-learners

**Contributor network**
- https://contributors.newsela.com/ · /onboarding · /contributor-groups/leveling · /contributor-groups/standards · /contributor-groups/units · /contributor-groups/newsela-quizzes · /contributor-groups/formative-assessments · /resources-faqs/contributor-systems-tools · /resources-faqs/faq

**Formative**
- https://www.formative.com/ · https://www.formative.com/balanced-assessment · https://www.formative.com/plans

**Jobs**
- Greenhouse board: https://boards-api.greenhouse.io/v1/boards/newsela/jobs · Senior PMM, Core: https://job-boards.greenhouse.io/newsela/jobs/8278660
- Learning Experience Designer, Core (mirror, expired): https://www.workingnomads.com/jobs/learning-experience-designer-core-remote-us-newsela · edtech.com mirrors (403 to WebFetch; seen via search): https://www.edtech.com/jobs/learning-experience-designer-core-remote-us-5181 · https://www.edtech.com/jobs/learning-experience-designer-ela-multilingual-learning-remote-us-9736
