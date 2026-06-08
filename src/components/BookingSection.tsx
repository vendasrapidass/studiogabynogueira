import { useState, useMemo, useEffect } from 'react';
import { SERVICES, isDayAllowed, getTimesForDate, WHATSAPP_NUMBER, generateWhatsAppUrl, formatPhone, getBookingDuration, ScheduleBlock } from '@/lib/types';
import { addBooking, getBookings, getBlocks } from '@/lib/bookingStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, X, Plus } from 'lucide-react';

type ServiceType = typeof SERVICES[0];

const BookingSection = () => {
  const [step, setStep] = useState(1);
  const [activeCategory, setActiveCategory] = useState('Unhas');
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [extras, setExtras] = useState<ServiceType[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalDuration = useMemo(() => {
    if (!selectedService) return 0;
    return selectedService.time + extras.reduce((sum, e) => sum + e.time, 0);
  }, [selectedService, extras]);

  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [googleBookings, setGoogleBookings] = useState<Booking[]>([]);
  const [googleBlocks, setGoogleBlocks] = useState<ScheduleBlock[]>([]);

  // Load schedule events from Google Calendar API on mount to act as source of truth
  useEffect(() => {
    fetch('/api/calendar')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.bookings)) {
          setGoogleBookings(data.bookings);
        }
        if (Array.isArray(data.blocks)) {
          setGoogleBlocks(data.blocks);
        }
      })
      .catch((err) => {
        console.error("Error loading events from Google Calendar API:", err);
      });
  }, []);

  useEffect(() => {
    if (!selectedDate || !selectedService) {
      setAvailableTimes([]);
      return;
    }

    const dateStr = format(selectedDate, 'dd/MM/yyyy');
    const baseTimes = getTimesForDate(selectedDate);

    const calculateLocalSlots = () => {
      // Mescla reservas locais e do Google Calendar para evitar duplicados e manter consistência imediata
      const localBookings = getBookings().filter((b) => b.date === dateStr && b.status !== 'completed');
      const apiBookings = googleBookings.filter((b) => b.date === dateStr && b.status !== 'completed');
      const bookings = [...apiBookings];
      localBookings.forEach(lb => {
        const lbIdNormalized = lb.id.replace(/-/g, '').toLowerCase();
        if (!bookings.some(ab => ab.id === lb.id || ab.id.replace(/-/g, '').toLowerCase() === lbIdNormalized)) {
          bookings.push(lb);
        }
      });

      const localBlocks = getBlocks().filter((block) => block.date === dateStr);
      const apiBlocks = googleBlocks.filter((block) => block.date === dateStr);
      const blocks = [...apiBlocks];
      localBlocks.forEach(lb => {
        const lbIdNormalized = lb.id.replace(/-/g, '').toLowerCase();
        if (!blocks.some(ab => ab.id === lb.id || ab.id.replace(/-/g, '').toLowerCase() === lbIdNormalized)) {
          blocks.push(lb);
        }
      });

      const timeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      const now = new Date();
      const isToday = selectedDate.toDateString() === now.toDateString();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      return baseTimes.filter((timeStr) => {
        const start = timeToMinutes(timeStr);
        const end = start + totalDuration;

        // Filter out past times for today
        if (isToday && start < currentMinutes) {
          return false;
        }

        // Lunch break check:
        // Weekdays: 12:00 to 13:00 (720 to 780 minutes)
        // Saturdays: 11:30 to 12:30 (690 to 750 minutes)
        const isSaturday = selectedDate.getDay() === 6;
        const lunchStart = isSaturday ? 690 : 720;
        const lunchEnd = isSaturday ? 750 : 780;

        const overlapsLunch = Math.max(start, lunchStart) < Math.min(end, lunchEnd);
        if (overlapsLunch) {
          return false;
        }

        // Check overlap with schedule blocks of the day
        const hasBlockOverlap = blocks.some((block) => {
          if (block.allDay) return true;
          if (!block.start || !block.end) return false;
          
          const blockStart = timeToMinutes(block.start);
          const blockEnd = timeToMinutes(block.end);
          
          return Math.max(start, blockStart) < Math.min(end, blockEnd);
        });

        if (hasBlockOverlap) {
          return false;
        }

        // Check overlap with any booking of the day
        const hasOverlap = bookings.some((b) => {
          const bStart = timeToMinutes(b.time);
          const bDuration = getBookingDuration(b.service);
          const bEnd = bStart + bDuration;

          return Math.max(start, bStart) < Math.min(end, bEnd);
        });

        return !hasOverlap;
      });
    };

    const localSlots = calculateLocalSlots();
    setAvailableTimes(localSlots);
  }, [selectedDate, selectedService, extras, totalDuration, googleBookings, googleBlocks]);

  // Combined service name and price
  const combinedServiceName = useMemo(() => {
    if (!selectedService) return '';
    const names = [selectedService.name, ...extras.map(e => e.name)];
    return names.join(' + ');
  }, [selectedService, extras]);

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    return selectedService.price + extras.reduce((sum, e) => sum + e.price, 0);
  }, [selectedService, extras]);

  // Order bump: only suggest small add-on nail services
  const availableExtras = useMemo(() => {
    if (!selectedService) return [];
    return SERVICES.filter(s => 
      s.name !== selectedService.name && 
      (s.name === 'Remoção' || s.name === 'Esmaltação em Gel' || s.name === 'Banho de Gel')
    );
  }, [selectedService]);

  const handleSelectService = (s: ServiceType) => {
    setSelectedService(s);
    setExtras([]);
    setStep(2);
  };

  const handleToggleExtra = (s: ServiceType) => {
    setExtras(prev => {
      const exists = prev.find(e => e.name === s.name);
      if (exists) return prev.filter(e => e.name !== s.name);
      return [...prev, s];
    });
  };

  const handleSkipExtras = () => {
    setStep(2);
  };

  const handleConfirmExtras = () => {
    setStep(2);
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTime('');
      setStep(3);
    }
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setStep(4);
  };

  const handleConfirm = () => {
    if (!name.trim() || !phone.trim() || !selectedService || !selectedDate || !selectedTime) return;

    const dateStr = format(selectedDate, 'dd/MM/yyyy');
    const booking = {
      id: crypto.randomUUID(),
      service: combinedServiceName,
      price: totalPrice,
      date: dateStr,
      time: selectedTime,
      name: name.trim(),
      phone: phone.trim(),
      status: 'accepted' as const,
    };

    setIsSubmitting(true);

    const finishBooking = () => {
      addBooking(booking);
      const msg = `✨ STUDIO GABY NOGUEIRA ✨\n\nOlá! 🌸\nMeu nome é ${booking.name}.\nMeu agendamento foi realizado com sucesso:\n\n📋 Serviço: ${booking.service}\n💰 Valor: R$ ${booking.price},00\n📅 Data: ${booking.date}\n🕐 Horário: ${booking.time}\n📱 Meu WhatsApp: ${booking.phone}\n\nObrigado! 💕`;
      window.location.href = generateWhatsAppUrl(WHATSAPP_NUMBER, msg);

      setIsSubmitting(false);
      setShowSuccess(true);
      setStep(1);
      setSelectedService(null);
      setExtras([]);
      setSelectedDate(undefined);
      setSelectedTime('');
      setName('');
      setPhone('');
    };

    // Sincroniza o agendamento com o Google Calendar via API Serverless
    fetch('/api/calendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'booking',
        booking,
        duration: totalDuration,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha na API de sincronização');
        return res.json();
      })
      .then((data) => {
        console.log("Booking synced to Google Calendar:", data);
        finishBooking();
      })
      .catch((err) => {
        console.error("Error syncing booking to Google Calendar:", err);
        finishBooking(); // Prossiga mesmo com erro no sync para garantir a experiência do usuário
      });
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <>
      <section id="agendar" className="py-24 px-4 md:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold">Agende seu horário</h2>
          <p className="text-muted-foreground mt-2">Escolha o serviço e o melhor momento para você.</p>
        </div>

        <div className="glass rounded-3xl p-4 md:p-8 card-shadow min-h-[400px]">
          {/* Steps */}
          <div className="flex justify-between mb-10 px-2 md:px-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors text-sm',
                    step >= i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {i}
                </div>
                <span className="text-xs text-muted-foreground hidden md:block">
                  {['Serviço', 'Data', 'Horário', 'Dados'][i - 1]}
                </span>
              </div>
            ))}
          </div>

          {step > 1 && (
            <button onClick={goBack} className="mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Voltar
            </button>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                {/* Category Tabs */}
                <div className="flex justify-center gap-2 mb-8 flex-wrap">
                  {['Unhas', 'Cílios - Aplicação', 'Cílios - Manutenção'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300",
                        activeCategory === cat
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-2 px-2">
                  {SERVICES.filter(s => s.category === activeCategory).map((s) => (
                    <button
                      key={s.name}
                      onClick={() => handleSelectService(s)}
                      className="flex-shrink-0 w-[200px] md:w-[220px] h-[240px] md:h-[270px] rounded-2xl border border-border hover:border-primary/50 transition-all text-center group overflow-hidden snap-center relative"
                    >
                      <img
                        src={s.image}
                        alt={s.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        width={220}
                        height={270}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                        <h3 className="font-bold text-sm md:text-base text-white group-hover:text-primary transition-colors">{s.name}</h3>
                        <p className="text-xs text-white/70 mt-1">{s.time} min</p>
                        <span className="text-lg font-mono font-bold mt-1 text-primary block">R$ {s.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-3 px-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    ← Arraste para o lado →
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex justify-center">
                <div className="bg-secondary rounded-2xl p-4 border border-border">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleSelectDate}
                    locale={ptBR}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today || !isDayAllowed(date);
                    }}
                    className="pointer-events-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-3 px-2 uppercase tracking-widest text-center">
                    Segunda a Sábado • Domingo Fechado
                  </p>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {availableTimes.map((time) => (
                    <button
                      key={time}
                      onClick={() => handleSelectTime(time)}
                      className={cn(
                        'py-3 rounded-xl font-mono font-medium border transition-all text-sm md:text-base',
                        selectedTime === time
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary border-border hover:border-primary/50'
                      )}
                    >
                      {time}
                    </button>
                  ))}
                  {availableTimes.length === 0 && (
                    <p className="col-span-full text-center text-sm text-muted-foreground py-8">
                      Nenhum horário disponível para este serviço nesta data.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="max-w-md mx-auto">
                <div className="bg-secondary/50 rounded-2xl p-4 mb-6 border border-border text-sm space-y-1">
                  <p><span className="text-muted-foreground">Serviço:</span> <span className="font-semibold">{combinedServiceName}</span></p>
                  <p><span className="text-muted-foreground">Data:</span> <span className="font-semibold">{selectedDate && format(selectedDate, 'dd/MM/yyyy')}</span></p>
                  <p><span className="text-muted-foreground">Horário:</span> <span className="font-semibold">{selectedTime}</span></p>
                  <p><span className="text-muted-foreground">Valor:</span> <span className="font-semibold font-mono">R$ {totalPrice},00</span></p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Nome Completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Maria Silva"
                      className="w-full bg-secondary border border-border rounded-xl p-4 focus:border-primary outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">WhatsApp</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="(41) 99999-9999"
                      maxLength={15}
                      className="w-full bg-secondary border border-border rounded-xl p-4 focus:border-primary outline-none transition-colors text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    onClick={handleConfirm}
                    disabled={!name.trim() || !phone.trim()}
                    className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl glow-shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    Finalizar Agendamento
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <div className="bg-card p-8 rounded-3xl card-shadow w-full max-w-sm border border-border text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <h3 className="text-lg font-bold">Salvando seu Horário...</h3>
              <p className="text-muted-foreground text-sm">
                Estamos registrando seu agendamento na nossa agenda e preparando sua mensagem do WhatsApp.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Popup */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card p-8 rounded-3xl card-shadow w-full max-w-sm border border-border text-center relative"
            >
              <button
                onClick={() => setShowSuccess(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Agendamento Realizado!</h3>
              <p className="text-muted-foreground text-sm">
                Seu agendamento foi enviado com sucesso. Aguarde a confirmação do Studio pelo WhatsApp.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BookingSection;
