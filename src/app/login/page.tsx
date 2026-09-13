import { redirect } from 'next/navigation';
import WardrobeApp from '@/components/WardrobeApp';
import { sessionUser } from '@/server/auth';

export default async function Login() {
  if (await sessionUser()) redirect('/');
  return <WardrobeApp initialAccountOpen />;
}
