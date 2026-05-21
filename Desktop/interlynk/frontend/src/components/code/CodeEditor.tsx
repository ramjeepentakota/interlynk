import React from 'react';
import Editor from '@monaco-editor/react';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Play,
  Terminal,
  X,
  Save,
  Search,
  Settings,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Tooltip, ScrollArea } from '@/components/ui';
import {
  useWorkspaceFiles,
  useWorkspaceFile,
  useSaveWorkspaceFile,
  languageForPath,
  type FileTreeItem,
} from '@/api/codeWorkspace';
import { codeExecutionApi } from '@/api/client';

interface CodeEditorProps {
  /** Workspace to attach to. When null, renders an empty state. */
  workspaceId?: number | string | null;
}

interface OpenFile {
  path: string;
  name: string;
  language: string;
}

export function CodeEditor({ workspaceId = null }: CodeEditorProps) {
  const filesQuery = useWorkspaceFiles(workspaceId);
  const saveFile = useSaveWorkspaceFile(workspaceId);

  const [openFiles, setOpenFiles] = React.useState<OpenFile[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [showTerminal, setShowTerminal] = React.useState(false);
  const [terminalOutput, setTerminalOutput] = React.useState<string[]>([
    '> Code execution ready',
  ]);

  const activeFileContent = useWorkspaceFile(workspaceId, activePath);
  const [draft, setDraft] = React.useState<string>('');
  const [dirty, setDirty] = React.useState(false);

  // When the server delivers fresh file content, replace the editor's draft —
  // but only if the user hasn't started editing it locally yet.
  React.useEffect(() => {
    if (!activeFileContent.data) return;
    if (dirty) return;
    setDraft(activeFileContent.data.content ?? '');
  }, [activeFileContent.data, dirty]);

  React.useEffect(() => {
    setDirty(false);
  }, [activePath]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFile = React.useCallback((file: { path: string; name: string; language: string }) => {
    setOpenFiles((curr) =>
      curr.some((f) => f.path === file.path) ? curr : [...curr, file],
    );
    setActivePath(file.path);
  }, []);

  const closeFile = (path: string) => {
    setOpenFiles((curr) => {
      const next = curr.filter((f) => f.path !== path);
      if (activePath === path && next.length > 0) setActivePath(next[next.length - 1].path);
      else if (next.length === 0) setActivePath(null);
      return next;
    });
  };

  const onSave = async () => {
    if (!activePath || !workspaceId) return;
    try {
      await saveFile.mutateAsync({ filePath: activePath, content: draft });
      setDirty(false);
      setTerminalOutput((prev) => [...prev, `✓ saved ${activePath}`]);
      setShowTerminal(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'save failed';
      setTerminalOutput((prev) => [...prev, `✗ save failed: ${msg}`]);
      setShowTerminal(true);
    }
  };

  const onRun = async () => {
    if (!activePath) return;
    setShowTerminal(true);
    setTerminalOutput((prev) => [...prev, `> running ${activePath}`]);
    try {
      const language = openFiles.find((f) => f.path === activePath)?.language ?? 'plaintext';
      const { data } = await codeExecutionApi.executeCode(draft, language);
      // Backend returns CodeExecution shape: { output, error, stdout, stderr }
      type ExecResult = { output?: string; error?: string; stdout?: string; stderr?: string };
      const res = (data ?? {}) as ExecResult;
      const out = res.output ?? res.stdout ?? '';
      const err = res.error ?? res.stderr ?? '';
      if (out) setTerminalOutput((prev) => [...prev, ...out.split('\n')]);
      if (err) setTerminalOutput((prev) => [...prev, ...err.split('\n').map((l) => `! ${l}`)]);
      setTerminalOutput((prev) => [...prev, '✓ execution finished']);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'execution failed';
      setTerminalOutput((prev) => [...prev, `✗ ${msg}`]);
    }
  };

  const activeLanguage = openFiles.find((f) => f.path === activePath)?.language ?? 'plaintext';

  // Keyboard shortcut: Ctrl/Cmd+S → save.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, draft]);

  return (
    <div className="flex flex-col h-full bg-background-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-elevated">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Play className="w-4 h-4" />}
            onClick={onRun}
            disabled={!activePath}
          >
            Run
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={
              saveFile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />
            }
            onClick={onSave}
            disabled={!activePath || !dirty || saveFile.isPending}
          >
            {dirty ? 'Save*' : 'Save'}
          </Button>
          <div className="h-4 w-px bg-border mx-2" />
          <Tooltip content="Git">
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <GitBranch className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-3 py-1.5 text-sm bg-background-hover border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary w-48"
            />
          </div>
          <Tooltip content="Settings">
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <Settings className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div className="w-60 border-r border-border flex flex-col bg-background-secondary">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Explorer
            </span>
            <div className="flex gap-1">
              <Tooltip content="New File">
                <Button variant="ghost" size="icon" className="w-6 h-6">
                  <Plus className="w-3 h-3" />
                </Button>
              </Tooltip>
              <Tooltip content="New Folder">
                <Button variant="ghost" size="icon" className="w-6 h-6">
                  <Folder className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {workspaceId == null ? (
                <div className="text-xs text-text-muted p-3">
                  No workspace selected. Open or create one to load files.
                </div>
              ) : filesQuery.isLoading ? (
                <div className="text-xs text-text-muted p-3 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> loading…
                </div>
              ) : filesQuery.isError ? (
                <div className="text-xs text-error p-3">Could not load files.</div>
              ) : (filesQuery.data ?? []).length === 0 ? (
                <div className="text-xs text-text-muted p-3">This workspace has no files yet.</div>
              ) : (
                (filesQuery.data ?? []).map((item) => (
                  <FileTreeRow
                    key={item.id}
                    item={item}
                    depth={0}
                    expandedFolders={expandedFolders}
                    onToggle={toggleFolder}
                    onOpen={openFile}
                    activePath={activePath}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-border bg-surface-elevated overflow-x-auto">
            {openFiles.map((file) => (
              <div
                key={file.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm border-r border-border cursor-pointer transition-colors',
                  activePath === file.path
                    ? 'bg-background-primary text-text-primary'
                    : 'text-text-secondary hover:bg-background-hover',
                )}
                onClick={() => setActivePath(file.path)}
                title={file.path}
              >
                <File className="w-4 h-4" />
                <span>{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(file.path);
                  }}
                  className="p-0.5 hover:bg-background-hover rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Monaco Editor */}
          <div className="flex-1">
            {activePath ? (
              <Editor
                height="100%"
                defaultLanguage="typescript"
                language={activeLanguage}
                value={draft}
                onChange={(value) => {
                  setDraft(value || '');
                  setDirty(true);
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderWhitespace: 'selection',
                  bracketPairColorization: { enabled: true },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-sm">
                {workspaceId == null
                  ? 'Open a workspace to start editing.'
                  : 'Select a file from the Explorer.'}
              </div>
            )}
          </div>

          {/* Terminal Panel */}
          {showTerminal && (
            <div className="h-[200px] border-t border-border bg-surface">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">Terminal</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                  onClick={() => setShowTerminal(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100%-32px)]">
                <div className="p-2 font-mono text-sm">
                  {terminalOutput.map((line, i) => (
                    <div key={i} className="text-text-secondary">
                      {line}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FileTreeRowProps {
  item: FileTreeItem;
  depth: number;
  expandedFolders: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (file: { path: string; name: string; language: string }) => void;
  activePath: string | null;
}

function FileTreeRow({ item, depth, expandedFolders, onToggle, onOpen, activePath }: FileTreeRowProps) {
  const isExpanded = expandedFolders.has(item.id);
  const isFile = item.type === 'file';

  return (
    <div>
      <button
        onClick={() => {
          if (isFile) {
            onOpen({
              path: item.path,
              name: item.name,
              language: item.language ?? languageForPath(item.name),
            });
          } else {
            onToggle(item.id);
          }
        }}
        className={cn(
          'w-full flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-background-hover transition-colors',
          isFile && activePath === item.path && 'bg-primary/10 text-primary',
          (!isFile || activePath !== item.path) && 'text-text-secondary hover:text-text-primary',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {!isFile && (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        {isFile ? (
          <File className="w-4 h-4" />
        ) : isExpanded ? (
          <FolderOpen className="w-4 h-4 text-warning" />
        ) : (
          <Folder className="w-4 h-4 text-warning" />
        )}
        <span className="truncate">{item.name}</span>
      </button>
      {!isFile && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeRow
              key={child.id}
              item={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onOpen={onOpen}
              activePath={activePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CodeEditor;
