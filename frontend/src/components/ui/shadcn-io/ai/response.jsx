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

'use client';
import { cn } from '../../../../lib/utils';
import { isValidElement, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { remarkHighlightMark } from 'remark-highlight-mark';
import { CodeBlock, CodeBlockCopyButton } from './code-block';
import { MermaidBlock } from './mermaid-block';
import { QuizBlock } from './quiz-block';
import { FlashcardBlock } from './flashcard-block';
import { MindmapBlock } from './mindmap-block';
import { FileBlock } from './file-block';
import 'katex/dist/katex.min.css';
import hardenReactMarkdown from 'harden-react-markdown';


/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
function parseIncompleteMarkdown(text) {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  const linkImagePattern = /(!?\[)([^\]]*?)$/;
  const linkMatch = result.match(linkImagePattern);
  if (linkMatch) {
    const startIndex = result.lastIndexOf(linkMatch[1]);
    result = result.substring(0, startIndex);
  }

  const boldPattern = /(\*\*)([^*]*?)$/;
  const boldMatch = result.match(boldPattern);
  if (boldMatch) {
    const asteriskPairs = (result.match(/\*\*/g) || []).length;
    if (asteriskPairs % 2 === 1) result = `${result}**`;
  }

  const italicPattern = /(__)([^_]*?)$/;
  const italicMatch = result.match(italicPattern);
  if (italicMatch) {
    const underscorePairs = (result.match(/__/g) || []).length;
    if (underscorePairs % 2 === 1) result = `${result}__`;
  }

  const singleAsteriskPattern = /(\*)([^*]*?)$/;
  const singleAsteriskMatch = result.match(singleAsteriskPattern);
  if (singleAsteriskMatch) {
    const singleAsterisks = result.split('').reduce((acc, char, index) => {
      if (char === '*') {
        const prevChar = result[index - 1];
        const nextChar = result[index + 1];
        if (prevChar !== '*' && nextChar !== '*') return acc + 1;
      }
      return acc;
    }, 0);
    if (singleAsterisks % 2 === 1) result = `${result}*`;
  }

  const singleUnderscorePattern = /(_)([^_]*?)$/;
  const singleUnderscoreMatch = result.match(singleUnderscorePattern);
  if (singleUnderscoreMatch) {
    const singleUnderscores = result.split('').reduce((acc, char, index) => {
      if (char === '_') {
        const prevChar = result[index - 1];
        const nextChar = result[index + 1];
        if (prevChar !== '_' && nextChar !== '_') return acc + 1;
      }
      return acc;
    }, 0);
    if (singleUnderscores % 2 === 1) result = `${result}_`;
  }

  const inlineCodePattern = /(`)([^`]*?)$/;
  const inlineCodeMatch = result.match(inlineCodePattern);
  if (inlineCodeMatch) {
    const allTripleBackticks = (result.match(/```/g) || []).length;
    const insideIncompleteCodeBlock = allTripleBackticks % 2 === 1;
    if (!insideIncompleteCodeBlock) {
      let singleBacktickCount = 0;
      for (let i = 0; i < result.length; i++) {
        if (result[i] === '`') {
          const isTripleStart = result.substring(i, i + 3) === '```';
          const isTripleMiddle = i > 0 && result.substring(i - 1, i + 2) === '```';
          const isTripleEnd = i > 1 && result.substring(i - 2, i + 1) === '```';
          if (!(isTripleStart || isTripleMiddle || isTripleEnd)) singleBacktickCount++;
        }
      }
      if (singleBacktickCount % 2 === 1) result = `${result}\``;
    }
  }

  const strikethroughPattern = /(~~)([^~]*?)$/;
  const strikethroughMatch = result.match(strikethroughPattern);
  if (strikethroughMatch) {
    const tildePairs = (result.match(/~~/g) || []).length;
    if (tildePairs % 2 === 1) result = `${result}~~`;
  }

  return result;
}

// ─── Auto-file wrapping ────────────────────────────────────────────────────────
/**
 * Maps common code fence languages to sensible filenames.
 * Used when the AI forgot to use file: prefix but the output is clearly a standalone file.
 */
const LANGUAGE_TO_FILENAME = {
  python: "script.py",
  py: "script.py",
  javascript: "script.js",
  js: "script.js",
  typescript: "script.ts",
  ts: "script.ts",
  jsx: "Component.jsx",
  tsx: "Component.tsx",
  html: "index.html",
  css: "styles.css",
  sql: "query.sql",
  bash: "script.sh",
  sh: "script.sh",
  shell: "script.sh",
  dockerfile: "Dockerfile",
  yaml: "config.yaml",
  yml: "config.yml",
  json: "data.json",
  markdown: "README.md",
  md: "README.md",
  env: ".env.example",
};

