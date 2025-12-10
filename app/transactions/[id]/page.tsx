import TransactionFormPage from '../TransactionFormPage';

export default function TransactionEditPage({ params }: { params: { id: string } }) {
  return <TransactionFormPage initialEditId={params.id} />;
}
