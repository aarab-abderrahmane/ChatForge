import { checkInjection } from './injectionGuard.js';

export async function processMessage(userMessage) {
  try {
    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      return { type: 'passthrough' };
    }

    const guardResult = checkInjection(userMessage);
    if (guardResult.blocked) {
      return { type: 'blocked', originalMessage: userMessage };
    }

    return { type: 'passthrough' };
  } catch (err) {
    console.error('[Middleware] Error:', err);
    return { type: 'passthrough' };
  }
}
