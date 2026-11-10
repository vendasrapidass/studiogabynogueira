import { google } from 'googleapis';

const DEFAULT_STUDIO_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'guilhermesuzena10@gmail.com';
const DEFAULT_PROFESSIONAL_EMAIL = process.env.PROFESSIONAL_EMAIL || 'gabynogueira05@outlook.com';
const DEVELOPER_ADMIN_EMAIL = 'guilhermesuzena10@gmail.com';

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

  // Resolve dynamic calendarId or client override
  const queryCalendarId = (req.query?.calendarId as string) || (req.headers?.['x-calendar-id'] as string);
  let activeCalendarId = queryCalendarId || process.env.GOOGLE_CALENDAR_ID || DEFAULT_STUDIO_CALENDAR_ID;

  // Profissional para attendees (sem incluir o desenvolvedor/administrador)
  const professionalEmail = (process.env.PROFESSIONAL_EMAIL || DEFAULT_PROFESSIONAL_EMAIL).trim();
  const attendeesList = professionalEmail && professionalEmail.toLowerCase() !== DEVELOPER_ADMIN_EMAIL.toLowerCase()
    ? [{ email: professionalEmail, displayName: 'Studio Gaby Nogueira' }]
    : undefined;

  try {
    // ----------------------------------------------------
    // GET: Buscar eventos (agendamentos e bloqueios)
    // ----------------------------------------------------
    if (req.method === 'GET') {
      const now = new Date();
      // Período de busca completo: carrega todo o histórico desde 2024 até 2 anos no futuro para manter histórico e faturamento anual completos
      const timeMin = (req.query?.timeMin as string) || new Date(2024, 0, 1).toISOString();
      const timeMax = (req.query?.timeMax as string) || new Date(now.getFullYear() + 2, 11, 31).toISOString();

      const events: any[] = [];
      let pageToken: string | undefined = undefined;

      do {
        let listResponse: any;
        try {
          listResponse = await calendar.events.list({
            calendarId: activeCalendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 2500,
            pageToken,
          });
        } catch (listErr: any) {
          if ((listErr?.code === 404 || listErr?.message?.includes('Not Found')) && activeCalendarId !== DEFAULT_STUDIO_CALENDAR_ID) {
            console.warn(`Calendar ${activeCalendarId} not accessible, falling back to ${DEFAULT_STUDIO_CALENDAR_ID}`);
            activeCalendarId = DEFAULT_STUDIO_CALENDAR_ID;
            listResponse = await calendar.events.list({
              calendarId: activeCalendarId,
              timeMin,
              timeMax,
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 2500,
              pageToken,
            });
          } else {
            throw listErr;
          }
        }

        if (listResponse?.data?.items) {
          events.push(...listResponse.data.items);
        }
        pageToken = listResponse?.data?.nextPageToken || undefined;
      } while (pageToken);
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

          blocks.push({
            id: shared?.id || event.id,
            googleEventId: event.id,
            date: dateVal,
            allDay,
            start: startVal,
            end: endVal,
            reason: shared?.reason || summary,
          });
        } else {
          // 2. Extração de Agendamentos (Bookings)
          let dateVal = shared?.date || '';
          let timeVal = shared?.time || '';

          if (event.start?.dateTime) {
            const parsed = parseDateTimeToSaoPaulo(event.start.dateTime);
            if (parsed) {
              dateVal = parsed.date;
              timeVal = parsed.time;
            }
          }

          if (!dateVal) {
            const startString = event.start?.date || event.start?.dateTime;
            if (startString) {
              const [y, m, d] = startString.split('T')[0].split('-');
              dateVal = `${d}/${m}/${y}`;
            }
          }

          // Se não houver extendedProperties (ex: criado direto no Google Calendar)
          let service = shared?.service || '';
          let name = shared?.name || '';
          if (!service || !name) {
            const parts = summary.split(' - ');
            if (parts.length >= 2) {
              service = parts.slice(0, -1).join(' - ').trim();
              name = parts[parts.length - 1].trim();
            } else {
              service = summary;
              name = 'Cliente';
            }
          }

          // Limpa sufixos de status no nome (como [Confirmado] ou [Concluído])
          name = name.replace(/\s*\[(Confirmado|Concluído)\]\s*$/i, '').trim();

          // Determina status
          let status: 'pending' | 'accepted' | 'completed' = (shared?.status as any) || 'accepted';
          if (summary.includes('[Concluído]')) {
            status = 'completed';
          } else if (summary.includes('[Confirmado]')) {
            status = 'accepted';
          } else if (isPast && status === 'accepted') {
            status = 'completed';
          }

          // Extração do telefone da descrição
          let phone = shared?.phone || '';
          if (!phone && event.description) {
            const match = event.description.match(/(?:Contato|WhatsApp|Telefone):\s*([^\n\r]+)/i);
            if (match) {
              phone = match[1].trim();
            }
          }

          bookings.push({
            id: shared?.id || event.id,
            googleEventId: event.id,
            service,
            price: Number(shared?.price) || 0,
            date: dateVal,
            time: timeVal,
            name,
            phone,
            status,
          });
        }
      }

      return res.status(200).json({ bookings, blocks });
    }

    // ----------------------------------------------------
    // POST: Criar novo agendamento ou bloqueio
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
        let endMinute = minute + (duration || 150);
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

        let listResponse;
        try {
          listResponse = await calendar.events.list({
            calendarId: activeCalendarId,
            timeMin,
            timeMax,
            singleEvents: true,
          });
        } catch (lErr: any) {
          if ((lErr?.code === 404 || lErr?.message?.includes('Not Found')) && activeCalendarId !== DEFAULT_STUDIO_CALENDAR_ID) {
            activeCalendarId = DEFAULT_STUDIO_CALENDAR_ID;
            listResponse = await calendar.events.list({
              calendarId: activeCalendarId,
              timeMin,
              timeMax,
              singleEvents: true,
            });
          } else {
            throw lErr;
          }
        }

        const existingEvents = listResponse.data.items || [];
        const timeToMinutes = (t: string) => {
          const [h, mi] = t.split(':').map(Number);
          return h * 60 + mi;
        };

        const getBookingDuration = (serviceName: string): number => {
          const SERVICES = [
            { name: 'Alongamento (Fibra de vidro)', time: 150 },
            { name: 'Manutenção de alongamento', time: 150 },
            { name: 'Banho de Gel', time: 150 },
            { name: 'Esmaltação em Gel', time: 120 },
            { name: 'Remoção', time: 120 },
            { name: 'Efeito Molhado (Aplicação)', time: 150 },
            { name: 'Volume Brasileiro (Aplicação)', time: 150 },
            { name: 'Volume Egípcio 3D (Aplicação)', time: 150 },
            { name: 'Efeito Sirena (Aplicação)', time: 150 },
            { name: 'Efeito Fox (Aplicação)', time: 150 },
            { name: 'Efeito Fox Eyes (Aplicação)', time: 150 },
            { name: 'Volume Inglês 5D (Aplicação)', time: 150 },
            { name: 'Volume Luxo 6D (Aplicação)', time: 150 },
            { name: 'Remoção (Cílios)', time: 60 },
            { name: 'Efeito Molhado (Manutenção)', time: 150 },
            { name: 'Volume Brasileiro (Manutenção)', time: 150 },
            { name: 'Volume Egípcio 3D (Manutenção)', time: 150 },
            { name: 'Efeito Sirena (Manutenção)', time: 150 },
            { name: 'Efeito Fox (Manutenção)', time: 150 },
            { name: 'Efeito Fox Eyes (Manutenção)', time: 150 },
            { name: 'Volume Inglês 5D (Manutenção)', time: 150 },
            { name: 'Volume Luxo 6D (Manutenção)', time: 150 }
          ];
          const names = serviceName.split(' + ');
          let total = 0;
          names.forEach(name => {
            const svc = SERVICES.find(s => s.name === name);
            if (svc) total += svc.time;
          });
          return total || 150;
        };

        const newStart = timeToMinutes(booking.time);
        const newEnd = newStart + (duration || 150);

        const isAdmin = req.body.source === 'admin';
        if (!isAdmin) {
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
            const isBlock = shared?.type === 'block' || hasBlockKeyword;

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
        }
        // --- END CHECK DOUBLE BOOKING ---

        const title = `${booking.service} - ${booking.name}`;
        const description = `Cliente: ${booking.name}\nContato: ${booking.phone}\nValor: R$ ${booking.price},00`;

        const insertPayload: any = {
          id: eventId,
          summary: title,
          description,
          start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
          end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
          attendees: attendeesList,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 60 },
              { method: 'popup', minutes: 15 },
            ],
          },
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
        };

        let insertedEvent: any;
        try {
          insertedEvent = await calendar.events.insert({
            calendarId: activeCalendarId,
            requestBody: insertPayload,
          });
        } catch (insertErr: any) {
          console.warn("Standard insert failed, falling back to clean insert:", insertErr?.message || insertErr);
          const fallbackPayload = {
            summary: title,
            description,
            start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'popup', minutes: 60 },
                { method: 'popup', minutes: 15 },
              ],
            },
            extendedProperties: insertPayload.extendedProperties,
          };

          try {
            insertedEvent = await calendar.events.insert({
              calendarId: DEFAULT_STUDIO_CALENDAR_ID,
              requestBody: fallbackPayload,
            });
          } catch (cleanErr: any) {
            console.error("Clean insert fallback failed:", cleanErr?.message || cleanErr);
            throw cleanErr;
          }
        }

        return res.status(201).json({ success: true, eventId: insertedEvent?.data?.id || eventId });
      }

      if (type === 'block' || type === 'blocks') {
        const blocksList: any[] = Array.isArray(req.body.blocks)
          ? req.body.blocks
          : (req.body.block ? [req.body.block] : []);

        if (blocksList.length === 0) {
          return res.status(400).json({ error: 'Nenhum bloqueio informado' });
        }

        const insertedIds: string[] = [];

        for (const item of blocksList) {
          const id = item.id;
          const eventId = id.replace(/-/g, '').toLowerCase();

          const [d, m, y] = item.date.split('/');
          const isoDate = `${y}-${m}-${d}`;

          let start: any;
          let end: any;

          if (item.allDay) {
            start = { date: isoDate };
            // O término de eventos de dia inteiro no Google é exclusivo (+1 dia)
            const dateObj = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
            dateObj.setDate(dateObj.getDate() + 1);
            const pad = (n: number) => String(n).padStart(2, '0');
            const nextDayStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
            end = { date: nextDayStr };
          } else {
            start = { dateTime: `${isoDate}T${item.start}:00`, timeZone: 'America/Sao_Paulo' };
            end = { dateTime: `${isoDate}T${item.end}:00`, timeZone: 'America/Sao_Paulo' };
          }

          const title = `Bloqueio - ${item.reason || 'Indisponível'}`;

          const blockPayload: any = {
            id: eventId,
            summary: title,
            description: `Bloqueio de Agenda\nMotivo: ${item.reason}`,
            start,
            end,
            extendedProperties: {
              shared: {
                id,
                type: 'block',
                reason: item.reason,
                date: item.date,
                allDay: String(item.allDay),
                start: item.start || '',
                end: item.end || '',
              },
            },
          };

          try {
            const insertedBlock = await calendar.events.insert({
              calendarId: activeCalendarId,
              requestBody: blockPayload,
            });
            insertedIds.push(insertedBlock?.data?.id || eventId);
          } catch (blockErr: any) {
            if ((blockErr?.code === 404 || blockErr?.message?.includes('Not Found')) && activeCalendarId !== DEFAULT_STUDIO_CALENDAR_ID) {
              activeCalendarId = DEFAULT_STUDIO_CALENDAR_ID;
              const insertedBlock = await calendar.events.insert({
                calendarId: activeCalendarId,
                requestBody: blockPayload,
              });
              insertedIds.push(insertedBlock?.data?.id || eventId);
            } else if (blockPayload.id) {
              delete blockPayload.id;
              const insertedBlock = await calendar.events.insert({
                calendarId: activeCalendarId,
                requestBody: blockPayload,
              });
              insertedIds.push(insertedBlock?.data?.id || eventId);
            } else {
              console.error('Error inserting block into Google Calendar:', blockErr);
            }
          }
        }

        return res.status(201).json({ success: true, count: insertedIds.length, eventIds: insertedIds });
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
        let endMinute = minute + (duration || 150);
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

        const updatePayload: any = {
          summary: title,
          description,
          start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
          end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
          attendees: attendeesList,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 60 },
              { method: 'popup', minutes: 15 },
            ],
          },
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
        };

        try {
          await calendar.events.update({
            calendarId: activeCalendarId,
            eventId,
            requestBody: updatePayload,
          });
        } catch (updateErr: any) {
          if ((updateErr?.code === 404 || updateErr?.message?.includes('Not Found')) && activeCalendarId !== DEFAULT_STUDIO_CALENDAR_ID) {
            activeCalendarId = DEFAULT_STUDIO_CALENDAR_ID;
            await calendar.events.update({
              calendarId: activeCalendarId,
              eventId,
              requestBody: updatePayload,
            });
          } else {
            throw updateErr;
          }
        }

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

        const updateBlockPayload: any = {
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
        };

        try {
          await calendar.events.update({
            calendarId: activeCalendarId,
            eventId,
            requestBody: updateBlockPayload,
          });
        } catch (updateErr: any) {
          if ((updateErr?.code === 404 || updateErr?.message?.includes('Not Found')) && activeCalendarId !== DEFAULT_STUDIO_CALENDAR_ID) {
            activeCalendarId = DEFAULT_STUDIO_CALENDAR_ID;
            await calendar.events.update({
              calendarId: activeCalendarId,
              eventId,
              requestBody: updateBlockPayload,
            });
          } else {
            throw updateErr;
          }
        }

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
          calendarId: activeCalendarId,
          eventId,
        });
      } catch (err: any) {
        // Se o evento já tiver sido excluído manualmente no Google Calendar, ignora o erro (404)
        if (err.code === 404 || err.message?.includes('Not Found')) {
          return res.status(200).json({ success: true, message: 'Event already removed' });
        }
        if (activeCalendarId !== DEFAULT_STUDIO_CALENDAR_ID) {
          try {
            await calendar.events.delete({
              calendarId: DEFAULT_STUDIO_CALENDAR_ID,
              eventId,
            });
            return res.status(200).json({ success: true });
          } catch (delErr: any) {
            if (delErr.code === 404 || delErr.message?.includes('Not Found')) {
              return res.status(200).json({ success: true, message: 'Event already removed' });
            }
          }
        }
        throw err;
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Google Calendar Sync Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
