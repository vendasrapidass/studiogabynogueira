import { google } from 'googleapis';

const calendarId = 'guilhermesuzena10@gmail.com';

// Configuração do Google Auth com a Service Account
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

function parseDateTimeToSaoPaulo(isoString: string) {
  try {
    const dObj = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(dObj);
    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    
    return {
      date: `${day}/${month}/${year}`,
      time: `${hour}:${minute}`
    };
  } catch (err) {
    console.error("Error parsing date-time:", err);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ----------------------------------------------------
    // GET: Buscar eventos (agendamentos e bloqueios)
    // ----------------------------------------------------
    if (req.method === 'GET') {
      const now = new Date();
      // Período de busca padrão: de 30 dias atrás até 90 dias no futuro
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();

      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      const bookings: any[] = [];
      const blocks: any[] = [];

      for (const event of events) {
        if (!event.id) continue;

        const shared = event.extendedProperties?.shared;
        const summary = event.summary || '';
        const summaryLower = summary.toLowerCase();

        // 1. Correção de Bloqueios (Blocks)
        // Se o summary contiver "Folga", "Bloqueado", "Bloqueio", "Indisponível"
        // OU não possuir um formato de agendamento (não contém " - "), é considerado um block.
        const hasBlockKeyword = summaryLower.includes('folga') || 
                                summaryLower.includes('bloqueado') || 
                                summaryLower.includes('bloqueio') ||
                                summaryLower.includes('indisponível') ||
                                summaryLower.includes('indisponivel');
        
        const hasDashSeparator = summary.includes(' - ');
        const isBlock = shared?.type === 'block' || hasBlockKeyword || !hasDashSeparator;

        // Determina se o evento já passou
        const endStr = event.end?.dateTime || event.end?.date;
        const endDate = endStr ? new Date(endStr) : new Date();
        const isPast = endDate.getTime() < now.getTime();

        if (isBlock) {
          const allDay = shared?.allDay === 'true' || !!event.start?.date;
          let startVal = shared?.start;
          let endVal = shared?.end;
          let dateVal = shared?.date || '';

          if (!allDay && event.start?.dateTime && event.end?.dateTime) {
            const parsedStart = parseDateTimeToSaoPaulo(event.start.dateTime);
            const parsedEnd = parseDateTimeToSaoPaulo(event.end.dateTime);
            if (parsedStart && parsedEnd) {
              dateVal = parsedStart.date;
              startVal = parsedStart.time;
              endVal = parsedEnd.time;
            }
          }

          if (!dateVal) {
            const startString = event.start?.date || event.start?.dateTime;
            if (startString) {
              const [y, m, d] = startString.split('T')[0].split('-');
              dateVal = `${d}/${m}/${y}`;
            }
          }
          if (!dateVal) {
            const dObj = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            dateVal = `${pad(dObj.getDate())}/${pad(dObj.getMonth() + 1)}/${dObj.getFullYear()}`;
          }

          blocks.push({
            id: shared?.id || event.id,
            date: shared?.date || dateVal,
            allDay,
            start: shared?.start || startVal,
            end: shared?.end || endVal,
            reason: shared?.reason || summary.replace(/^(Bloqueio - |AGENDA BLOQUEADA - )/i, '') || 'Bloqueio',
          });
        } else {
          // É um agendamento (Booking)
          let service = '';
          let name = 'Cliente Google';
          let phone = '';
          let price = 0;
          let status = 'accepted';

          // Extração do Serviço e Nome
          if (shared) {
            service = shared.service || '';
            name = shared.name || '';
            phone = shared.phone || '';
          } else {
            const parts = summary.split(' - ');
            if (parts.length >= 2) {
              service = parts.slice(0, -1).join(' - ').trim();
              name = parts[parts.length - 1].trim();
            } else {
              service = summary;
            }
          }

          // 2. Extração Inteligente de Preço (Fallback)
          if (shared?.price) {
            price = Number(shared.price);
          } else {
            // Tenta descrição
            const desc = event.description || '';
            const priceDescMatch = desc.match(/Valor:\s*R\$\s*(\d+)/i) || desc.match(/Valor:\s*(\d+)/i);
            if (priceDescMatch) {
              price = Number(priceDescMatch[1]);
            } else {
              // Tenta Regex no título: "R$ 85,00" ou similar
              const rsMatch = summary.match(/R\$\s*(\d+)(?:[.,]\d+)?/i);
              if (rsMatch) {
                price = Number(rsMatch[1]);
              } else {
                // Standalone number
                const numMatch = summary.match(/\b(\d+)\b/);
                if (numMatch) {
                  price = Number(numMatch[1]);
                }
              }
            }

            // Standalone fallback: baseado no serviço conhecido
            if (price === 0 && service) {
              const cleanSvc = service.toLowerCase().trim();
              if (cleanSvc.includes('alongamento')) price = 135;
              else if (cleanSvc.includes('manutenção') || cleanSvc.includes('manutencao')) price = 95;
              else if (cleanSvc.includes('banho de gel')) price = 85;
              else if (cleanSvc.includes('esmaltação') || cleanSvc.includes('esmaltacao')) price = 60;
              else if (cleanSvc.includes('remoção') || cleanSvc.includes('remocao')) price = 20;
              else if (cleanSvc.includes('efeito molhado')) price = 125;
              else if (cleanSvc.includes('volume brasileiro')) price = 135;
              else if (cleanSvc.includes('volume egípcio') || cleanSvc.includes('volume egipcio')) price = 140;
              else if (cleanSvc.includes('sirena')) price = 135;
              else if (cleanSvc.includes('fox')) price = 150;
              else if (cleanSvc.includes('volume inglês') || cleanSvc.includes('volume ingles')) price = 155;
              else if (cleanSvc.includes('volume luxo')) price = 160;
            }
          }

          // 3. Automação de Status para Eventos Passados
          if (isPast) {
            status = 'completed';
          } else {
            let parsedStatus = 'accepted';
            if (shared?.status) {
              parsedStatus = shared.status;
            } else {
              // Parser manual de status para futuros
              const desc = event.description || '';
              const statusMatch = desc.match(/Status:\s*(.*)/i);
              if (statusMatch) {
                parsedStatus = statusMatch[1].trim();
              } else if (summary.includes('[Confirmado]')) {
                parsedStatus = 'accepted';
              } else if (summary.includes('[Concluído]')) {
                parsedStatus = 'completed';
              }
            }
            // Apenas accepted (Confirmado) e completed (Concluído) são aceitos.
            status = parsedStatus === 'completed' ? 'completed' : 'accepted';
          }

          // 4. Correção de Datas Vazias
          let dateVal = '';
          let timeVal = '';

          if (event.start?.dateTime) {
            const parsed = parseDateTimeToSaoPaulo(event.start.dateTime);
            if (parsed) {
              dateVal = parsed.date;
              timeVal = parsed.time;
            }
          } else if (event.start?.date) {
            const [y, m, d] = event.start.date.split('-');
            dateVal = `${d}/${m}/${y}`;
            timeVal = '08:00';
          }

          if (!dateVal) {
            const dObj = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            dateVal = `${pad(dObj.getDate())}/${pad(dObj.getMonth() + 1)}/${dObj.getFullYear()}`;
          }

          bookings.push({
            id: shared?.id || event.id,
            service,
            price,
            date: shared?.date || dateVal,
            time: shared?.time || timeVal,
            name,
            phone,
            status,
          });
        }
      }

      return res.status(200).json({ bookings, blocks });
    }

    // ----------------------------------------------------
    // POST: Criar novo evento (agendamento ou bloqueio)
    // ----------------------------------------------------
    if (req.method === 'POST') {
      const { type, booking, block, duration } = req.body;

      if (type === 'booking') {
        const id = booking.id;
        // O ID de evento do Google Calendar precisa ser base32hex compatível (a-v e 0-9)
        const eventId = id.replace(/-/g, '').toLowerCase();

        const [d, m, y] = booking.date.split('/');
        const isoDate = `${y}-${m}-${d}`;
        const startDateTime = `${isoDate}T${booking.time}:00`;

        // Cálculo determinístico do término baseado nos minutos de duração
        const [hour, minute] = booking.time.split(':').map(Number);
        let endHour = hour;
        let endMinute = minute + (duration || 180);
        if (endMinute >= 60) {
          endHour += Math.floor(endMinute / 60);
          endMinute = endMinute % 60;
        }
        const pad = (n: number) => String(n).padStart(2, '0');
        const endDateTime = `${isoDate}T${pad(endHour)}:${pad(endMinute)}:00`;

        // --- CHECK DOUBLE BOOKING ---
        // Fetch all events for that specific date to verify no overlap occurred
        const timeMin = `${isoDate}T00:00:00-03:00`;
        const timeMax = `${isoDate}T23:59:59-03:00`;

        const listResponse = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
        });

        const existingEvents = listResponse.data.items || [];
        const timeToMinutes = (t: string) => {
          const [h, mi] = t.split(':').map(Number);
          return h * 60 + mi;
        };

        const getBookingDuration = (serviceName: string): number => {
          const SERVICES = [
            { name: 'Alongamento (Fibra de vidro)', time: 180 },
            { name: 'Manutenção de alongamento', time: 180 },
            { name: 'Banho de Gel', time: 180 },
            { name: 'Esmaltação em Gel', time: 120 },
            { name: 'Remoção', time: 120 },
            { name: 'Efeito Molhado (Aplicação)', time: 180 },
            { name: 'Volume Brasileiro (Aplicação)', time: 180 },
            { name: 'Volume Egípcio 3D (Aplicação)', time: 180 },
            { name: 'Efeito Sirena (Aplicação)', time: 180 },
            { name: 'Efeito Fox (Aplicação)', time: 180 },
            { name: 'Volume Inglês 5D (Aplicação)', time: 180 },
            { name: 'Volume Luxo 6D (Aplicação)', time: 180 },
            { name: 'Remoção (Cílios)', time: 60 },
            { name: 'Efeito Molhado (Manutenção)', time: 180 },
            { name: 'Volume Brasileiro (Manutenção)', time: 180 },
            { name: 'Volume Egípcio 3D (Manutenção)', time: 180 },
            { name: 'Efeito Sirena (Manutenção)', time: 180 },
            { name: 'Efeito Fox (Manutenção)', time: 180 },
            { name: 'Volume Inglês 5D (Manutenção)', time: 180 },
            { name: 'Volume Luxo 6D (Manutenção)', time: 180 }
          ];
          const names = serviceName.split(' + ');
          let total = 0;
          names.forEach(name => {
            const svc = SERVICES.find(s => s.name === name);
            if (svc) total += svc.time;
          });
          return total || 180;
        };

        const newStart = timeToMinutes(booking.time);
        const newEnd = newStart + (duration || 180);

        for (const existingEvent of existingEvents) {
          if (existingEvent.id === eventId) continue;

          const shared = existingEvent.extendedProperties?.shared;
          const summary = existingEvent.summary || '';
          const summaryLower = summary.toLowerCase();

          const hasBlockKeyword = summaryLower.includes('folga') || 
                                  summaryLower.includes('bloqueado') || 
                                  summaryLower.includes('bloqueio') ||
                                  summaryLower.includes('indisponível') ||
                                  summaryLower.includes('indisponivel');
          const hasDashSeparator = summary.includes(' - ');
          const isBlock = shared?.type === 'block' || hasBlockKeyword || !hasDashSeparator;

          if (isBlock) {
            const allDay = shared?.allDay === 'true' || !!existingEvent.start?.date;
            if (allDay) {
              return res.status(409).json({ error: 'slot_occupied', message: 'Este dia está bloqueado para agendamentos.' });
            }
            let blockStartVal = shared?.start;
            let blockEndVal = shared?.end;
            if (!blockStartVal && existingEvent.start?.dateTime && existingEvent.end?.dateTime) {
              const parsedStart = parseDateTimeToSaoPaulo(existingEvent.start.dateTime);
              const parsedEnd = parseDateTimeToSaoPaulo(existingEvent.end.dateTime);
              if (parsedStart && parsedEnd) {
                blockStartVal = parsedStart.time;
                blockEndVal = parsedEnd.time;
              }
            }
            if (blockStartVal && blockEndVal) {
              const bStart = timeToMinutes(blockStartVal);
              const bEnd = timeToMinutes(blockEndVal);
              if (Math.max(newStart, bStart) < Math.min(newEnd, bEnd)) {
                return res.status(409).json({ error: 'slot_occupied', message: 'Este horário está em um período bloqueado.' });
              }
            }
          } else {
            let bookingTimeVal = shared?.time;
            if (!bookingTimeVal && existingEvent.start?.dateTime) {
              const parsedStart = parseDateTimeToSaoPaulo(existingEvent.start.dateTime);
              if (parsedStart) {
                bookingTimeVal = parsedStart.time;
              }
            }
            if (!bookingTimeVal) bookingTimeVal = '08:00';

            let bookingService = shared?.service || '';
            if (!bookingService) {
              const parts = summary.split(' - ');
              if (parts.length >= 2) {
                bookingService = parts.slice(0, -1).join(' - ').trim();
              } else {
                bookingService = summary;
              }
            }

            const bStart = timeToMinutes(bookingTimeVal);
            const bDuration = getBookingDuration(bookingService);
            const bEnd = bStart + bDuration;

            if (Math.max(newStart, bStart) < Math.min(newEnd, bEnd)) {
              return res.status(409).json({ error: 'slot_occupied', message: 'Este horário já foi agendado por outra pessoa.' });
            }
          }
        }
        // --- END CHECK DOUBLE BOOKING ---

        const title = `${booking.service} - ${booking.name}`;
        const description = `Cliente: ${booking.name}\nContato: ${booking.phone}\nValor: R$ ${booking.price},00`;

        await calendar.events.insert({
          calendarId,
          requestBody: {
            id: eventId,
            summary: title,
            description,
            start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
            extendedProperties: {
              shared: {
                id,
                type: 'booking',
                service: booking.service,
                name: booking.name,
                phone: booking.phone,
                price: String(booking.price),
                status: booking.status,
                date: booking.date,
                time: booking.time,
              },
            },
          },
        });

        return res.status(201).json({ success: true, eventId });
      }

      if (type === 'block') {
        const id = block.id;
        const eventId = id.replace(/-/g, '').toLowerCase();

        const [d, m, y] = block.date.split('/');
        const isoDate = `${y}-${m}-${d}`;

        let start: any;
        let end: any;

        if (block.allDay) {
          start = { date: isoDate };
          // O término de eventos de dia inteiro no Google é exclusivo (+1 dia)
          const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
          dateObj.setDate(dateObj.getDate() + 1);
          const pad = (n: number) => String(n).padStart(2, '0');
          const nextDayStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
          end = { date: nextDayStr };
        } else {
          start = { dateTime: `${isoDate}T${block.start}:00`, timeZone: 'America/Sao_Paulo' };
          end = { dateTime: `${isoDate}T${block.end}:00`, timeZone: 'America/Sao_Paulo' };
        }

        const title = `Bloqueio - ${block.reason || 'Indisponível'}`;

        await calendar.events.insert({
          calendarId,
          requestBody: {
            id: eventId,
            summary: title,
            description: `Bloqueio de Agenda\nMotivo: ${block.reason}`,
            start,
            end,
            extendedProperties: {
              shared: {
                id,
                type: 'block',
                reason: block.reason,
                date: block.date,
                allDay: String(block.allDay),
                start: block.start || '',
                end: block.end || '',
              },
            },
          },
        });

        return res.status(201).json({ success: true, eventId });
      }
    }

    // ----------------------------------------------------
    // PUT: Atualizar evento existente (status/detalhes)
    // ----------------------------------------------------
    if (req.method === 'PUT') {
      const { id, type, booking, block, duration } = req.body;
      const eventId = id.replace(/-/g, '').toLowerCase();

      if (type === 'booking') {
        const [d, m, y] = booking.date.split('/');
        const isoDate = `${y}-${m}-${d}`;
        const startDateTime = `${isoDate}T${booking.time}:00`;

        const [hour, minute] = booking.time.split(':').map(Number);
        let endHour = hour;
        let endMinute = minute + (duration || 180);
        if (endMinute >= 60) {
          endHour += Math.floor(endMinute / 60);
          endMinute = endMinute % 60;
        }
        const pad = (n: number) => String(n).padStart(2, '0');
        const endDateTime = `${isoDate}T${pad(endHour)}:${pad(endMinute)}:00`;

        let suffix = '';
        if (booking.status === 'accepted') suffix = ' [Confirmado]';
        else if (booking.status === 'completed') suffix = ' [Concluído]';

        const title = `${booking.service} - ${booking.name}${suffix}`;
        const description = `Cliente: ${booking.name}\nContato: ${booking.phone}\nValor: R$ ${booking.price},00`;

        await calendar.events.update({
          calendarId,
          eventId,
          requestBody: {
            summary: title,
            description,
            start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
            extendedProperties: {
              shared: {
                id,
                type: 'booking',
                service: booking.service,
                name: booking.name,
                phone: booking.phone,
                price: String(booking.price),
                status: booking.status,
                date: booking.date,
                time: booking.time,
              },
            },
          },
        });

        return res.status(200).json({ success: true });
      }

      if (type === 'block') {
        const [d, m, y] = block.date.split('/');
        const isoDate = `${y}-${m}-${d}`;

        let start: any;
        let end: any;

        if (block.allDay) {
          start = { date: isoDate };
          const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
          dateObj.setDate(dateObj.getDate() + 1);
          const pad = (n: number) => String(n).padStart(2, '0');
          const nextDayStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
          end = { date: nextDayStr };
        } else {
          start = { dateTime: `${isoDate}T${block.start}:00`, timeZone: 'America/Sao_Paulo' };
          end = { dateTime: `${isoDate}T${block.end}:00`, timeZone: 'America/Sao_Paulo' };
        }

        const title = `Bloqueio - ${block.reason || 'Indisponível'}`;

        await calendar.events.update({
          calendarId,
          eventId,
          requestBody: {
            summary: title,
            description: `Bloqueio de Agenda\nMotivo: ${block.reason}`,
            start,
            end,
            extendedProperties: {
              shared: {
                id,
                type: 'block',
                reason: block.reason,
                date: block.date,
                allDay: String(block.allDay),
                start: block.start || '',
                end: block.end || '',
              },
            },
          },
        });

        return res.status(200).json({ success: true });
      }
    }

    // ----------------------------------------------------
    // DELETE: Excluir evento (agendamento ou bloqueio)
    // ----------------------------------------------------
    if (req.method === 'DELETE') {
      const id = (req.query.id as string) || req.body.id;
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      const eventId = id.replace(/-/g, '').toLowerCase();

      try {
        await calendar.events.delete({
          calendarId,
          eventId,
        });
      } catch (err: any) {
        // Se o evento já tiver sido excluído manualmente no Google Calendar, ignora o erro (404)
        if (err.code !== 404) {
          throw err;
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Google Calendar Sync Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
