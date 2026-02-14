'use client';

import React, { useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send, Loader2, X } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface AudioRecorderProps {
    /** Called when user sends the recorded audio */
    onSend: (blob: Blob) => void;
    /** Called when user cancels recording */
    onCancel: () => void;
    /** Whether sending is in progress */
    isSending?: boolean;
}

/**
 * Audio recorder component with recording, preview, and send functionality
 */
export const AudioRecorder: React.FC<AudioRecorderProps> = ({
    onSend,
    onCancel,
    isSending = false,
}) => {
    const {
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
    } = useAudioRecorder();

    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);

    // Auto-start recording when component mounts
    useEffect(() => {
        startRecording();
    }, [startRecording]);

    // Handle audio playback state
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => setIsPlaying(false);
        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, [audioUrl]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play();
            setIsPlaying(true);
        }
    };

    const handleSend = () => {
        if (audioBlob) {
            onSend(audioBlob);
        }
    };

    const handleCancel = () => {
        cancelRecording();
        onCancel();
    };

    const handleDelete = () => {
        clearAudio();
        // Restart recording
        startRecording();
    };

    if (!isSupported) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                <X className="w-5 h-5" />
                <span className="text-sm">Gravação de áudio não suportada neste navegador</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <X className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                </div>
                <button
                    onClick={handleCancel}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                    Cancelar
                </button>
            </div>
        );
    }

    // Recording state
    if (isRecording) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {/* Recording indicator */}
                <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        Gravando...
                    </span>
                </div>

                {/* Duration */}
                <span className="text-sm font-mono text-red-600 dark:text-red-400 min-w-[48px]">
                    {formatDuration(duration)}
                </span>

                {/* Waveform placeholder */}
                <div className="flex-1 h-8 flex items-center justify-center gap-0.5">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-red-400 dark:bg-red-500 rounded-full animate-pulse"
                            style={{
                                height: `${Math.random() * 24 + 8}px`,
                                animationDelay: `${i * 50}ms`,
                            }}
                        />
                    ))}
                </div>

                {/* Cancel button */}
                <button
                    onClick={handleCancel}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    title="Cancelar"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Stop button */}
                <button
                    onClick={stopRecording}
                    className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    title="Parar gravação"
                >
                    <Square className="w-5 h-5 fill-current" />
                </button>
            </div>
        );
    }

    // Preview state (after recording)
    if (audioBlob && audioUrl) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-100 dark:bg-white/5 rounded-lg">
                {/* Hidden audio element */}
                <audio ref={audioRef} src={audioUrl} />

                {/* Play/Pause button */}
                <button
                    onClick={handlePlayPause}
                    className="p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-full transition-colors"
                    title={isPlaying ? 'Pausar' : 'Reproduzir'}
                >
                    {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                    ) : (
                        <Play className="w-5 h-5 fill-current" />
                    )}
                </button>

                {/* Duration */}
                <span className="text-sm font-mono text-slate-600 dark:text-slate-400 min-w-[48px]">
                    {formatDuration(duration)}
                </span>

                {/* Waveform placeholder */}
                <div className="flex-1 h-8 flex items-center gap-0.5">
                    {Array.from({ length: 30 }).map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-primary-400 dark:bg-primary-500 rounded-full"
                            style={{
                                height: `${Math.random() * 24 + 8}px`,
                            }}
                        />
                    ))}
                </div>

                {/* Delete button */}
                <button
                    onClick={handleDelete}
                    className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                    title="Deletar e regravar"
                    disabled={isSending}
                >
                    <Trash2 className="w-5 h-5" />
                </button>

                {/* Send button */}
                <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="p-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-colors"
                    title="Enviar áudio"
                >
                    {isSending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </button>
            </div>
        );
    }

    // Initial state (should not happen, but fallback)
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <button
                onClick={() => startRecording()}
                className="p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-full transition-colors"
                title="Iniciar gravação"
            >
                <Mic className="w-5 h-5" />
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
                Clique para gravar
            </span>
        </div>
    );
};
