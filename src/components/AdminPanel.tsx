import { useState, useEffect, useMemo } from 'react';
import { Booking, SERVICES, generateWhatsAppUrl, formatPhone, ScheduleBlock } from '@/lib/types';
import { getBookings, saveBookings, getCompleted, saveCompleted, addCompleted, removeCompleted, addBooking, getBlocks, addBlock, removeBlock } from '@/lib/bookingStore';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, DollarSign, Scissors, TrendingUp, ArrowLeft, Plus, X, Check, Clock, Pencil, Trash2, Phone } from 'lucide-react';

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
    setBookings(getBookings());
    setCompleted(getCompleted());
    
    // Immediate fallback load from localStorage
    const localBlocks = getBlocks();
    setBlocks(localBlocks);

    // Sync blocks from GAS if available to ensure dashboard lists it correctly across devices
    const google = (window as any).google;
    if (google?.script?.run) {
      const run = google.script.run;
      const getBlocksFunc = run.getBlocks ? 'getBlocks' : (run.getScheduleBlocks ? 'getScheduleBlocks' : null);
      if (getBlocksFunc) {
        run.withSuccessHandler((gasBlocks: ScheduleBlock[]) => {
          if (Array.isArray(gasBlocks)) {
            saveBlocks(gasBlocks);
            setBlocks(gasBlocks);
          }
        })
        .withFailureHandler((err: any) => {
          console.error("Error loading blocks from GAS:", err);
        })
        [getBlocksFunc]();
      }
    }
  };

  useEffect(() => { reload(); }, []);

  // Accept booking → send WhatsApp confirmation, mark as accepted
  const handleAccept = (booking: Booking) => {
    const msg = `✨ *STUDIO GABY NOGUEIRA* ✨\n\nOlá *${booking.name}*! 👋\n\nSeu agendamento foi *CONFIRMADO* com sucesso! ✅\n\n📋 *Serviço:* ${booking.service}\n💰 *Valor:* R$ ${booking.price},00\n📅 *Data:* ${booking.date}\n🕐 *Horário:* ${booking.time}\n\n📍 *Endereço:* R. Uirapuru, 746 - Capela Velha, Araucária\n\nEstamos te esperando! 🌸\nAté lá! 🤝`;
    
    if (booking.phone) {
      window.open(generateWhatsAppUrl(booking.phone, msg), '_blank');
    }

    // Update status to accepted
    const updated = bookings.map(b => b.id === booking.id ? { ...b, status: 'accepted' as const } : b);
    saveBookings(updated);
    setBookings(updated);
  };

  // Finalize → move to completed, free time slot
  const handleFinalize = (booking: Booking) => {
    addCompleted(booking);
    const updated = bookings.filter(b => b.id !== booking.id);
    saveBookings(updated);
    setBookings(updated);
    setCompleted(getCompleted());
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
      status: 'pending',
    };

    addBooking(booking);
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

    const google = (window as any).google;
    if (google?.script?.run) {
      google.script.run
        .withSuccessHandler(() => {
          console.log("Block saved to GAS");
          reload(); // Refresh dashboard list once confirmed by GAS backend
        })
        .withFailureHandler((err: any) => {
          console.error("Error saving block to GAS:", err);
        })
        .addBlock(block);
    }

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

    const google = (window as any).google;
    if (google?.script?.run) {
      google.script.run
        .withSuccessHandler(() => {
          console.log("Block deleted from GAS");
        })
        .withFailureHandler((err: any) => {
          console.error("Error deleting block from GAS:", err);
        })
        .removeBlock(id);
    }

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

    bookings.forEach(b => {
      const [d, m, y] = b.date.split('/').map(Number);
      const [hour, min] = b.time.split(':').map(Number);
      const timestamp = new Date(y, m - 1, d, hour, min).getTime();
      agendaItems.push({ type: 'booking', id: b.id, timestamp, raw: b });
    });

    blocks.forEach(bl => {
      const [d, m, y] = bl.date.split('/').map(Number);
      let hour = 0;
      let min = 0;
      if (!bl.allDay && bl.start) {
        const [h, mi] = bl.start.split(':').map(Number);
        hour = h;
        min = mi;
      }
      const timestamp = new Date(y, m - 1, d, hour, min).getTime();
      agendaItems.push({ type: 'block', id: bl.id, timestamp, raw: bl });
    });

    return agendaItems.sort((a, b) => a.timestamp - b.timestamp);
  }, [bookings, blocks]);

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

              {/* Summary */}
              {bookings.length > 0 && (
                <div className="flex gap-3 mb-2">
                  <span className="text-xs bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-full font-medium">
                    ⏳ {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full font-medium">
                    ✅ {acceptedCount} aceito{acceptedCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {unifiedAgenda.length === 0 && (
                <div className="text-center py-16">
                  <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum agendamento pendente ou bloqueio ativo</p>
                </div>
              )}

              {unifiedAgenda.map(item => {
                if (item.type === 'booking') {
                  const a = item.raw;
                  return (
                    <div key={a.id} className={`p-5 md:p-6 bg-card/60 backdrop-blur-sm rounded-2xl border transition-all ${
                      a.status === 'accepted' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-primary/10 hover:border-primary/20'
                    }`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-lg text-foreground">{a.name}</p>
                            {a.status === 'accepted' && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Pendente</span>
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
                          {a.status === 'accepted' ? (
                            <button
                              onClick={() => handleFinalize(a)}
                              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold transition-all hover:shadow-[0_0_20px_-5px_hsl(6_48%_68%/0.4)] hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                              <Check className="w-4 h-4" /> Finalizar
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleAccept(a)}
                                className="px-5 py-2.5 bg-emerald-600 text-foreground rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
                              >
                                ✅ Aceitar
                              </button>
                              <button
                                onClick={() => setRefusingId(a.id)}
                                className="px-5 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm font-bold transition-all hover:bg-destructive hover:text-destructive-foreground hover:scale-105 active:scale-95"
                              >
                                ✕ Recusar
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {refusingId === a.id && (
                        <div className="mt-4 p-4 bg-background/50 rounded-xl border border-destructive/10 space-y-2">
                          <p className="text-sm font-medium text-foreground mb-3">Motivo da recusa:</p>
                          {REFUSE_REASONS.map(reason => (
                            <button
                              key={reason}
                              onClick={() => handleRefuse(a, reason)}
                              className="block w-full text-left px-4 py-2.5 rounded-lg bg-card hover:bg-destructive/10 hover:text-destructive text-sm transition-all border border-transparent hover:border-destructive/20"
                            >
                              {reason}
                            </button>
                          ))}
                          <button onClick={() => setRefusingId(null)} className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      )}
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
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
