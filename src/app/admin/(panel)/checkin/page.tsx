"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  CheckCircle, XCircle, AlertTriangle, Camera, CameraOff,
  Keyboard, RefreshCw, Volume2, VolumeX, ScanLine
} from "lucide-react";

type ScanOutcome = "idle" | "success" | "already_checked_in" | "invalid" | "revoked" | "error";

interface CheckInResult {
  outcome: ScanOutcome;
  attendeeName?: string;
  checkedInAt?: string;
  message?: string;
}

const OUTCOME_CONFIG: Record<ScanOutcome, {
  bg: string;
  icon: React.ElementType;
  title: string;
  textColor: string;
}> = {
  idle: { bg: "bg-gray-50", icon: ScanLine, title: "Ready to Scan", textColor: "text-gray-500" },
  success: { bg: "bg-green-50", icon: CheckCircle, title: "✅ Checked In!", textColor: "text-green-700" },
  already_checked_in: { bg: "bg-yellow-50", icon: AlertTriangle, title: "⚠️ Already Checked In", textColor: "text-yellow-700" },
  invalid: { bg: "bg-red-50", icon: XCircle, title: "❌ Invalid Ticket", textColor: "text-red-700" },
  revoked: { bg: "bg-red-50", icon: XCircle, title: "🚫 Ticket Revoked", textColor: "text-red-700" },
  error: { bg: "bg-orange-50", icon: AlertTriangle, title: "⚠️ Error", textColor: "text-orange-700" },
};

const COOLDOWN_MS = 2500;

