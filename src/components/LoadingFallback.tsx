import React from 'react';

interface LoadingFallbackProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'Memuat Halaman...',
  submessage = 'Mohon tunggu sebentar, menyiapkan sistem SPMB SMK Muhiba',
  fullScreen = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 transition-opacity duration-300 ${
        fullScreen ? 'min-h-screen bg-slate-50' : 'min-h-[55vh] w-full'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {/* Glow halo */}
        <div className="absolute w-20 h-20 bg-blue-500/15 rounded-full blur-xl animate-pulse" />

        {/* Dual Spinner Rings */}
        <div className="w-14 h-14 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin" />
        <div
          className="absolute w-10 h-10 rounded-full border-2 border-indigo-100 border-b-indigo-500 animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}
        />

        {/* Center school emblem dot */}
        <div className="absolute w-4 h-4 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-xs" />
      </div>

      <div className="mt-5 text-center max-w-sm">
        <p className="text-sm font-bold text-slate-800 tracking-wide">{message}</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed font-normal">{submessage}</p>
      </div>
    </div>
  );
};
