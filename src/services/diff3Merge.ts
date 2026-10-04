/**
 * 3-Way Diff Merge Engine for Gitero IDE
 * Performs clean 3-way line merging (Base vs Ours vs Theirs) in pure TypeScript.
 *
 * - Base: The file state when opened or last saved in Gitero
 * - Ours: The unsaved editor buffer in Gitero
 * - Theirs: The external modifications written to disk (e.g. by AI agent or another app)
 *
 * Automatically combines non-overlapping changes and produces standard conflict
 * markers (<<<<<<<, =======, >>>>>>>) when edits overlap on identical line ranges.
 */

export interface Diff3MergeResult {
  /** True if all hunks merged cleanly without any overlapping collisions */
  success: boolean;
  /** Number of conflicting overlapping hunks detected */
  conflictCount: number;
  /** The resulting merged document text (with conflict markers if success === false) */
  text: string;
}

interface Hunk {
  baseStart: number;
  baseEnd: number;
  newLines: string[];
}

interface TaggedHunk extends Hunk {
  origin: 'ours' | 'theirs';
}

function getHunks(baseLines: string[], otherLines: string[]): Hunk[] {
  const n = baseLines.length;
  const m = otherLines.length;

  // 1. Strip common prefix lines
  let prefix = 0;
  while (prefix < n && prefix < m && baseLines[prefix] === otherLines[prefix]) {
    prefix++;
  }

  // 2. Strip common suffix lines
  let suffix = 0;
  while (
    suffix < (n - prefix) &&
    suffix < (m - prefix) &&
    baseLines[n - 1 - suffix] === otherLines[m - 1 - suffix]
  ) {
    suffix++;
  }

  const midA = baseLines.slice(prefix, n - suffix);
  const midB = otherLines.slice(prefix, m - suffix);
  const midN = midA.length;
  const midM = midB.length;

  if (midN === 0 && midM === 0) {
    return [];
  }

  // 3. Compute LCS on the middle portion
  const hunks: Hunk[] = [];

  // Guard against massive combinatorial explosion for huge files (> 4M cells)
  if (midN * midM <= 4000000) {
    const dp = Array.from({ length: midN + 1 }, () => new Int32Array(midM + 1));
    for (let i = 0; i < midN; i++) {
      for (let j = 0; j < midM; j++) {
        if (midA[i] === midB[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = midN;
    let j = midM;
    const matches: Array<{ a: number; b: number }> = [];
    while (i > 0 && j > 0) {
      if (midA[i - 1] === midB[j - 1]) {
        matches.unshift({ a: prefix + i - 1, b: prefix + j - 1 });
        i--;
        j--;
      } else if (dp[i][j - 1] >= dp[i - 1][j]) {
        j--;
      } else {
        i--;
      }
    }

    let lastA = prefix;
    let lastB = prefix;

    for (const match of matches) {
      if (match.a > lastA || match.b > lastB) {
        hunks.push({
          baseStart: lastA,
          baseEnd: match.a,
          newLines: otherLines.slice(lastB, match.b)
        });
      }
      lastA = match.a + 1;
      lastB = match.b + 1;
    }

    if (lastA < (n - suffix) || lastB < (m - suffix)) {
      hunks.push({
        baseStart: lastA,
        baseEnd: n - suffix,
        newLines: otherLines.slice(lastB, m - suffix)
      });
    }
  } else {
    // Large fallback replacement
    hunks.push({
      baseStart: prefix,
      baseEnd: n - suffix,
      newLines: otherLines.slice(prefix, m - suffix)
    });
  }

  return hunks;
}

export function diff3Merge(
  baseText: string,
  oursText: string,
  theirsText: string,
  options?: {
    oursLabel?: string;
    theirsLabel?: string;
  }
): Diff3MergeResult {
  // Shortcut: if ours or theirs didn't change from base
  if (oursText === theirsText) {
    return { success: true, conflictCount: 0, text: oursText };
  }
  if (baseText === oursText) {
    return { success: true, conflictCount: 0, text: theirsText };
  }
  if (baseText === theirsText) {
    return { success: true, conflictCount: 0, text: oursText };
  }

  const baseLines = baseText.split(/\r?\n/);
  const oursLines = oursText.split(/\r?\n/);
  const theirsLines = theirsText.split(/\r?\n/);

  const oursHunks = getHunks(baseLines, oursLines);
  const theirsHunks = getHunks(baseLines, theirsLines);

  const allHunks: TaggedHunk[] = [
    ...oursHunks.map((h): TaggedHunk => ({ ...h, origin: 'ours' })),
    ...theirsHunks.map((h): TaggedHunk => ({ ...h, origin: 'theirs' }))
  ].sort((a, b) => a.baseStart - b.baseStart || a.baseEnd - b.baseEnd);

  const resultLines: string[] = [];
  let curIndex = 0;
  let hasConflicts = false;
  let conflictCount = 0;

  const oursLabel = options?.oursLabel || 'Local Unsaved Changes';
  const theirsLabel = options?.theirsLabel || 'External Disk (AI)';

  for (let idx = 0; idx < allHunks.length; idx++) {
    const hunk = allHunks[idx];
    const group: TaggedHunk[] = [hunk];
    let maxEnd = hunk.baseEnd;

    // Expand overlapping / adjacent hunks
    while (idx + 1 < allHunks.length && allHunks[idx + 1].baseStart < maxEnd) {
      idx++;
      group.push(allHunks[idx]);
      maxEnd = Math.max(maxEnd, allHunks[idx].baseEnd);
    }

    const groupStart = Math.min(...group.map((g) => g.baseStart));
    if (groupStart > curIndex) {
      resultLines.push(...baseLines.slice(curIndex, groupStart));
    }

    if (group.length === 1) {
      // Clean non-overlapping hunk from either ours or theirs
      resultLines.push(...group[0].newLines);
    } else {
      // Overlapping hunks from both sides
      const oursInGroup = group.filter((g) => g.origin === 'ours');
      const theirsInGroup = group.filter((g) => g.origin === 'theirs');

      const oursContent = oursInGroup.map((g) => g.newLines.join('\n')).join('\n');
      const theirsContent = theirsInGroup.map((g) => g.newLines.join('\n')).join('\n');

      if (oursContent === theirsContent) {
        // Both sides made the identical modification
        resultLines.push(...oursInGroup[0].newLines);
      } else {
        // True conflict on this line range!
        hasConflicts = true;
        conflictCount++;
        resultLines.push(`<<<<<<< ${oursLabel}`);
        resultLines.push(...oursInGroup.flatMap((g) => g.newLines));
        resultLines.push('=======');
        resultLines.push(...theirsInGroup.flatMap((g) => g.newLines));
        resultLines.push(`>>>>>>> ${theirsLabel}`);
      }
    }

    curIndex = Math.max(curIndex, maxEnd);
  }

  if (curIndex < baseLines.length) {
    resultLines.push(...baseLines.slice(curIndex));
  }

  return {
    success: !hasConflicts,
    conflictCount,
    text: resultLines.join('\n')
  };
}
