'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Download, Play, Check, AlertCircle, RefreshCw, FileText, Settings, X, Crop as CropIcon } from 'lucide-react';
import Header from '@/components/Header';
import { useFiles, QueueItem } from '@/context/FileContext';
import { convertImage } from '@/utils/converter';
import ReactCrop, { type Crop as ReactImageCrop, type PixelCrop } from 'react-image-crop';
import { getCroppedImg } from '@/utils/crop';
import 'react-image-crop/dist/ReactCrop.css';


export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function ConvertPage() {
  const router = useRouter();
  const { item, setItem } = useFiles();

  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [customFileName, setCustomFileName] = useState<string>('');
  const fileNameInitialized = React.useRef(false);

  // Crop states
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [crop, setCrop] = useState<ReactImageCrop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    
    // Initial crop in percentage
    const percentWidth = 80;
    const percentHeight = aspect ? percentWidth / aspect : 80;
    
    // Make sure height doesn't exceed 80%
    const finalPercentHeight = Math.min(percentHeight, 80);
    const finalPercentWidth = aspect ? finalPercentHeight * aspect : percentWidth;
    
    const initialCrop = {
      unit: '%' as const,
      x: (100 - finalPercentWidth) / 2,
      y: (100 - finalPercentHeight) / 2,
      width: finalPercentWidth,
      height: finalPercentHeight,
    };
    
    setCrop(initialCrop);
    
    // Set completed crop in pixels
    const pixelWidth = (finalPercentWidth / 100) * width;
    const pixelHeight = (finalPercentHeight / 100) * height;
    setCompletedCrop({
      unit: 'px',
      x: ((100 - finalPercentWidth) / 200) * width,
      y: ((100 - finalPercentHeight) / 200) * height,
      width: pixelWidth,
      height: pixelHeight,
    });
  }, [aspect]);

  const handleSaveCrop = useCallback(async () => {
    if (!item || !imgRef.current || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) return;

    try {
      const croppedFile = await getCroppedImg(imgRef.current, completedCrop, item.name);
      
      // Revoke old object URL
      URL.revokeObjectURL(item.previewUrl);
      if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);

      setItem((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          file: croppedFile,
          size: croppedFile.size,
          previewUrl: URL.createObjectURL(croppedFile),
          status: 'idle' as const,
          convertedUrl: undefined,
          convertedFileName: undefined,
          convertedSize: undefined,
          convertedBlob: undefined,
        };
      });

      setIsCropModalOpen(false);
    } catch (err) {
      console.error('Failed to crop image:', err);
    }
  }, [item, completedCrop, setItem]);


  // Initialize custom filename only once when item is first loaded
  useEffect(() => {
    if (item && !fileNameInitialized.current) {
      const nameWithoutExt = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
      setCustomFileName(nameWithoutExt);
      fileNameInitialized.current = true;
    }
  }, [item]);

  // Redirect to home if empty
  useEffect(() => {
    if (!item) {
      router.push('/');
    }
  }, [item, router]);

  // Sync actual converted size to estimated size once done
  useEffect(() => {
    if (item?.status === 'success' && item.convertedSize) {
      setEstimatedSize(item.convertedSize);
    }
  }, [item?.status, item?.convertedSize]);

  // Background estimated size calculation on quality/format changes
  useEffect(() => {
    if (!item || item.status === 'converting') return;

    const estimate = async () => {
      setIsEstimating(true);
      try {
        const result = await convertImage(item.file, {
          targetFormat: item.targetFormat as any,
          quality: item.quality,
          targetSizeKb: item.targetSizeKb,
        });
        setEstimatedSize(result.blob.size);
        URL.revokeObjectURL(result.url); // prevent memory leak of object urls
      } catch (err) {
        setEstimatedSize(null);
      } finally {
        setIsEstimating(false);
      }
    };

    // Debounce the calculation by 150ms
    const timer = setTimeout(() => {
      estimate();
    }, 150);

    return () => clearTimeout(timer);
  }, [item?.targetFormat, item?.quality, item?.targetSizeKb, item?.file, item?.status]);

  const handleClear = useCallback(() => {
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
      if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
    }
    setCustomFileName('');
    setItem(null);
    router.push('/');
  }, [item, setItem, router]);

  const updateOptions = useCallback((options: Partial<Pick<QueueItem, 'targetFormat' | 'quality' | 'targetSizeKb'>>) => {
    setItem((prev) => {
      if (!prev) return null;
      
      const wasSuccess = prev.status === 'success';
      const status = wasSuccess ? 'success' : (prev.status === 'error' ? 'idle' : prev.status);
      
      if (wasSuccess && prev.convertedUrl) {
        URL.revokeObjectURL(prev.convertedUrl);
      }

      return {
        ...prev,
        ...options,
        status,
        convertedUrl: undefined,
        convertedFileName: undefined,
        convertedSize: undefined,
        convertedBlob: undefined,
      };
    });
  }, [setItem]);

  const handleConvert = useCallback(async () => {
    if (!item || item.status === 'converting') return;

    setItem((prev) => (prev ? { ...prev, status: 'converting' } : null));

    try {
      const result = await convertImage(item.file, {
        targetFormat: item.targetFormat as any,
        quality: item.quality,
        targetSizeKb: item.targetSizeKb,
      });

      setItem((prev) =>
        prev
          ? {
              ...prev,
              status: 'success',
              convertedUrl: result.url,
              convertedFileName: result.fileName,
              convertedSize: result.blob.size,
              convertedBlob: result.blob,
            }
          : null
      );
    } catch (error: any) {
      setItem((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              errorMessage: error.message || 'Conversion failed',
            }
          : null
      );
    }
  }, [item, setItem]);

  if (!item) return null;

  const isLossy = item.targetFormat === 'jpeg' || item.targetFormat === 'webp' || item.targetFormat === 'png' || item.targetFormat === 'gif';

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F4F4F0] bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:20px_20px]">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 flex flex-col gap-6 justify-center animate-in fade-in duration-300">
        {/* Navigation / Back Action */}
        <div>
          <button
            onClick={handleClear}
            className="px-4 py-2.5 bg-white text-black font-heading font-black uppercase text-xs border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4 stroke-[3px]" />
            Back to Upload
          </button>
        </div>

        {/* Two-Column Redesigned Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          
          {/* Column 1: Spacious File Preview & Metadata Details (2/5 Width) */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="neo-card p-6 bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] flex flex-col items-center gap-6">
              
              {/* Box Preview */}
              <div className="w-full aspect-square max-w-[220px] border-4 border-black bg-neutral-50 flex items-center justify-center overflow-hidden shadow-[4px_4px_0px_0px_#000] relative rotate-[-1deg]">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText className="w-16 h-16 text-black/30 stroke-[1.5px]" />
                )}
              </div>

              {/* Crop Button */}
              {item.status !== 'converting' && (
                <button
                  onClick={() => setIsCropModalOpen(true)}
                  className="px-4 py-2 bg-retro-yellow text-black font-heading font-black uppercase text-xs border-4 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer flex items-center gap-1.5 w-full justify-center rotate-[0.5deg] text-center"
                >
                  <CropIcon className="w-4 h-4 stroke-[3px]" />
                  Crop Original Image
                </button>
              )}


              {/* Data Table */}
              <div className="border-t-4 border-black pt-4 flex flex-col gap-2 w-full text-xs font-bold">
                <div className="flex justify-between border-b border-black/10 pb-1.5 min-w-0">
                  <span className="text-black/50 uppercase tracking-wider">File Name</span>
                  <span className="truncate max-w-[120px] text-right font-mono" title={item.name}>{item.name}</span>
                </div>
                <div className="flex justify-between border-b border-black/10 pb-1.5">
                  <span className="text-black/50 uppercase tracking-wider">Original Size</span>
                  <span className="font-mono">{formatBytes(item.size)}</span>
                </div>
                {estimatedSize !== null && (
                  <div className="flex justify-between border-b border-black/10 pb-1.5 animate-in fade-in">
                    <span className="text-black/50 uppercase tracking-wider">Est. Output Size</span>
                    <span className="font-mono text-black font-black text-xs flex items-center gap-1.5 justify-end">
                      {isEstimating && <RefreshCw className="w-2.5 h-2.5 stroke-[3px] animate-spin text-black/40" />}
                      ~{formatBytes(estimatedSize)}
                      {estimatedSize !== item.size && (
                        <span className={estimatedSize < item.size ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                          ({estimatedSize < item.size ? '-' : '+'}{Math.round(Math.abs((estimatedSize - item.size) / item.size) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pb-0.5">
                  <span className="text-black/50 uppercase tracking-wider">Format</span>
                  <span className="bg-retro-blue/20 text-black px-1.5 py-0.5 border border-black font-mono font-black uppercase text-[10px]">
                    {(item.file.type.split('/')[1] || item.name.split('.').pop() || 'IMAGE').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Preview Action (under data table) */}
              {item.status === 'success' && item.convertedUrl && (
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="w-full px-4 py-2.5 bg-retro-blue text-white font-heading font-black uppercase text-xs border-4 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                >
                  <FileText className="w-4 h-4 stroke-[3px]" />
                  Preview Converted Image
                </button>
              )}

            </div>
          </div>

          {/* Column 2: Configuration & Trigger Hub (3/5 Width) */}
          <div className="md:col-span-3 flex flex-col gap-6">
            <div className="neo-card p-6 bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] flex flex-col justify-between h-full gap-6">
              
              {/* Config Options */}
              <div className="flex flex-col gap-6">
                <h3 className="font-heading text-lg font-black uppercase text-black border-b-4 border-black pb-2 flex items-center gap-1.5">
                  <Settings className="w-5 h-5 stroke-[3px]" />
                  Settings
                </h3>

                 {/* Target Format Dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-black">Target Format</label>
                  <select
                    value={item.targetFormat}
                    onChange={(e) => updateOptions({ targetFormat: e.target.value as any })}
                    disabled={item.status === 'converting'}
                    className="bg-white text-black font-black border-4 border-black px-3 py-2 shadow-[3px_3px_0px_0px_#000] focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[2px_2px_0px_0px_#000] transition-all outline-none cursor-pointer text-sm w-full"
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WEBP</option>
                    <option value="bmp">BMP</option>
                    <option value="gif">GIF</option>
                    <option value="ico">ICO</option>
                    <option value="svg">SVG</option>
                  </select>
                </div>

                {/* Output Filename Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-black">Output Filename</label>
                  <div className="relative flex items-center w-full">
                    <input
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder="Enter filename"
                      disabled={item.status === 'converting'}
                      className="bg-white text-black font-black border-4 border-black px-3 py-2 pr-12 shadow-[3px_3px_0px_0px_#000] focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[2px_2px_0px_0px_#000] transition-all outline-none text-sm w-full font-mono"
                    />
                    <span className="absolute right-3 text-xs font-mono font-black text-black/50 select-none">
                      .{item.targetFormat}
                    </span>
                  </div>
                </div>

                {/* Range Sliders / Size settings */}
                {isLossy ? (
                  <div className="flex flex-col gap-4">
                    {/* Quality Slider */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-black">
                        <span>Compression Quality</span>
                        <span className={`bg-white px-2 py-0.5 border border-black shadow-[1.5px_1.5px_0px_0px_#000] font-mono text-xs font-black ${item.targetSizeKb !== undefined ? 'opacity-40' : ''}`}>
                          {item.targetSizeKb !== undefined ? 'Auto' : `${item.quality}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={item.quality}
                        onChange={(e) => updateOptions({ quality: parseInt(e.target.value) })}
                        disabled={item.status === 'converting' || item.targetSizeKb !== undefined}
                        className="w-full h-3 bg-neutral-100 border-2 border-black rounded-none appearance-none cursor-pointer accent-black disabled:opacity-30"
                      />
                    </div>

                    {/* Target Size constraints */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black uppercase tracking-wider text-black">Target File Size (KB)</label>
                      <div className="relative flex items-center w-full max-w-[200px]">
                        <input
                          type="number"
                          min="1"
                          placeholder="e.g. 150 (Optional)"
                          value={item.targetSizeKb ?? ''}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            const val = !isNaN(parsed) && parsed > 0 ? parsed : undefined;
                            updateOptions({ targetSizeKb: val });
                          }}
                          disabled={item.status === 'converting'}
                          className="bg-white text-black font-black border-4 border-black px-3 py-1.5 pr-8 shadow-[3px_3px_0px_0px_#000] focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[2px_2px_0px_0px_#000] transition-all outline-none text-sm w-full text-center"
                        />
                        {item.targetSizeKb !== undefined && (
                          <button
                            onClick={() => updateOptions({ targetSizeKb: undefined })}
                            disabled={item.status === 'converting'}
                            className="absolute right-2 text-black/50 hover:text-black cursor-pointer bg-transparent border-0 outline-none p-0 flex items-center justify-center"
                            title="Reset Size Constraint"
                          >
                            <RefreshCw className="w-3.5 h-3.5 stroke-[3px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#FFFCE3] border-4 border-black p-3 text-xs font-bold text-black flex items-center gap-2 shadow-[3px_3px_0px_0px_#000] rotate-[-0.5deg] select-none">
                    <AlertCircle className="w-4 h-4 text-black flex-shrink-0 stroke-[2.5px]" />
                    <span>Lossless format. Quality adjustments are disabled.</span>
                  </div>
                )}
              </div>

              {/* Status Indicator & Operations Banner */}
              <div className="flex flex-col gap-4 border-t-4 border-black pt-4">
                
                {/* Status Bar */}
                <div className="w-full">
                  {item.status === 'idle' && (
                    <span className="px-3 py-1.5 bg-retro-yellow text-black border-2 border-black font-heading text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] inline-block rotate-[-0.5deg]">
                      Ready to Convert
                    </span>
                  )}
                  {item.status === 'converting' && (
                    <span className="px-3 py-1.5 bg-retro-blue text-white border-2 border-black font-heading text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 w-fit">
                      <RefreshCw className="w-3.5 h-3.5 stroke-[3px] animate-spin" />
                      Converting...
                    </span>
                  )}
                  {item.status === 'success' && (
                    <div className="flex flex-col items-start gap-1">
                      <span className="px-3 py-1.5 bg-retro-green text-black border-2 border-black font-heading text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 rotate-[0.5deg]">
                        <Check className="w-3.5 h-3.5 stroke-[3.5px]" />
                        Success!
                      </span>
                      {item.convertedSize && (
                        <span className="text-xs font-mono font-bold text-black/60 mt-1">
                          Output: {formatBytes(item.convertedSize)} ({Math.round(((item.convertedSize - item.size) / item.size) * 100)}%)
                        </span>
                      )}
                    </div>
                  )}
                  {item.status === 'error' && (
                    <div className="flex flex-col items-start gap-1">
                      <span className="px-3 py-1.5 bg-retro-pink text-black border-2 border-black font-heading text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 stroke-[3px]" />
                        Failed
                      </span>
                      <span className="text-[10px] font-bold text-retro-pink font-mono mt-1">
                        {item.errorMessage}
                      </span>
                    </div>
                  )}
                </div>

                {/* Operations Buttons Stack */}
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  {item.status === 'success' && item.convertedUrl ? (
                    <>
                      <a
                        href={item.convertedUrl}
                        download={`${customFileName || 'converted'}.${item.targetFormat}`}
                        className="px-6 py-3 bg-retro-green text-black font-heading font-black uppercase text-sm border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer flex items-center justify-center gap-2 flex-1 text-center"
                      >
                        <Download className="w-4 h-4 stroke-[3px]" />
                        Download
                      </a>
                      <button
                        onClick={handleConvert}
                        className="px-4 py-3 bg-retro-yellow text-black font-heading font-black uppercase text-xs border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title="Re-convert/Adjust Size"
                      >
                        <RefreshCw className="w-4 h-4 stroke-[3px]" />
                        Recalculate
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConvert}
                      disabled={item.status === 'converting'}
                      className="px-6 py-3 bg-retro-orange text-black font-heading font-black uppercase text-sm border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#000] transition-all cursor-pointer flex items-center justify-center gap-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4 fill-black stroke-[3px]" />
                      {item.status === 'success' ? 'Recalculate' : 'Convert Now'}
                    </button>
                  )}

                  <button
                    onClick={handleClear}
                    disabled={item.status === 'converting'}
                    className="px-4 py-3 bg-white text-black font-heading font-bold uppercase text-xs border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:bg-neutral-50 hover:text-red-500 hover:border-red-500 hover:shadow-[4px_4px_0px_0px_#ef4444] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#000] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 stroke-[2px]" />
                    Remove
                  </button>
                </div>

              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Real-time Preview Modal Overlay */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] w-full max-w-3xl max-h-[85vh] flex flex-col z-50 rotate-[0.2deg] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-retro-yellow border-b-4 border-black px-4 py-3 flex justify-between items-center font-heading font-black uppercase text-sm select-none border-t-0">
              <span className="truncate max-w-[500px]">Preview: {customFileName || 'converted'}.{item.targetFormat}</span>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 hover:bg-black/10 border border-transparent hover:border-black transition-all cursor-pointer flex items-center justify-center"
                title="Close Preview"
              >
                <X className="w-5 h-5 stroke-[3px]" />
              </button>
            </div>
            
            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#F4F4F0] min-h-0 flex flex-col justify-center">
              <div className="flex justify-center items-center h-full min-h-[300px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.convertedUrl}
                  className="max-w-full max-h-[60vh] object-contain border-4 border-black shadow-[4px_4px_0px_0px_#000] bg-neutral-100"
                  alt="Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal Overlay */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] w-full max-w-2xl max-h-[90vh] flex flex-col z-50 rotate-[-0.2deg] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-retro-yellow border-b-4 border-black px-4 py-3 flex justify-between items-center font-heading font-black uppercase text-sm select-none border-t-0">
              <span>Crop Image</span>
              <button
                onClick={() => setIsCropModalOpen(false)}
                className="p-1 hover:bg-black/10 border border-transparent hover:border-black transition-all cursor-pointer flex items-center justify-center"
                title="Close Crop"
              >
                <X className="w-5 h-5 stroke-[3px]" />
              </button>
            </div>

            {/* Aspect Ratio Selector bar */}
            <div className="bg-white border-b-4 border-black px-4 py-2 flex flex-wrap gap-2 items-center select-none text-xs font-bold">
              <span className="text-black/55 uppercase tracking-wide mr-2">Aspect Ratio:</span>
              {[
                { label: 'Free', val: undefined },
                { label: '1:1 Square', val: 1 },
                { label: '4:3 Standard', val: 4/3 },
                { label: '16:9 Widescreen', val: 16/9 },
              ].map((aspectOption) => (
                <button
                  key={aspectOption.label}
                  onClick={() => {
                    setAspect(aspectOption.val);
                    // Reset crop to apply aspect
                    setCrop({
                      unit: '%',
                      width: 80,
                      height: aspectOption.val ? 80 / aspectOption.val : 80,
                      x: 10,
                      y: 10,
                    });
                  }}
                  className={`px-3 py-1.5 border-2 border-black font-heading font-black uppercase text-[10px] shadow-[2px_2px_0px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_0px_#000] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none transition-all cursor-pointer ${
                    aspect === aspectOption.val ? 'bg-retro-orange text-black' : 'bg-white text-black'
                  }`}
                >
                  {aspectOption.label}
                </button>
              ))}
            </div>

            {/* Cropping Canvas Body */}
            <div className="p-6 flex-1 bg-[#F4F4F0] min-h-0 flex flex-col items-center justify-center">
              <div className="border-4 border-black shadow-[4px_4px_0px_0px_#000] bg-neutral-100 p-1 max-w-full max-h-[50vh] overflow-hidden flex items-center justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  className="max-w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={item.originalPreviewUrl || item.previewUrl}
                    alt="Original for cropping"
                    style={{ maxHeight: '46vh', maxWidth: '100%', height: 'auto', display: 'block' }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="border-t-4 border-black p-4 bg-white flex justify-end gap-3 select-none">
              <button
                onClick={() => setIsCropModalOpen(false)}
                className="px-4 py-2 bg-white text-black font-heading font-black uppercase text-xs border-4 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCrop}
                disabled={!completedCrop || completedCrop.width === 0 || completedCrop.height === 0}
                className="px-6 py-2 bg-retro-green text-black font-heading font-black uppercase text-xs border-4 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
