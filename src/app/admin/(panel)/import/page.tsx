"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle,
  ArrowRight, Download, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import toast from "react-hot-toast";

interface ParsedRow {
  rowIndex: number;
  fullName?: string;
  email?: string;
  phone?: string;
  registrationId?: string;
  organization?: string;
}

interface ImportError {
  rowIndex: number;
  field: string;
  message: string;
}

interface PreviewData {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  detectedMapping: Record<string, string>;
  totalRows: number;
  fileId: string;
}

interface CommitResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
  batchId: string;
}

type Step = "upload" | "mapping" | "preview" | "commit" | "done";

const FIELDS = [
  { key: "fullName", label: "Full Name *", required: true },
  { key: "email", label: "Email Address *", required: true },
  { key: "phone", label: "Phone Number", required: false },
  { key: "registrationId", label: "Registration ID", required: false },
  { key: "organization", label: "Organization / University", required: false },
];

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [fileBuffer, setFileBuffer] = useState<string | null>(null);
  const [showAllPreview, setShowAllPreview] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to parse file");
        return;
      }

      const data: { preview: PreviewData; fileData: string } = await res.json();
      setPreview(data.preview);
      setMapping(data.preview.detectedMapping);
      setFileBuffer(data.fileData);
      setStep("mapping");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  async function handleValidate() {
    if (!fileBuffer) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: fileBuffer, mapping }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Validation failed");
        return;
      }

      const data: { valid: ParsedRow[]; errors: ImportError[] } = await res.json();
      setValidRows(data.valid);
      setErrors(data.errors);
      setStep("preview");
    } catch {
      toast.error("Validation request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!fileBuffer) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: fileBuffer, mapping }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Import failed");
        return;
      }

      const result: CommitResult = await res.json();
      setCommitResult(result);
      setStep("done");
      toast.success(`Imported ${result.imported} attendees!`);
    } catch {
      toast.error("Import request failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadErrorReport() {
    const csv = [
      "Row,Field,Error",
      ...errors.map((e) => `${e.rowIndex},${e.field},"${e.message}"`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep("upload");
    setPreview(null);
    setMapping({});
    setValidRows([]);
    setErrors([]);
    setCommitResult(null);
    setFileBuffer(null);
  }

  function downloadTemplate() {
    import("xlsx").then((XLSX) => {
      const data = [
        ["Full Name", "Email", "Phone Number", "Registration ID", "Organization"],
        ["Mohammed Tarek", "mohammed@example.com", "01284621015", "REG-001", "GDG Community"],
        ["Ahmed Ali", "ahmed@example.com", "01098765432", "REG-002", "Beni-Suef University"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendees");
      XLSX.writeFile(wb, "gdg_attendees_template.xlsx");
      toast.success("Excel template downloaded with Phone Number column!");
    });
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Import Attendees</h1>
          <p className="text-sm text-gray-500 mt-1">Upload your registration spreadsheet to import attendees</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="btn-secondary btn-sm self-start sm:self-auto flex items-center gap-2"
          title="Download ready-to-fill Excel template"
        >
          <Download size={15} className="text-gdg-blue" />
          Download Excel Template
        </button>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {[
          { id: "upload", label: "Upload" },
          { id: "mapping", label: "Map Columns" },
          { id: "preview", label: "Preview" },
          { id: "commit", label: "Confirm" },
          { id: "done", label: "Done" },
        ].map(({ id, label }, i, arr) => {
          const steps = ["upload", "mapping", "preview", "commit", "done"];
          const currentIdx = steps.indexOf(step);
          const thisIdx = steps.indexOf(id);
          const isDone = thisIdx < currentIdx;
          const isCurrent = thisIdx === currentIdx;
          return (
            <div key={id} className="flex items-center gap-2 flex-shrink-0">
              <div className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${isCurrent ? "bg-gdg-blue text-white" : isDone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}
              `}>
                {isDone ? <CheckCircle size={14} /> : <span className="w-4 h-4 text-xs flex items-center justify-center">{thisIdx + 1}</span>}
                {label}
              </div>
              {i < arr.length - 1 && <ArrowRight size={16} className="text-gray-300" />}
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="card p-8">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDragActive ? "border-gdg-blue bg-blue-50" : "border-gray-200 hover:border-gdg-blue hover:bg-blue-50/30"}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              {loading ? (
                <div className="w-12 h-12 border-3 border-gdg-blue/20 border-t-gdg-blue rounded-full animate-spin" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gdg-blue/10 flex items-center justify-center">
                  <FileSpreadsheet size={32} className="text-gdg-blue" />
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-gdg-navy">
                  {isDragActive ? "Drop your file here" : "Drop your spreadsheet here"}
                </p>
                <p className="text-sm text-gray-500 mt-1">Supports .xlsx, .xls, .csv · Max 10MB</p>
              </div>
              <button className="btn-primary">
                <Upload size={16} />
                Browse File
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm font-medium text-blue-800 mb-2">📋 Expected Columns (any order)</p>
            <div className="flex flex-wrap gap-2">
              {["Full Name", "Email", "Phone (optional)", "Registration ID (optional)", "Organization (optional)"].map((col) => (
                <span key={col} className="badge-blue">{col}</span>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">Arabic headers are automatically detected.</p>
          </div>
        </div>
      )}

      {/* Step: Column Mapping */}
      {step === "mapping" && preview && (
        <div className="card p-6">
          <h2 className="section-title">Map Spreadsheet Columns</h2>
          <p className="text-sm text-gray-500 mb-6">
            Match each required field to the correct column in your spreadsheet.
            Auto-detection has been applied where possible.
          </p>

          {/* Helpful note if Phone column is not in the uploaded file */}
          {!preview.headers.some((h) => ["phone", "mobile", "هاتف", "موبايل"].some((alias) => h.toLowerCase().includes(alias))) && (
            <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="text-sm font-bold">تريد إضافة عمود رقم الهاتف (Phone Number)؟</strong><br />
                الخيارات في القائمة المنسدلة هي الأعمدة الموجودة في شيت الإكسيل الذي رفعته (شيتك الحالي به فقط: <strong>{preview.headers.join("، ")}</strong>).<br />
                لإدراج أرقام الهواتف، افتح شيت الإكسيل وأضف عمود جديد باسم <strong>Phone Number</strong> أو <strong>رقم الهاتف</strong> واكتب تحته الأرقام، ثم اضغط <strong>Back</strong> وأعد رفع الملف وسيتعرف عليه النظام فوراً.
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="btn-secondary btn-sm bg-white text-xs inline-flex items-center gap-1.5 shadow-sm font-medium"
                  >
                    <Download size={13} className="text-gdg-blue" />
                    تحميل نموذج إكسيل جاهز به عمود رقم الهاتف (Template)
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {FIELDS.map(({ key, label, required }) => (
              <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="sm:w-48 text-sm font-medium text-gdg-navy flex-shrink-0">
                  {label}
                </label>
                <select
                  value={mapping[key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                  className="input flex-1"
                  required={required}
                >
                  <option value="">-- Not mapped --</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {mapping[key] ? (
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                ) : required ? (
                  <XCircle size={18} className="text-red-400 flex-shrink-0" />
                ) : null}
              </div>
            ))}
          </div>

          {/* Sample Data Preview */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-600 mb-2">Sample rows from your file:</p>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    {preview.headers.slice(0, 6).map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {preview.headers.slice(0, 6).map((h) => (
                        <td key={h} className="max-w-[150px] truncate">
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">Showing 3 of {preview.totalRows} rows</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("upload")} className="btn-secondary">Back</button>
            <button
              onClick={handleValidate}
              disabled={loading || !mapping.fullName || !mapping.email}
              className="btn-primary"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Validate Data
            </button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center border-green-200 bg-green-50">
              <p className="text-3xl font-bold text-green-700">{validRows.length}</p>
              <p className="text-sm text-green-600 mt-1">Valid rows</p>
            </div>
            <div className={`card p-4 text-center ${errors.length > 0 ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
              <p className={`text-3xl font-bold ${errors.length > 0 ? "text-red-600" : "text-gray-500"}`}>{errors.length}</p>
              <p className={`text-sm mt-1 ${errors.length > 0 ? "text-red-500" : "text-gray-400"}`}>Invalid rows (won&apos;t import)</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-gdg-navy">{validRows.length + errors.length}</p>
              <p className="text-sm text-gray-500 mt-1">Total rows</p>
            </div>
          </div>

          {/* Error Report */}
          {errors.length > 0 && (
            <div className="card p-4 border-red-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {errors.length} Invalid Rows
                </h3>
                <div className="flex gap-2">
                  <button onClick={downloadErrorReport} className="btn-sm btn-secondary text-xs">
                    <Download size={12} />
                    Download Report
                  </button>
                  <button onClick={() => setShowErrors(!showErrors)} className="btn-sm btn-secondary text-xs">
                    {showErrors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showErrors ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {showErrors && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {errors.slice(0, 50).map((err, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded text-xs">
                      <span className="text-red-400 font-mono w-12 flex-shrink-0">Row {err.rowIndex}</span>
                      <span className="text-red-600">{err.message}</span>
                    </div>
                  ))}
                  {errors.length > 50 && <p className="text-xs text-red-400 text-center">+ {errors.length - 50} more errors</p>}
                </div>
              )}
            </div>
          )}

          {/* Valid Rows Preview */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gdg-navy">Valid Attendees Preview</h3>
              <button onClick={() => setShowAllPreview(!showAllPreview)} className="text-xs text-gdg-blue hover:underline">
                {showAllPreview ? "Show less" : `Show all ${validRows.length}`}
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Reg. ID</th>
                    <th>Organization</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllPreview ? validRows : validRows.slice(0, 10)).map((row) => (
                    <tr key={row.rowIndex}>
                      <td className="text-gray-400 font-mono text-xs">{row.rowIndex}</td>
                      <td className="font-medium">{row.fullName}</td>
                      <td className="text-gray-500 text-xs">{row.email}</td>
                      <td className="text-gray-400 text-xs">{row.phone ?? "—"}</td>
                      <td className="text-gray-400 text-xs">{row.registrationId ?? "—"}</td>
                      <td className="text-gray-400 text-xs">{row.organization ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("mapping")} className="btn-secondary">Back</button>
            <button
              onClick={handleCommit}
              disabled={loading || validRows.length === 0}
              className="btn-primary"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Import {validRows.length} Attendees
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && commitResult && (
        <div className="card p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-gdg-green" />
          </div>
          <h2 className="text-2xl font-bold text-gdg-navy mb-2">Import Complete!</h2>
          <div className="flex justify-center gap-8 mt-6 mb-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{commitResult.imported}</p>
              <p className="text-sm text-gray-500">Imported</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-500">{commitResult.skipped}</p>
              <p className="text-sm text-gray-500">Skipped (duplicates)</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">{commitResult.errors.length}</p>
              <p className="text-sm text-gray-500">Failed rows</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-6">Batch ID: <code className="font-mono">{commitResult.batchId}</code></p>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="btn-secondary">
              <Upload size={16} />
              Import Another File
            </button>
            <a href="/admin/attendees" className="btn-primary">
              <ArrowRight size={16} />
              View Attendees
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
