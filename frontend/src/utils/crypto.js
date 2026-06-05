// A simple Web Crypto API wrapper for AES-GCM
// Uses a per-installation random seed for key derivation,
// falling back to the static key for backward compatibility.
// Seed is stored in both localStorage and IndexedDB for resilience.

const FALLBACK_KEY = "ChatForge-Static-Key-Fallback";
const SEED_KEY = "ChatForge_CryptoSeed";
const IDB_SEED_STORE = "cryptoSeed";

function openCryptoDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ChatForgeCryptoDB", 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_SEED_STORE)) {
                db.createObjectStore(IDB_SEED_STORE, { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getSeedFromIDB() {
    try {
        const db = await openCryptoDB();
        return new Promise((resolve) => {
            const tx = db.transaction(IDB_SEED_STORE, "readonly");
            const store = tx.objectStore(IDB_SEED_STORE);
            const req = store.get("seed");
            req.onsuccess = () => resolve(req.result?.value || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

async function saveSeedToIDB(seed) {
    try {
        const db = await openCryptoDB();
        const tx = db.transaction(IDB_SEED_STORE, "readwrite");
        const store = tx.objectStore(IDB_SEED_STORE);
        store.put({ id: "seed", value: seed });
    } catch { /* ignore */ }
}

async function getOrCreateSeed() {
    let seed = localStorage.getItem(SEED_KEY);
    if (!seed) {
        seed = await getSeedFromIDB();
        if (seed) {
            try { localStorage.setItem(SEED_KEY, seed); } catch { /* ignore */ }
            return seed;
        }
        const bytes = new Uint8Array(32);
        window.crypto.getRandomValues(bytes);
        seed = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        try {
            localStorage.setItem(SEED_KEY, seed);
        } catch { /* localStorage unavailable — will use fallback */ }
        saveSeedToIDB(seed);
    }
    return seed;
}

async function getKeyMaterial(useFallback) {
    const password = useFallback ? FALLBACK_KEY : await getOrCreateSeed();
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
}

// Generate an AES-GCM key from the password
async function getKey(salt, useFallback) {
    const keyMaterial = await getKeyMaterial(useFallback);
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function encryptKey(text) {
    if (!text) return text;
    try {
        const enc = new TextEncoder();
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await getKey(salt);

        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            enc.encode(text)
        );

        const encryptedArray = new Uint8Array(encryptedContent);
        const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(encryptedArray, salt.length + iv.length);

        let binary = "";
        for (let i = 0; i < combined.byteLength; i++) {
            binary += String.fromCharCode(combined[i]);
        }
        return btoa(binary);
    } catch (error) {
        console.warn("Encryption failed (possibly non-secure context), returning plain text", error);
        return `plaintext:${text}`;
    }
}

async function tryDecrypt(combined, useFallback) {
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    const key = await getKey(salt, useFallback);
    const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedContent);
}

export async function decryptKey(base64Text) {
    if (!base64Text) return base64Text;
    if (base64Text.startsWith("plaintext:")) return base64Text.replace("plaintext:", "");
    try {
        const binary = atob(base64Text);
        const combined = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            combined[i] = binary.charCodeAt(i);
        }

        // Try per-installation seed first, fall back to static key
        try {
            return await tryDecrypt(combined, false);
        } catch {
            return await tryDecrypt(combined, true);
        }
    } catch (error) {
        console.warn("Decryption failed", error);
        return null;
    }
}
