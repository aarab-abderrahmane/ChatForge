"use client";
import { createContext, useContext, useState, useCallback, useRef } from "react";

const ArtifactContext = createContext(null);

export function ArtifactProvider({ children }) {
  const [files, setFiles] = useState([]);
  const fileIdCounter = useRef(0);

  const addFile = useCallback((sessionId, { filename, content, mime, size, messageId }) => {
    const id = `artifact-${++fileIdCounter.current}`;
    const file = { id, sessionId, filename, content, mime, size, messageId, timestamp: Date.now() };
    setFiles(prev => [...prev, file]);
    return id;
  }, []);

  const clearFiles = useCallback((sessionId) => {
    setFiles(prev => sessionId ? prev.filter(f => f.sessionId !== sessionId) : []);
  }, []);

  const getFiles = useCallback((sessionId) => {
    return sessionId ? files.filter(f => f.sessionId === sessionId) : files;
  }, [files]);

  return (
    <ArtifactContext.Provider value={{ files, addFile, clearFiles, getFiles }}>
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifacts() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error("useArtifacts must be used within an ArtifactProvider");
  return ctx;
}
