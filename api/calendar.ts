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
          let startVal: string | undefined;
          let endVal: string | undefined;

          if (!allDay && event.start?.dateTime && event.end?.dateTime) {
            const startTimePart = event.start.dateTime.split('T')[1];
            const endTimePart = event.end.dateTime.split('T')[1];
            if (startTimePart && endTimePart) {
              startVal = startTimePart.substring(0, 5);
              endVal = endTimePart.substring(0, 5);
            }
          }

          let dateVal = '';
          const startString = event.start?.date || event.start?.dateTime;
          if (startString) {
            const [y, m, d] = startString.split('T')[0].split('-');
            dateVal = `${d}/${m}/${y}`;
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
          
          const startString = event.start?.dateTime || event.start?.date;
          if (startString) {
            const [dStr, tStr] = startString.split('T');
            const [y, m, d] = dStr.split('-');
            dateVal = `${d}/${m}/${y}`;
            if (tStr) {
              timeVal = tStr.substring(0, 5);
            } else {
              timeVal = '08:00';
            }
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
