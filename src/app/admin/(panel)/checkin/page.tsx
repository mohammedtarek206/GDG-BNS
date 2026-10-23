"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  CheckCircle, XCircle, AlertTriangle, Camera, CameraOff,
  Keyboard, RefreshCw, Volume2, VolumeX, ScanLine, SwitchCamera
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);
  const lastScanRef = useRef<{ token: string; time: number } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [result, setResult] = useState<CheckInResult>({ outcome: "idle" });
  const [manualCode, setManualCode] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);

  const playSound = useCallback((type: "success" | "error") => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
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
    const cleanToken = token.trim();
    if (!cleanToken) return;

    // Client-side dedup guard
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.token === cleanToken &&
      now - lastScanRef.current.time < COOLDOWN_MS
    ) {
      return;
    }
    lastScanRef.current = { token: cleanToken, time: now };

    setLoading(true);
    try {
      const res = await fetch("/api/checkin/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleanToken }),
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

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        if (html5QrRef.current.isScanning) {
          await html5QrRef.current.stop();
        }
        await html5QrRef.current.clear();
      } catch (err) {
        console.warn("Error stopping scanner:", err);
      }
      html5QrRef.current = null;
    }
    setScanning(false);
    setIsStarting(false);
  }, []);

  const startScannerWithMode = useCallback(async (mode: "environment" | "user") => {
    setCameraError("");
    setIsStarting(true);

    // Check secure context
    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setCameraError("Camera access requires HTTPS or localhost. Please ensure your site is on HTTPS.");
      setIsStarting(false);
      return;
    }

    // Check mediaDevices support
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API is not supported on this browser. Please use Chrome or Safari.");
      setIsStarting(false);
      return;
    }

    try {
      // Clean up previous instance if any
      await stopScanner();

      // Dynamically import Html5Qrcode
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(160, Math.floor(minEdge * 0.72));
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      const handleDecoded = (decodedText: string) => {
        let token = decodedText.trim();
        try {
          const url = new URL(token);
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts.length > 0) {
            token = parts[parts.length - 1];
          }
        } catch { /* not a URL */ }

        if (token) validateTicket(token);
      };

      try {
        // Try requested facing mode (default: environment/back camera)
        await scanner.start({ facingMode: mode }, qrConfig, handleDecoded, undefined);
      } catch (firstErr) {
        console.warn(`Failed to start camera with ${mode}, attempting fallback...`, firstErr);
        // Fallback to the other facing mode or generic camera
        const fallbackMode = mode === "environment" ? "user" : "environment";
        try {
          await scanner.start({ facingMode: fallbackMode }, qrConfig, handleDecoded, undefined);
          setFacingMode(fallbackMode);
        } catch {
          // Fallback to any available camera ID
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            await scanner.start(cameras[0].id, qrConfig, handleDecoded, undefined);
          } else {
            throw firstErr;
          }
        }
      }

      setScanning(true);
    } catch (err: unknown) {
      console.error("Camera start error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("devices")) {
        setCameraError("No camera device found on this system.");
      } else {
        setCameraError(`Camera error: ${msg}`);
      }
      await stopScanner();
    } finally {
      setIsStarting(false);
    }
  }, [stopScanner, validateTicket]);

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (scanning) {
      await startScannerWithMode(nextMode);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

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
          <p className="text-sm text-gray-500 mt-1">Scan attendee QR tickets for rapid check-in</p>
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

      {/* Camera Scanner Card */}
      <div className="card overflow-hidden mb-4">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gdg-navy flex items-center gap-2">
            <Camera size={16} />
            Camera Scanner
          </h2>
          <div className="flex items-center gap-2">
            {scanning && (
              <button
                onClick={toggleCameraFacing}
                className="btn-secondary btn-sm"
                title="Switch Camera (Front/Rear)"
              >
                <SwitchCamera size={14} />
                Flip
              </button>
            )}
            {scanning ? (
              <button onClick={stopScanner} className="btn-danger btn-sm">
                <CameraOff size={14} />
                Stop
              </button>
            ) : (
              <button
                onClick={() => startScannerWithMode(facingMode)}
                disabled={isStarting}
                className="btn-primary btn-sm"
              >
                {isStarting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Camera size={14} />
                    Start Camera
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {cameraError && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600 flex items-center gap-2 font-medium">
              <AlertTriangle size={16} className="flex-shrink-0" />
              {cameraError}
            </p>
            <p className="text-xs text-red-500 mt-2 leading-relaxed">
              💡 Ensure camera permission is granted in your browser. You can also use the manual entry below to type or paste ticket codes.
            </p>
          </div>
        )}

        <div className="p-4">
          {/* Reader container - NEVER display:none when scanner initializes */}
          <div
            id="qr-reader"
            ref={scannerRef}
            className={`w-full overflow-hidden rounded-xl bg-slate-900 ${
              scanning || isStarting ? "min-h-[280px]" : "hidden"
            }`}
          />

          {!scanning && !isStarting && !cameraError && (
            <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-1">
                <Camera size={32} />
              </div>
              <p className="text-sm font-medium text-gray-600">Click &quot;Start Camera&quot; to begin scanning</p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Allows scanning directly with your phone or laptop camera
              </p>
            </div>
          )}

          {isStarting && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
              <RefreshCw size={28} className="animate-spin text-gdg-blue" />
              <p className="text-xs font-medium">Requesting camera access...</p>
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
