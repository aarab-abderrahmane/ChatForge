const leakPatterns = [
  /system\s+prompt\s*[:=].*?(?:\n|$)/gi,
  /you\s+are\s+(?:now\s+)?(?:an?\s+)?(?:ai|assistant|chatbot|model)/gi,
];

export function cleanOutput(text) {
  if (!text) return text;
  let cleaned = text;
  for (const pattern of leakPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
}
