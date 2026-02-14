// Legacy hooks (now using Chatwoot under the hood)
export { useConversations, useConversation, useUpdateConversation } from './useConversations';
export { useMessages, useSendMessage, useAddMessageToCache, useAddChatwootMessageToCache } from './useMessages';
export { useMessagingController } from './useMessagingController';

// New messaging hooks for embedded chat
export { useAgents } from './useAgents';
export { useAssignConversation } from './useAssignConversation';
export { useToggleStatus } from './useToggleStatus';
export { useSendPrivateNote } from './useSendPrivateNote';
export { useMarkAsRead } from './useMarkAsRead';
export { useMessagingRealtime } from './useMessagingRealtime';
export { useAudioRecorder } from './useAudioRecorder';
export { useUploadAttachment } from './useUploadAttachment';
