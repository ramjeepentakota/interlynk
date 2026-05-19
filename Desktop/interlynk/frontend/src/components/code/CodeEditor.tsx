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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Tooltip, ScrollArea } from '@/components/ui';

// Types
interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
  language?: string;
}

// Mock file tree
const mockFileTree: FileTreeItem[] = [
  {
    id: '1',
    name: 'src',
    type: 'folder',
    children: [
      { id: '2', name: 'components', type: 'folder', children: [
        { id: '3', name: 'App.tsx', type: 'file', language: 'typescriptreact' },
        { id: '4', name: 'index.tsx', type: 'file', language: 'typescriptreact' },
        { id: '5', name: 'Button.tsx', type: 'file', language: 'typescript' },
      ]},
      { id: '6', name: 'styles', type: 'folder', children: [
        { id: '7', name: 'main.css', type: 'file', language: 'css' },
      ]},
      { id: '8', name: 'utils.ts', type: 'file', language: 'typescript' },
      { id: '9', name: 'types.ts', type: 'file', language: 'typescript' },
    ],
  },
  { id: '10', name: 'package.json', type: 'file', language: 'json' },
  { id: '11', name: 'tsconfig.json', type: 'file', language: 'json' },
  { id: '12', name: 'README.md', type: 'file', language: 'markdown' },
];

const mockCode = `// Welcome to Interlynk Code Editor
import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', children, onClick }: ButtonProps) {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default Button;
`;

export function CodeEditor() {
  const [openFiles, setOpenFiles] = React.useState([
    { id: '3', name: 'App.tsx', language: 'typescriptreact' },
  ]);
  const [activeFile, setActiveFile] = React.useState('3');
  const [code, setCode] = React.useState(mockCode);
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set(['1']));
  const [showTerminal, setShowTerminal] = React.useState(false);
  const [terminalOutput, setTerminalOutput] = React.useState<string[]>([
    '> Code execution ready',
    '> Running build...',
    '✓ Build completed in 2.3s',
  ]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openFile = (file: { id: string; name: string; language: string }) => {
    if (!openFiles.find((f) => f.id === file.id)) {
      setOpenFiles([...openFiles, file]);
    }
    setActiveFile(file.id);
  };

  const closeFile = (fileId: string) => {
    const newFiles = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(newFiles);
    if (activeFile === fileId && newFiles.length > 0) {
      setActiveFile(newFiles[newFiles.length - 1].id);
    }
  };

  const runCode = () => {
    setShowTerminal(true);
    setTerminalOutput((prev) => [
      ...prev,
      '> Running code...',
      '> Executing test...',
      '✓ All tests passed',
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-background-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-elevated">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Play className="w-4 h-4" />} onClick={runCode}>
            Run
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Save className="w-4 h-4" />}>
            Save
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
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Explorer</span>
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
              {mockFileTree.map((item) => (
                <FileTreeItem
                  key={item.id}
                  item={item}
                  depth={0}
                  expandedFolders={expandedFolders}
                  onToggle={toggleFolder}
                  onOpen={openFile}
                  activeFile={activeFile}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-border bg-surface-elevated overflow-x-auto">
            {openFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm border-r border-border cursor-pointer transition-colors',
                  activeFile === file.id
                    ? 'bg-background-primary text-text-primary'
                    : 'text-text-secondary hover:bg-background-hover'
                )}
                onClick={() => setActiveFile(file.id)}
              >
                <File className="w-4 h-4" />
                <span>{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(file.id);
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
            <Editor
              height="100%"
              defaultLanguage="typescript"
              language={openFiles.find((f) => f.id === activeFile)?.language || 'typescript'}
              value={code}
              onChange={(value) => setCode(value || '')}
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
          </div>

          {/* Terminal Panel */}
          {showTerminal && (
            <div className="h-[200px] border-t border-border bg-surface">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">Terminal</span>
                </div>
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setShowTerminal(false)}>
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

interface FileTreeItemProps {
  item: FileTreeItem;
  depth: number;
  expandedFolders: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (file: { id: string; name: string; language: string }) => void;
  activeFile: string;
}

function FileTreeItem({ item, depth, expandedFolders, onToggle, onOpen, activeFile }: FileTreeItemProps) {
  const isExpanded = expandedFolders.has(item.id);
  const isFile = item.type === 'file';

  return (
    <div>
      <button
        onClick={() => {
          if (isFile) {
            onOpen({ id: item.id, name: item.name, language: item.language || 'plaintext' });
          } else {
            onToggle(item.id);
          }
        }}
        className={cn(
          'w-full flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-background-hover transition-colors',
          isFile && activeFile === item.id && 'bg-primary/10 text-primary',
          !isFile || activeFile !== item.id && 'text-text-secondary hover:text-text-primary'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {!isFile && (
          isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
        )}
        {isFile ? (
          <File className="w-4 h-4" />
        ) : (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-warning" />
          ) : (
            <Folder className="w-4 h-4 text-warning" />
          )
        )}
        <span className="truncate">{item.name}</span>
      </button>
      {!isFile && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onOpen={onOpen}
              activeFile={activeFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CodeEditor;
