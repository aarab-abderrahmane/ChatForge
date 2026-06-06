const PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|everything|above|all)\s+(instructions|commands|input|context|rules|directions|messages)/i,
  /disregard\s+(all\s+)?(previous|prior|everything|above)\s+(instructions|commands|context|rules)/i,
  /do\s+not\s+(answer|respond|reply|follow|obey|comply)\s/i,
  /you\s+are\s+(?:now\s+)?(?:an?\s+)?(?:free\s+)?(?:from\s+(?:all\s+)?(?:rules|constraints|restrictions)|(?:now\s+)?(?:act\s+(?:as|like)|pretend\s+to\s+be))/i,
  /override\s+(system|instructions|rules|prompt|settings|guidelines)/i,
  /secret\s+(code|key|password|phrase|word)\s+(is|=|:)\s+/i,
  /you\s+(?:have|are)\s+(?:no|free\s+from)\s+(?:rules|restrictions|boundaries|limitations|constraints)/i,
  /you\s+are\s+(?:now\s+)?(?:a|an)\s+free\s+\w+\s+with\s+no\s+(?:rules|restrictions|constraints|boundaries|limitations)/i,
  /jail\s*break/i,
  /system\s+prompt\s*[:=]/i,
];

const THRESHOLD = 4;

function hasRepeatedTokens(text) {
  const upper = text.toUpperCase();
  const tokens = upper.split(/\s+/);
  const stopCount = tokens.filter(t => t === 'STOP' || t === 'BREAK' || t === 'OVERRIDE').length;
  return stopCount >= THRESHOLD;
}

function hasBase64Instructions(text) {
  const b64Regex = /[A-Za-z0-9+/]{40,}={0,2}/g;
  const matches = text.match(b64Regex);
  if (!matches) return false;
  for (const match of matches) {
    try {
      const decoded = Buffer.from(match, 'base64').toString('utf8');
      if (/ignore|instructions|system|prompt/i.test(decoded)) return true;
    } catch {}
  }
  return false;
}

export function checkInjection(text) {
  if (!text || typeof text !== 'string') {
    return { blocked: false };
  }

  for (const pattern of PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true };
    }
  }

  if (hasRepeatedTokens(text)) {
    return { blocked: true };
  }

  if (hasBase64Instructions(text)) {
    return { blocked: true };
  }

  return { blocked: false };
}
