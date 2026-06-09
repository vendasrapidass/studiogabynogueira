import { useState, useEffect, useMemo } from 'react';
import { Booking, SERVICES, generateWhatsAppUrl, formatPhone, ScheduleBlock } from '@/lib/types';
import { getBookings, saveBookings, getCompleted, saveCompleted, addCompleted, removeCompleted, addBooking, getBlocks, saveBlocks, addBlock, removeBlock } from '@/lib/bookingStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, DollarSign, Scissors, TrendingUp, ArrowLeft, Plus, X, Check, Clock, Pencil, Trash2, Phone, Search } from 'lucide-react';

const REFUSE_REASONS = ['Imprevisto', 'Indisponibilidade', 'Problema pessoal', 'Horário não disponível'];

type FilterType = 'today' | 'week' | 'month' | 'year';
type TabType = 'bookings' | 'dashboard' | 'add';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [completed, setCompleted] = useState<Booking[]>([]);
  const [refusingId, setRefusingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('month');
  const [subFilter, setSubFilter] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'blocks'>('accepted');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Edit Booking (active) state
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editBookingDate, setEditBookingDate] = useState('');
  const [editBookingTime, setEditBookingTime] = useState('');
  const [editBookingService, setEditBookingService] = useState('');
  const [editBookingPrice, setEditBookingPrice] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editService, setEditService] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // Manual service form
  const [manualService, setManualService] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Schedule block state
  const [addMode, setAddMode] = useState<'booking' | 'block'>('booking');
  const [blockDate, setBlockDate] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(false);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);

  const reload = () => {
    // Carregamento imediato do local storage para feedback instantâneo
    setBookings(getBookings());
    setCompleted(getCompleted());
    setBlocks(getBlocks());

    // Busca eventos em tempo real do Google Calendar API (fonte da verdade)
    fetch(`/api/calendar?t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao buscar eventos do Google Agenda');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.bookings)) {
          const active = data.bookings.filter((b: Booking) => b.status !== 'completed');
          const done = data.bookings.filter((b: Booking) => b.status === 'completed');
          
          saveBookings(active);
          saveCompleted(done);
          setBookings(active);
          setCompleted(done);
        }
        if (Array.isArray(data.blocks)) {
          saveBlocks(data.blocks);
          setBlocks(data.blocks);
        }
      })
      .catch((err) => {
        console.error("Error loading events from Google Calendar API:", err);
      });
  };

  useEffect(() => { reload(); }, []);

  const getBookingDuration = (serviceName: string): number => {
    const names = serviceName.split(' + ');
    let total = 0;
    names.forEach(name => {
      const svc = SERVICES.find(s => s.name === name);
      if (svc) total += svc.time;
    });
    return total || 180;
  };

  // Accept booking → send WhatsApp confirmation, mark as accepted
  const handleAccept = (booking: Booking) => {
    const msg = `✨ *STUDIO GABY NOGUEIRA* ✨\n\nOlá *${booking.name}*! 👋\n\nSeu agendamento foi *CONFIRMADO* com sucesso! ✅\n\n📋 *Serviço:* ${booking.service}\n💰 *Valor:* R$ ${booking.price},00\n📅 *Data:* ${booking.date}\n🕐 *Horário:* ${booking.time}\n\n📍 *Endereço:* R. Uirapuru, 746 - Capela Velha, Araucária\n\nEstamos te esperando! 🌸\nAté lá! 🤝`;
    
    if (booking.phone) {
      window.open(generateWhatsAppUrl(booking.phone, msg), '_blank');
    }

    // Update status locally for instant feedback
    const updatedBooking = { ...booking, status: 'accepted' as const };
    const updated = bookings.map(b => b.id === booking.id ? updatedBooking : b);
    saveBookings(updated);
    setBookings(updated);

    // Sync status update to Google Calendar
    fetch('/api/calendar', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: booking.id,
        type: 'booking',
        booking: updatedBooking,
        duration: getBookingDuration(booking.service),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha no update do status');
        console.log("Booking status updated to accepted in Google Calendar");
        reload();
      })
      .catch((err) => {
        console.error("Error updating booking status in Google Calendar:", err);
      });
  };

  // Finalize → move to completed, free time slot
  const handleFinalize = (booking: Booking) => {
    const updatedBooking = { ...booking, status: 'completed' as const };
    addCompleted(booking);
    const updated = bookings.filter(b => b.id !== booking.id);
    saveBookings(updated);
    setBookings(updated);
    setCompleted(getCompleted());

    // Sync status update to Google Calendar
    fetch('/api/calendar', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: booking.id,
        type: 'booking',
        booking: updatedBooking,
        duration: getBookingDuration(booking.service),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha no update do status');
        console.log("Booking status updated to completed in Google Calendar");
        reload();
      })
      .catch((err) => {
        console.error("Error updating booking status in Google Calendar:", err);
      });
  };

  // Refuse → send WhatsApp with reason, remove from bookings
  const handleRefuse = (booking: Booking, reason: string) => {
    const msg = `✨ *STUDIO GABY NOGUEIRA* ✨\n\nOlá *${booking.name}*! 👋\n\nInfelizmente não poderemos atender seu agendamento. 😔\n\n📋 *Serviço:* ${booking.service}\n📅 *Data:* ${booking.date}\n🕐 *Horário:* ${booking.time}\n\n❌ *Motivo:* ${reason}\n\nPor favor, escolha outro horário disponível no nosso site. Desculpe pelo inconveniente! 🙏\n\nEstamos à disposição! 🌸`;
    
    if (booking.phone) {
      window.open(generateWhatsAppUrl(booking.phone, msg), '_blank');
    }

    const updated = bookings.filter(b => b.id !== booking.id);
    saveBookings(updated);
    setBookings(updated);
    setRefusingId(null);

    // Sync cancellation/deletion to Google Calendar
    fetch(`/api/calendar?id=${booking.id}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao excluir agendamento');
        console.log("Booking deleted from Google Calendar");
        reload();
      })
      .catch((err) => {
        console.error("Error deleting booking in Google Calendar:", err);
      });
  };

  // Cancel/delete booking from admin panel (sets state to show custom modal)
  const handleCancelBooking = (booking: Booking) => {
    setCancellingBooking(booking);
  };

  // Confirm cancel via custom modal and sync to API
  const handleConfirmCancel = () => {
    if (!cancellingBooking) return;
    const booking = cancellingBooking;

    const updated = bookings.filter(b => b.id !== booking.id);
    saveBookings(updated);
    setBookings(updated);
    setCancellingBooking(null);

    fetch(`/api/calendar?id=${booking.id}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao excluir agendamento');
        console.log("Booking deleted from Google Calendar");
        toast.success('Agendamento cancelado com sucesso!');
        reload();
      })
      .catch((err) => {
        console.error("Error deleting booking in Google Calendar:", err);
        toast.error('Erro ao cancelar agendamento.');
      });
  };

  // Delete completed service
  const handleDeleteCompleted = (id: string) => {
    removeCompleted(id);
    setCompleted(getCompleted());
  };

  // Start editing a completed service
  const startEdit = (b: Booking) => {
    setEditingId(b.id);
    setEditService(b.service);
    setEditPrice(String(b.price));
    setEditName(b.name);
    setEditDate(b.date);
    setEditTime(b.time);
  };

  // Save edit
  const saveEdit = () => {
    if (!editingId) return;
    const updated = completed.map(b =>
      b.id === editingId
        ? { ...b, service: editService, price: Number(editPrice), name: editName, date: editDate, time: editTime }
        : b
    );
    saveCompleted(updated);
    setCompleted(updated);
    setEditingId(null);
  };

  // Start editing active booking
  const startEditBooking = (b: Booking) => {
    setEditingBooking(b);
    const [d, m, y] = b.date.split('/');
    setEditBookingDate(`${y}-${m}-${d}`);
    setEditBookingTime(b.time);
    setEditBookingService(b.service);
    setEditBookingPrice(b.price);
  };

  // Handle service change with dynamic price update
  const handleServiceChange = (serviceName: string) => {
    setEditBookingService(serviceName);
    const svc = SERVICES.find(s => s.name === serviceName);
    if (svc) {
      setEditBookingPrice(svc.price);
      setEditingBooking(prev => prev ? { ...prev, service: serviceName, price: svc.price } : null);
    }
  };

  // Save active booking edit and sync with calendar API
  const handleSaveEditBooking = () => {
    if (!editingBooking || !editBookingService || !editBookingDate || !editBookingTime) return;

    setIsSavingEdit(true);

    const [y, m, d] = editBookingDate.split('-');
    const formattedDate = `${d}/${m}/${y}`;

    const updatedBooking: Booking = {
      ...editingBooking,
      service: editBookingService,
      price: editBookingPrice,
      date: formattedDate,
      time: editBookingTime,
    };

    fetch('/api/calendar', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: editingBooking.id,
        type: 'booking',
        booking: updatedBooking,
        duration: getBookingDuration(updatedBooking.service),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao remarcar agendamento');
        return res.json();
      })
      .then(() => {
        const updatedBookings = bookings.map((b) =>
          b.id === editingBooking.id ? updatedBooking : b
        );
        saveBookings(updatedBookings);
        setBookings(updatedBookings);

        setEditingBooking(null);
        setIsSavingEdit(false);
        toast.success('Agendamento editado com sucesso!');
        reload();
      })
      .catch((err) => {
        console.error("Error editing booking:", err);
        toast.error('Ocorreu um erro ao salvar as alterações.');
        setIsSavingEdit(false);
      });
  };

  // Manual add → goes to BOOKINGS (agendados), not completed
  const handleAddManualService = () => {
    if (!manualService || !manualPrice || !manualName || !manualDate || !manualTime) return;

    if (manualDate.length < 10) {
      alert("Por favor, digite a data completa no formato DD/MM/AAAA");
      return;
    }

    const booking: Booking = {
      id: crypto.randomUUID(),
      service: manualService,
      price: Number(manualPrice),
      date: manualDate,
      time: manualTime,
      name: manualName,
      phone: manualPhone.replace(/\D/g, ''),
      status: 'accepted',
    };

    // Immediate local feedback
    addBooking(booking);
    
    // Find service duration
    const svc = SERVICES.find(s => s.name === manualService);
    const duration = svc ? svc.time : 180;

    // Sync manual booking to Google Calendar via Serverless API
    fetch('/api/calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'booking',
        booking,
        duration,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao adicionar agendamento manual');
        console.log("Manual booking synced to Google Calendar");
        reload();
      })
      .catch((err) => {
        console.error("Error syncing manual booking to Google Calendar:", err);
      });

    reload();
    setManualService('');
    setManualPrice('');
    setManualName('');
    setManualPhone('');
    setManualDate('');
    setManualTime('');
    setShowSuccess(true);
    setTab('bookings');
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleSaveBlock = () => {
    if (!blockDate || (!blockAllDay && (!blockStart || !blockEnd))) return;

    if (blockDate.length < 10) {
      alert("Por favor, digite a data completa no formato DD/MM/AAAA");
      return;
    }

    const block: ScheduleBlock = {
      id: crypto.randomUUID(),
      date: blockDate,
      allDay: blockAllDay,
      start: blockAllDay ? undefined : blockStart,
      end: blockAllDay ? undefined : blockEnd,
      reason: blockReason || 'Bloqueio de Agenda',
    };

    addBlock(block);

    // Sync block to Google Calendar via Serverless API
    fetch('/api/calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'block',
        block,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao salvar bloqueio');
        console.log("Block saved to Google Calendar");
        reload();
      })
      .catch((err) => {
        console.error("Error saving block to Google Calendar:", err);
      });

    reload();
    setBlockDate('');
    setBlockAllDay(false);
    setBlockStart('');
    setBlockEnd('');
    setBlockReason('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleDeleteBlock = (id: string) => {
    removeBlock(id);

    // Sync block deletion to Google Calendar via Serverless API
    fetch(`/api/calendar?id=${id}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao deletar bloqueio');
        console.log("Block deleted from Google Calendar");
        reload();
      })
      .catch((err) => {
        console.error("Error deleting block from Google Calendar:", err);
      });

    reload();
  };

  const handleSelectService = (name: string) => {
    setManualService(name);
    const svc = SERVICES.find(s => s.name === name);
    if (svc) setManualPrice(String(svc.price));
  };

  const filteredCompleted = useMemo(() => {
    const now = new Date();
    return completed.filter(b => {
      const [d, m, y] = b.date.split('/').map(Number);
      const date = new Date(y, m - 1, d);
      switch (filter) {
        case 'today': return date.toDateString() === now.toDateString();
        case 'week': { const wa = new Date(now); wa.setDate(wa.getDate() - 7); return date >= wa; }
        case 'month': return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        case 'year': return date.getFullYear() === now.getFullYear();
        default: return true;
      }
    });
  }, [completed, filter]);

  const totalRevenue = filteredCompleted.reduce((sum, b) => sum + b.price, 0);
  const totalServices = filteredCompleted.length;

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const acceptedCount = bookings.filter(b => b.status === 'accepted').length;

  const unifiedAgenda = useMemo(() => {
    const agendaItems: Array<
      | { type: 'booking'; id: string; timestamp: number; raw: Booking }
      | { type: 'block'; id: string; timestamp: number; raw: ScheduleBlock }
    > = [];

    // Se o filtro for concluído, lê da lista de concluídos, senão da de agendados
    const listBookings = subFilter === 'completed' ? completed : bookings;

    listBookings.forEach(b => {
      if (subFilter !== 'all' && subFilter !== 'completed' && b.status !== subFilter) {
        return;
      }
      try {
        const [d, m, y] = b.date.split('/').map(Number);
        const [hour, min] = (b.time || '00:00').split(':').map(Number);
        const timestamp = new Date(y, m - 1, d, hour, min).getTime() || 0;
        agendaItems.push({ type: 'booking', id: b.id, timestamp, raw: b });
      } catch (err) {
        agendaItems.push({ type: 'booking', id: b.id, timestamp: 0, raw: b });
      }
    });

    if (subFilter === 'all' || subFilter === 'blocks') {
      blocks.forEach(bl => {
        try {
          const [d, m, y] = bl.date.split('/').map(Number);
          let hour = 0;
          let min = 0;
          if (!bl.allDay && bl.start) {
            const [h, mi] = bl.start.split(':').map(Number);
            hour = h;
            min = mi;
          }
          const timestamp = new Date(y, m - 1, d, hour, min).getTime() || 0;
          agendaItems.push({ type: 'block', id: bl.id, timestamp, raw: bl });
        } catch (err) {
          agendaItems.push({ type: 'block', id: bl.id, timestamp: 0, raw: bl });
        }
      });
    }

    // Ordenação do Dashboard: Concluídos mostram os mais recentes no topo (descendente),
    // agendamentos futuros mostram os mais próximos no topo (crescente)
    if (subFilter === 'completed') {
      return agendaItems.sort((a, b) => b.timestamp - a.timestamp);
    }
    return agendaItems.sort((a, b) => a.timestamp - b.timestamp);
  }, [bookings, blocks, completed, subFilter]);

  const filteredAgenda = useMemo(() => {
    let items = unifiedAgenda;

    // Filter by text search (case-insensitive)
    if (searchTerm.trim() !== '') {
      const cleanSearch = searchTerm.toLowerCase().trim();
      items = items.filter(item => {
        if (item.type === 'booking') {
          const b = item.raw;
          return (b.name || '').toLowerCase().includes(cleanSearch) ||
                 (b.service || '').toLowerCase().includes(cleanSearch) ||
                 (b.phone || '').toLowerCase().includes(cleanSearch);
        } else if (item.type === 'block') {
          const bl = item.raw;
          return (bl.reason || '').toLowerCase().includes(cleanSearch);
        }
        return false;
      });
    }

    // Filter by date (convert YYYY-MM-DD -> DD/MM/YYYY)
    if (filterDate) {
      const [y, m, d] = filterDate.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      items = items.filter(item => item.raw.date === formattedDate);
    }

    return items;
  }, [unifiedAgenda, searchTerm, filterDate]);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'bookings', label: 'Agendamentos', icon: <CalendarDays className="w-4 h-4" />, badge: bookings.length + blocks.length },
    { key: 'dashboard', label: 'Dashboard', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'add', label: 'Adicionar', icon: <Plus className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-primary/10 flex justify-between items-center bg-card/50 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Painel de Controle</h2>
              <p className="text-xs text-muted-foreground">Studio Gaby Nogueira</p>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-primary/10 sticky top-[68px] md:top-[76px] bg-background/80 backdrop-blur-xl z-10">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all relative ${
                tab === t.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {t.badge}
                </span>
              )}
              {tab === t.key && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 md:p-8">
          {/* ===== BOOKINGS TAB ===== */}
          {tab === 'bookings' && (
            <div className="space-y-4">
              {showSuccess && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-3 text-primary text-sm font-medium animate-in fade-in">
                  <Check className="w-5 h-5" /> Serviço adicionado aos agendamentos!
                </div>
              )}

              {/* Sub-tabs de Filtragem */}
              <div className="flex gap-2 flex-wrap pb-3 border-b border-primary/5">
                {([
                  { key: 'accepted', label: 'Todos', count: acceptedCount, color: 'text-emerald-400' },
                  { key: 'completed', label: 'Concluídos', count: completed.length, color: 'text-primary' },
                  { key: 'blocks', label: 'Bloqueios', count: blocks.length, color: 'text-destructive' }
                ] as const).map(sf => (
                  <button
                    key={sf.key}
                    onClick={() => setSubFilter(sf.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      subFilter === sf.key
                        ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_-3px_hsl(6_48%_68%/0.3)]'
                        : 'bg-card/40 text-muted-foreground hover:text-foreground border-primary/10'
                    }`}
                  >
                    <span className={subFilter === sf.key ? 'text-primary-foreground' : sf.color}>{sf.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      subFilter === sf.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {sf.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search & Date Filter Bar */}
              <div className="flex items-center bg-card/50 backdrop-blur-sm border border-primary/10 rounded-xl px-3 h-10 w-full text-xs gap-2 relative overflow-hidden">
                <div className="flex items-center gap-2 flex-1 h-full min-w-0">
                  <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar..."
                    className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 w-full h-full text-xs min-w-0"
                  />
                </div>
                
                {(searchTerm || filterDate) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setFilterDate('');
                    }}
                    className="p-3 -ml-2 text-muted-foreground/60 hover:text-foreground transition-colors flex-shrink-0 cursor-pointer z-20 relative"
                    title="Limpar filtros"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                
                <div className="h-4 w-px bg-primary/10 flex-shrink-0" />
                
                <div className="relative flex items-center justify-center h-full px-1.5 gap-1.5 cursor-pointer hover:bg-primary/5 rounded-lg transition-colors flex-shrink-0">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  {filterDate ? (
                    <span className="text-[10px] font-mono text-primary font-bold pointer-events-none">
                      {(() => {
                        const [y, m, d] = filterDate.split('-');
                        return `${d}/${m}`;
                      })()}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline pointer-events-none">Data</span>
                  )}
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {filteredAgenda.length === 0 && (
                <div className="text-center py-16 opacity-60">
                  <p className="text-muted-foreground text-sm font-medium">
                    {searchTerm || filterDate ? 'Nenhum agendamento encontrado.' : (
                      <>
                        {subFilter === 'accepted' && 'Nenhum agendamento confirmado'}
                        {subFilter === 'completed' && 'Nenhum agendamento concluído no histórico'}
                        {subFilter === 'blocks' && 'Nenhum horário bloqueado'}
                      </>
                    )}
                  </p>
                </div>
              )}

              {filteredAgenda.map(item => {
                if (item.type === 'booking') {
                  const a = item.raw;
                  return (
                    <div key={a.id} className={`p-5 md:p-6 bg-card/60 backdrop-blur-sm rounded-2xl border transition-all ${
                      a.status === 'completed' ? 'border-primary/10 opacity-70 bg-secondary/5' :
                      a.status === 'accepted' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-primary/10 hover:border-primary/20'
                    }`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-lg text-foreground">{a.name}</p>
                            {a.status === 'completed' && (
                              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Concluído</span>
                            )}
                            {a.status === 'accepted' && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Confirmado</span>
                            )}
                            {a.status === 'pending' && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Aguardando</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                              <Scissors className="w-3 h-3" /> {a.service}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-full">
                              <CalendarDays className="w-3 h-3" /> {a.date} às {a.time}
                            </span>
                          </div>
                          {a.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {a.phone}</p>}
                          <p className="text-lg font-mono font-bold text-primary mt-1">R$ {a.price},00</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {a.status === 'completed' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">✓ Concluído</span>
                              <button
                                onClick={() => handleDeleteCompleted(a.id)}
                                className="px-3 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                                title="Remover do histórico"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleFinalize(a)}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold transition-all hover:shadow-[0_0_20px_-5px_hsl(6_48%_68%/0.4)] hover:scale-105 active:scale-95 flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" /> Finalizar
                              </button>
                              <button
                                onClick={() => handleCancelBooking(a)}
                                className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-xs font-bold transition-all hover:bg-destructive hover:text-destructive-foreground hover:scale-105 active:scale-95 flex items-center gap-1.5"
                              >
                                <X className="w-3.5 h-3.5" /> Cancelar
                              </button>
                              <button
                                onClick={() => startEditBooking(a)}
                                className="px-3.5 py-2 bg-transparent text-muted-foreground/60 border border-primary/5 hover:border-primary/20 hover:text-foreground rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                                title="Editar agendamento"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Editar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const bl = item.raw;
                  return (
                    <div key={bl.id} className="p-5 md:p-6 bg-destructive/5 backdrop-blur-sm rounded-2xl border border-destructive/20 hover:border-destructive/30 transition-all animate-in fade-in duration-300">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-lg text-foreground">AGENDA BLOQUEADA</p>
                            <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Bloqueio</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                              Motivo: {bl.reason}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-full">
                              <CalendarDays className="w-3 h-3" /> {bl.date} {bl.allDay ? '(Dia Inteiro)' : `das ${bl.start} às ${bl.end}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleDeleteBlock(bl.id)}
                            className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                          >
                            <Trash2 className="w-4 h-4" /> Remover Bloqueio
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}

          {/* ===== DASHBOARD TAB ===== */}
          {tab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 bg-card/60 backdrop-blur-sm rounded-2xl border border-primary/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Faturamento</p>
                  </div>
                  <p className="text-3xl md:text-4xl font-mono font-bold text-foreground">
                    R$ <span className="text-primary">{totalRevenue}</span>
                  </p>
                </div>
                <div className="p-6 bg-card/60 backdrop-blur-sm rounded-2xl border border-primary/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Scissors className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Serviços</p>
                  </div>
                  <p className="text-3xl md:text-4xl font-mono font-bold text-foreground">
                    <span className="text-primary">{totalServices}</span>
                  </p>
                </div>
              </div>

              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                {([['today', 'Hoje'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      filter === key
                        ? 'bg-primary text-primary-foreground shadow-[0_0_15px_-3px_hsl(45_97%_54%/0.4)]'
                        : 'bg-card/60 text-muted-foreground hover:text-foreground border border-primary/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Revenue by Service */}
              <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-primary/10 p-6">
                <h3 className="font-bold mb-5 text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Faturamento por Serviço
                </h3>
                {(() => {
                  const grouped: Record<string, number> = {};
                  filteredCompleted.forEach(b => { grouped[b.service] = (grouped[b.service] || 0) + b.price; });
                  const max = Math.max(...Object.values(grouped), 1);
                  return Object.entries(grouped).length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum serviço concluído neste período.</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(grouped).sort(([, a], [, b]) => b - a).map(([service, total]) => (
                        <div key={service}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-foreground">{service}</span>
                            <span className="font-mono font-bold text-primary">R$ {total}</span>
                          </div>
                          <div className="w-full bg-secondary/50 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-primary/80 to-primary h-2.5 rounded-full transition-all duration-700" style={{ width: `${(total / max) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Completed History */}
              <div>
                <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Histórico ({filteredCompleted.length})
                </h3>
                <div className="space-y-3">
                  {filteredCompleted.length === 0 && (
                    <div className="text-center py-12">
                      <Scissors className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Nenhum serviço concluído neste período.</p>
                    </div>
                  )}
                  {filteredCompleted.map(b => (
                    <div key={b.id} className="p-4 bg-card/60 backdrop-blur-sm rounded-xl border border-primary/10 hover:border-primary/20 transition-all">
                      {editingId === b.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input value={editService} onChange={e => setEditService(e.target.value)} placeholder="Serviço" className="bg-background/50 border border-primary/10 p-2.5 rounded-lg text-sm text-foreground outline-none focus:border-primary/40" />
                            <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" placeholder="Valor" className="bg-background/50 border border-primary/10 p-2.5 rounded-lg text-sm font-mono text-foreground outline-none focus:border-primary/40" />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" className="bg-background/50 border border-primary/10 p-2.5 rounded-lg text-sm text-foreground outline-none focus:border-primary/40" />
                            <input value={editDate} onChange={e => setEditDate(e.target.value)} placeholder="Data" className="bg-background/50 border border-primary/10 p-2.5 rounded-lg text-sm text-foreground outline-none focus:border-primary/40" />
                            <input value={editTime} onChange={e => setEditTime(e.target.value)} placeholder="Horário" className="bg-background/50 border border-primary/10 p-2.5 rounded-lg text-sm text-foreground outline-none focus:border-primary/40" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:scale-105 active:scale-95 transition-all">
                              Salvar
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-secondary text-muted-foreground rounded-lg text-xs font-medium hover:text-foreground transition-colors">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-foreground">{b.name} — <span className="text-primary">{b.service}</span></p>
                            <p className="text-xs text-muted-foreground">{b.date} às {b.time}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-primary">R$ {b.price}</span>
                            <button onClick={() => startEdit(b)} className="text-muted-foreground hover:text-primary text-sm transition-colors p-1.5 rounded-lg hover:bg-primary/10">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteCompleted(b.id)} className="text-muted-foreground hover:text-destructive text-sm transition-colors p-1.5 rounded-lg hover:bg-destructive/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== ADD SERVICE TAB ===== */}
          {tab === 'add' && (
            <div className="max-w-lg mx-auto space-y-6">
              <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-primary/10 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">
                      {addMode === 'booking' ? 'Adicionar Agendamento' : 'Bloquear Agenda'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {addMode === 'booking' 
                        ? 'O serviço irá para a lista de agendamentos' 
                        : 'Defina horários em que a agenda estará fechada'}
                    </p>
                  </div>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex bg-background/80 p-1 rounded-xl border border-primary/5 mb-6">
                  <button
                    type="button"
                    onClick={() => setAddMode('booking')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      addMode === 'booking'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Adicionar Agendamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('block')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      addMode === 'block'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Bloquear Horário
                  </button>
                </div>

                {addMode === 'booking' ? (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 block">Serviço Rápido</label>
                      <div className="grid grid-cols-2 gap-2">
                        {SERVICES.map(s => (
                          <button
                            key={s.name}
                            onClick={() => handleSelectService(s.name)}
                            className={`p-3 rounded-xl text-xs font-medium transition-all border text-left ${
                              manualService === s.name
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-background/50 border-primary/5 text-muted-foreground hover:border-primary/20 hover:text-foreground'
                            }`}
                          >
                            <span className="block">{s.name}</span>
                            <span className="font-mono text-[10px] opacity-70">R$ {s.price}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Ou nome personalizado</label>
                      <input type="text" value={manualService} onChange={e => setManualService(e.target.value)} placeholder="Nome do serviço" className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/40" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Valor (R$)</label>
                        <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="0" className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm font-mono placeholder:text-muted-foreground/40" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Horário</label>
                        <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/40" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Nome do cliente</label>
                      <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nome do cliente" className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/40" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">WhatsApp do cliente</label>
                      <input type="tel" value={manualPhone} onChange={e => setManualPhone(formatPhone(e.target.value))} placeholder="(41) 99999-9999" maxLength={15} className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/40" />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Data (DD/MM/AAAA)</label>
                      <input
                        type="text"
                        value={manualDate}
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '').slice(0, 8);
                          if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
                          else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                          setManualDate(v);
                        }}
                        placeholder="06/04/2026"
                        className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/40"
                      />
                    </div>

                    <button
                      onClick={handleAddManualService}
                      disabled={!manualService || !manualPrice || !manualName || !manualDate || !manualTime}
                      className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:shadow-[0_0_25px_-5px_hsl(6_48%_68%/0.5)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:shadow-none disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" /> Adicionar aos Agendamentos
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Data (DD/MM/AAAA)</label>
                      <input
                        type="text"
                        value={blockDate}
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g, '').slice(0, 8);
                          if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
                          else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                          setBlockDate(v);
                        }}
                        placeholder="06/04/2026"
                        className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/40"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-background/50 border border-primary/10 p-4 rounded-xl">
                      <span className="text-sm text-foreground font-medium">Bloquear o dia inteiro</span>
                      <button
                        type="button"
                        onClick={() => setBlockAllDay(!blockAllDay)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                          blockAllDay ? 'bg-primary' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            blockAllDay ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {!blockAllDay && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Horário de Início</label>
                          <input
                            type="time"
                            value={blockStart}
                            onChange={e => setBlockStart(e.target.value)}
                            className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Horário de Término</label>
                          <input
                            type="time"
                            value={blockEnd}
                            onChange={e => setBlockEnd(e.target.value)}
                            className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Motivo (Ex: Folga, Almoço, Manutenção)</label>
                      <input
                        type="text"
                        value={blockReason}
                        onChange={e => setBlockReason(e.target.value)}
                        placeholder="Folga, Almoço, Manutenção"
                        className="w-full bg-background/50 border border-primary/10 focus:border-primary/40 p-3.5 rounded-xl outline-none transition-all text-foreground text-sm placeholder:text-muted-foreground/40"
                      />
                    </div>

                    <button
                      onClick={handleSaveBlock}
                      disabled={!blockDate || (!blockAllDay && (!blockStart || !blockEnd))}
                      className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:shadow-[0_0_25px_-5px_hsl(6_48%_68%/0.5)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:shadow-none disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                      Salvar Bloqueio
                    </button>
                  </div>
                )}
              </div>

              {/* Active Blocks List */}
              {addMode === 'block' && blocks.length > 0 && (
                <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-primary/10 p-6 md:p-8 animate-in fade-in duration-300">
                  <h4 className="font-bold text-sm text-foreground mb-4">Horários Bloqueados</h4>
                  <div className="space-y-3">
                    {blocks.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-3.5 bg-background/50 border border-primary/5 rounded-xl text-sm">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{b.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.date} • {b.allDay ? 'Dia Inteiro' : `${b.start} às ${b.end}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteBlock(b.id)}
                          className="p-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors"
                          title="Remover Bloqueio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Booking Modal */}
          {editingBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <div className="w-[95%] max-w-md mx-auto bg-zinc-950 rounded-2xl border border-primary/15 card-shadow p-6 md:p-8 relative space-y-6">
                <button
                  onClick={() => setEditingBooking(null)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">Editar Agendamento</h3>
                  <p className="text-xs text-muted-foreground">Cliente: {editingBooking.name}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase text-zinc-400 tracking-wider font-semibold mb-2">Serviço</label>
                    <select
                      value={editBookingService}
                      onChange={(e) => handleServiceChange(e.target.value)}
                      className="w-full bg-zinc-800 border-none rounded-xl p-3.5 focus:ring-1 focus:ring-primary outline-none text-foreground text-sm"
                      style={{ colorScheme: 'dark' }}
                    >
                      {SERVICES.map((s) => (
                        <option key={s.name} value={s.name} className="bg-zinc-900 text-foreground">
                          {s.name} (R$ {s.price},00)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Contêiner Pai Invisível usando Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-4">
                    
                    {/* Coluna 1: Data */}
                    <div className="flex flex-col w-full">
                      <label className="text-xs font-semibold text-gray-400 tracking-wider mb-1.5">
                        NOVA DATA
                      </label>
                      <input 
                        type="date" 
                        className="w-full bg-[#27272a] rounded-lg px-3 py-2.5 text-sm text-white border border-transparent outline-none focus:border-zinc-500 transition-colors"
                        value={editBookingDate}
                        onChange={(e) => setEditBookingDate(e.target.value)}
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>

                    {/* Coluna 2: Horário */}
                    <div className="flex flex-col w-full">
                      <label className="text-xs font-semibold text-gray-400 tracking-wider mb-1.5">
                        NOVO HORÁRIO
                      </label>
                      <input 
                        type="time" 
                        className="w-full bg-[#27272a] rounded-lg px-3 py-2.5 text-sm text-white border border-transparent outline-none focus:border-zinc-500 transition-colors"
                        value={editBookingTime}
                        onChange={(e) => setEditBookingTime(e.target.value)}
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>

                  </div>

                  <div className="flex justify-between items-center bg-zinc-800/40 p-4 rounded-xl border border-primary/5">
                    <span className="text-xs uppercase text-zinc-400 tracking-wider font-semibold">Valor do Serviço</span>
                    <span className="text-base font-mono font-bold text-primary">R$ {editBookingPrice},00</span>
                  </div>

                  <button
                    onClick={handleSaveEditBooking}
                    disabled={isSavingEdit || !editBookingDate || !editBookingTime || !editBookingService}
                    className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:shadow-[0_0_25px_-5px_hsl(6_48%_68%/0.5)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSavingEdit ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Confirm Cancel Modal */}
          {cancellingBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-card w-full max-w-sm rounded-3xl border border-primary/15 card-shadow p-6 md:p-8 relative space-y-6 animate-in zoom-in-95 duration-200">
                <button
                  onClick={() => setCancellingBooking(null)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-2 text-center pt-2">
                  <h3 className="text-lg font-bold text-foreground">Confirmar Cancelamento</h3>
                  <p className="text-sm text-muted-foreground">
                    Tem certeza que deseja cancelar o agendamento de <span className="font-semibold text-foreground">{cancellingBooking.name}</span>?
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setCancellingBooking(null)}
                    className="flex-1 py-3 bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl text-xs font-bold transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmCancel}
                    className="flex-1 py-3 bg-destructive/15 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 rounded-xl text-xs font-bold transition-all"
                  >
                    Sim, Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
