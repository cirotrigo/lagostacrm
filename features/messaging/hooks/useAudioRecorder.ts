'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderOptions {
    /** Maximum recording duration in seconds (default: 300 = 5 minutes) */
    maxDuration?: number;
    /** Callback when recording starts */
    onStart?: () => void;
    /** Callback when recording stops */
    onStop?: (blob: Blob) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
}

interface UseAudioRecorderReturn {
    /** Start recording */
    startRecording: () => Promise<void>;
    /** Stop recording and get blob */
    stopRecording: () => void;
    /** Cancel recording without saving */
    cancelRecording: () => void;
    /** Whether currently recording */
    isRecording: boolean;
    /** Recording duration in seconds */
    duration: number;
    /** The recorded audio blob (after stopping) */
    audioBlob: Blob | null;
    /** Audio URL for playback */
    audioUrl: string | null;
    /** Clear the recorded audio */
    clearAudio: () => void;
    /** Error message if any */
    error: string | null;
    /** Whether the browser supports audio recording */
    isSupported: boolean;
}

/**
 * Hook for recording audio using the Web Audio API (MediaRecorder)
 *
 * @example
 * ```tsx
 * const {
 *   startRecording,
 *   stopRecording,
 *   isRecording,
 *   duration,
 *   audioBlob,
 *   audioUrl,
 * } = useAudioRecorder({
 *   onStop: (blob) => {
 *     // Upload the blob
 *     uploadAudio(blob);
 *   },
 * });
 * ```
 */
export function useAudioRecorder(
    options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn {
    const { maxDuration = 300, onStart, onStop, onError } = options;

    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Check browser support
    const isSupported =
        typeof window !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!window.MediaRecorder;

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const startRecording = useCallback(async () => {
        if (!isSupported) {
            const err = new Error('Audio recording is not supported in this browser');
            setError(err.message);
            onError?.(err);
            return;
        }

        try {
            setError(null);
            chunksRef.current = [];

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            streamRef.current = stream;

            // Determine best supported MIME type
            // Prefer webm (Chrome, Edge, Firefox) or mp4 (Safari)
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/mp4')
                ? 'audio/mp4'
                : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
                ? 'audio/ogg;codecs=opus'
                : 'audio/webm';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                onStop?.(blob);

                // Clean up stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                }
            };

            mediaRecorder.onerror = (event) => {
                const err = new Error('Recording error occurred');
                setError(err.message);
                onError?.(err);
            };

            // Start recording
            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            startTimeRef.current = Date.now();
            onStart?.();

            // Start duration timer
            timerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setDuration(elapsed);

                // Auto-stop if max duration reached
                if (elapsed >= maxDuration) {
                    stopRecording();
                }
            }, 100);
        } catch (err) {
            const error =
                err instanceof Error ? err : new Error('Failed to start recording');

            if (error.name === 'NotAllowedError') {
                setError('Acesso ao microfone negado. Permita o acesso nas configurações do navegador.');
            } else if (error.name === 'NotFoundError') {
                setError('Nenhum microfone encontrado.');
            } else {
                setError(error.message);
            }

            onError?.(error);
        }
    }, [isSupported, maxDuration, onStart, onStop, onError]);

    const stopRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        setIsRecording(false);
    }, []);

    const cancelRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        chunksRef.current = [];
        setIsRecording(false);
        setDuration(0);
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
    }, [audioUrl]);

    const clearAudio = useCallback(() => {
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        setDuration(0);
        setError(null);
    }, [audioUrl]);

    return {
        startRecording,
        stopRecording,
        cancelRecording,
        isRecording,
        duration,
        audioBlob,
        audioUrl,
        clearAudio,
        error,
        isSupported,
    };
}
