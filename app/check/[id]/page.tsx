import { CheckScreen } from '@/ui/screens/CheckScreen';

export default async function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckScreen id={decodeURIComponent(id)} />;
}
