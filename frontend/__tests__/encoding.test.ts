import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const srcDir = resolve(__dirname, '../src');

const readUtf8 = (path: string) => readFileSync(path, 'utf-8');

describe('frontend encoding', () => {
  it('has no replacement characters anywhere in src', () => {
    const files: string[] = [];
    const glob = ['forms', 'components', 'views'];
    const queue = glob.map((name) => resolve(srcDir, name));

    while (queue.length) {
      const next = queue.pop();
      if (!next) {
        continue;
      }
      const entries = require('node:fs')
        .readdirSync(next, { withFileTypes: true })
        .map((entry) => resolve(next, entry.name));
      for (const entryPath of entries) {
        const stat = require('node:fs').statSync(entryPath);
        if (stat.isDirectory()) {
          queue.push(entryPath);
          continue;
        }
        if (!entryPath.endsWith('.tsx') && !entryPath.endsWith('.ts')) {
          continue;
        }
        const content = readUtf8(entryPath);
        if (content.includes('\uFFFD')) {
          files.push(entryPath);
        }
      }
    }

    expect(files).toEqual([]);
  });

  it('renders current form labels correctly without replacement characters', () => {
    const policyFormPath = resolve(srcDir, 'components/forms/AddPolicyForm.tsx');
    const content = readUtf8(policyFormPath);
    expect(content).toContain('Контрагент');
    expect(content).toContain('Доходы');
    expect(content).not.toContain('\uFFFD');
  });
});
