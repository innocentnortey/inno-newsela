# Replay comparison: `final` outputs (current-code reanalysis)

| # | label | commit | dirty code files? | input_hash | review context |
|---|---|---|---|---|---|
| 0 | base e7e72a3 | e7e72a3 | yes | aecf38bdc1f0 | generation_time |
| 1 | C control 42f6989 | 42f6989 | yes | aecf38bdc1f0 | generation_time |
| 2 | A d727537 | d727537 | yes | aecf38bdc1f0 | generation_time |
| 3 | B control 18a52cf | 18a52cf | yes | aecf38bdc1f0 | generation_time |
| 4 | D1 f236214 | f236214 | yes | aecf38bdc1f0 | generation_time |
| 5 | D2 99b8e77 | 99b8e77 | yes | aecf38bdc1f0 | generation_time |
| 6 | D3 88d6b97 | 88d6b97 | yes | aecf38bdc1f0 | generation_time |
| 7 | A follow-up 6cc5e07 | 6cc5e07 | yes | aecf38bdc1f0 | generation_time |
| 8 | PD-39 45a2a63 | 45a2a63 | yes | aecf38bdc1f0 | generation_time |
| 9 | F1 contract owner e8a7f27 | e8a7f27 | no | aecf38bdc1f0 | generation_time |
| 10 | HEAD after F1 7f6efd3 | 7f6efd3 | no | aecf38bdc1f0 | generation_time |

## Generation gate: lessons passing

| # | commit | passing (of all, of compiled) | not compiled |
|---|---|---|---|
| 0 | e7e72a3 | 30/47 of all, 30/47 of compiled | 0 |
| 1 | 42f6989 | 30/47 of all, 30/47 of compiled | 0 |
| 2 | d727537 | 47/47 of all, 47/47 of compiled | 0 |
| 3 | 18a52cf | 47/47 of all, 47/47 of compiled | 0 |
| 4 | f236214 | 7/47 of all, 7/47 of compiled | 0 |
| 5 | 99b8e77 | 7/47 of all, 7/47 of compiled | 0 |
| 6 | 88d6b97 | 4/47 of all, 4/47 of compiled | 0 |
| 7 | 6cc5e07 | 4/47 of all, 4/47 of compiled | 0 |
| 8 | 45a2a63 | 5/47 of all, 5/47 of compiled | 0 |
| 9 | e8a7f27 | 1/47 of all, 1/47 of compiled | 0 |
| 10 | 7f6efd3 | 1/47 of all, 1/47 of compiled | 0 |

### Lessons with a blocking gen finding, by kind

| kind | #0 | #1 | #2 | #3 | #4 | #5 | #6 | #7 | #8 | #9 | #10 | d 0->1 | d 1->2 | d 2->3 | d 3->4 | d 4->5 | d 5->6 | d 6->7 | d 7->8 | d 8->9 | d 9->10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| code_not_allowed | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 | 2 |  |  |  |  |  | +2 |  |  |  |  |
| page_out_of_range | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | -2 |  |  |  |  |  |  |  |  |
| proper_noun_unsourced | 15 | 15 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 |  | -15 |  |  |  |  | +2 |  |  |  |
| section_missing | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 | 26 | 26 |  |  |  |  | +1 |  |  |  | +25 |  |
| standard_not_checked | 0 | 0 | 0 | 0 | 11 | 11 | 11 | 11 | 9 | 9 | 9 |  |  |  | +11 |  |  |  | -2 |  |  |
| standard_not_taught | 0 | 0 | 0 | 0 | 40 | 40 | 41 | 41 | 40 | 40 | 40 |  |  |  | +40 |  | +1 |  | -1 |  |  |

### Lessons changing gen verdict between consecutive boundaries

