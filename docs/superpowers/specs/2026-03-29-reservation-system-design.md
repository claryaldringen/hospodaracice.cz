# Rezervační systém — design spec

## Přehled

Veřejný rezervační systém pro Hospodu Na Palouku. Hosté si rezervují počet míst na konkrétní časový rozsah (datum, čas od–do). Systém hlídá celkovou kapacitu (z env `TOTAL_SEATS`) a vyžaduje potvrzení emailem.

## Datový model

Rezervace se ukládají jako JSON pole v `reservations.json` ve Vercel Blob.

```typescript
interface Reservation {
  id: string;             // nanoid
  name: string;
  email: string;
  seats: number;
  date: string;           // "2026-04-15"
  timeFrom: string;       // "18:00"
  timeTo: string;         // "21:00"
  note?: string;
  status: "pending" | "confirmed" | "cancelled";
  token: string;          // potvrzovací/zrušovací token
  createdAt: string;      // ISO timestamp
}
```

## Env proměnné

- `TOTAL_SEATS` — celková kapacita hospody (počet míst)
- `RESEND_API_KEY` — API klíč pro Resend (odesílání emailů)
- `NEXT_PUBLIC_BASE_URL` — veřejná URL webu (pro odkazy v emailech)

## Flow rezervace

1. Host otevře `/rezervace` a vyplní formulář (jméno, email, počet míst, datum, čas od, čas do, poznámka)
2. Klient nejdřív ověří dostupnost přes GET `/api/reservations/availability`
3. Server vytvoří rezervaci se statusem `pending`, uloží do Blob, pošle potvrzovací email přes Resend
4. Host klikne na potvrzovací odkaz v emailu → GET `/api/reservations/confirm?token=xxx` → status se změní na `confirmed`, host dostane potvrzovací email se shrnutím
5. Nepotvrzené (`pending`) rezervace starší než 30 minut se ignorují při výpočtu kapacity

## Kontrola kapacity

Pro daný den a časový rozsah se sečtou místa všech aktivních rezervací (confirmed + pending < 30 min), které se časově překrývají s požadovaným rozsahem. Překryv = `existující.timeFrom < nová.timeTo && existující.timeTo > nová.timeFrom`. Pokud součet + nová rezervace > `TOTAL_SEATS`, systém odmítne.

## API Routes

### `GET /api/reservations/availability?date=YYYY-MM-DD`

Vrátí obsazenost po hodinách pro daný den. Veřejné (bez autorizace).

Response:
```json
{
  "date": "2026-04-15",
  "totalSeats": 40,
  "hours": [
    { "hour": "11:00", "reserved": 12 },
    { "hour": "12:00", "reserved": 28 },
    ...
  ]
}
```

### `POST /api/reservations`

Vytvoří novou rezervaci. Veřejné.

Body:
```json
{
  "name": "Jan Novák",
  "email": "jan@example.com",
  "seats": 4,
  "date": "2026-04-15",
  "timeFrom": "18:00",
  "timeTo": "21:00",
  "note": "Narozeninová oslava"
}
```

Response: `{ "ok": true }` nebo `{ "error": "Nedostatek volných míst" }` (409).

### `GET /api/reservations/confirm?token=xxx`

Potvrdí rezervaci. Přesměruje na `/rezervace?confirmed=1`.

### `GET /api/reservations/cancel?token=xxx`

Zruší rezervaci. Přesměruje na `/rezervace?cancelled=1`.

### `GET /api/reservations/list` (admin)

Vrátí všechny rezervace pro daný den. Vyžaduje autorizaci (session cookie).

Query: `?date=YYYY-MM-DD`

### `POST /api/reservations/admin-cancel` (admin)

Zruší rezervaci podle ID. Vyžaduje autorizaci.

Body: `{ "id": "xxx" }`

## Úložiště (Vercel Blob)

Soubor `reservations.json` — pole všech rezervací. Při každém zápisu se načte celý soubor, upraví a zapíše zpět. Pro malou hospodu je toto dostatečné.

Staré rezervace (datum < dnes - 30 dní) se při zápisu automaticky odstraní, aby soubor nerostl neomezeně.

## Veřejná stránka `/rezervace`

Client component s formulářem:

- Jméno (povinné)
- Email (povinný)
- Počet míst (povinný, číslo)
- Datum (povinné, date picker, min = dnes)
- Čas od (povinný, select)
- Čas do (povinný, select)
- Poznámka (volitelná, textarea)

Po výběru data se zobrazí vizuální přehled obsazenosti (z `/api/reservations/availability`). Po odeslání se zobrazí zpráva "Zkontrolujte email a potvrďte rezervaci".

Query parametry `?confirmed=1` a `?cancelled=1` zobrazí příslušnou zprávu.

## Admin panel

Do stávajícího `/admin` se přidá sekce "Rezervace":

- Date picker pro výběr dne
- Seznam rezervací na vybraný den (jméno, email, místa, čas, status)
- Tlačítko "Zrušit" u každé rezervace
- Zobrazení celkové obsazenosti

## Emaily (Resend)

### Potvrzovací email (po vytvoření rezervace)

Předmět: `Potvrďte svou rezervaci — Hospoda Na Palouku`

Obsah: shrnutí rezervace + tlačítko/odkaz na potvrzení + odkaz na zrušení.

### Email po potvrzení

Předmět: `Rezervace potvrzena — Hospoda Na Palouku`

Obsah: shrnutí potvrzené rezervace + odkaz na zrušení.

## Navigace

Do Navigation.tsx se přidá odkaz "Rezervace" směřující na `/rezervace`.

## Závislosti

- `resend` — npm balíček pro odesílání emailů
- `nanoid` — generování unikátních ID a tokenů
