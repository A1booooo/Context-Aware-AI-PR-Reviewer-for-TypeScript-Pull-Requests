# AI PR Review Assistant

## Reviewer Configuration

Task 5 adds repository-level reviewer configuration through `.ai-pr-review.yml`.

If the file is missing, the action uses safe defaults:

```yml
language: zh-CN
max_files: 20
max_patch_chars_per_file: 6000
include_full_file_context: false
exclude:
  - dist/**
  - build/**
  - coverage/**
  - node_modules/**
  - package-lock.json
  - pnpm-lock.yaml
  - yarn.lock
  - "*.min.js"
  - "*.min.css"
review:
  severity_threshold: medium
  max_inline_comments: 5
  confidence_threshold: 0.75
  focus:
    - bug-risk
    - security
    - test-coverage
    - maintainability
    - react-hooks
    - typescript-types
```

Supported fields:

- `language`
- `max_files`
- `max_patch_chars_per_file`
- `include_full_file_context`
- `exclude`
- `review.severity_threshold`
- `review.max_inline_comments`
- `review.confidence_threshold`
- `review.focus`

Notes:

- Unknown fields fail validation with a clear error.
- Invalid values fail validation with a clear error.
- `exclude` merges user patterns on top of the default exclude list.
- `max_files` limits the included reviewable files after diff filtering.
- `max_patch_chars_per_file` controls patch truncation for included files.
- `include_full_file_context` and `review.max_inline_comments` are parsed and validated only in this task.