export default function CheckinPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);
  const lastScanRef = useRef<{ token: string; time: number } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckInResult>({ outcome: "idle" });
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);

  const playSound = useCallback((type: "success" | "error") => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      if (type === "success") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch { /* ignore audio errors */ }
  }, [soundEnabled]);

  const validateTicket = useCallback(async (token: string) => {
    // Client-side dedup guard
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.token === token &&
      now - lastScanRef.current.time < COOLDOWN_MS
    ) {
      return;
    }
    lastScanRef.current = { token, time: now };

    setLoading(true);
    try {
      const res = await fetch("/api/checkin/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok && res.status === 0) {
        setResult({ outcome: "error", message: "Network error – please retry" });
        playSound("error");
        return;
      }

      const data: CheckInResult = await res.json();
      setResult(data);

      if (data.outcome === "success") {
        playSound("success");
      } else {
        playSound("error");
      }
    } catch {
      setResult({ outcome: "error", message: "Network error – please retry manually" });
      playSound("error");
    } finally {
      setLoading(false);
    }
  }, [playSound]);

  async function startScanner() {
    if (!scannerRef.current) return;
    setCameraError("");

    try {
      // Dynamically import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;

      // Prefer rear camera
      const cameras = await Html5Qrcode.getCameras();
      const backCamera = cameras.find((c) =>
        c.label.toLowerCase().includes("back") ||
        c.label.toLowerCase().includes("rear") ||
        c.label.toLowerCase().includes("environment")
      );
      const cameraId = backCamera?.id ?? (cameras[0]?.id ?? { facingMode: "environment" });

      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // Extract token from URL if needed
          let token = decodedText;
          try {
            const url = new URL(decodedText);
            const parts = url.pathname.split("/");
            token = parts[parts.length - 1];
          } catch { /* not a URL */ }

          if (token) validateTicket(token);
        },
        undefined
      );
      setScanning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera error";
      setCameraError(msg.includes("permission") ? "Camera permission denied" : msg);
    }
  }

  async function stopScanner() {
    if (html5QrRef.current) {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        await (html5QrRef.current as InstanceType<typeof Html5Qrcode>).stop();
      } catch { /* ignore */ }
      html5QrRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    validateTicket(manualCode.trim());
    setManualCode("");
  }

  const currentConfig = OUTCOME_CONFIG[result.outcome];
  const Icon = currentConfig.icon;

  return (
    <div className="animate-fade-in max-w-lg mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ScanLine size={24} className="text-gdg-blue" />
            Check-in Scanner
          </h1>
          <p className="text-sm text-gray-500 mt-1">Scan attendee QR tickets to check them in</p>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="btn-secondary btn-sm"
          title={soundEnabled ? "Mute sounds" : "Enable sounds"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* Result Display */}
      <div className={`
        card p-8 text-center mb-6 transition-all duration-300
        ${currentConfig.bg}
        ${loading ? "animate-pulse" : ""}
        ${result.outcome === "success" ? "animate-pulse-success" : ""}
        ${result.outcome === "invalid" || result.outcome === "revoked" ? "animate-pulse-error" : ""}
      `}>
        <div className="flex flex-col items-center gap-4">
          {loading ? (
            <RefreshCw size={48} className="animate-spin text-gray-400" />
          ) : (
            <Icon
              size={64}
              className={`${
                result.outcome === "success" ? "text-green-500" :
                result.outcome === "already_checked_in" ? "text-yellow-500" :
                result.outcome === "invalid" || result.outcome === "revoked" ? "text-red-500" :
                result.outcome === "error" ? "text-orange-500" :
                "text-gray-300"
              } transition-all duration-300`}
            />
          )}
          <div>
            <h2 className={`text-2xl font-bold ${currentConfig.textColor}`}>
              {loading ? "Validating..." : currentConfig.title}
            </h2>
            {result.attendeeName && (
              <p className="text-lg font-semibold text-gdg-navy mt-2">{result.attendeeName}</p>
            )}
            {result.message && (
              <p className={`text-sm mt-1 ${currentConfig.textColor}`}>{result.message}</p>
            )}
            {result.checkedInAt && (
              <p className="text-sm text-yellow-600 mt-1">
                Previously checked in at: {new Date(result.checkedInAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          {result.outcome !== "idle" && (
            <button
              onClick={() => setResult({ outcome: "idle" })}
              className="btn-secondary btn-sm mt-2"
            >
              <RefreshCw size={14} />
              Ready for next scan
            </button>
          )}
        </div>
      </div>

      {/* Camera Scanner */}
      <div className="card overflow-hidden mb-4">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gdg-navy flex items-center gap-2">
            <Camera size={16} />
            Camera Scanner
          </h2>
          {scanning ? (
            <button onClick={stopScanner} className="btn-danger btn-sm">
              <CameraOff size={14} />
              Stop
            </button>
          ) : (
            <button onClick={startScanner} className="btn-primary btn-sm">
              <Camera size={14} />
              Start Camera
            </button>
          )}
        </div>

        {cameraError && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle size={14} />
              {cameraError}
            </p>
            <p className="text-xs text-red-400 mt-1">
              Use HTTPS in production. Camera permissions must be granted.
              Use manual entry below as fallback.
            </p>
          </div>
        )}

        <div className="p-4">
          <div
            id="qr-reader"
            ref={scannerRef}
            className={`w-full ${scanning ? "min-h-[300px]" : "hidden"}`}
          />
          {!scanning && !cameraError && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
              <Camera size={40} className="opacity-30" />
              <p className="text-sm">Click &quot;Start Camera&quot; to begin scanning</p>
              <p className="text-xs">Make sure to allow camera access when prompted</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry */}
      <div className="card p-4">
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-600 hover:text-gdg-navy transition-colors"
        >
          <span className="flex items-center gap-2">
            <Keyboard size={16} />
            Manual Ticket Code Entry
          </span>
          <span className="text-xs text-gray-400">{showManual ? "▲" : "▼"}</span>
        </button>

        {showManual && (
          <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2 animate-fade-in">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="input flex-1 font-mono text-sm"
              placeholder="Enter ticket code or scan URL..."
              autoComplete="off"
            />
            <button type="submit" disabled={loading || !manualCode.trim()} className="btn-primary">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : "Validate"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
