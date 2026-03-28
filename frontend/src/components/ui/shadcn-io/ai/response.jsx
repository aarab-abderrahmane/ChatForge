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
import { isValidElement, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { CodeBlock, CodeBlockCopyButton } from './code-block';
import { MermaidBlock } from './mermaid-block';
import { QuizBlock } from './quiz-block';
import 'katex/dist/katex.min.css';
import hardenReactMarkdown from 'harden-react-markdown';


/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
function parseIncompleteMarkdown(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;

  // Handle incomplete links and images
  // Pattern: [...] or ![...] where the closing ] is missing
  const linkImagePattern = /(!?\[)([^\]]*?)$/;
  const linkMatch = result.match(linkImagePattern);
  if (linkMatch) {
    // If we have an unterminated [ or ![, remove it and everything after
    const startIndex = result.lastIndexOf(linkMatch[1]);
    result = result.substring(0, startIndex);
  }

  // Handle incomplete bold formatting (**)
  const boldPattern = /(\*\*)([^*]*?)$/;
  const boldMatch = result.match(boldPattern);
  if (boldMatch) {
    // Count the number of ** in the entire string
    const asteriskPairs = (result.match(/\*\*/g) || []).length;
    // If odd number of **, we have an incomplete bold - complete it
    if (asteriskPairs % 2 === 1) {
      result = `${result}**`;
    }
  }

  // Handle incomplete italic formatting (__)
  const italicPattern = /(__)([^_]*?)$/;
  const italicMatch = result.match(italicPattern);
  if (italicMatch) {
    // Count the number of __ in the entire string
    const underscorePairs = (result.match(/__/g) || []).length;
    // If odd number of __, we have an incomplete italic - complete it
    if (underscorePairs % 2 === 1) {
      result = `${result}__`;
    }
  }

  // Handle incomplete single asterisk italic (*)
  const singleAsteriskPattern = /(\*)([^*]*?)$/;
  const singleAsteriskMatch = result.match(singleAsteriskPattern);
  if (singleAsteriskMatch) {
    // Count single asterisks that aren't part of **
    const singleAsterisks = result.split('').reduce((acc, char, index) => {
      if (char === '*') {
        // Check if it's part of a ** pair
        const prevChar = result[index - 1];
        const nextChar = result[index + 1];
        if (prevChar !== '*' && nextChar !== '*') {
          return acc + 1;
        }
      }
      return acc;
    }, 0);

    // If odd number of single *, we have an incomplete italic - complete it
    if (singleAsterisks % 2 === 1) {
      result = `${result}*`;
    }
  }

  // Handle incomplete single underscore italic (_)
  const singleUnderscorePattern = /(_)([^_]*?)$/;
  const singleUnderscoreMatch = result.match(singleUnderscorePattern);
  if (singleUnderscoreMatch) {
    // Count single underscores that aren't part of __
    const singleUnderscores = result.split('').reduce((acc, char, index) => {
      if (char === '_') {
        // Check if it's part of a __ pair
        const prevChar = result[index - 1];
        const nextChar = result[index + 1];
        if (prevChar !== '_' && nextChar !== '_') {
          return acc + 1;
        }
      }
      return acc;
    }, 0);

    // If odd number of single _, we have an incomplete italic - complete it
    if (singleUnderscores % 2 === 1) {
      result = `${result}_`;
    }
  }

  // Handle incomplete inline code blocks (`) - but avoid code blocks (```)
  const inlineCodePattern = /(`)([^`]*?)$/;
  const inlineCodeMatch = result.match(inlineCodePattern);
  if (inlineCodeMatch) {
    // Check if we're dealing with a code block (triple backticks)
    const hasCodeBlockStart = result.includes('```');
    const codeBlockPattern = /```[\s\S]*?```/g;
    const completeCodeBlocks = (result.match(codeBlockPattern) || []).length;
    const allTripleBackticks = (result.match(/```/g) || []).length;

    // If we have an odd number of ``` sequences, we're inside an incomplete code block
    // In this case, don't complete inline code
    const insideIncompleteCodeBlock = allTripleBackticks % 2 === 1;

    if (!insideIncompleteCodeBlock) {
      // Count the number of single backticks that are NOT part of triple backticks
      let singleBacktickCount = 0;
      for (let i = 0; i < result.length; i++) {
        if (result[i] === '`') {
          // Check if this backtick is part of a triple backtick sequence
          const isTripleStart = result.substring(i, i + 3) === '```';
          const isTripleMiddle =
            i > 0 && result.substring(i - 1, i + 2) === '```';
          const isTripleEnd = i > 1 && result.substring(i - 2, i + 1) === '```';

          if (!(isTripleStart || isTripleMiddle || isTripleEnd)) {
            singleBacktickCount++;
          }
        }
      }

      // If odd number of single backticks, we have an incomplete inline code - complete it
      if (singleBacktickCount % 2 === 1) {
        result = `${result}\``;
      }
    }
  }

  // Handle incomplete strikethrough formatting (~~)
  const strikethroughPattern = /(~~)([^~]*?)$/;
  const strikethroughMatch = result.match(strikethroughPattern);
  if (strikethroughMatch) {
    // Count the number of ~~ in the entire string
    const tildePairs = (result.match(/~~/g) || []).length;
    // If odd number of ~~, we have an incomplete strikethrough - complete it
    if (tildePairs % 2 === 1) {
      result = `${result}~~`;
    }
  }

  return result;
}

// Create a hardened version of ReactMarkdown
const HardenedMarkdown = hardenReactMarkdown(ReactMarkdown);

const components = {
  // Lists
  ol: ({ node, children, className, ...props }) => (
    <ol
      className={cn('ml-5 list-outside list-decimal space-y-1 my-2', className)}
      style={{ color: 'rgba(200,255,192,0.85)' }}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ node, children, className, ...props }) => (
    <li className={cn('py-0.5 leading-relaxed', className)} {...props}>
      {children}
    </li>
  ),
  ul: ({ node, children, className, ...props }) => (
    <ul
      className={cn('ml-5 list-outside list-disc space-y-1 my-2', className)}
      style={{ color: 'rgba(200,255,192,0.85)' }}
      {...props}
    >
      {children}
    </ul>
  ),

  // Horizontal rule
  hr: ({ node, className, ...props }) => (
    <hr
      className={cn('my-5', className)}
      style={{ borderColor: 'rgba(57,255,20,0.2)' }}
      {...props}
    />
  ),

  // Bold
  strong: ({ node, children, className, ...props }) => (
    <span
      className={cn('font-bold', className)}
      style={{ color: '#39ff14', textShadow: '0 0 8px rgba(57,255,20,0.4)' }}
      {...props}
    >
      {children}
    </span>
  ),

  // Italic
  em: ({ node, children, className, ...props }) => (
    <em
      className={cn('italic', className)}
      style={{ color: 'rgba(0,245,255,0.85)' }}
      {...props}
    >
      {children}
    </em>
  ),

  // Strikethrough
  del: ({ node, children, className, ...props }) => (
    <del
      className={cn('line-through', className)}
      style={{ color: 'rgba(255,45,120,0.7)' }}
      {...props}
    >
      {children}
    </del>
  ),

  // Links
  a: ({ node, children, className, ...props }) => (
    <a
      className={cn('underline decoration-dashed underline-offset-2 transition-all', className)}
      style={{ color: '#00f5ff' }}
      onMouseEnter={e => (e.target.style.textShadow = '0 0 8px rgba(0,245,255,0.8)')}
      onMouseLeave={e => (e.target.style.textShadow = 'none')}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),

  // Headings
  h1: ({ node, children, className, ...props }) => (
    <h1
      className={cn('mt-6 mb-3 font-bold text-2xl', className)}
      style={{ color: '#39ff14', textShadow: '0 0 12px rgba(57,255,20,0.5)', borderBottom: '1px solid rgba(57,255,20,0.2)', paddingBottom: '0.4rem' }}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ node, children, className, ...props }) => (
    <h2
      className={cn('mt-5 mb-2 font-bold text-xl', className)}
      style={{ color: '#39ff14', textShadow: '0 0 10px rgba(57,255,20,0.4)' }}
      {...props}
    >
      # {children}
    </h2>
  ),
  h3: ({ node, children, className, ...props }) => (
    <h3
      className={cn('mt-4 mb-2 font-semibold text-lg', className)}
      style={{ color: '#00f5ff', textShadow: '0 0 8px rgba(0,245,255,0.4)' }}
      {...props}
    >
      ## {children}
    </h3>
  ),
  h4: ({ node, children, className, ...props }) => (
    <h4
      className={cn('mt-4 mb-1 font-semibold text-base', className)}
      style={{ color: '#00f5ff' }}
      {...props}
    >
      ### {children}
    </h4>
  ),
  h5: ({ node, children, className, ...props }) => (
    <h5
      className={cn('mt-3 mb-1 font-semibold', className)}
      style={{ color: 'rgba(200,255,192,0.8)' }}
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ node, children, className, ...props }) => (
    <h6
      className={cn('mt-3 mb-1 font-semibold text-sm', className)}
      style={{ color: 'rgba(200,255,192,0.6)' }}
      {...props}
    >
      {children}
    </h6>
  ),

  // Tables
  table: ({ node, children, className, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(57,255,20,0.2)' }}>
      <table
        className={cn('w-full border-collapse', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ node, children, className, ...props }) => (
    <thead
      className={cn('', className)}
      style={{ background: 'rgba(57,255,20,0.08)', borderBottom: '1px solid rgba(57,255,20,0.25)' }}
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ node, children, className, ...props }) => (
    <tbody className={cn('', className)} {...props}>
      {children}
    </tbody>
  ),
  tr: ({ node, children, className, ...props }) => (
    <tr
      className={cn('', className)}
      style={{ borderBottom: '1px solid rgba(57,255,20,0.1)' }}
      {...props}
    >
      {children}
    </tr>
  ),
  th: ({ node, children, className, ...props }) => (
    <th
      className={cn('px-4 py-2 text-left font-bold text-xs tracking-widest uppercase', className)}
      style={{ color: '#00f5ff' }}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ node, children, className, ...props }) => (
    <td
      className={cn('px-4 py-2 text-sm', className)}
      style={{ color: 'rgba(200,255,192,0.85)' }}
      {...props}
    >
      {children}
    </td>
  ),

  // Blockquote
  blockquote: ({ node, children, className, ...props }) => (
    <blockquote
      className={cn('my-4 pl-4 italic', className)}
      style={{
        borderLeft: '3px solid rgba(0,245,255,0.5)',
        color: 'rgba(0,245,255,0.7)',
        background: 'rgba(0,245,255,0.04)',
        borderRadius: '0 6px 6px 0',
        padding: '8px 16px',
      }}
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Task list checkbox
  input: ({ node, type, checked, className, ...props }) => {
    if (type !== 'checkbox') {
      return <input type={type} checked={checked} className={className} {...props} />;
    }
    return (
      <span
        className="inline-flex items-center justify-center mr-2 flex-shrink-0"
        style={{
          width: 14,
          height: 14,
          border: `1px solid ${checked ? '#39ff14' : 'rgba(57,255,20,0.35)'}`,
          borderRadius: 3,
          background: checked ? 'rgba(57,255,20,0.18)' : 'transparent',
          boxShadow: checked ? '0 0 6px rgba(57,255,20,0.4)' : 'none',
          verticalAlign: 'middle',
          cursor: 'default',
          display: 'inline-flex',
          position: 'relative',
          top: '-1px',
        }}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3L3.5 5.5L8 1" stroke="#39ff14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    );
  },

  // Inline code
  code: ({ node, className, ...props }) => {
    const inline = node?.position?.start.line === node?.position?.end.line;
    if (!inline) {
      return <code className={className} {...props} />;
    }
    return (
      <code
        className={cn('rounded px-1.5 py-0.5 font-mono text-sm', className)}
        style={{
          background: 'rgba(57,255,20,0.1)',
          color: '#39ff14',
          border: '1px solid rgba(57,255,20,0.2)',
        }}
        {...props}
      />
    );
  },

  // Code block via <pre> — with mermaid detection
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
    if (
      isValidElement(children) &&
      children.props &&
      typeof children.props.children === 'string'
    ) {
      code = children.props.children;
    } else if (typeof children === 'string') {
      code = children;
    }

    // Render mermaid diagrams inline
    if (language === 'mermaid') {
      return <MermaidBlock code={code} />;
    }

    // Render quiz blocks inline
    if (language === 'quiz') {
      return <QuizBlock code={code} />;
    }

    return (
      <CodeBlock code={code} language={language}>
        <CodeBlockCopyButton
          onCopy={() => { }}
          onError={() => { }}
        />
      </CodeBlock>
    );
  },
};

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
  // Parse the children to remove incomplete markdown tokens if enabled
  const parsedChildren =
    typeof children === 'string' && shouldParseIncompleteMarkdown
      ? parseIncompleteMarkdown(children)
      : children;

  return (
    <div
      className={cn('text-wrap', className)}
      {...props}>
      <HardenedMarkdown
        allowedImagePrefixes={allowedImagePrefixes ?? ['*']}
        allowedLinkPrefixes={allowedLinkPrefixes ?? ['*']}
        components={components}
        defaultOrigin={defaultOrigin}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
        {...options}>
        {parsedChildren}
      </HardenedMarkdown>
    </div>
  );
}, (prevProps, nextProps) => prevProps.children === nextProps.children);

Response.displayName = 'Response';
