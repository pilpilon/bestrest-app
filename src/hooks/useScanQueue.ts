import { useState, useEffect } from 'react';
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ScanJob {
    id: string;
    status: 'processing' | 'ready' | 'error';
    imageUrl: string;
    fileName: string;
    uploadedAt: Timestamp;
    completedAt?: Timestamp;
    ocrResult?: any;
    errorMessage?: string;
}

export function useScanQueue(businessId: string | undefined) {
    const [queueJobs, setQueueJobs] = useState<ScanJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!businessId) {
            setQueueJobs([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'businesses', businessId, 'scanQueue'),
            orderBy('uploadedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ScanJob[];
            setQueueJobs(jobs);
            setLoading(false);
        }, (error) => {
            console.error("ScanQueue snapshot error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [businessId]);

    const addJob = async (jobId: string, fileName: string, imageUrl: string) => {
        if (!businessId) return;

        const jobRef = doc(db, 'businesses', businessId, 'scanQueue', jobId);
        await setDoc(jobRef, {
            status: 'processing',
            imageUrl,
            fileName,
            uploadedAt: serverTimestamp(),
        });
    };

    const markReady = async (jobId: string, ocrResult: any) => {
        if (!businessId) return;
        const jobRef = doc(db, 'businesses', businessId, 'scanQueue', jobId);
        await setDoc(jobRef, {
            status: 'ready',
            ocrResult,
            completedAt: serverTimestamp(),
        }, { merge: true });
    };

    const markError = async (jobId: string, errorMessage: string) => {
        if (!businessId) return;
        const jobRef = doc(db, 'businesses', businessId, 'scanQueue', jobId);
        await setDoc(jobRef, {
            status: 'error',
            errorMessage,
            completedAt: serverTimestamp(),
        }, { merge: true });
    };

    const removeJob = async (jobId: string) => {
        if (!businessId) return;
        await deleteDoc(doc(db, 'businesses', businessId, 'scanQueue', jobId));
    };

    // Auto-fail jobs that are stuck in 'processing' for more than 3 minutes
    // This handles cases where the app was closed during upload or network failed silently.
    useEffect(() => {
        if (!businessId || queueJobs.length === 0) return;

        const interval = setInterval(() => {
            const now = new Date();
            queueJobs.forEach(job => {
                if (job.status === 'processing' && job.uploadedAt && typeof job.uploadedAt.toDate === 'function') {
                    const uploadedTime = job.uploadedAt.toDate();
                    const diffMinutes = (now.getTime() - uploadedTime.getTime()) / (1000 * 60);
                    if (diffMinutes > 3) {
                        markError(job.id, 'הסריקה נקטעה (תקלת תקשורת או סגירת אפליקציה). אנא נסה שוב.');
                    }
                }
            });
        }, 15000); // Check every 15 seconds

        return () => clearInterval(interval);
    }, [queueJobs, businessId]);

    return {
        queueJobs,
        loading,
        addJob,
        markReady,
        markError,
        removeJob
    };
}
