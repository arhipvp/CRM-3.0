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
  const allowedExtras = new Set([
    String.fromCharCode(0x00ab),
    String.fromCharCode(0x00bb),
    String.fromCharCode(0x2014),
    String.fromCharCode(0x2013),
    String.fromCharCode(0x2018),
    String.fromCharCode(0x2019),
    String.fromCharCode(0x201c),
    String.fromCharCode(0x201d),
    String.fromCharCode(0x2026),
    String.fromCharCode(0x00b7),
    String.fromCharCode(0x20bd),
    String.fromCharCode(0x2116),
    String.fromCharCode(0x2022),
    String.fromCharCode(0x00a0),
  ]);
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
        resolve(next, entry.name)
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
