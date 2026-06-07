import { Booking, ScheduleBlock } from './types';

const BOOKINGS_KEY = 'classea_bookings';
const COMPLETED_KEY = 'classea_completed';
const BLOCKS_KEY = 'studiogaby_blocks';

export function getBlocks(): ScheduleBlock[] {
  return JSON.parse(localStorage.getItem(BLOCKS_KEY) || '[]');
}

export function saveBlocks(blocks: ScheduleBlock[]): void {
  localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
}

export function addBlock(block: ScheduleBlock): void {
  const blocks = getBlocks();
  blocks.push(block);
  saveBlocks(blocks);
}

export function removeBlock(id: string): void {
  const blocks = getBlocks().filter(b => b.id !== id);
  saveBlocks(blocks);
}

export function getBookings(): Booking[] {
  return JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]');
}

export function saveBookings(bookings: Booking[]): void {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
}

export function addBooking(booking: Booking): void {
  const bookings = getBookings();
  bookings.push(booking);
  saveBookings(bookings);
}

export function removeBooking(id: string): void {
  const bookings = getBookings().filter(b => b.id !== id);
  saveBookings(bookings);
}

export function getCompleted(): Booking[] {
  return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]');
}

export function saveCompleted(completed: Booking[]): void {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
}

export function addCompleted(booking: Booking): void {
  const completed = getCompleted();
  completed.push({ ...booking, status: 'completed' });
  saveCompleted(completed);
}

export function removeCompleted(id: string): Booking | undefined {
  const completed = getCompleted();
  const removed = completed.find(b => b.id === id);
  saveCompleted(completed.filter(b => b.id !== id));
  return removed;
}
