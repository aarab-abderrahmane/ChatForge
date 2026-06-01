"use client";
import { createContext, useContext, useState, useCallback, useRef } from "react";

const ArtifactContext = createContext(null);

export function ArtifactProvider({ children, sessionId }) {
  const [files, setFiles] = useState([]);
  const fileIdCounter = useRef(0);

  const upsertFile = useCallback((_sessionId, { filename, content, mime, size, messageId }) => {
    const id = `artifact-${++fileIdCounter.current}`;
    const sid = _sessionId ?? sessionId;
    const file = { id, sessionId: sid, filename, content, mime, size, messageId, timestamp: Date.now() };
    setFiles(prev => {
      const dupIdx = prev.findIndex(f =>
        f.sessionId === sid && f.filename === filename
      );
      if (dupIdx !== -1) {
        const next = [...prev];
        next[dupIdx] = file;
        return next;
      }
      return [...prev, file];
    });
    return id;
  }, [sessionId]);

  const removeFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFiles = useCallback((clearSessionId) => {
    setFiles(prev => clearSessionId ? prev.filter(f => f.sessionId !== clearSessionId) : []);
  }, []);

  const getFiles = useCallback((sid) => {
    const targetId = sid ?? sessionId;
    return targetId ? files.filter(f => f.sessionId === targetId) : files;
  }, [files, sessionId]);

  return (
    <ArtifactContext.Provider value={{ files, sessionId, upsertFile, removeFile, clearFiles, getFiles }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifacts() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error("useArtifacts must be used within an ArtifactProvider");
  return ctx;
}
