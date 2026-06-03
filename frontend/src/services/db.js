import { encryptKey, decryptKey } from '../utils/crypto';
import LZString from 'lz-string';

const DB_NAME = 'ChatForgeDB';
const DB_VERSION = 1;

export const stores = {
    KEYS: 'keys',
    CONVERSATIONS: 'conversations',
    PROJECTS: 'projects',
};

// Open DB
export const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(stores.KEYS)) {
                db.createObjectStore(stores.KEYS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(stores.CONVERSATIONS)) {
                const store = db.createObjectStore(stores.CONVERSATIONS, { keyPath: 'id' });
                store.createIndex('project_id', 'project_id', { unique: false });
            }
            if (!db.objectStoreNames.contains(stores.PROJECTS)) {
                db.createObjectStore(stores.PROJECTS, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

// ── Write-ahead log ──────────────────────────────────────────────
const batchQueue = [];
let batchTimer = null;
const BATCH_FLUSH_MS = 30_000;

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { flushBatch(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushBatch();
    });
}

function scheduleBatchFlush() {
    if (batchTimer) return;
    batchTimer = setTimeout(async () => {
        batchTimer = null;
        await flushBatch();
    }, BATCH_FLUSH_MS);
}

async function flushBatch() {
    const items = batchQueue.splice(0);
    if (!items.length) return;

    const groups = {};
    for (const { storeName, value } of items) {
        if (!groups[storeName]) groups[storeName] = [];
        groups[storeName].push(value);
    }

    const db = await openDB();
    const tx = db.transaction(Object.keys(groups), 'readwrite');
    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        for (const [storeName, values] of Object.entries(groups)) {
            const store = tx.objectStore(storeName);
            for (const value of values) {
                store.put(value);
            }
        }
    });
}

export const idb = {
    get: async (storeName, id) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    getAll: async (storeName) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    put: async (storeName, value) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    putBatch: async (storeName, value) => {
        batchQueue.push({ storeName, value });
        scheduleBatchFlush();
    },
    flushBatch: async () => {
        if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
        }
        await flushBatch();
    },
    getQueueLength: () => batchQueue.length,
    delete: async (storeName, id) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};

export const KeysService = {
    saveKeys: async (keys) => {
        const encrypted = { id: 'user_keys' };
        if (keys.openrouter) encrypted.openrouter = await encryptKey(keys.openrouter);
        if (keys.groq) encrypted.groq = await encryptKey(keys.groq);
        if (keys.gemini) encrypted.gemini = await encryptKey(keys.gemini);
        if (keys.huggingface) encrypted.huggingface = await encryptKey(keys.huggingface);
        if (keys.together) encrypted.together = await encryptKey(keys.together);
        if (keys.mistral) encrypted.mistral = await encryptKey(keys.mistral);

        const existing = await idb.get(stores.KEYS, 'user_keys') || {};
        await idb.put(stores.KEYS, { ...existing, ...encrypted });
    },
    getKeys: async () => {
        const encrypted = await idb.get(stores.KEYS, 'user_keys') || {};
        const decrypted = {};
        if (encrypted.openrouter) decrypted.openrouter = await decryptKey(encrypted.openrouter);
        if (encrypted.groq) decrypted.groq = await decryptKey(encrypted.groq);
        if (encrypted.gemini) decrypted.gemini = await decryptKey(encrypted.gemini);
        if (encrypted.huggingface) decrypted.huggingface = await decryptKey(encrypted.huggingface);
        if (encrypted.together) decrypted.together = await decryptKey(encrypted.together);
        if (encrypted.mistral) decrypted.mistral = await decryptKey(encrypted.mistral);
        return decrypted;
    },
    getStatus: async () => {
        const keys = await idb.get(stores.KEYS, 'user_keys') || {};
        return {
            openrouter: !!keys.openrouter,
            groq: !!keys.groq,
            gemini: !!keys.gemini,
            huggingface: !!keys.huggingface,
            together: !!keys.together,
            mistral: !!keys.mistral,
        };
    },
    /**
     * Migrate any legacy keys from localStorage to the new encrypted IndexedDB store.
     * Called on app mount. Safe to call multiple times (idempotent).
     */
    migrateLegacyKeys: async () => {
        try {
            // Check if already migrated
            const existing = await idb.get(stores.KEYS, 'user_keys');
            if (existing) return; // Already has keys in IDB, nothing to do

            // Look for legacy plaintext key in localStorage
            const legacyKey = localStorage.getItem('ChatForge_APIKey') ||
                localStorage.getItem('openrouter_key') ||
                localStorage.getItem('APIKey');

            if (legacyKey) {
                const cleanKey = legacyKey.trim();
                if (cleanKey) {
                    // Detect provider from key format
                    const provider = cleanKey.startsWith('gsk_') ? 'groq' :
                        cleanKey.startsWith('AIza') ? 'gemini' : 'openrouter';
                    await KeysService.saveKeys({ [provider]: cleanKey });
                    // Clean up old localStorage entry
                    localStorage.removeItem('ChatForge_APIKey');
                    localStorage.removeItem('openrouter_key');
                    localStorage.removeItem('APIKey');
                    console.log(`[ChatForge] Migrated legacy ${provider} key to secure storage.`);
                }
            }
        } catch (err) {
            console.warn('[ChatForge] Key migration skipped:', err.message);
        }
    },
};

