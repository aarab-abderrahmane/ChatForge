"use client";
import { createContext, useContext, useState, useCallback, useRef } from "react";

const ArtifactContext = createContext(null);

export function ArtifactProvider({ children, sessionId }) {
  const [files, setFiles] = useState([]);
  const [trash, setTrash] = useState({});
  const fileIdCounter = useRef(0);

  const upsertFile = useCallback((_sessionId, { filename, content, mime, size, messageId }) => {
    const sid = _sessionId || sessionId;
    if (!sid) return;
    const id = `artifact-${++fileIdCounter.current}`;
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
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        setTrash(t => ({
          ...t,
          [file.sessionId]: { ...(t[file.sessionId] || {}), [file.filename]: file },
        }));
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback((clearSessionId) => {
    setFiles(prev => clearSessionId ? prev.filter(f => f.sessionId !== clearSessionId) : []);
  }, []);

  const removeFileByFilename = useCallback((sid, filename) => {
    const targetId = sid ?? sessionId;
    if (!targetId) return;
    setFiles(prev => {
      const file = prev.find(f => f.sessionId === targetId && f.filename === filename);
      if (file) {
        setTrash(t => ({
          ...t,
          [targetId]: { ...(t[targetId] || {}), [filename]: file },
        }));
      }
      return prev.filter(f => !(f.sessionId === targetId && f.filename === filename));
    });
  }, [sessionId]);

  const getFiles = useCallback((sid) => {
    const targetId = sid ?? sessionId;
    return targetId ? files.filter(f => f.sessionId === targetId) : files;
  }, [files, sessionId]);

  return (
    <ArtifactContext.Provider value={{ files, sessionId, upsertFile, removeFile, clearFiles, removeFileByFilename, getFiles, trash }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifacts() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error("useArtifacts must be used within an ArtifactProvider");
  return ctx;
}
