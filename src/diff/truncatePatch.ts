export const DEFAULT_MAX_PATCH_CHARACTERS = 12000;

export interface TruncatePatchOptions {
  maxCharacters?: number;
}

export interface TruncatePatchResult {
  patch: string;
  wasTruncated: boolean;
  originalPatchLength: number;
  truncatedPatchLength: number;
}

export function truncatePatch(
  patch: string,
  options: TruncatePatchOptions = {}
): TruncatePatchResult {
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_PATCH_CHARACTERS;

  if (patch.length <= maxCharacters) {
    return {
      patch,
      wasTruncated: false,
      originalPatchLength: patch.length,
      truncatedPatchLength: patch.length
    };
  }

  const truncatedPatch = truncateAtLineBoundary(patch, maxCharacters);

  return {
    patch: truncatedPatch,
    wasTruncated: true,
    originalPatchLength: patch.length,
    truncatedPatchLength: truncatedPatch.length
  };
}

function truncateAtLineBoundary(patch: string, maxCharacters: number): string {
  const lines = patch.split('\n');
  const keptLines: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    const nextLength = keptLines.length === 0
      ? line.length
      : currentLength + 1 + line.length;

    if (nextLength > maxCharacters) {
      break;
    }

    keptLines.push(line);
    currentLength = nextLength;
  }

  if (keptLines.length === 0) {
    return patch.slice(0, maxCharacters);
  }

  return keptLines.join('\n');
}