/**
 * Determines whether a plain code block should be auto-promoted to a FileBlock.
 *
 * Rules (all must be true):
 * 1. The language maps to a known filename.
 * 2. The code is long enough to be a real file (> 10 lines).
 * 3. The code looks complete (has proper structure like imports/exports/functions).
 *
 * This is intentionally conservative — we only auto-promote when confident,
 * to avoid turning every short snippet into a download card.
 */
const shouldAutoPromoteToFile = (language, code) => {
  if (!language || !code) return { promote: false, filename: null };

  const lang = language.toLowerCase();
  const filename = LANGUAGE_TO_FILENAME[lang];
  if (!filename) return { promote: false, filename: null };

  const lines = code.trim().split('\n').length;
  if (lines < 10) return { promote: false, filename: null };

  // Structural completeness heuristics per language
  const structuralChecks = {
    python: () => /^(import |from |def |class )/m.test(code),
    javascript: () => /(import |export |function |const |class )/m.test(code),
    typescript: () => /(import |export |function |const |class |interface |type )/m.test(code),
    jsx: () => /(import React|import {|export default|export function|const \w+ = \()/m.test(code),
    tsx: () => /(import React|import {|export default|export function|const \w+: React)/m.test(code),
    html: () => /<html|<!DOCTYPE|<body|<head/i.test(code),
    css: () => /[a-z-]+\s*:\s*[^;]+;/m.test(code) && lines > 5,
    sql: () => /(CREATE TABLE|SELECT|INSERT|ALTER TABLE)/i.test(code),

    yaml: () => /^[\w-]+:/m.test(code),
    yml: () => /^[\w-]+:/m.test(code),
    json: () => { try { JSON.parse(code); return true; } catch { return false; } },
  };

    //   bash: () => /(#!/|echo |if \[|for |while )/m.test(code),
    // sh: () => /(#!/|echo |if \[|for |while )/m.test(code),

  const check = structuralChecks[lang];
  if (check && !check()) return { promote: false, filename: null };

  return { promote: true, filename };
};

// ─── Markdown components ───────────────────────────────────────────────────────
const HardenedMarkdown = hardenReactMarkdown(ReactMarkdown);

const components = {
  ol: ({ node, children, className, ...props }) => (
    <ol className={cn('ml-5 list-outside list-decimal space-y-1 my-2 text-ink', className)} {...props}>
      {children}
    </ol>
  ),
  li: ({ node, children, className, ...props }) => (
    <li className={cn('py-0.5 leading-relaxed', className)} {...props}>{children}</li>
  ),
  ul: ({ node, children, className, ...props }) => (
    <ul className={cn('ml-5 list-outside list-disc space-y-1 my-2 text-ink', className)} {...props}>
      {children}
    </ul>
  ),
  hr: ({ node, className, ...props }) => (
    <hr className={cn('my-5 border-divider', className)} {...props} />
  ),
  strong: ({ node, children, className, ...props }) => (
    <span className={cn('font-bold text-ink', className)} {...props}>{children}</span>
  ),
  em: ({ node, children, className, ...props }) => (
    <em className={cn('italic', className)} {...props}>{children}</em>
  ),
  del: ({ node, children, className, ...props }) => (
    <del className={cn('line-through text-muted-500', className)} {...props}>{children}</del>
  ),
  highlight: ({ node, children, className, ...props }) => (
    <mark className={cn('bg-yellow-200 text-ink px-1 rounded', className)} {...props}>{children}</mark>
  ),
  a: ({ node, children, className, ...props }) => (
    <a className={cn('underline text-ink hover:text-red underline-offset-2', className)} rel="noreferrer" target="_blank" {...props}>
      {children}
    </a>
  ),
  h1: ({ node, children, className, ...props }) => (
    <h1 className={cn('mt-6 mb-3 font-serif text-2xl font-black', className)} {...props}>{children}</h1>
  ),
  h2: ({ node, children, className, ...props }) => (
    <h2 className={cn('mt-5 mb-2 font-serif text-xl font-bold', className)} {...props}># {children}</h2>
  ),
  h3: ({ node, children, className, ...props }) => (
    <h3 className={cn('mt-4 mb-2 font-serif text-lg font-semibold', className)} {...props}>## {children}</h3>
  ),
  h4: ({ node, children, className, ...props }) => (
    <h4 className={cn('mt-4 mb-1 font-serif text-base font-semibold', className)} {...props}>### {children}</h4>
  ),
  h5: ({ node, children, className, ...props }) => (
    <h5 className={cn('mt-3 mb-1 font-serif font-semibold', className)} {...props}>{children}</h5>
  ),
  h6: ({ node, children, className, ...props }) => (
    <h6 className={cn('mt-3 mb-1 font-serif text-sm font-semibold', className)} {...props}>{children}</h6>
  ),
  table: ({ node, children, className, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-ink">
      <table className={cn('w-full border-collapse', className)} {...props}>{children}</table>
    </div>
  ),
  thead: ({ node, children, className, ...props }) => (
    <thead className={cn('bg-muted-100', className)} {...props}>{children}</thead>
  ),
  tbody: ({ node, children, className, ...props }) => (
    <tbody className={cn('', className)} {...props}>{children}</tbody>
  ),
  tr: ({ node, children, className, ...props }) => (
    <tr className={cn('', className)} {...props}>{children}</tr>
  ),
  th: ({ node, children, className, ...props }) => (
    <th className={cn('px-4 py-2 text-left font-mono text-xs tracking-widest uppercase text-ink', className)} {...props}>
      {children}
    </th>
  ),
  td: ({ node, children, className, ...props }) => (
    <td className={cn('px-4 py-2 text-sm font-body', className)} {...props}>{children}</td>
  ),
  blockquote: ({ node, children, className, ...props }) => (
    <blockquote className={cn('my-4 pl-4 italic border-l-2 border-ink bg-paper', className)} {...props}>
      {children}
    </blockquote>
  ),
  input: ({ node, type, checked, className, ...props }) => {
    if (type !== 'checkbox') return <input type={type} checked={checked} className={className} {...props} />;
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center mr-2 flex-shrink-0 w-3.5 h-3.5 align-middle rounded-sm border',
          checked ? 'border-ink' : 'border-divider',
          className
        )}
        style={{ cursor: 'default', position: 'relative', top: '-1px' }}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3L3.5 5.5L8 1" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    );
  },
  code: ({ node, className, ...props }) => {
    const inline = node?.position?.start.line === node?.position?.end.line;
    if (!inline) return <code dir="ltr" className={className} {...props} />;
    return (
      <code
        dir="ltr"
        className={cn('rounded px-1.5 py-0.5 font-mono text-sm bg-muted-100 text-ink border border-divider', className)}
        {...props}
      />
    );
  },

  // ── Code / pre block ────────────────────────────────────────────────────────
  pre: ({ node, className, children }) => {
    // Detect language from child code element
    let language = 'text';
    if (isValidElement(children) && children.props?.className) {
      const match = children.props.className.match(/language-(\S+)/);
      if (match) language = match[1];
    } else if (typeof node?.properties?.className === 'string') {
      language = node.properties.className.replace('language-', '');
    }

    // Extract code string
    let code = '';
    if (isValidElement(children) && children.props && typeof children.props.children === 'string') {
      code = children.props.children;
    } else if (typeof children === 'string') {
      code = children;
    }

    // ── Special language handlers ────────────────────────────────────────────

    if (language === 'mermaid') return <MermaidBlock code={code} />;
    if (language === 'quiz') return <QuizBlock code={code} />;
    if (language === 'flashcards') return <FlashcardBlock code={code} />;
    if (language === 'mindmap') return <MindmapBlock code={code} />;

    // ── file:filename.ext — explicit file download card ──────────────────────
    if (language?.startsWith('file:')) {
      const filename = language.replace('file:', '').trim() || 'untitled.txt';
      return <FileBlock code={code} filename={filename} />;
    }

    // ── Auto-promote large, complete code blocks to FileBlock ────────────────
    // This handles cases where the AI generated a full file but forgot the file: prefix.
    const { promote, filename: autoFilename } = shouldAutoPromoteToFile(language, code);
    if (promote && autoFilename) {
      return <FileBlock code={code} filename={autoFilename} autoPromoted />;
    }

    // ── Default: syntax-highlighted code block ───────────────────────────────
    return (
      <CodeBlock code={code} language={language} dir="ltr">
        <CodeBlockCopyButton onCopy={() => {}} onError={() => {}} />
      </CodeBlock>
    );
  },
};

// ─── Response component ────────────────────────────────────────────────────────
export const Response = memo(({
  className,
  options,
  children,
  allowedImagePrefixes,
  allowedLinkPrefixes,
  defaultOrigin,
  parseIncompleteMarkdown: shouldParseIncompleteMarkdown = true,
  ...props
}) => {
  const parsedChildren =
    typeof children === 'string' && shouldParseIncompleteMarkdown
      ? parseIncompleteMarkdown(children)
      : children;

  return (
    <div className={cn('text-wrap', className)} {...props}>
      <HardenedMarkdown
        allowedImagePrefixes={allowedImagePrefixes ?? ['*']}
        allowedLinkPrefixes={allowedLinkPrefixes ?? ['*']}
        components={components}
        defaultOrigin={defaultOrigin}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath, remarkHighlightMark]}
        {...options}
      >
        {parsedChildren}
      </HardenedMarkdown>
    </div>
  );
}, (prevProps, nextProps) => prevProps.children === nextProps.children);

Response.displayName = 'Response';