export const StorageService = {
    getUsage: async () => {
        if (!navigator.storage || !navigator.storage.estimate) {
            return { used: 0, quota: 0, percentage: 0 };
        }
        const { usage, quota } = await navigator.storage.estimate();
        return {
            used: usage || 0,
            quota: quota || 0,
            percentage: quota ? ((usage / quota) * 100).toFixed(2) : 0
        };
    }
};

// ── Compression helpers ─────────────────────────────────────────
const COMPRESS_MSG_THRESHOLD = 50;
const COMPRESS_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function shouldCompress(session) {
    if (session._compressed) return false;
    const msgCount = session.messages?.length || 0;
    if (msgCount > COMPRESS_MSG_THRESHOLD) return true;
    const age = Date.now() - new Date(session.createdAt || 0).getTime();
    return age > COMPRESS_AGE_MS;
}

function compressSession(session) {
    if (!session || session._compressed) return session;
    try {
        const compressed = LZString.compress(JSON.stringify(session.messages || []));
        return { ...session, messages: compressed, _compressed: true };
    } catch {
        return session;
    }
}

function decompressSession(session) {
    if (!session || !session._compressed) return session;
    try {
        const decompressed = JSON.parse(LZString.decompress(session.messages));
        return { ...session, messages: decompressed, _compressed: false };
    } catch {
        return { ...session, messages: [], _compressed: false };
    }
}

export const ConversationsService = {
    saveConversation: async (conv) => {
        const toSave = shouldCompress(conv) ? compressSession(conv) : conv;
        await idb.putBatch(stores.CONVERSATIONS, toSave);
    },
    getConversation: async (id) => {
        const raw = await idb.get(stores.CONVERSATIONS, id);
        return raw ? decompressSession(raw) : raw;
    },
    getAllConversations: async () => {
        const raw = await idb.getAll(stores.CONVERSATIONS);
        return raw.map(decompressSession);
    },
    deleteConversation: async (id) => await idb.delete(stores.CONVERSATIONS, id),
    flushBatch: async () => await idb.flushBatch(),
};

export const ProjectsService = {
    saveProject: async (project) => await idb.put(stores.PROJECTS, project),
    getProject: async (id) => await idb.get(stores.PROJECTS, id),
    getAllProjects: async () => await idb.getAll(stores.PROJECTS),
    deleteProject: async (id) => await idb.delete(stores.PROJECTS, id),
};
