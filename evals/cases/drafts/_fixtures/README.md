# S3 stub fixtures

Synthetic files for the S3 draft golden (NL-109); no model wrote any of them. `bad-draft.json` is a schema-valid `LessonDraft` made by mutating the stub WP-1 draft so that several S3 assertions fail at once (it is the `--stub-draft` input of the AC-5 check). `good-wp-3.json` is the hand-written Flex Day stub draft the stub provider returns for case `wp-3`. Keys starting with `_` are notes and are stripped before use.
