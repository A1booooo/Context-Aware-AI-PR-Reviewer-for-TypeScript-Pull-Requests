import type {
  PullRequestChangedFile,
  PullRequestDeletedFile,
  PullRequestMissingPatchFile,
  PullRequestTextPatchFile
} from '../../src/github/pr';

interface BaseFileOverrides {
  status?: PullRequestChangedFile['status'];
  additions?: number;
  deletions?: number;
  changes?: number;
}

export function createTextPatchFile(
  filename: string,
  patch: string,
  overrides: BaseFileOverrides = {}
): PullRequestTextPatchFile {
  return {
    filename,
    status: overrides.status ?? 'modified',
    additions: overrides.additions ?? 1,
    deletions: overrides.deletions ?? 0,
    changes: overrides.changes ?? 1,
    kind: 'text_patch',
    patch
  };
}

export function createMissingPatchFile(
  filename: string,
  overrides: BaseFileOverrides = {}
): PullRequestMissingPatchFile {
  return {
    filename,
    status: overrides.status ?? 'modified',
    additions: overrides.additions ?? 1,
    deletions: overrides.deletions ?? 0,
    changes: overrides.changes ?? 1,
    kind: 'missing_patch',
    patch: null
  };
}

export function createDeletedFile(
  filename: string,
  overrides: BaseFileOverrides = {}
): PullRequestDeletedFile {
  return {
    filename,
    status: 'removed',
    additions: overrides.additions ?? 0,
    deletions: overrides.deletions ?? 1,
    changes: overrides.changes ?? 1,
    kind: 'deleted',
    patch: null
  };
}

