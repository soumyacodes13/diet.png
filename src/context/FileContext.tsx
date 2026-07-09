'use client';

import React, { createContext, useContext, useState } from 'react';

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  targetFormat: 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'svg' | 'gif';
  quality: number;
  targetSizeKb?: number;
  status: 'idle' | 'converting' | 'success' | 'error';
  errorMessage?: string;
  convertedUrl?: string;
  convertedFileName?: string;
  convertedSize?: number;
  convertedBlob?: Blob;
  originalFile?: File;
  originalPreviewUrl?: string;
}

interface FileContextType {
  item: QueueItem | null;
  setItem: React.Dispatch<React.SetStateAction<QueueItem | null>>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<QueueItem | null>(null);
  return (
    <FileContext.Provider value={{ item, setItem }}>
      {children}
    </FileContext.Provider>
  );
}

export function useFiles() {
  const context = useContext(FileContext);
  if (!context) throw new Error('useFiles must be used within FileProvider');
  return context;
}
