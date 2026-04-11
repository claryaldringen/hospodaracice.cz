import Navigation from '@/app/components/Navigation';

export const metadata = {
  title: 'Ochrana osobních údajů — Hospoda Na Palouku',
};

export default function PrivacyPage() {
  return (
    <div>
      <Navigation visibleImages={{ action: false, weekly: false, permanent: false }} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 text-white">
        <h1 className="mb-8 text-3xl font-bold">Ochrana osobních údajů</h1>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Správce osobních údajů</h2>
          <p>Obec Račice, IČO: 16981901</p>
          <p>Račice 65, 270 24 Račice</p>
          <p>
            Email:{' '}
            <a href="mailto:hospoda@obec-racice.cz" className="text-blue-400 hover:underline">
              hospoda@obec-racice.cz
            </a>
          </p>
          <p>
            Telefon:{' '}
            <a href="tel:+420702181247" className="text-blue-400 hover:underline">
              702 181 247
            </a>
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Jaké údaje zpracováváme</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Rezervace:</strong> jméno, email, počet míst, datum a čas, poznámka
            </li>
            <li>
              <strong>Objednávky:</strong> jméno, telefon, adresa, obec, poznámka
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Účel zpracování</h2>
          <p>
            Osobní údaje zpracováváme výhradně za účelem vyřízení vaší rezervace nebo doručení
            objednávky.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Právní základ</h2>
          <p>
            Zpracování je nezbytné pro plnění smlouvy, jejíž smluvní stranou je subjekt údajů (čl. 6
            odst. 1 písm. b) obecného nařízení o ochraně osobních údajů — GDPR).
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Doba uchování</h2>
          <p>
            Údaje o rezervacích a objednávkách jsou automaticky odstraněny 30 dní po jejich
            vytvoření.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Cookies</h2>
          <p>
            Tento web používá pouze technický session cookie nezbytný pro přihlášení do
            administrace. Nepoužíváme žádné analytické, marketingové ani cookies třetích stran.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Vaše práva</h2>
          <p className="mb-2">V souvislosti se zpracováním osobních údajů máte právo na:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>přístup ke svým osobním údajům</li>
            <li>opravu nepřesných údajů</li>
            <li>výmaz údajů</li>
            <li>omezení zpracování</li>
            <li>přenositelnost údajů</li>
            <li>námitku proti zpracování</li>
            <li>
              podání stížnosti u Úřadu pro ochranu osobních údajů (
              <a
                href="https://www.uoou.cz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                www.uoou.cz
              </a>
              )
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Kontakt</h2>
          <p>
            S dotazy ohledně ochrany osobních údajů se obracejte na{' '}
            <a href="mailto:hospoda@obec-racice.cz" className="text-blue-400 hover:underline">
              hospoda@obec-racice.cz
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
