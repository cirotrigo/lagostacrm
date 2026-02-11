'use client';

import dynamic from 'next/dynamic';

const MessagingPage = dynamic(
  () => import('@/features/messaging/MessagingPage'),
  { ssr: false }
);

export default function MessagingRoute() {
  return <MessagingPage />;
}
