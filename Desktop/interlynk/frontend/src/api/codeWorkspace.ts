import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from './client';

/**
 * Hooks + tree-builder for the Monaco editor view. The backend stores files
 * as a flat list keyed by filePath ("src/components/Button.tsx"); the editor
 * needs a nested folder tree. We build the tree client-side rather than
 * shipping a second endpoint — the file lists for a single workspace are
 * small enough (a few hundred entries at most) that grouping in JS is faster
 * than another round-trip.
 */

export interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  language?: string;
  children?: FileTreeItem[];
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  cpp: 'cpp',
  cc: 'cpp',
  c: 'c',
  h: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  xml: 'xml',
  sh: 'shell',
};

export function languageForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
}

/** Build a folder tree from a flat ["src/foo.ts", "src/bar/baz.ts", ...] list. */
export function buildFileTree(paths: Array<{ filePath: string; language?: string }>): FileTreeItem[] {
  const root: FileTreeItem[] = [];

  for (const entry of paths) {
    const segments = entry.filePath.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    let cursor = root;
    let acc = '';
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i];
      const isFile = i === segments.length - 1;
      acc = acc ? `${acc}/${name}` : name;

      let node = cursor.find((c) => c.name === name && c.type === (isFile ? 'file' : 'folder'));
      if (!node) {
        node = {
          id: acc,
          name,
          path: acc,
          type: isFile ? 'file' : 'folder',
          language: isFile ? entry.language ?? languageForPath(name) : undefined,
          children: isFile ? undefined : [],
        };
        cursor.push(node);
      }
      if (!isFile) cursor = node.children!;
    }
  }

  // Folders before files, then alphabetical.
  const sortRec = (nodes: FileTreeItem[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children && sortRec(n.children));
  };
  sortRec(root);
  return root;
}

export const useWorkspaceFiles = (workspaceId: string | number | null) =>
  useQuery({
    queryKey: ['workspace', workspaceId, 'files'],
    queryFn: async () => {
      const { data } = await workspaceApi.getFiles(workspaceId!);
      return buildFileTree(
        (data ?? []).map((f) => ({ filePath: f.filePath, language: f.language })),
      );
    },
    enabled: workspaceId != null,
  });

export const useWorkspaceFile = (workspaceId: string | number | null, filePath: string | null) =>
  useQuery({
    queryKey: ['workspace', workspaceId, 'file', filePath],
    queryFn: async () => (await workspaceApi.getFile(workspaceId!, filePath!)).data,
    enabled: workspaceId != null && filePath != null,
    staleTime: 5 * 60 * 1000, // file contents rarely change behind our back
  });

export const useSaveWorkspaceFile = (workspaceId: string | number | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { filePath: string; content: string }) =>
      workspaceApi.saveFile(workspaceId!, vars.filePath, vars.content),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['workspace', workspaceId, 'file', vars.filePath] });
      qc.invalidateQueries({ queryKey: ['workspace', workspaceId, 'files'] });
    },
  });
};
