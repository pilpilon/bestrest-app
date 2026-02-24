import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Eye, Trash2 } from 'lucide-react';
import { type ScanJob } from '../hooks/useScanQueue';

interface ScanQueuePanelProps {
    jobs: ScanJob[];
    onReview: (job: ScanJob) => void;
    onRemove: (jobId: string) => void;
}

export const ScanQueuePanel: React.FC<ScanQueuePanelProps> = ({ jobs, onReview, onRemove }) => {
    if (jobs.length === 0) return null;

    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse"></div>
                    תור סריקה ({jobs.length})
                </h3>
                <span className="text-[10px] text-[var(--color-text-muted)]">הסריקות מתבצעות ברקע, אפשר להמשיך לעבוד</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {jobs.map((job) => (
                    <div
                        key={job.id}
                        className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative">
                                <img src={job.imageUrl} alt="Thumbnail" className="w-full h-full object-cover opacity-50" />
                                {job.status === 'processing' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin" />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-white">{job.fileName}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    {job.status === 'processing' ? (
                                        <span className="text-[10px] text-orange-400 flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            מעבד...
                                        </span>
                                    ) : job.status === 'ready' ? (
                                        <span className="text-[10px] text-[var(--color-primary)] flex items-center gap-1 font-bold">
                                            <CheckCircle2 className="w-3 h-3" />
                                            מוכן לביקורת
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-red-400 flex items-center gap-1 max-w-[150px]" title={job.errorMessage || 'שגיאה בסריקה'}>
                                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{job.errorMessage || 'שגיאה בסריקה'}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {job.status === 'ready' && (
                                <button
                                    onClick={() => onReview(job)}
                                    className="bg-[var(--color-primary)] text-slate-900 py-1.5 px-3 rounded-lg text-[10px] font-black shadow-[0_0_10px_rgba(13,242,128,0.3)] hover:brightness-110 transition-all flex items-center gap-1.5"
                                >
                                    <Eye className="w-3 h-3" />
                                    ביקורת
                                </button>
                            )}
                            {job.status === 'error' && (
                                <button
                                    onClick={() => onRemove(job.id)}
                                    className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                    title="מחק"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            {job.status === 'processing' && (
                                <button
                                    onClick={() => onRemove(job.id)}
                                    className="p-1.5 hover:bg-white/10 text-white/40 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="בטל"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
