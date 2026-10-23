import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="card bg-slate-800/80 border-white/10 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-gdg-blue flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-sm text-gray-400 mb-6">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn-primary justify-center w-full">
          Return to Home
        </Link>
      </div>
    </div>
  );
}
