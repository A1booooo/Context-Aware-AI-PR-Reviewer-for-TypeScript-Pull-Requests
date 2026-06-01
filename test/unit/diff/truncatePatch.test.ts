import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_PATCH_CHARACTERS,
  truncatePatch
} from '../../../src/diff/truncatePatch';

describe('truncatePatch', () => {
  it('keeps a patch unchanged when it fits within the configured limit', () => {
    const patch = '@@ -1 +1 @@\n-old\n+new';

    expect(truncatePatch(patch, { maxCharacters: DEFAULT_MAX_PATCH_CHARACTERS })).toEqual({
      patch,
      wasTruncated: false,
      originalPatchLength: patch.length,
      truncatedPatchLength: patch.length
    });
  });

  it('truncates oversized patches and returns explicit length metadata', () => {
    const patch = ['@@ -1,4 +1,4 @@', '-old line', '+new line', '+another line'].join('\n');

    expect(truncatePatch(patch, { maxCharacters: 20 })).toEqual({
      patch: '@@ -1,4 +1,4 @@',
      wasTruncated: true,
      originalPatchLength: patch.length,
      truncatedPatchLength: '@@ -1,4 +1,4 @@'.length
    });
  });

  it('falls back to slicing when the first line already exceeds the maximum length', () => {
    const patch = '@@ -123456789 +123456789 @@\n+rest';

    expect(truncatePatch(patch, { maxCharacters: 10 })).toEqual({
      patch: patch.slice(0, 10),
      wasTruncated: true,
      originalPatchLength: patch.length,
      truncatedPatchLength: 10
    });
  });
});
