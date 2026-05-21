import { describe, expect, it } from 'vitest';
import { buildFileTree, languageForPath } from '../codeWorkspace';

describe('languageForPath', () => {
  it.each([
    ['App.tsx', 'typescriptreact'],
    ['main.ts', 'typescript'],
    ['index.js', 'javascript'],
    ['style.css', 'css'],
    ['README.md', 'markdown'],
    ['Makefile', 'plaintext'],
  ])('%s → %s', (path, expected) => {
    expect(languageForPath(path)).toBe(expected);
  });
});

describe('buildFileTree', () => {
  it('groups files into folders and sorts folders before files', () => {
    const tree = buildFileTree([
      { filePath: 'README.md' },
      { filePath: 'src/components/Button.tsx' },
      { filePath: 'src/App.tsx' },
      { filePath: 'src/styles/main.css' },
      { filePath: 'package.json' },
    ]);

    // Top level should be: src (folder), package.json, README.md
    expect(tree.map((n) => n.name)).toEqual(['src', 'package.json', 'README.md']);
    expect(tree[0].type).toBe('folder');

    const src = tree[0];
    // src contains: components (folder), styles (folder), App.tsx
    expect(src.children!.map((c) => c.name)).toEqual(['components', 'styles', 'App.tsx']);

    // Leaf gets the right language inferred from its extension.
    const components = src.children!.find((c) => c.name === 'components')!;
    expect(components.children![0].name).toBe('Button.tsx');
    expect(components.children![0].language).toBe('typescriptreact');
  });

  it('returns an empty tree for empty input', () => {
    expect(buildFileTree([])).toEqual([]);
  });
});
