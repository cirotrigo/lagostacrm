'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { adaptChatwootMessage } from '../utils/chatwootAdapters';
import type { MessagesResponse } from '../types/messaging';

interface UploadAttachmentPayload {
    conversationId: string;
    file: File | Blob;
    content?: string;
    isPrivate?: boolean;
}

/**
 * Hook to upload attachments (images, audio, video, documents) to a conversation
 *
 * @example
 * ```tsx
 * const uploadAttachment = useUploadAttachment();
 *
 * // Upload an image
 * uploadAttachment.mutate({
 *   conversationId: '123',
 *   file: imageFile,
 *   content: 'Check out this image!',
 * });
 *
 * // Upload audio (from AudioRecorder)
 * uploadAttachment.mutate({
 *   conversationId: '123',
 *   file: audioBlob,
 * });
 * ```
 */
export function useUploadAttachment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UploadAttachmentPayload) => {
            const conversationId = parseInt(payload.conversationId, 10);

            // Create FormData
            const formData = new FormData();

            // Handle File or Blob
            if (payload.file instanceof Blob && !(payload.file instanceof File)) {
                // Convert Blob to File with a name (required for audio recordings)
                const extension = payload.file.type.includes('webm') ? 'webm'
                    : payload.file.type.includes('mp4') ? 'm4a'
                    : payload.file.type.includes('ogg') ? 'ogg'
                    : 'audio';
                const file = new File([payload.file], `audio.${extension}`, { type: payload.file.type });
                formData.append('file', file);
            } else {
                formData.append('file', payload.file);
            }

            if (payload.content) {
                formData.append('content', payload.content);
            }
            if (payload.isPrivate) {
                formData.append('private', 'true');
            }

            const response = await fetch(
                `/api/chatwoot/conversations/${conversationId}/upload`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to upload attachment');
            }

            const result = await response.json();
            return {
                message: adaptChatwootMessage(result.data),
            };
        },
        onSuccess: (data, variables) => {
            const conversationId = parseInt(variables.conversationId, 10);

            // Add message to cache
            if (data.message) {
                queryClient.setQueryData(
                    [...queryKeys.chatwoot.messages(conversationId), 'infinite'],
                    (old: { pages: MessagesResponse[] } | undefined) => {
                        if (!old) return old;
                        return {
                            ...old,
                            pages: old.pages.map((page, index) =>
                                index === old.pages.length - 1
                                    ? { ...page, data: [...page.data, data.message] }
                                    : page
                            ),
                        };
                    }
                );
            }

            // Invalidate conversations to update last_message
            queryClient.invalidateQueries({ queryKey: queryKeys.chatwoot.conversations() });
        },
    });
}
