# Právní náležitosti webu — Design Spec

## Přehled

Doplnění zákonných náležitostí na web restaurace: identifikační údaje provozovatele, GDPR zásady, informace o alergenech, souhlas se zpracováním osobních údajů u formulářů.

## Provozovatel

- **Název:** Obec Račice
- **IČO:** 16981901
- **Adresa:** Račice 65, 270 24 Račice
- **Telefon:** 702 181 247
- **Email:** hospoda@obec-racice.cz

## Změny

### 1. Footer — identifikační údaje

Přidat do stávajícího Footer komponentu (`src/app/components/Footer.tsx`) sekci s údaji provozovatele:

```
Provozovatel: Obec Račice, IČO: 16981901
Račice 65, 270 24 Račice
Tel: 702 181 247 | hospoda@obec-racice.cz
```

Také přidat odkaz na stránku ochrany osobních údajů.

### 2. Stránka `/ochrana-osobnich-udaju`

Nová stránka se zásadami ochrany osobních údajů. Obsah:

- **Správce:** Obec Račice, IČO 16981901, Račice 65, 270 24 Račice
- **Sbírané údaje:** jméno, email (rezervace); jméno, telefon, adresa (objednávky)
- **Účel zpracování:** vyřízení rezervace / doručení objednávky
- **Právní základ:** plnění smlouvy (čl. 6 odst. 1 písm. b GDPR)
- **Doba uchování:** 30 dní od vytvoření (automatický cleanup v systému)
- **Cookies:** pouze technický session cookie pro administraci, bez analytických/marketingových cookies, cookie lišta není nutná
- **Práva subjektu údajů:** přístup, oprava, výmaz, omezení zpracování, přenositelnost, námitka, podání stížnosti u ÚOOÚ
- **Kontakt pro GDPR:** hospoda@obec-racice.cz

Server-rendered statická stránka, žádné API, žádná DB. Stylování konzistentní se zbytkem webu (černé pozadí, bílý text).

### 3. Informace o alergenech

Přidat pod sekci menu obrázků na homepage krátkou poznámku:

```
Informace o alergenech podáme na vyžádání — tel. 702 181 247
```

Tato poznámka se zobrazí v `MenuImages` komponentu pod jídelním lístkem.

### 4. Checkbox souhlasu u formulářů

Přidat na oba formuláře (rezervace `/rezervace`, objednávka `/objednavka`) checkbox:

```
☐ Souhlasím se zpracováním osobních údajů za účelem vyřízení rezervace/objednávky.
```

S odkazem na `/ochrana-osobnich-udaju`. Formulář nelze odeslat bez zaškrtnutí (client-side validace).

## Soubory k úpravě

| Soubor | Změna |
|---|---|
| `src/app/components/Footer.tsx` | Přidat identifikační údaje + odkaz na GDPR |
| `src/app/components/MenuImages.tsx` | Přidat poznámku o alergenech |
| `src/app/ochrana-osobnich-udaju/page.tsx` | Nová stránka — GDPR zásady |
| `src/app/rezervace/page.tsx` | Přidat GDPR checkbox |
| `src/app/components/OrderForm.tsx` | Přidat GDPR checkbox |
| `src/app/sitemap.ts` | Přidat `/ochrana-osobnich-udaju` |

## Co se nedělá

- Obchodní podmínky (nejedná se o e-shop)
- Cookie lišta (jen technický session cookie)
- Reklamační řád (jde o objednávky jídla, ne zboží)
