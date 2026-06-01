import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';

SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('rb', ruby);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('cs', csharp);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('dockerfile', docker);
SyntaxHighlighter.registerLanguage('docker', docker);

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

export default function LazyHighlight({ code, language, showLineNumbers }) {
  return (
    <SyntaxHighlighter
      codeTagProps={{ className: 'font-mono' }}
      customStyle={{
        margin: 0,
        padding: '1rem',
        background: 'transparent',
        fontSize: '0.82rem',
        lineHeight: '1.6',
      }}
      language={language}
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
  );
}