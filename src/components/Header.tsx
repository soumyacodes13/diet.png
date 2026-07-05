import React from 'react';
import { Layers } from 'lucide-react';

export default function Header() {
  return (
    <header className="w-full bg-white border-b-4 border-black sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-retro-yellow border-4 border-black p-2 shadow-[3px_3px_0px_0px_#000] rotate-[-2deg] flex items-center justify-center">
            <Layers className="w-6.5 h-6.5 stroke-[3px] text-black" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-heading font-black tracking-tight lowercase select-none flex items-center gap-1">
              diet<span className="bg-retro-orange text-black px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] inline-block rotate-[1.5deg]">.png</span>
            </h1>
            {/* <span className="text-xs font-bold tracking-wider text-black/60 uppercase">The File Converter</span> */}
          </div>
        </div>

      </div>
    </header>
  );
}
