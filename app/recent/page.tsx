import type { Metadata } from 'next';
import { RecentScreen } from '@/ui/screens/RecentScreen';

export const metadata: Metadata = { title: 'Recent' };

export default function RecentPage() {
  return <RecentScreen />;
}
