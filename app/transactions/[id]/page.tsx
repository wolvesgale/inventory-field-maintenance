import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import TransactionFormPage from '../TransactionFormPage';
import { authOptions } from '@/auth';
import { getTransactionById } from '@/lib/sheets';

export default async function TransactionEditPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }

  const tx = await getTransactionById(params.id);
  if (!tx) {
    redirect('/transactions');
  }

  if (
    (session.user as any)?.role === 'worker' &&
    (session.user as any)?.id &&
    (session.user as any)?.id !== (tx.user_id || tx.user_name)
  ) {
    redirect('/transactions');
  }

  return <TransactionFormPage mode="edit" initialTransaction={tx} />;
}
