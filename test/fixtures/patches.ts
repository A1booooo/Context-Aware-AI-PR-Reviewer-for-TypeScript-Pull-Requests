import { createTextPatchFile } from './diffFiles';

export function createFeaturePatchFile() {
  return createTextPatchFile(
    'src/feature.ts',
    [
      '@@ -10,2 +10,3 @@',
      ' const count = value;',
      '+const nextCount = count + 1;',
      ' return nextCount;'
    ].join('\n')
  );
}

export function createSecondFeaturePatchFile() {
  return createTextPatchFile(
    'src/second.ts',
    [
      '@@ -20,2 +20,3 @@',
      ' const status = "pending";',
      '+const status = "ready";',
      ' return status;'
    ].join('\n')
  );
}

export function createDeletedLineOnlyPatchFile() {
  return createTextPatchFile(
    'src/deleted-only.ts',
    [
      '@@ -4,2 +4,1 @@',
      '-const removedValue = computeOldValue();',
      ' return fallbackValue;'
    ].join('\n')
  );
}
