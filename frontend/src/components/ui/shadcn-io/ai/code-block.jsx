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

// VS Code Light+ inspired theme
const codeTheme = {
  'code[class*="language-"]': {
    color: '#111111',
    background: 'none',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
    color: '#111111',
    background: '#F5F5F5',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
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
  comment: { color: '#6A9955', fontStyle: 'italic' },
  prolog: { color: '#6A9955' },
  doctype: { color: '#6A9955' },
  cdata: { color: '#6A9955' },
  punctuation: { color: '#111111' },
  property: { color: '#EC5243' },
  tag: { color: '#800000' },
  boolean: { color: '#0000FF' },
  number: { color: '#098658' },
  constant: { color: '#098658' },
  symbol: { color: '#098658' },
  deleted: { color: '#A31515' },
  selector: { color: '#800000' },
  'attr-name': { color: '#FF0000' },
  string: { color: '#A31515' },
  char: { color: '#A31515' },
  builtin: { color: '#0000FF' },
  inserted: { color: '#098658' },
  operator: { color: '#111111' },
  entity: { color: '#A31515', cursor: 'help' },
  url: { color: '#111111' },
  'language-css .token.string': { color: '#A31515' },
  'style .token.string': { color: '#A31515' },
  variable: { color: '#001080' },
  atrule: { color: '#795E26' },
  'attr-value': { color: '#A31515' },
  function: { color: '#795E26' },
  'class-name': { color: '#267F99' },
  keyword: { color: '#0000FF' },
  regex: { color: '#A31515' },
  important: { color: '#0000FF', fontWeight: 'bold' },
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
      className={cn('relative w-full overflow-hidden my-3', className)}
      style={{
        border: '1px solid #D4D4D4',
        background: '#F5F5F5',
      }}
      {...props}
    >
      {/* Language label + copy button header */}
      <div
        className="flex items-center justify-between px-4 py-1.5"
        style={{
          borderBottom: '1px solid #D4D4D4',
          background: '#EEEEEE',
        }}
      >
        <span
          className="text-[10px] tracking-widest uppercase"
          style={{ color: '#737373', fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
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
            color: '#A3A3A3',
            paddingRight: '1.2rem',
            minWidth: '2.5rem',
            userSelect: 'none',
          }}
          showLineNumbers={showLineNumbers}
          style={codeTheme}
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
