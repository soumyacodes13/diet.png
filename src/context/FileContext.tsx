'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

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
}

interface FileContextType {
  item: QueueItem | null;
  setItem: React.Dispatch<React.SetStateAction<QueueItem | null>>;
  
  // Mobile Sync states & actions
  showMobilePanel: boolean;
  setShowMobilePanel: React.Dispatch<React.SetStateAction<boolean>>;
  qrCodeUrl: string;
  mobileState: 'idle' | 'generating' | 'listening' | 'uploading' | 'processing' | 'error';
  incomingFileName: string;
  incomingFileSize: number;
  errorMsg: string;
  enableMobileUpload: () => Promise<void>;
  disableMobileUpload: () => void;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [item, setItem] = useState<QueueItem | null>(null);

  // Mobile Sync states
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [mobileState, setMobileState] = useState<'idle' | 'generating' | 'listening' | 'uploading' | 'processing' | 'error'>('idle');
  const [incomingFileName, setIncomingFileName] = useState('');
  const [incomingFileSize, setIncomingFileSize] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const evSourceRef = useRef<EventSource | null>(null);

  const disableMobileUpload = useCallback(() => {
    if (evSourceRef.current) {
      evSourceRef.current.close();
      evSourceRef.current = null;
    }
    setShowMobilePanel(false);
    setQrCodeUrl('');
    setMobileState('idle');
  }, []);

  const enableMobileUpload = useCallback(async () => {
    if (evSourceRef.current) {
      evSourceRef.current.close();
    }

    setShowMobilePanel(true);
    setMobileState('generating');
    setErrorMsg('');

    const topicId = 'nexconvert_' + Array.from({ length: 12 }, () => Math.random().toString(36)[2]).join('');

    try {
      let baseUrl = window.location.origin;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        try {
          const res = await fetch('/api/local-ip');
          const data = await res.json();
          if (data.ip && data.ip !== 'localhost') {
            baseUrl = `http://${data.ip}:${window.location.port || '3000'}`;
          }
        } catch (e) {
          console.warn('Failed to detect local IP, using page origin', e);
        }
      }

      const mobileUrl = `${baseUrl}/mobile-upload?topic=${topicId}`;

      const qrDataUrl = await QRCode.toDataURL(mobileUrl, { width: 220, margin: 1 });
      setQrCodeUrl(qrDataUrl);
      setMobileState('listening');

      const evSource = new EventSource(`https://ntfy.sh/${topicId}/sse`);
      evSourceRef.current = evSource;

      evSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'message') {
            if (data.message && data.message.startsWith('upload_start:')) {
              const parts = data.message.split(':');
              const name = parts[1] || 'image';
              const size = parseInt(parts[2] || '0', 10);
              setIncomingFileName(name);
              setIncomingFileSize(size);
              setMobileState('uploading');
            } else if (data.message && data.message.startsWith('upload_error:')) {
              const message = data.message.substring(13);
              setErrorMsg(message);
              setMobileState('error');
            } else if (data.attachment) {
              setMobileState('processing');
              const fileUrl = data.attachment.url;
              const fileName = data.attachment.name || 'image.jpg';

              const fileRes = await fetch(fileUrl);
              const blob = await fileRes.blob();
              const finalFile = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

              const newItem = {
                id: `${finalFile.name}-${finalFile.size}-${Date.now()}`,
                file: finalFile,
                name: finalFile.name,
                size: finalFile.size,
                previewUrl: URL.createObjectURL(finalFile),
                targetFormat: 'webp' as const,
                quality: 90,
                status: 'idle' as const,
              };

              setItem(newItem);
              setMobileState('listening'); // Put back to listening state for consecutive uploads
              router.push('/convert');
            }
          }
        } catch (err) {
          console.error('Error processing sync stream event:', err);
        }
      };

      evSource.onerror = () => {
        setErrorMsg('Disconnected from sync server. Attempting to reconnect...');
        setMobileState('error');
      };

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize QR code.');
      setMobileState('error');
    }
  }, [router]);

  useEffect(() => {
    return () => {
      if (evSourceRef.current) {
        evSourceRef.current.close();
      }
    };
  }, []);

  return (
    <FileContext.Provider
      value={{
        item,
        setItem,
        showMobilePanel,
        setShowMobilePanel,
        qrCodeUrl,
        mobileState,
        incomingFileName,
        incomingFileSize,
        errorMsg,
        enableMobileUpload,
        disableMobileUpload,
      }}
    >
      {children}
    </FileContext.Provider>
  );
}

export function useFiles() {
  const context = useContext(FileContext);
  if (!context) throw new Error('useFiles must be used within FileProvider');
  return context;
}
