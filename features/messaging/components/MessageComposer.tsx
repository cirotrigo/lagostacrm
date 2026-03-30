'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Send, Paperclip, Smile, Loader2, Mic } from 'lucide-react';
import { AudioRecorder } from './chat/AudioRecorder';

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSendAudio?: (blob: Blob) => void;
  isSending: boolean;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChange,
  onSend,
  onSendAudio,
  isSending,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isSending && value.trim()) {
        onSend();
      }
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleCancelRecording = () => {
    setIsRecording(false);
  };

  const handleSendAudio = async (blob: Blob) => {
    if (!onSendAudio) {
      console.warn('onSendAudio not provided - audio upload not implemented');
      setIsRecording(false);
      return;
    }

    setIsSendingAudio(true);
    try {
      await onSendAudio(blob);
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to send audio:', error);
    } finally {
      setIsSendingAudio(false);
    }
  };

  // Show AudioRecorder when recording
  if (isRecording) {
    return (
      <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
        <AudioRecorder
          onSend={handleSendAudio}
          onCancel={handleCancelRecording}
          isSending={isSendingAudio}
        />
      </div>
    );
  }

  const hasText = value.trim().length > 0;

  return (
    <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
      <div className="flex items-end gap-2">
        {/* Attachment button (placeholder) */}
        <button
          type="button"
          disabled={disabled}
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50 transition-colors"
          title="Anexar arquivo (em breve)"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white placeholder-slate-400 disabled:opacity-50 transition-all"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
        </div>

        {/* Emoji button (placeholder) */}
        <button
          type="button"
          disabled={disabled}
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50 transition-colors"
          title="Emojis (em breve)"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Send button (when has text) or Mic button (when empty) */}
        {hasText ? (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || isSending}
            className="p-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Enviar mensagem"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={disabled || isSending}
            className="p-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Gravar áudio"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
