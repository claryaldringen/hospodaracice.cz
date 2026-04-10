import { Resend } from 'resend';
import type { Reservation } from '@/app/types';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const FROM = 'Hospoda Na Palouku <noreply@resend.dev>';

export async function sendConfirmationRequest(reservation: Reservation) {
  const confirmUrl = `${BASE_URL}/api/reservations/confirm?token=${reservation.token}`;
  const cancelUrl = `${BASE_URL}/api/reservations/cancel?token=${reservation.token}`;

  await getResend().emails.send({
    from: FROM,
    to: reservation.email,
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
