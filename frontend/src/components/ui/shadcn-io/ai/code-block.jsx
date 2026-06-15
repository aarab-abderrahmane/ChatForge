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
import { cn } from '../../../../lib/utils';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { createContext, useContext, useState, lazy, Suspense } from 'react';
import { radius } from '../../../../lib/design-tokens';

const LazySyntaxHighlighter = lazy(() => import('./syntax-highlighter').then(m => ({ default: m.default })));

function SyntaxHighlighterFallback({ code }) {
  return (
    <pre className="font-mono text-xs p-4 overflow-x-auto whitespace-pre-wrap bg-muted-100" style={{ margin: 0 }}>
      <code>{code}</code>
    </pre>
  );
}





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
      className={cn('relative w-full overflow-hidden my-3 border-2 border-ink wobbly-sm shadow-hard-sm', className)}
      style={{
        background: '#F5F5F5',
      }}
      {...props}
    >
      {/* Language label + copy button header */}
      <div
        className="flex items-center justify-between px-4 py-1.5 bg-muted-100 border-b border-divider"
      >
        <span
          className="text-[10px] tracking-widest uppercase text-muted-500 font-mono"
        >
          {language || 'code'}
        </span>
        {children && (
          <div className="flex items-center gap-2">{children}</div>
        )}
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <Suspense fallback={<SyntaxHighlighterFallback code={code} />}>
          <LazySyntaxHighlighter code={code} language={language || 'text'} showLineNumbers={showLineNumbers} />
        </Suspense>
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
    <button
      className={cn('btn-sketch-icon', className)}
      onClick={copyToClipboard}
      {...props}>
      {children ?? <Icon size={14} />}
    </button>
  );
};
