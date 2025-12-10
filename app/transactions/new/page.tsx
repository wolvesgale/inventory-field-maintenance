import TransactionFormPage from '../TransactionFormPage';

interface PageProps {
  searchParams?: Record<string, string | string[]>;
}

export default function NewTransactionPage({ searchParams }: PageProps) {
  const editIdParam =
    typeof searchParams?.editId === 'string'
      ? searchParams.editId
      : Array.isArray(searchParams?.editId)
      ? searchParams?.editId[0]
      : null;

  return <TransactionFormPage initialEditId={editIdParam} />;
}