- 0->1 (e7e72a3 -> 42f6989, C control 42f6989): newly blocked 0; newly unblocked 0; still blocked 17; still passing 30
- 1->2 (42f6989 -> d727537, A d727537): newly blocked 0; newly unblocked 17 (G6.U4.FLEX-1b, G6.U4.FLEX-2b, G6.U4.L10, G6.U4.L19, G6.U4.L20, G6.U4.L21, G6.U4.L22, G6.U4.L23, G6.U4.L24, G6.U4.L28, G6.U4.L32, G6.U4.L33, G6.U4.L35, G6.U4.L4, G6.U4.L40, G6.U4.L8, G6.U4.L9); still blocked 0; still passing 30
- 2->3 (d727537 -> 18a52cf, B control 18a52cf): newly blocked 0; newly unblocked 0; still blocked 0; still passing 47
- 3->4 (18a52cf -> f236214, D1 f236214): newly blocked 40 (G6.U4.L1, G6.U4.L10, G6.U4.L11, G6.U4.L12, G6.U4.L13, G6.U4.L14, G6.U4.L15, G6.U4.L16, G6.U4.L17, G6.U4.L18, G6.U4.L19, G6.U4.L2, G6.U4.L20, G6.U4.L21, G6.U4.L22, G6.U4.L23, G6.U4.L24, G6.U4.L25, G6.U4.L26, G6.U4.L27, G6.U4.L28, G6.U4.L29, G6.U4.L3, G6.U4.L30, G6.U4.L31, G6.U4.L32, G6.U4.L33, G6.U4.L34, G6.U4.L35, G6.U4.L36, G6.U4.L37, G6.U4.L38, G6.U4.L39, G6.U4.L4, G6.U4.L40, G6.U4.L41, G6.U4.L5, G6.U4.L6, G6.U4.L8, G6.U4.L9); newly unblocked 0; still blocked 0; still passing 7
- 4->5 (f236214 -> 99b8e77, D2 99b8e77): newly blocked 0; newly unblocked 0; still blocked 40; still passing 7
- 5->6 (99b8e77 -> 88d6b97, D3 88d6b97): newly blocked 3 (G6.U4.FLEX-1b, G6.U4.FLEX-2b, G6.U4.FLEX-3b); newly unblocked 0; still blocked 40; still passing 4
- 6->7 (88d6b97 -> 6cc5e07, A follow-up 6cc5e07): newly blocked 0; newly unblocked 0; still blocked 43; still passing 4
- 7->8 (6cc5e07 -> 45a2a63, PD-39 45a2a63): newly blocked 0; newly unblocked 1 (G6.U4.L25); still blocked 42; still passing 4
- 8->9 (45a2a63 -> e8a7f27, F1 contract owner e8a7f27): newly blocked 4 (G6.U4.FLEX-1a, G6.U4.FLEX-2a, G6.U4.FLEX-3a, G6.U4.L25); newly unblocked 0; still blocked 42; still passing 1
- 9->10 (e8a7f27 -> 7f6efd3, HEAD after F1 7f6efd3): newly blocked 0; newly unblocked 0; still blocked 46; still passing 1

## Review gate: lessons passing

| # | commit | passing (of all, of compiled) | not compiled |
|---|---|---|---|
| 0 | e7e72a3 | 3/47 of all, 3/47 of compiled | 0 |
| 1 | 42f6989 | 3/47 of all, 3/47 of compiled | 0 |
| 2 | d727537 | 20/47 of all, 20/47 of compiled | 0 |
| 3 | 18a52cf | 20/47 of all, 20/47 of compiled | 0 |
| 4 | f236214 | 3/47 of all, 3/47 of compiled | 0 |
| 5 | 99b8e77 | 3/47 of all, 3/47 of compiled | 0 |
| 6 | 88d6b97 | 4/47 of all, 4/47 of compiled | 0 |
| 7 | 6cc5e07 | 4/47 of all, 4/47 of compiled | 0 |
| 8 | 45a2a63 | 4/47 of all, 4/47 of compiled | 0 |
| 9 | e8a7f27 | 1/47 of all, 1/47 of compiled | 0 |
| 10 | 7f6efd3 | 1/47 of all, 1/47 of compiled | 0 |

### Lessons with a blocking review finding, by kind

