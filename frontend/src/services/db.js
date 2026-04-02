import { encryptKey, decryptKey } from '../utils/crypto';

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
        return decrypted;
    },
    getStatus: async () => {
        const keys = await idb.get(stores.KEYS, 'user_keys') || {};
        return {
            openrouter: !!keys.openrouter,
            groq: !!keys.groq,
            gemini: !!keys.gemini,
            huggingface: !!keys.huggingface,
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

export const ConversationsService = {
    saveConversation: async (conv) => await idb.put(stores.CONVERSATIONS, conv),
    getConversation: async (id) => await idb.get(stores.CONVERSATIONS, id),
    getAllConversations: async () => await idb.getAll(stores.CONVERSATIONS),
    deleteConversation: async (id) => await idb.delete(stores.CONVERSATIONS, id),
};

export const ProjectsService = {
    saveProject: async (project) => await idb.put(stores.PROJECTS, project),
    getProject: async (id) => await idb.get(stores.PROJECTS, id),
    getAllProjects: async () => await idb.getAll(stores.PROJECTS),
    deleteProject: async (id) => await idb.delete(stores.PROJECTS, id),
};
