import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const srcDir = resolve(__dirname, '../src');
const rootDir = resolve(__dirname, '..');

const readUtf8 = (path: string) => readFileSync(path, 'utf-8');

describe('frontend encoding', () => {
  const russianLetters = new Set([
    ...Array.from({ length: 32 }, (_, i) => String.fromCharCode(0x0410 + i)),
    ...Array.from({ length: 32 }, (_, i) => String.fromCharCode(0x0430 + i)),
    String.fromCharCode(0x0401),
    String.fromCharCode(0x0451),
  ]);
  const allowedExtras = new Set(
    [
      0x00ab, 0x00bb, 0x2014, 0x2013, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x00b7, 0x20bd,
      0x2116, 0x2022, 0x00a0, 0x00d7, 0x2264, 0x2191, 0x2193, 0x2195, 0x21c4, 0x21bb, 0x23f3,
      0x2699, 0x26ab, 0x2705, 0x270e, 0x2717, 0x274c, 0x2912, 0xfe0f, 0x1f4ac, 0x1f4bf, 0x1f4c1,
      0x1f4c4, 0x1f4ce, 0x1f4da, 0x1f4dd, 0x1f464, 0x1f465, 0x1f552, 0x1f5c2, 0x1f5d1, 0x1f9fe,
    ].map((code) => String.fromCodePoint(code)),
  );
  const isSupportedChar = (char: string) => {
    if (char === String.fromCharCode(0xfeff)) {
      return true;
    }
    const code = char.codePointAt(0);
    if (!code) {
      return true;
    }
    if (code >= 0x20 && code <= 0x7e) {
      return true;
    }
    if (char === '\n' || char === '\r' || char === '\t') {
      return true;
    }
    if (russianLetters.has(char)) {
      return true;
    }
    if (allowedExtras.has(char)) {
      return true;
    }
    return false;
  };

  it('has no broken encoding symbols in frontend sources', () => {
    const replacementChar = String.fromCharCode(0xfffd);
    const files: string[] = [];
    const queue = [srcDir];
    const extraFiles = [resolve(rootDir, 'index.html')];

    while (queue.length) {
      const next = queue.pop();
      if (!next) {
        continue;
      }
      const entries = readdirSync(next, { withFileTypes: true }).map((entry) =>
        resolve(next, entry.name),
      );
      for (const entryPath of entries) {
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          queue.push(entryPath);
          continue;
        }
        if (
          !entryPath.endsWith('.tsx') &&
          !entryPath.endsWith('.ts') &&
          !entryPath.endsWith('.js') &&
          !entryPath.endsWith('.jsx') &&
          !entryPath.endsWith('.html') &&
          !entryPath.endsWith('.json') &&
          !entryPath.endsWith('.css') &&
          !entryPath.endsWith('.scss')
        ) {
          continue;
        }
        files.push(entryPath);
      }
    }

    const failed: string[] = [];
    for (const path of [...files, ...extraFiles]) {
      const content = readUtf8(path);
      if (content.includes(replacementChar)) {
        failed.push(`${path} contains \\uFFFD`);
        continue;
      }
      for (const char of content) {
        if (!isSupportedChar(char)) {
          failed.push(`${path} contains unexpected character ${JSON.stringify(char)}`);
          break;
        }
      }
    }

    expect(failed).toEqual([]);
  });
});
