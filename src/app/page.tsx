'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileImage } from 'lucide-react';
import Header from '@/components/Header';
import FileDropzone from '@/components/FileDropzone';
import { useFiles } from '@/context/FileContext';

export default function Home() {
  const router = useRouter();
  const { setItem } = useFiles();

  const handleFilesAdded = useCallback(
    (files: FileList | File[]) => {
      const filesArray = Array.from(files);
      const allowedTypes = ['image/'];
      
      const firstFile = filesArray.find((file) => {
        return allowedTypes.some(type => file.type.startsWith(type));
      });

      if (firstFile) {
        const newItem = {
          id: `${firstFile.name}-${firstFile.size}-${Date.now()}`,
          file: firstFile,
          name: firstFile.name,
          size: firstFile.size,
          previewUrl: URL.createObjectURL(firstFile),
          targetFormat: 'webp' as const,
          quality: 90,
          status: 'idle' as const,
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
              100% Client-Side
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-black lowercase tracking-tight leading-none text-black">
              diet.png
            </h2>
            <p className="text-sm sm:text-base font-bold text-black/80 max-w-2xl leading-relaxed">
              Convert, compress, and resize images locally in your browser. No files are uploaded to any servers, keeping your data entirely private.
            </p>
          </div>
        </div>

        {/* Core Workspace Dropzone */}
        <div className="flex flex-col gap-6">
          <FileDropzone onFilesAdded={handleFilesAdded} />
        </div>
      </main>
    </div>
  );
}
