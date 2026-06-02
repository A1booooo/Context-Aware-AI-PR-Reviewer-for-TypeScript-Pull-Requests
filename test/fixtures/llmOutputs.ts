export function createValidReviewJsonOutput(): string {
  return JSON.stringify({
    summary_findings: [
      {
        title: 'Missing null guard before property access',
        severity: 'high',
        confidence: 0.92,
        description:
          'The code reads user.profile.name before confirming profile exists.'
      }
    ],
    inline_findings: [
      {
        message: 'Effect depends on stale closure state',
        severity: 'medium',
        confidence: 0.81,
        file: 'src/component.tsx',
        code_snippet: 'useEffect(() => syncCount(count), [])'
      }
    ]
  });
}

export function createCodeFencedReviewJsonOutput(): string {
  return `  \n\`\`\`json\n${createValidReviewJsonOutput()}\n\`\`\`\n  `;
}

export function createPlainCodeFencedReviewJsonOutput(): string {
  return `\n\`\`\`\n${createValidReviewJsonOutput()}\n\`\`\`\n`;
}

export function createMalformedReviewJsonOutput(): string {
  return '{"summary_findings":[{"title":"oops","severity":"high","confidence":0.9}';
}

export function createInvalidSeverityOutput(): string {
  return JSON.stringify({
    summary_findings: [
      {
        title: 'Unsupported severity should be excluded',
        severity: 'warning',
        confidence: 0.9
      }
    ]
  });
}

export function createInvalidConfidenceOutput(): string {
  return JSON.stringify({
    summary_findings: [
      {
        title: 'Out of range confidence should be excluded',
        severity: 'medium',
        confidence: 2
      }
    ]
  });
}

export function createInlineDowngradeOutput(): string {
  return JSON.stringify({
    inline_findings: [
      {
        description: 'The finding can still appear in the summary.',
        severity: 'low',
        confidence: 0.6,
        file: 'src/feature.ts'
      },
      {
        message: 'Missing file should also downgrade when core fields are valid.',
        severity: 'medium',
        confidence: 0.7,
        code_snippet: 'dangerousCall()'
      }
    ]
  });
}

export function createMissingCoreFieldsOutput(): string {
  return JSON.stringify({
    summary_findings: [
      {
        severity: 'high',
        confidence: 0.9
      }
    ],
    inline_findings: [
      {
        severity: 'medium',
        confidence: 0.7,
        file: 'src/example.ts',
        code_snippet: 'doThing()'
      }
    ]
  });
}

export function createInvalidTopLevelOutput(): string {
  return JSON.stringify(['not-an-object']);
}
