import { query, queryOne } from './db';
import type { Reservation } from '@/app/types';

const PENDING_TIMEOUT = '30 minutes';

interface ReservationRow {
  id: string;
  name: string;
  email: string;
  seats: number;
  date: string;
  time_from: string;
  time_to: string;
  note: string | null;
  status: string;
  token: string;
  created_at: Date;
}

function mapRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    seats: row.seats,
    date: row.date,
    timeFrom: row.time_from,
    timeTo: row.time_to,
    note: row.note ?? undefined,
    status: row.status as Reservation['status'],
    token: row.token,
    createdAt: row.created_at.toISOString(),
  };
}

const ACTIVE_CONDITION = `(status = 'confirmed' OR (status = 'pending' AND created_at > NOW() - INTERVAL '${PENDING_TIMEOUT}'))`;

export async function createReservation(reservation: Reservation): Promise<void> {
  await query(
    `INSERT INTO reservations (id, name, email, seats, date, time_from, time_to, note, status, token, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      reservation.id,
      reservation.name,
      reservation.email,
      reservation.seats,
      reservation.date,
      reservation.timeFrom,
      reservation.timeTo,
      reservation.note ?? null,
      reservation.status,
      reservation.token,
      reservation.createdAt,
    ]
  );
}

export async function findByToken(token: string): Promise<Reservation | null> {
  const row = await queryOne<ReservationRow>('SELECT * FROM reservations WHERE token = $1', [
    token,
  ]);
  return row ? mapRow(row) : null;
}

export async function findById(id: string): Promise<Reservation | null> {
  const row = await queryOne<ReservationRow>('SELECT * FROM reservations WHERE id = $1', [id]);
  return row ? mapRow(row) : null;
}

export async function updateStatus(id: string, status: Reservation['status']): Promise<void> {
  await query('UPDATE reservations SET status = $1 WHERE id = $2', [status, id]);
}

export async function getReservationsByDate(date: string): Promise<Reservation[]> {
  const rows = await query<ReservationRow>(
    `SELECT * FROM reservations WHERE date = $1 AND ${ACTIVE_CONDITION} ORDER BY time_from`,
    [date]
  );
  return rows.map(mapRow);
}

export async function getReservedSeats(
  date: string,
  timeFrom: string,
  timeTo: string
): Promise<number> {
  const rows = await query<{ total: string }>(
    `SELECT COALESCE(SUM(seats), 0) as total FROM reservations
     WHERE date = $1 AND time_from < $3 AND time_to > $2 AND ${ACTIVE_CONDITION}`,
    [date, timeFrom, timeTo]
  );
  return parseInt(rows[0]?.total ?? '0', 10);
}

export function getTotalSeats(): number {
  return parseInt(process.env.TOTAL_SEATS || '40', 10);
}
