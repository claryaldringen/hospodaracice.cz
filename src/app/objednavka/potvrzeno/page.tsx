import Link from 'next/link';

const MESSAGES: Record<string, { title: string; text: string }> = {
  confirmed: {
    title: 'Objednávka potvrzena',
    text: 'Objednávka byla potvrzena. Zákazníkovi jsme poslali potvrzovací e-mail.',
  },
  already: {
    title: 'Již potvrzeno',
    text: 'Tato objednávka už byla potvrzena dříve.',
  },
  cancelled: {
    title: 'Objednávku nelze potvrdit',
    text: 'Tuto objednávku nelze potvrdit — byla zrušena.',
  },
  notfound: {
    title: 'Objednávka nenalezena',
    text: 'Objednávka nebyla nalezena. Odkaz může být neplatný.',
  },
};

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const msg = MESSAGES[status ?? ''] ?? MESSAGES.notfound;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{msg.title}</h1>
      <p className="max-w-md text-gray-600">{msg.text}</p>
      <Link
        href="/"
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700"
      >
        Zpět na web
      </Link>
    </main>
  );
}
