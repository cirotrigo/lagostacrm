'use client';

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Clock, AlertCircle, Image, FileText, Mic, Video } from 'lucide-react';
import type { WhatsAppMessage, WhatsAppMessageStatus, WhatsAppMediaType } from '../types/messaging';

interface MessageBubbleProps {
  message: WhatsAppMessage;
}

const statusIcons: Record<WhatsAppMessageStatus, React.ReactNode> = {
  pending: <Clock className="w-3 h-3 text-slate-400" />,
  sent: <Check className="w-3 h-3 text-slate-400" />,
  delivered: <CheckCheck className="w-3 h-3 text-slate-400" />,
  read: <CheckCheck className="w-3 h-3 text-blue-500" />,
  failed: <AlertCircle className="w-3 h-3 text-red-500" />,
};

const mediaIcons: Partial<Record<WhatsAppMediaType, React.ReactNode>> = {
  image: <Image className="w-4 h-4" />,
  audio: <Mic className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isOutbound = message.direction === 'outbound';
  const timestamp = message.wpp_timestamp || message.created_at;
  const formattedTime = format(new Date(timestamp), 'HH:mm', { locale: ptBR });

  const renderMedia = () => {
    if (!message.media_url) return null;

    switch (message.media_type) {
      case 'image':
        return (
          <img
            src={message.media_url}
            alt={message.caption || 'Image'}
            className="max-w-[280px] rounded-lg mb-1"
            loading="lazy"
          />
        );
      case 'video':
        return (
          <video
            src={message.media_url}
            controls
            className="max-w-[280px] rounded-lg mb-1"
          />
        );
      case 'audio':
        return (
          <audio src={message.media_url} controls className="max-w-[280px] mb-1" />
        );
      case 'document':
        return (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-white/10 rounded-lg mb-1 hover:bg-white/20 transition-colors"
          >
            <FileText className="w-5 h-5" />
            <span className="text-sm truncate">
              {message.media_filename || 'Documento'}
            </span>
          </a>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? 'bg-primary-500 text-white rounded-br-md'
            : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white rounded-bl-md'
        }`}
      >
        {/* Sender name for groups */}
        {!isOutbound && message.sender_name && (
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
            {message.sender_name}
          </p>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Content */}
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {/* Caption for media */}
        {message.caption && message.media_url && (
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
            {message.caption}
          </p>
        )}

        {/* Footer */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 ${
            isOutbound ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {message.is_forwarded && (
            <span className="text-[10px] italic mr-1">Encaminhada</span>
          )}
          <span className="text-[10px]">{formattedTime}</span>
          {isOutbound && statusIcons[message.status]}
        </div>
      </div>
    </div>
  );
};
