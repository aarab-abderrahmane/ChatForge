import { create, insert, search } from '@orama/orama'

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 80;
const TOP_K = 3;

let db = null;

function chunkText(text, filename) {
  const chunks = [];
  let start = 0;
  let index = 0;
  let safety = 10000;

  while (start < text.length && safety-- > 0) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start + CHUNK_SIZE / 2) {
        end = boundary;
      }
    }

    chunks.push({
      filename,
      chunkIndex: index,
      text: text.slice(start, end),
    });

    index++;
    start = end - CHUNK_OVERLAP;
    if (start >= text.length || text.length - start <= 1 || text.length - start <= CHUNK_OVERLAP) break;
  }

  return chunks;
}

async function getDb() {
  if (!db) {
    db = await create({
      schema: {
        filename: 'string',
        chunkIndex: 'number',
        text: 'string',
      },
    });
  }
  return db;
}

export async function indexFiles(files) {
  const textFiles = files.filter(f => !f.isImage);
  if (!textFiles.length) return;

  db = await create({
    schema: {
      filename: 'string',
      chunkIndex: 'number',
      text: 'string',
    },
  });

  for (const file of textFiles) {
    const chunks = chunkText(file.content, file.name);
    for (const chunk of chunks) {
      await insert(db, chunk);
    }
  }

}

export async function searchRelevant(query, topK = TOP_K) {
  if (!db) return [];

  try {
    const results = await search(db, {
      term: query,
      properties: ['text'],
    });

    return results.hits.slice(0, topK).map(hit => ({
      filename: hit.document.filename,
      text: hit.document.text,
      score: hit.score,
    }));
  } catch {
    return [];
  }
}

export function clearRAGIndex() {
  db = null;
}

export async function buildRAGBlock(files, question) {
  const textFiles = files.filter(f => !f.isImage);
  if (!textFiles.length) return '';

  if (!question) {
    let block = '=== ATTACHED FILES ===\nThe user has attached the following file(s) for you to read and work with:\n\n';
    for (const file of textFiles) {
      const content = file.content.slice(0, 4000);
      block += `--- File: ${file.name} (${file.sizeKB}KB, ${file.type || 'text'}) ---\n`;
      block += content;
      if (file.content.length > 4000) block += '\n[...]';
      block += '\n--- End of file ---\n\n';
    }
    block += 'INSTRUCTIONS FOR FILES:\n' +
      '- Treat the above file content as the source of truth for any questions about it.\n' +
      '- If the user asks to edit, improve, or analyze the file, base your response on its actual content.\n' +
      '- If you generate a modified version, output it as a downloadable file block: ```file:filename.ext\n```\n\n';
    return block;
  }

  try {
    await indexFiles(files);
    const hits = await searchRelevant(question);

    if (hits.length === 0) {
      let block = '=== ATTACHED FILES ===\n';
      for (const file of textFiles) {
        const content = file.content.slice(0, 4000);
        block += `--- File: ${file.name} (${file.sizeKB}KB, ${file.type || 'text'}) ---\n`;
        block += content;
        if (file.content.length > 4000) block += '\n[...]';
        block += '\n--- End of file ---\n\n';
      }
      block += 'INSTRUCTIONS FOR FILES:\n' +
        '- Treat the above file content as the source of truth for any questions about it.\n' +
        '- If the user asks to edit, improve, or analyze the file, base your response on its actual content.\n' +
        '- If you generate a modified version, output it as a downloadable file block: ```file:filename.ext\n```\n\n';
      return block;
    }

    const fileList = [...new Set(hits.map(h => h.filename))];

    let block = '=== RELEVANT FILE SECTIONS ===\n';
    block += 'The following sections from your attached files are most relevant to your question:\n\n';

    for (const hit of hits) {
      block += `--- From: ${hit.filename} ---\n`;
      block += hit.text.trim();
      block += '\n--- End of section ---\n\n';
    }

    if (textFiles.length > fileList.length) {
      const omitted = textFiles.filter(f => !fileList.includes(f.name)).map(f => f.name);
      block += `[${omitted.length} file(s) not shown — their content was not relevant to your question: ${omitted.join(', ')}]\n\n`;
    }

    block += 'INSTRUCTIONS:\n' +
      '- The above sections are the most relevant parts of your attached files for this question.\n' +
      '- Base your response on these sections as the source of truth.\n' +
      '- If you cannot answer from the provided sections, say so.\n\n';

    return block;
  } catch {
    return '';
  }
}
