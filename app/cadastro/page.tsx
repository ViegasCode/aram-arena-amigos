import { getChatGPTUser } from '@/app/chatgpt-auth';
import Enrollment from './enrollment';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cadastro de jogador | ARAM Arena' };
export default async function Signup() {
  const user = await getChatGPTUser();
  return <Enrollment signedIn={!!user} />;
}
