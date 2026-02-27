export default function Footer() {
  return (
    <footer id="contact" className="bg-white p-6 mt-10">
      <div className="flex flex-col md:flex-row justify-between">
        <div className="w-full md:w-1/3 p-4 space-y-2">
          <h2 className="text-xl font-semibold mb-2">Kontakt</h2>
          <p>Hospoda na Palouku</p>
          <p>Adresa: Račice 42, 270 24 Račice</p>
          <p>
            Telefon:{' '}
            <a href="tel:+420702181347" className="text-blue-500 hover:underline">
              +420 702 181 347
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
          <p>Pondělí: ZAVŘENO</p>
          <p>Úterý: 11:00 až 15:00</p>
          <p>Středa: 11:00 až 15:00</p>
          <p>Čtvrtek 11:00 až 15:00</p>
          <p>Pátek: 11:00 až 23:00</p>
          <p>Sobota: 11:00 až 23:00</p>
          <p>Neděle: 11:00 až 19:00</p>
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
    </footer>
  );
}
