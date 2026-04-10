# Objednávkový systém z denní nabídky — design spec

## Přehled

Zákazník si objedná jídla z týdenní nabídky k rozvozu do okolních obcí. Nabídka se parsuje z obrázku (`weekly.webp`) přes Claude Vision do strukturovaného JSONu. Objednávka přijde emailem na hospodu.

## Vylepšení OCR → strukturovaná nabídka

Při uploadu obrázku `weekly` se kromě stávajícího OCR textu (`weekly.json`) vygeneruje i strukturovaný `weekly-menu.json`:

```json
{
  "days": [
    {
      "day": "Pondělí",
      "date": "2026-03-30",
      "meals": [
        { "name": "Svíčková na smetaně", "price": 145 },
        { "name": "Smažený řízek", "price": 135 }
      ]
    }
  ]
}
```

Prompt pro Claude Vision bude instruovat model, aby vrátil JSON s dny a jídly včetně cen. Upload API route (`api/upload/route.ts`) se rozšíří — při typu `weekly` se volá druhý dotaz na Vision s JSON výstupem.

## Admin — správa obcí

Nová sekce v admin panelu: "Rozvoz — obce". Textarea se seznamem obcí (jedna na řádek). Ukládá se jako `delivery-villages.json` v Blob (formát: `{ "villages": ["Račice", "Zbečno", ...] }`).

## API Routes

### `GET /api/menu`

Vrátí strukturovanou nabídku z `weekly-menu.json`. Veřejné.

Response:
```json
{
  "days": [...]
}
```

Pokud `weekly-menu.json` neexistuje, vrátí `{ "days": [] }`.

### `GET /api/delivery-villages`

Vrátí seznam obcí. Veřejné.

Response: `{ "villages": ["Račice", "Zbečno", ...] }`

### `POST /api/delivery-villages`

Uloží seznam obcí. Vyžaduje autorizaci.

Body: `{ "villages": "Račice\nZbečno\nKřivoklát" }` (text, jeden řádek = obec)

### `POST /api/orders`

Vytvoří objednávku — pošle email na `ORDER_EMAIL`. Veřejné.

Body:
```json
{
  "name": "Jan Novák",
  "phone": "+420 123 456 789",
  "address": "Hlavní 42",
  "village": "Račice",
  "note": "Zvonek nefunguje",
  "day": "Pondělí",
  "date": "2026-03-30",
  "items": [
    { "name": "Svíčková na smetaně", "price": 145, "quantity": 2 },
    { "name": "Smažený řízek", "price": 135, "quantity": 1 }
  ]
}
```

Response: `{ "ok": true }`

Validace: alespoň 1 položka, všechna povinná pole vyplněna, obec musí být v seznamu.

## Datový model

```typescript
interface MenuItem {
  name: string;
  price: number;
}

interface MenuDay {
  day: string;
  date: string;
  meals: MenuItem[];
}

interface WeeklyMenu {
  days: MenuDay[];
}

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface OrderRequest {
  name: string;
  phone: string;
  address: string;
  village: string;
  note?: string;
  day: string;
  date: string;
  items: OrderItem[];
}
```

## Email objednávky

Odesílá se přes Resend na `ORDER_EMAIL`. Formát:

Předmět: `Nová objednávka — {jméno}, {obec}, {den} {datum}`

Obsah: shrnutí objednávky (jméno, telefon, adresa, obec, seznam jídel s počtem a cenou, celková cena, poznámka).

## Veřejná stránka `/objednavka`

Client component. Načte nabídku z `/api/menu` a seznam obcí z `/api/delivery-villages`.

- Zobrazí nabídku po dnech (jen budoucí dny)
- U každého jídla +/- pro počet porcí
- Formulář: jméno, telefon, adresa, obec (select), poznámka
- Zobrazení celkové ceny
- Po odeslání: "Objednávka odeslána!"

## Navigace

Odkaz "Objednávka" v Navigation.tsx (vedle Rezervace).

## Env proměnné

- `ORDER_EMAIL` — emailová adresa hospody pro příjem objednávek
