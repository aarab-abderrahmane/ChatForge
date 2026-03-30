/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';;
import { Button } from '../../button';
import { cn } from '../../../../lib/utils';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

// Custom neon terminal theme for code blocks
const neonTerminalTheme = {
  'code[class*="language-"]': {
    color: '#c8ffc0',
    background: 'none',
    fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
    fontSize: '0.85rem',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.6',
    tabSize: 2,
    hyphens: 'none',
  },
  'pre[class*="language-"]': {
    color: '#c8ffc0',
    background: '#050f08',
    fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
    fontSize: '0.85rem',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: '1.6',
    tabSize: 2,
    hyphens: 'none',
    padding: '1rem',
    margin: 0,
    overflow: 'auto',
  },
  comment: { color: '#4a7a50', fontStyle: 'italic' },
  prolog: { color: '#4a7a50' },
  doctype: { color: '#4a7a50' },
  cdata: { color: '#4a7a50' },
  punctuation: { color: '#7eed8a' },
  property: { color: '#00f5ff' },
  tag: { color: '#00f5ff' },
  boolean: { color: '#ff2d78' },
  number: { color: '#ffd700' },
  constant: { color: '#ff2d78' },
  symbol: { color: '#ffd700' },
  deleted: { color: '#ff2d78' },
  selector: { color: '#39ff14' },
  'attr-name': { color: '#00f5ff' },
  string: { color: '#39ff14' },
  char: { color: '#39ff14' },
  builtin: { color: '#00f5ff' },
  inserted: { color: '#39ff14' },
  operator: { color: '#c8ffc0' },
  entity: { color: '#ffd700', cursor: 'help' },
  url: { color: '#00f5ff' },
  'language-css .token.string': { color: '#39ff14' },
  'style .token.string': { color: '#39ff14' },
  variable: { color: '#c8ffc0' },
  atrule: { color: '#00f5ff' },
  'attr-value': { color: '#39ff14' },
  function: { color: '#00f5ff', textShadow: '0 0 6px rgba(0,245,255,0.5)' },
  'class-name': { color: '#ffd700', textShadow: '0 0 6px rgba(255,215,0,0.4)' },
  keyword: { color: '#ff2d78', textShadow: '0 0 6px rgba(255,45,120,0.4)' },
  regex: { color: '#ffd700' },
  important: { color: '#ffd700', fontWeight: 'bold' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
};






export const CodeBlockContext = createContext({
  code: '',
});

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = true,
  className,
  children,
  ...props
}) => (
  <CodeBlockContext.Provider value={{ code }}>
    <div
      className={cn('relative w-full overflow-hidden rounded-lg my-3', className)}
      style={{
        border: '1px solid rgba(57,255,20,0.25)',
        background: '#050f08',
        boxShadow: '0 0 20px rgba(57,255,20,0.06), inset 0 0 20px rgba(0,0,0,0.5)',
      }}
      {...props}
    >
      {/* Language label + copy button header */}
      <div
        className="flex items-center justify-between px-4 py-1.5"
        style={{
          borderBottom: '1px solid rgba(57,255,20,0.15)',
          background: 'rgba(57,255,20,0.04)',
        }}
      >
        <span
          className="text-[10px] tracking-widest uppercase"
          style={{ color: 'rgba(0,245,255,0.6)', fontFamily: "'Fira Code', monospace" }}
        >
          {language || 'code'}
        </span>
        {children && (
          <div className="flex items-center gap-2">{children}</div>
        )}
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          codeTagProps={{ className: 'font-mono' }}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.82rem',
            lineHeight: '1.6',
          }}
          language={language || 'text'}
          lineNumberStyle={{
            color: 'rgba(57,255,20,0.2)',
            paddingRight: '1.2rem',
            minWidth: '2.5rem',
            userSelect: 'none',
          }}
          showLineNumbers={showLineNumbers}
          style={neonTerminalTheme}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  </CodeBlockContext.Provider>
);

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard.writeText) {
      onError?.(new Error('Clipboard API not available'));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn('shrink-0', className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}>
      {children ?? <Icon size={14} />}
    </Button>
  );
};
