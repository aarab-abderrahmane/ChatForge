// A simple Web Crypto API wrapper for AES-GCM
// Generates a static key or uses a password-derived key.

const ENCRYPTION_KEY = "ChatForge-Static-Key-Fallback";

async function getKeyMaterial() {
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey(
        "raw",
        enc.encode(ENCRYPTION_KEY),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
}

// Generate an AES-GCM key from the password
async function getKey(salt) {
    const keyMaterial = await getKeyMaterial();
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

        // Convert to base64 safely
        let binary = "";
        for (let i = 0; i < combined.byteLength; i++) {
            binary += String.fromCharCode(combined[i]);
        }
        return btoa(binary);
    } catch (error) {
        console.warn("Encryption failed (possibly non-secure context), returning plain text", error);
        return `plaintext:${text}`; // Fallback to easily identifiable plaintext if crypto fails
    }
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
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const data = combined.slice(28);

        const key = await getKey(salt);
        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            data
        );

        const dec = new TextDecoder();
        return dec.decode(decryptedContent);
    } catch (error) {
        console.warn("Decryption failed", error);
        return base64Text;
    }
}
