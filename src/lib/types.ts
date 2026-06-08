export interface Service {
  name: string;
  time: number;
  price: number;
  image: string;
  category: string;
}

export interface ScheduleBlock {
  id: string;
  date: string;
  allDay: boolean;
  start?: string;
  end?: string;
  reason: string;
}

export interface Booking {
  id: string;
  service: string;
  price: number;
  date: string;
  time: string;
  name: string;
  phone: string;
  status: 'pending' | 'accepted' | 'completed';
}

export const SERVICES: Service[] = [
  // Categoria: Unhas
  { name: 'Alongamento (Fibra de vidro)', time: 180, price: 135, image: 'https://i.imgur.com/AJQylcN.webp', category: 'Unhas' },
  { name: 'Manutenção de alongamento', time: 180, price: 95, image: 'https://i.imgur.com/Fy4vWem.webp', category: 'Unhas' },
  { name: 'Banho de Gel', time: 180, price: 85, image: 'https://i.imgur.com/158QzCm.webp', category: 'Unhas' },
  { name: 'Esmaltação em Gel', time: 120, price: 60, image: 'https://i.imgur.com/rGFS09Y.webp', category: 'Unhas' },
  { name: 'Remoção', time: 120, price: 20, image: 'https://i.imgur.com/b2U1d2I.webp', category: 'Unhas' },

  // Categoria: Cílios - Aplicação
  { name: 'Efeito Molhado (Aplicação)', time: 180, price: 125, image: 'https://i.imgur.com/XWtg2Hu.webp', category: 'Cílios - Aplicação' },
  { name: 'Volume Brasileiro (Aplicação)', time: 180, price: 135, image: 'https://i.imgur.com/WRS7NWw.webp', category: 'Cílios - Aplicação' },
  { name: 'Volume Egípcio 3D (Aplicação)', time: 180, price: 140, image: 'https://i.imgur.com/aIBWRgv.webp', category: 'Cílios - Aplicação' },
  { name: 'Efeito Sirena (Aplicação)', time: 180, price: 135, image: 'https://i.imgur.com/lqyeUni.webp', category: 'Cílios - Aplicação' },
  { name: 'Efeito Fox (Aplicação)', time: 180, price: 150, image: 'https://i.imgur.com/231xZUC.webp', category: 'Cílios - Aplicação' },
  { name: 'Volume Inglês 5D (Aplicação)', time: 180, price: 155, image: 'https://i.imgur.com/tczQCXR.webp', category: 'Cílios - Aplicação' },
  { name: 'Volume Luxo 6D (Aplicação)', time: 180, price: 160, image: 'https://i.imgur.com/MRHHhmd.webp', category: 'Cílios - Aplicação' },
  { name: 'Remoção (Cílios)', time: 60, price: 20, image: 'https://i.imgur.com/EWYwzY0.webp', category: 'Cílios - Aplicação' },

  // Categoria: Cílios - Manutenção
  { name: 'Efeito Molhado (Manutenção)', time: 180, price: 80, image: 'https://i.imgur.com/XWtg2Hu.webp', category: 'Cílios - Manutenção' },
  { name: 'Volume Brasileiro (Manutenção)', time: 180, price: 85, image: 'https://i.imgur.com/WRS7NWw.webp', category: 'Cílios - Manutenção' },
  { name: 'Volume Egípcio 3D (Manutenção)', time: 180, price: 95, image: 'https://i.imgur.com/aIBWRgv.webp', category: 'Cílios - Manutenção' },
  { name: 'Efeito Sirena (Manutenção)', time: 180, price: 85, image: 'https://i.imgur.com/lqyeUni.webp', category: 'Cílios - Manutenção' },
  { name: 'Efeito Fox (Manutenção)', time: 180, price: 95, image: 'https://i.imgur.com/231xZUC.webp', category: 'Cílios - Manutenção' },
  { name: 'Volume Inglês 5D (Manutenção)', time: 180, price: 100, image: 'https://i.imgur.com/tczQCXR.webp', category: 'Cílios - Manutenção' },
  { name: 'Volume Luxo 6D (Manutenção)', time: 180, price: 105, image: 'https://i.imgur.com/MRHHhmd.webp', category: 'Cílios - Manutenção' },
];

export const GALLERY_IMAGES = [
  'https://i.imgur.com/sfMMupW.webp',
  'https://i.imgur.com/eJylWcO.webp',
  'https://i.imgur.com/AgnUCre.webp',
  'https://i.imgur.com/4Tomn0z.webp'
];

export const WHATSAPP_NUMBER = '5541998818540';

export function isOpenNow(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeValue = hour * 60 + minute;

  if (day === 0) return false;
  return timeValue >= 480 && timeValue < 1200; // 08:00 to 20:00
}

export function isDayAllowed(date: Date): boolean {
  return date.getDay() !== 0; // Fechado aos Domingos
}

export function getTimesForDate(date: Date): string[] {
  const day = date.getDay();
  if (day === 0) return []; // Domingos
  if (day === 6) {
    // Sábados: 08:30, 12:30 e 15:30
    return ['08:30', '12:30', '15:30'];
  }
  // Segunda a Sexta: 08:00, 14:00, 17:00, 17:30, 18:00 e 18:30
  return ['08:00', '14:00', '17:00', '17:30', '18:00', '18:30'];
}

export function getBookingDuration(serviceName: string): number {
  const names = serviceName.split(' + ');
  let total = 0;
  names.forEach(name => {
    const svc = SERVICES.find(s => s.name === name);
    if (svc) {
      total += svc.time;
    }
  });
  return total || 180; // default to 180min if unknown (lash designer standard)
}

export function generateWhatsAppUrl(phone: string, message: string): string {
  return `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

