"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="card bg-slate-800/80 border-white/10 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-400 mb-6">
          An unexpected error occurred while loading this page.
        </p>
        <button onClick={() => reset()} className="btn-primary justify-center w-full">
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    </div>
  );
}
