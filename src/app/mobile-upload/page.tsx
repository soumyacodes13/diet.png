'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload, Check, AlertCircle, RefreshCw, Layers } from 'lucide-react';

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function MobileUploadContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic');
  
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('image/')) {
        setErrorMessage('Please select a valid image file.');
        setStatus('error');
        return;
      }
      
      // Limit to 15MB (ntfy.sh free limit)
      if (selectedFile.size > 15 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 15MB limit.');
        setStatus('error');
        return;
      }

      setFile(selectedFile);
      uploadFile(selectedFile);
    }
  };

  const uploadFile = async (selectedFile: File) => {
    if (!topic) {
      setErrorMessage('No connection topic found. Please scan the QR code again.');
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setProgress(0);

    try {
      // 1. Send start signal
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: `upload_start:${selectedFile.name}:${selectedFile.size}`
      });

      // 2. Perform raw binary upload with XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      
      xhr.open('PUT', `https://ntfy.sh/${topic}`);
      
      // Set filename headers
      xhr.setRequestHeader('Filename', selectedFile.name);
      xhr.setRequestHeader('X-Filename', encodeURIComponent(selectedFile.name));
      xhr.setRequestHeader('Content-type', selectedFile.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus('success');
        } else {
          handleUploadError('Server returned status: ' + xhr.status);
        }
      };

      xhr.onerror = () => {
        handleUploadError('Network connection failed.');
      };

      xhr.send(selectedFile);

    } catch (err: any) {
      handleUploadError(err.message || 'Failed to start upload.');
    }
  };

  const handleUploadError = async (message: string) => {
    setErrorMessage(message);
    setStatus('error');
    if (topic) {
      try {
        await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          body: `upload_error:${message}`
        });
      } catch (e) {
        // ignore secondary error reporting failure
      }
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setStatus('idle');
    setFile(null);
    setProgress(0);
  };

  const resetPage = () => {
    setStatus('idle');
    setFile(null);
    setProgress(0);
    setErrorMessage('');
  };

  if (!topic) {
    return (
      <div className="neo-card p-6 bg-retro-pink border-4 border-black shadow-[6px_6px_0px_0px_#000] max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 stroke-[3px] text-black mx-auto mb-4" />
        <h3 className="text-xl font-heading font-black uppercase mb-2">Invalid Session</h3>
        <p className="text-sm font-bold text-black/70 mb-4">
          The topic parameter is missing. Please scan the QR code on your computer screen.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto px-4 flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Brand logo at top */}
      <div className="flex items-center gap-3 justify-center mt-6">
        <div className="bg-retro-yellow border-4 border-black p-2 shadow-[3px_3px_0px_0px_#000] rotate-[-2deg] flex items-center justify-center">
          <Layers className="w-6.5 h-6.5 stroke-[3px] text-black" />
        </div>
        <h1 className="text-3xl font-heading font-black tracking-tight lowercase select-none flex items-center gap-1">
          diet<span className="bg-retro-orange text-black px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] inline-block rotate-[1.5deg]">.png</span>
        </h1>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {status === 'idle' && (
        <div
          onClick={handleSelectClick}
          className="neo-card p-8 bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] text-center cursor-pointer hover:bg-neutral-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[4px_4px_0px_0px_#000] transition-all flex flex-col items-center justify-center min-h-[300px] select-none"
        >
          <div className="bg-retro-yellow border-4 border-black p-5 mb-6 shadow-[4px_4px_0px_0px_#000] rotate-[-1deg] inline-flex items-center justify-center">
            <Upload className="w-12 h-12 stroke-[3px] text-black" />
          </div>
          <h2 className="text-2xl font-heading font-black uppercase mb-3 tracking-tight">
            Tap to Select Image
          </h2>
          <p className="text-xs font-bold text-black/60 max-w-[240px] leading-relaxed">
            Take a photo with your camera or select an existing picture from your library.
          </p>
        </div>
      )}

      {status === 'uploading' && (
        <div className="neo-card p-6 bg-retro-blue border-4 border-black shadow-[6px_6px_0px_0px_#000] text-black flex flex-col gap-6 select-none">
          <div className="flex items-center gap-4">
            <div className="bg-white border-4 border-black p-3 shadow-[3px_3px_0px_0px_#000] flex-shrink-0 animate-spin">
              <RefreshCw className="w-6 h-6 stroke-[3px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-black uppercase text-lg leading-tight truncate">
                Uploading...
              </h3>
              <p className="text-xs font-bold text-black/75 truncate mt-0.5">
                {file?.name}
              </p>
              <p className="text-[10px] font-mono font-bold text-black/50 mt-0.5">
                {file && formatBytes(file.size)}
              </p>
            </div>
          </div>

          <div className="w-full bg-white border-4 border-black p-1 shadow-[3px_3px_0px_0px_#000] relative">
            <div
              className="bg-retro-orange h-6 border-r-4 border-black transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-black">
              {progress}%
            </span>
          </div>

          <button
            onClick={cancelUpload}
            className="w-full py-2.5 bg-white text-black font-heading font-black uppercase text-xs border-4 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer text-center"
          >
            Cancel Upload
          </button>
        </div>
      )}

      {status === 'success' && (
        <div className="neo-card p-6 bg-retro-green border-4 border-black shadow-[6px_6px_0px_0px_#000] text-black flex flex-col items-center justify-center text-center gap-6 min-h-[300px] select-none">
          <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] rotate-[-2deg] inline-flex items-center justify-center">
            <Check className="w-12 h-12 stroke-[4px] text-green-600" />
          </div>
          <div>
            <h3 className="text-2xl font-heading font-black uppercase mb-2">Upload Complete!</h3>
            <p className="text-sm font-bold text-black/70 max-w-[260px] leading-relaxed">
              Check your computer screen. The image should load automatically.
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="neo-card p-6 bg-retro-pink border-4 border-black shadow-[6px_6px_0px_0px_#000] text-black flex flex-col items-center justify-center text-center gap-6 min-h-[300px] select-none">
          <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] rotate-[1.5deg] inline-flex items-center justify-center">
            <AlertCircle className="w-12 h-12 stroke-[3px] text-red-600" />
          </div>
          <div>
            <h3 className="text-2xl font-heading font-black uppercase mb-2">Upload Failed</h3>
            <p className="text-xs font-mono font-bold text-red-700 bg-white/40 border border-black/10 p-2 max-w-[260px] break-all leading-normal">
              {errorMessage}
            </p>
          </div>
          <button
            onClick={resetPage}
            className="px-6 py-2.5 bg-white text-black font-heading font-black uppercase text-xs border-4 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

    </div>
  );
}

export default function MobileUploadPage() {
  return (
    <div className="min-h-screen bg-[#F4F4F0] bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:20px_20px] flex items-center justify-center py-12">
      <Suspense fallback={
        <div className="neo-card p-6 bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] flex items-center gap-3">
          <RefreshCw className="w-5 h-5 stroke-[3px] animate-spin text-black" />
          <span className="font-heading font-black uppercase text-sm">Loading...</span>
        </div>
      }>
        <MobileUploadContent />
      </Suspense>
    </div>
  );
}
