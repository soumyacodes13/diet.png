'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

interface FileDropzoneProps {
  onFilesAdded: (files: FileList | File[]) => void;
}

export default function FileDropzone({ onFilesAdded }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdded(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
      className={`relative w-full py-12 px-6 flex flex-col items-center justify-center text-center cursor-pointer select-none rounded-none neo-card transition-all duration-200 ${
        isDragActive
          ? 'bg-retro-yellow/20 translate-x-[4px] translate-y-[4px] shadow-[2px_2px_0px_0px_#000]'
          : 'bg-white hover:bg-neutral-50/50 shadow-neo'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      <div className="bg-retro-yellow border-4 border-black p-4 mb-4 shadow-[4px_4px_0px_0px_#000] rotate-[-1deg] inline-flex items-center justify-center">
        <UploadCloud className="w-10 h-10 stroke-[3px] text-black" />
      </div>

      <h3 className="text-xl sm:text-2xl font-heading font-black tracking-tight uppercase mb-2">
        Drag & Drop files here
      </h3>
      <p className="text-sm font-bold text-black/70 max-w-sm mb-4">
        or click to browse your computer
      </p>

      {/* Styled upload button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // Avoid triggering parent div click
          onButtonClick();
        }}
        className="px-6 py-2.5 bg-retro-orange text-black font-heading font-black uppercase text-sm border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer inline-flex items-center gap-2"
      >
        <ImageIcon className="w-4 h-4 stroke-[3px]" />
        Choose Files
      </button>
    </div>
  );
}
