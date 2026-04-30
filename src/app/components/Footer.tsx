const DEFAULT_HOURS = [
  'Pondělí: ZAVŘENO',
  'Úterý: 11:00 až 15:00',
  'Středa: 11:00 až 15:00',
  'Čtvrtek: 11:00 až 15:00',
  'Pátek: 11:00 až 23:00',
  'Sobota: 11:00 až 23:00',
  'Neděle: 11:00 až 19:00',
];

export default function Footer({ openingHours }: { openingHours?: string }) {
  const lines =
    openingHours && openingHours.trim().length > 0
      ? openingHours.split('\n').filter((l) => l.trim().length > 0)
      : DEFAULT_HOURS;

  return (
    <footer id="contact" className="bg-white p-6 mt-10">
      <div className="flex flex-col md:flex-row justify-between">
        <div className="w-full md:w-1/3 p-4 space-y-2">
          <h2 className="text-xl font-semibold mb-2">Kontakt</h2>
          <p>Hospoda na Palouku</p>
          <p>Adresa: Račice 42, 270 24 Račice</p>
          <p>
            Telefon:{' '}
            <a href="tel:+420702181247" className="text-blue-500 hover:underline">
              +420 702 181 247
            </a>
            ,{' '}
            <a href="tel:+420603263291" className="text-blue-500 hover:underline">
              +420 603 263 291
            </a>
          </p>
          <p>
            Email:{' '}
            <a href="mailto:hospoda@obec-racice.cz" className="text-blue-500 hover:underline">
              hospoda@obec-racice.cz
            </a>
          </p>
          <p>
            Facebook:{' '}
            <a
              href="https://www.facebook.com/napaloukuracice"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              facebook.com/hospodanapalouku
            </a>
          </p>
        </div>

        <div className="w-full md:w-1/3 p-4 space-y-2">
          <h2 className="text-xl font-semibold mb-2">Otevírací doba</h2>
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        <div className="w-full md:w-1/3 h-64">
          <iframe
            src="https://frame.mapy.cz/s/jumomubodo"
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            title="Mapa - Hospoda na Palouku"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 mt-6 pt-4 px-4 text-center text-sm text-gray-500">
        <p>Provozovatel: Obec Račice, IČO: 16981901 | Račice 65, 270 24 Račice</p>
        <p className="mt-1">
          <a href="/ochrana-osobnich-udaju" className="text-blue-500 hover:underline">
            Ochrana osobních údajů
          </a>
        </p>
      </div>
    </footer>
  );
}
