import React from 'react';
import { PageSkeleton } from './ui/Skeletons';

interface LoadingFallbackProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
}

/** Fallback Suspense generik: skeleton (bukan spinner). Props dipertahankan agar pemanggil lama tetap valid. */
export const LoadingFallback: React.FC<LoadingFallbackProps> = () => <PageSkeleton />;
