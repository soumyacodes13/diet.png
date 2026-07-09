'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileImage, Smartphone, Wifi, X, AlertCircle, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import FileDropzone from '@/components/FileDropzone';
import { useFiles } from '@/context/FileContext';
import QRCode from 'qrcode';

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function Home() {
  const router = useRouter();
  const { setItem } = useFiles();

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
    // 1. Reset and close any active connection
    if (evSourceRef.current) {
      evSourceRef.current.close();
    }

    setShowMobilePanel(true);
    setMobileState('generating');
    setErrorMsg('');

    // Generate topic ID
    const topicId = 'nexconvert_' + Array.from({ length: 12 }, () => Math.random().toString(36)[2]).join('');

    try {
      // 2. Determine base URL (handles local dev network environments)
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

      // 3. Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(mobileUrl, { width: 220, margin: 1 });
      setQrCodeUrl(qrDataUrl);
      setMobileState('listening');

      // 4. Connect to SSE
      const evSource = new EventSource(`https://ntfy.sh/${topicId}/sse`);
      evSourceRef.current = evSource;

      evSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'message' && data.message) {
            try {
              const signal = JSON.parse(data.message);
              if (signal.type === 'upload_start') {
                setIncomingFileName(signal.name || 'image');
                setIncomingFileSize(signal.size || 0);
                setMobileState('uploading');
              } else if (signal.type === 'upload_error') {
                setErrorMsg(signal.message || 'Unknown upload error');
                setMobileState('error');
              } else if (signal.type === 'upload_complete') {
                setMobileState('processing');
                try {
                  const pageUrl = signal.url;
                  const fileName = signal.name || 'image.jpg';

                  // 1. Fetch the HTML page to scrape the dynamic direct download URL
                  const pageRes = await fetch(pageUrl);
                  if (!pageRes.ok) throw new Error('Transit server returned ' + pageRes.status);
                  const html = await pageRes.text();

                  // 2. Extract direct link using regex
                  const dlMatch = html.match(/href="(https:\/\/tmpfiles\.org\/dl\/[^"]+)"/);
                  if (!dlMatch) throw new Error('Download session expired or file format unsupported.');
                  const directUrl = dlMatch[1];

                  // 3. Fetch the actual raw file bytes
                  const fileRes = await fetch(directUrl);
                  if (!fileRes.ok) throw new Error('Download from file server failed.');
                  const blob = await fileRes.blob();
                  const finalFile = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

                  const previewUrl = URL.createObjectURL(finalFile);
                  const newItem = {
                    id: `${finalFile.name}-${finalFile.size}-${Date.now()}`,
                    file: finalFile,
                    name: finalFile.name,
                    size: finalFile.size,
                    previewUrl: previewUrl,
                    targetFormat: 'webp' as const,
                    quality: 90,
                    status: 'idle' as const,
                    originalFile: finalFile,
                    originalPreviewUrl: previewUrl,
                  };

                  setItem(newItem);
                  if (evSourceRef.current) {
                    evSourceRef.current.close();
                    evSourceRef.current = null;
                  }
                  router.push('/convert');
                } catch (fetchErr: any) {
                  console.error('Error downloading synced file:', fetchErr);
                  setErrorMsg(fetchErr.message || 'Failed to download sync file.');
                  setMobileState('error');
                }
              }
            } catch (jsonErr) {
              console.warn('Non-JSON message received on SSE stream:', jsonErr);
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
  }, [router, setItem]);

  useEffect(() => {
    return () => {
      if (evSourceRef.current) {
        evSourceRef.current.close();
      }
    };
  }, []);

  const handleFilesAdded = useCallback(
    (files: FileList | File[]) => {
      const filesArray = Array.from(files);
      const allowedTypes = ['image/'];
      
      const firstFile = filesArray.find((file) => {
        return allowedTypes.some(type => file.type.startsWith(type));
      });

      if (firstFile) {
        const previewUrl = URL.createObjectURL(firstFile);
        const newItem = {
          id: `${firstFile.name}-${firstFile.size}-${Date.now()}`,
          file: firstFile,
          name: firstFile.name,
          size: firstFile.size,
          previewUrl: previewUrl,
          targetFormat: 'webp' as const,
          quality: 90,
          status: 'idle' as const,
          originalFile: firstFile,
          originalPreviewUrl: previewUrl,
        };

        setItem(newItem);
        router.push('/convert');
      }
    },
    [setItem, router]
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F4F4F0] bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:20px_20px]">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-center gap-8 animate-in fade-in duration-300">
        {/* Intro Banner */}
        <div className="neo-card p-8 bg-retro-blue text-black relative overflow-hidden shadow-[6px_6px_0px_0px_#000]">
          <div className="absolute right-[-10px] bottom-[-20px] opacity-15 pointer-events-none rotate-12">
            <FileImage className="w-64 h-64 text-black" />
          </div>

          <div className="relative z-10 flex flex-col gap-4">
            <span className="bg-retro-yellow text-black text-xs font-black uppercase tracking-wider px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#000] self-start inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 fill-black" />
              Private & Serverless
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-black lowercase tracking-tight leading-none text-black">
              diet.png
            </h2>
            <p className="text-sm sm:text-base font-bold text-black/80 max-w-2xl leading-relaxed">
              Convert, compress, and resize images locally in your browser. Files remain entirely private (mobile sync files are encrypted and automatically deleted in 60 mins).
            </p>
          </div>
        </div>

        {/* Core Workspace Dropzone */}
        <div className="flex flex-col gap-6">
          <FileDropzone onFilesAdded={handleFilesAdded} />

          {/* New Mobile Upload Sync Section */}
          {!showMobilePanel ? (
            <div
              onClick={enableMobileUpload}
              className="neo-card p-5 bg-retro-yellow hover:bg-retro-yellow/90 border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer flex items-center justify-between select-none"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white border-4 border-black p-2.5 shadow-[3px_3px_0px_0px_#000] rotate-[-2deg] flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 stroke-[3px] text-black" />
                </div>
                <div>
                  <h3 className="font-heading font-black uppercase text-sm sm:text-base tracking-tight text-black">
                    Scan to Upload from Phone
                  </h3>
                  <p className="text-xs font-bold text-black/60 mt-0.5 leading-tight">
                    Upload an image directly from your mobile camera or library.
                  </p>
                </div>
              </div>
              <span className="text-xl font-black mr-2 select-none">➔</span>
            </div>
          ) : (
            <div className="neo-card p-6 bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] flex flex-col md:flex-row gap-6 relative animate-in zoom-in-95 duration-200">
              
              <button
                onClick={disableMobileUpload}
                className="absolute top-4 right-4 p-1 hover:bg-neutral-100 border border-transparent hover:border-black transition-all cursor-pointer inline-flex items-center justify-center"
                title="Close Mobile Sync"
              >
                <X className="w-5 h-5 stroke-[2.5px]" />
              </button>

              {/* QR Code Graphic Frame */}
              <div className="flex flex-col items-center justify-center flex-shrink-0">
                <div className="relative border-4 border-black p-3 bg-white shadow-[4px_4px_0px_0px_#000] w-[200px] h-[200px] flex items-center justify-center overflow-hidden select-none">
                  {mobileState === 'listening' && qrCodeUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCodeUrl} alt="Upload QR Code" className="w-full h-full object-contain" />
                      <div className="absolute left-0 right-0 h-1 bg-retro-green shadow-[0_0_8px_#00e676] animate-scan z-10" />
                    </>
                  ) : mobileState === 'idle' || mobileState === 'generating' ? (
                    <div className="flex flex-col items-center justify-center text-center gap-2">
                      <RefreshCw className="w-8 h-8 stroke-[3px] animate-spin text-black/40" />
                      <span className="text-xs font-bold text-black/50">Generating QR...</span>
                    </div>
                  ) : mobileState === 'uploading' ? (
                    <div className="flex flex-col items-center justify-center text-center gap-3">
                      <div className="bg-retro-blue border-4 border-black p-4 shadow-[3px_3px_0px_0px_#000] animate-pulse">
                        <Smartphone className="w-8 h-8 stroke-[3px] text-white" />
                      </div>
                      <span className="text-[10px] font-heading font-black uppercase tracking-wider text-black">Receiving File...</span>
                    </div>
                  ) : mobileState === 'processing' ? (
                    <div className="flex flex-col items-center justify-center text-center gap-3">
                      <RefreshCw className="w-8 h-8 stroke-[3px] animate-spin text-black" />
                      <span className="text-[10px] font-heading font-black uppercase tracking-wider text-black">Processing...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center gap-2 p-2">
                      <AlertCircle className="w-8 h-8 stroke-[2.5px] text-retro-pink" />
                      <span className="text-[9px] font-mono font-bold text-retro-pink line-clamp-3 leading-tight">{errorMsg}</span>
                      <button
                        onClick={enableMobileUpload}
                        className="px-2 py-1 bg-retro-yellow text-black border border-black shadow-[1.5px_1.5px_0px_0px_#000] text-[9px] font-heading font-black uppercase hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none transition-all cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Guide Contents */}
              <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                <div className="flex flex-col gap-3">
                  <span className="bg-retro-blue text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] self-start inline-flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5" />
                    Serverless Sync
                  </span>

                  <h3 className="font-heading font-black text-xl uppercase tracking-tight leading-none text-black">
                    {mobileState === 'listening' && "Scan to Upload"}
                    {mobileState === 'uploading' && "Upload in Progress"}
                    {mobileState === 'processing' && "Almost Done!"}
                    {mobileState === 'error' && "Sync Connection Error"}
                  </h3>

                  <div className="text-xs font-bold text-black/75 leading-relaxed">
                    {mobileState === 'listening' && (
                      <ol className="list-decimal pl-4 flex flex-col gap-1.5">
                        <li>Scan the QR code with your phone's camera.</li>
                        <li>Tap the screen to select a picture or capture a photo.</li>
                        <li>Keep this page open while the file transfers over Wi-Fi/LTE.</li>
                      </ol>
                    )}
                    {mobileState === 'uploading' && (
                      <div className="flex flex-col gap-2 bg-neutral-50 border-4 border-black p-3 shadow-[3px_3px_0px_0px_#000] rotate-[-0.5deg]">
                        <span className="font-mono text-black font-black block truncate">File: {incomingFileName}</span>
                        <span className="font-mono text-black/60 block">Size: {incomingFileSize ? formatBytes(incomingFileSize) : 'Calculating...'}</span>
                        <span className="text-[10px] font-heading font-black text-retro-blue animate-pulse uppercase tracking-wider flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 stroke-[3px] animate-spin" />
                          Uploading directly from phone...
                        </span>
                      </div>
                    )}
                    {mobileState === 'processing' && (
                      <p className="max-w-md">Downloading file and preparing it for converter. Please hold on...</p>
                    )}
                    {mobileState === 'error' && (
                      <p className="max-w-md text-red-500 font-mono font-bold">
                        Failed to maintain serverless socket subscription. Please try refreshing or click Retry to generate a new scan session.
                      </p>
                    )}
                  </div>
                </div>

                {/* Connection Status Badge */}
                <div className="flex items-center gap-2 mt-4 select-none">
                  <span className={`w-3 h-3 border border-black shadow-[1px_1px_0px_0px_#000] rounded-full inline-block ${
                    mobileState === 'listening' ? 'bg-retro-yellow animate-pulse' :
                    mobileState === 'uploading' ? 'bg-retro-blue animate-pulse' :
                    mobileState === 'processing' ? 'bg-retro-green animate-pulse' :
                    'bg-retro-pink'
                  }`} />
                  <span className="text-[10px] font-heading font-black uppercase tracking-wider text-black/40">
                    {mobileState === 'listening' && "Waiting for mobile connection..."}
                    {mobileState === 'uploading' && "Receiving file bytes..."}
                    {mobileState === 'processing' && "Retrieving file payload..."}
                    {mobileState === 'error' && "Disconnected"}
                  </span>
                </div>

              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

