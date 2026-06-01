export interface MockGitHubChangedFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export function createMockChangedFile(
  overrides: Partial<MockGitHubChangedFile> & Pick<MockGitHubChangedFile, 'filename'>
): MockGitHubChangedFile {
  return {
    filename: overrides.filename,
    status: overrides.status ?? 'modified',
    additions: overrides.additions ?? 1,
    deletions: overrides.deletions ?? 0,
    changes: overrides.changes ?? 1,
    patch: overrides.patch
  };
}

const firstPageLeadingFiles = [
  createMockChangedFile({
    filename: 'src/kept.ts',
    patch: '@@ -1 +1 @@\n-old\n+new'
  }),
  createMockChangedFile({
    filename: 'docs/image.png'
  })
];

const firstPagePaddingFiles = Array.from({ length: 98 }, (_, index) =>
  createMockChangedFile({
    filename: `src/page-one-${index}.ts`,
    patch: '@@ -1 +1 @@\n-old\n+new'
  })
);

export const paginatedChangedFiles = [
  [...firstPageLeadingFiles, ...firstPagePaddingFiles],
  [
    createMockChangedFile({
      filename: 'src/deleted.ts',
      status: 'removed',
      deletions: 10,
      changes: 10
    }),
    createMockChangedFile({
      filename: 'src/renamed.ts',
      status: 'renamed'
    })
  ]
];
