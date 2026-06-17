import type { ScrapeReport } from '../../types/index.js';

export function ReportErrorsSection({ report }: { report: ScrapeReport }) {
  if (!report.errors || report.errors.length === 0) return null;
  return (
    <div className="card p-6 mb-6 border-red-200">
      <h2 className="text-xl font-bold mb-4 text-red-800">Erreurs ({report.errors.length})</h2>
      <div className="space-y-3">
        {report.errors.map((err, index) => (
          <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
            <p className="font-semibold text-red-900">{err.theater_name}</p>
            <p className="text-sm text-red-700 mt-1">{err.error}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportProgressLog({ report }: { report: ScrapeReport }) {
  if (!report.progress_log || report.progress_log.length === 0) return null;
  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4">Journal de progression</h2>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {report.progress_log.map((log, index) => (
          <div key={index} className="text-sm bg-gray-50 p-2 rounded font-mono">
            <span className="text-gray-500">[{log.type}]</span> {JSON.stringify(log)}
          </div>
        ))}
      </div>
    </div>
  );
}
