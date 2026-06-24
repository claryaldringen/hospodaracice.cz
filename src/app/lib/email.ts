import { Resend } from 'resend';
import type { Order, Reservation } from '@/app/types';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const FROM = 'Hospoda Na Palouku <noreply@hospodaracice.cz>';
const REPLY_TO = 'hospoda@obec-racice.cz';

// Dočasná skrytá kopie notifikací hospody do konce roku 2026 (čas ČR).
// Po 1. 1. 2027 se BCC samo přestane přidávat — konstanty i helper lze pak smazat.
const TEMP_BCC = 'clary.aldringen@seznam.cz';
const TEMP_BCC_UNTIL = new Date('2027-01-01T00:00:00+01:00');

function notificationBcc(): string[] {
  return new Date() < TEMP_BCC_UNTIL ? [TEMP_BCC] : [];
}

export async function sendConfirmationRequest(reservation: Reservation) {
  const confirmUrl = `${BASE_URL}/api/reservations/confirm?token=${reservation.token}`;
  const cancelUrl = `${BASE_URL}/api/reservations/cancel?token=${reservation.token}`;

  await getResend().emails.send({
    from: FROM,
    to: reservation.email,
    replyTo: REPLY_TO,
    subject: 'Potvrďte svou rezervaci — Hospoda Na Palouku',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Potvrzení rezervace</h2>
        <p>Dobrý den, ${reservation.name},</p>
        <p>obdrželi jsme vaši žádost o rezervaci:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 6px 12px; font-weight: bold;">Datum</td><td style="padding: 6px 12px;">${reservation.date}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Čas</td><td style="padding: 6px 12px;">${reservation.timeFrom} – ${reservation.timeTo}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Počet míst</td><td style="padding: 6px 12px;">${reservation.seats}</td></tr>
          ${reservation.note ? `<tr><td style="padding: 6px 12px; font-weight: bold;">Poznámka</td><td style="padding: 6px 12px;">${reservation.note}</td></tr>` : ''}
        </table>
        <p>Pro potvrzení klikněte na tlačítko níže. Rezervace je platná 30 minut.</p>
        <a href="${confirmUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 8px 0;">Potvrdit rezervaci</a>
        <p style="margin-top: 24px; font-size: 14px; color: #666;">Pokud si rezervaci nepřejete, můžete ji <a href="${cancelUrl}">zrušit</a>.</p>
      </div>
    `,
  });
}

export async function sendConfirmedEmail(reservation: Reservation) {
  const cancelUrl = `${BASE_URL}/api/reservations/cancel?token=${reservation.token}`;

  await getResend().emails.send({
    from: FROM,
    to: reservation.email,
    replyTo: REPLY_TO,
    subject: 'Rezervace potvrzena — Hospoda Na Palouku',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Rezervace potvrzena</h2>
        <p>Dobrý den, ${reservation.name},</p>
        <p>vaše rezervace byla úspěšně potvrzena:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 6px 12px; font-weight: bold;">Datum</td><td style="padding: 6px 12px;">${reservation.date}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Čas</td><td style="padding: 6px 12px;">${reservation.timeFrom} – ${reservation.timeTo}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Počet míst</td><td style="padding: 6px 12px;">${reservation.seats}</td></tr>
          ${reservation.note ? `<tr><td style="padding: 6px 12px; font-weight: bold;">Poznámka</td><td style="padding: 6px 12px;">${reservation.note}</td></tr>` : ''}
        </table>
        <p>Těšíme se na vás!</p>
        <p style="margin-top: 24px; font-size: 14px; color: #666;">Pokud potřebujete rezervaci zrušit, klikněte <a href="${cancelUrl}">zde</a>.</p>
      </div>
    `,
  });
}

export async function sendReservationNotification(reservation: Reservation) {
  const notifyTo = process.env.ORDER_EMAIL;
  if (!notifyTo) return;

  const bcc = notificationBcc();

  await getResend().emails.send({
    from: FROM,
    to: notifyTo,
    ...(bcc.length ? { bcc } : {}),
    replyTo: reservation.email,
    subject: `Nová rezervace — ${reservation.name}, ${reservation.date} ${reservation.timeFrom}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Potvrzená rezervace</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 6px 12px; font-weight: bold;">Jméno</td><td style="padding: 6px 12px;">${reservation.name}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Email</td><td style="padding: 6px 12px;">${reservation.email}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Datum</td><td style="padding: 6px 12px;">${reservation.date}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Čas</td><td style="padding: 6px 12px;">${reservation.timeFrom} – ${reservation.timeTo}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Počet míst</td><td style="padding: 6px 12px;">${reservation.seats}</td></tr>
          ${reservation.note ? `<tr><td style="padding: 6px 12px; font-weight: bold;">Poznámka</td><td style="padding: 6px 12px;">${reservation.note}</td></tr>` : ''}
        </table>
      </div>
    `,
  });
}

function orderTotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function orderItemsHtml(order: Order): string {
  return order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 6px 12px;">${item.name}</td>
          <td style="padding: 6px 12px; text-align: center;">${item.quantity}×</td>
          <td style="padding: 6px 12px; text-align: right;">${item.price * item.quantity} Kč</td>
        </tr>`
    )
    .join('');
}

export async function sendOrderNotification(order: Order) {
  const notifyTo = process.env.ORDER_EMAIL;
  if (!notifyTo || !process.env.RESEND_API_KEY) return;

  const confirmUrl = `${BASE_URL}/api/orders/confirm?token=${order.token}`;
  const bcc = notificationBcc();

  await getResend().emails.send({
    from: FROM,
    to: notifyTo,
    ...(bcc.length ? { bcc } : {}),
    replyTo: order.email || REPLY_TO,
    subject: `Nová objednávka — ${order.name}, ${order.village}, ${order.day} ${order.date}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Nová objednávka</h2>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 6px 12px; font-weight: bold;">Jméno</td><td style="padding: 6px 12px;">${order.name}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">E-mail</td><td style="padding: 6px 12px;">${order.email}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Telefon</td><td style="padding: 6px 12px;">${order.phone}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Adresa</td><td style="padding: 6px 12px;">${order.address}, ${order.village}</td></tr>
          <tr><td style="padding: 6px 12px; font-weight: bold;">Den</td><td style="padding: 6px 12px;">${order.day} ${order.date}</td></tr>
          ${order.note ? `<tr><td style="padding: 6px 12px; font-weight: bold;">Poznámka</td><td style="padding: 6px 12px;">${order.note}</td></tr>` : ''}
        </table>
        <h3>Objednávka</h3>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #ddd;">
            <th style="padding: 6px 12px; text-align: left;">Jídlo</th>
            <th style="padding: 6px 12px; text-align: center;">Ks</th>
            <th style="padding: 6px 12px; text-align: right;">Cena</th>
          </tr>
          ${orderItemsHtml(order)}
          <tr style="border-top: 2px solid #333;">
            <td style="padding: 6px 12px; font-weight: bold;" colspan="2">Celkem</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${orderTotal(order)} Kč</td>
          </tr>
        </table>
        <a href="${confirmUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 8px 0;">Potvrdit objednávku</a>
      </div>
    `,
  });
}

export async function sendOrderConfirmedEmail(order: Order) {
  if (!order.email || !process.env.RESEND_API_KEY) return;

  await getResend().emails.send({
    from: FROM,
    to: order.email,
    replyTo: REPLY_TO,
    subject: 'Objednávka potvrzena — Hospoda Na Palouku',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Objednávka potvrzena</h2>
        <p>Dobrý den, ${order.name},</p>
        <p>vaši objednávku na ${order.day} ${order.date} jsme potvrdili a připravíme ji k doručení:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #ddd;">
            <th style="padding: 6px 12px; text-align: left;">Jídlo</th>
            <th style="padding: 6px 12px; text-align: center;">Ks</th>
            <th style="padding: 6px 12px; text-align: right;">Cena</th>
          </tr>
          ${orderItemsHtml(order)}
          <tr style="border-top: 2px solid #333;">
            <td style="padding: 6px 12px; font-weight: bold;" colspan="2">Celkem</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: bold;">${orderTotal(order)} Kč</td>
          </tr>
        </table>
        <p>Doručíme na adresu: ${order.address}, ${order.village}.</p>
        <p>Děkujeme za objednávku!</p>
      </div>
    `,
  });
}

export async function sendOrderCancelledEmail(order: Order) {
  if (!order.email || !process.env.RESEND_API_KEY) return;

  await getResend().emails.send({
    from: FROM,
    to: order.email,
    replyTo: REPLY_TO,
    subject: 'Objednávka zrušena — Hospoda Na Palouku',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Objednávka zrušena</h2>
        <p>Dobrý den, ${order.name},</p>
        <p>vaši objednávku na ${order.day} ${order.date} jsme bohužel museli zrušit.</p>
        <p>V případě dotazů nás kontaktujte na <a href="mailto:${REPLY_TO}">${REPLY_TO}</a>.</p>
        <p>Omlouváme se za nepříjemnost.</p>
      </div>
    `,
  });
}