| kind | #0 | #1 | #2 | #3 | #4 | #5 | #6 | #7 | #8 | #9 | #10 | d 0->1 | d 1->2 | d 2->3 | d 3->4 | d 4->5 | d 5->6 | d 6->7 | d 7->8 | d 8->9 | d 9->10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| code_not_allowed | 0 | 0 | 0 | 0 | 44 | 44 | 2 | 2 | 2 | 2 | 2 |  |  |  | +44 |  | -42 |  |  |  |  |
| excerpt_slot_open | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |  |  |  |  |  |  |  |  |  |  |
| page_out_of_range | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | -2 |  |  |  |  |  |  |  |  |
| proper_noun_unsourced | 15 | 15 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 2 |  | -15 |  |  |  |  | +2 |  |  |  |
| quote_placeholder_open | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 |  |  |  |  |  |  |  |  |  |  |
| schema_invalid | 44 | 44 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |  | -44 |  |  |  |  |  |  |  |  |
| section_missing | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 | 26 | 26 |  |  |  |  | +1 |  |  |  | +25 |  |
| standard_not_checked | 0 | 0 | 0 | 0 | 11 | 11 | 11 | 11 | 9 | 9 | 9 |  |  |  | +11 |  |  |  | -2 |  |  |
| standard_not_taught | 0 | 0 | 0 | 0 | 40 | 40 | 41 | 41 | 40 | 40 | 40 |  |  |  | +40 |  | +1 |  | -1 |  |  |

### Lessons changing review verdict between consecutive boundaries

- 0->1 (e7e72a3 -> 42f6989, C control 42f6989): newly blocked 0; newly unblocked 0; still blocked 44; still passing 3
- 1->2 (42f6989 -> d727537, A d727537): newly blocked 0; newly unblocked 17 (G6.U4.FLEX-3b, G6.U4.L14, G6.U4.L17, G6.U4.L19, G6.U4.L2, G6.U4.L21, G6.U4.L23, G6.U4.L24, G6.U4.L28, G6.U4.L30, G6.U4.L36, G6.U4.L37, G6.U4.L38, G6.U4.L39, G6.U4.L40, G6.U4.L41, G6.U4.L7); still blocked 27; still passing 3
- 2->3 (d727537 -> 18a52cf, B control 18a52cf): newly blocked 0; newly unblocked 0; still blocked 27; still passing 20
- 3->4 (18a52cf -> f236214, D1 f236214): newly blocked 17 (G6.U4.FLEX-3b, G6.U4.L14, G6.U4.L17, G6.U4.L19, G6.U4.L2, G6.U4.L21, G6.U4.L23, G6.U4.L24, G6.U4.L28, G6.U4.L30, G6.U4.L36, G6.U4.L37, G6.U4.L38, G6.U4.L39, G6.U4.L40, G6.U4.L41, G6.U4.L7); newly unblocked 0; still blocked 27; still passing 3
- 4->5 (f236214 -> 99b8e77, D2 99b8e77): newly blocked 0; newly unblocked 0; still blocked 44; still passing 3
- 5->6 (99b8e77 -> 88d6b97, D3 88d6b97): newly blocked 0; newly unblocked 1 (G6.U4.L7); still blocked 43; still passing 3
- 6->7 (88d6b97 -> 6cc5e07, A follow-up 6cc5e07): newly blocked 0; newly unblocked 0; still blocked 43; still passing 4
- 7->8 (6cc5e07 -> 45a2a63, PD-39 45a2a63): newly blocked 0; newly unblocked 0; still blocked 43; still passing 4
- 8->9 (45a2a63 -> e8a7f27, F1 contract owner e8a7f27): newly blocked 3 (G6.U4.FLEX-1a, G6.U4.FLEX-2a, G6.U4.FLEX-3a); newly unblocked 0; still blocked 43; still passing 1
- 9->10 (e8a7f27 -> 7f6efd3, HEAD after F1 7f6efd3): newly blocked 0; newly unblocked 0; still blocked 46; still passing 1

Attribution is order-dependent: slice D's commits sit on top of slice A's, so there is no D-without-A run; each step shows what that commit changed on top of the previous one.
