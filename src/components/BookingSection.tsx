import { useState, useMemo, useEffect } from 'react';
import { SERVICES, isDayAllowed, getTimesForDate, WHATSAPP_NUMBER, generateWhatsAppUrl, formatPhone, getBookingDuration, ScheduleBlock } from '@/lib/types';
import { addBooking, getBookings, getBlocks } from '@/lib/bookingStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, X, Plus, Copy, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

type ServiceType = typeof SERVICES[0];

const PIX_KEY = 'gabynogueira05@outlook.com'; // A chave Pix (email, telefone, cpf ou aleatória)
const SINAL_VALUE = 30; // O valor fixo do sinal em reais

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

  // Estados do Modal Pix
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);
  
  // Estados de Upload do Comprovante
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [comprovantePreview, setComprovantePreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [comprovanteError, setComprovanteError] = useState('');

  // Tratar Cancelamentos Inesperados
  useEffect(() => {
    if (!showPixModal) {
      setComprovanteFile(null);
      setComprovantePreview('');
      setComprovanteError('');
      setPixCopiado(false);
    }
  }, [showPixModal]);

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
        // Saturdays: 08:00, 11:00 e 14:00 são os horários oficiais (sem corte de almoço)
        const isSaturday = selectedDate.getDay() === 6;
        const lunchStart = 720;
        const lunchEnd = 780;

        const overlapsLunch = !isSaturday && timeStr !== '11:00' && Math.max(start, lunchStart) < Math.min(end, lunchEnd);
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

  const compressAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve((e.target?.result as string) || '');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setComprovanteFile(file);
      setComprovanteError('');
      try {
        const base64 = await compressAndGetBase64(file);
        setComprovantePreview(base64);
      } catch (err) {
        console.warn('Preview error:', err);
      }
    }
  };

  const finishBookingFlow = async (comprovanteUrl?: string) => {
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

    // 1. Salva imediatamente no banco local
    addBooking(booking);

    // 2. Prepara mensagem para o WhatsApp com link oficial do comprovante ou fallback não-bloqueante
    let msg = `✨ *STUDIO GABY NOGUEIRA* ✨\n\nOlá Gaby! 🌸\nMeu nome é *${booking.name}*.\nMeu agendamento foi realizado pelo site:\n\n📋 *Serviço:* ${booking.service}\n💰 *Valor Total:* R$ ${booking.price},00\n📅 *Data:* ${booking.date}\n🕐 *Horário:* ${booking.time}\n📱 *Meu WhatsApp:* ${booking.phone}\n\n💵 *Sinal Pago:* R$ ${SINAL_VALUE},00`;

    if (comprovanteUrl) {
      msg += `\n\n🧾 *Comprovante do Sinal:*\n${comprovanteUrl}`;
    } else {
      msg += `\n\n🧾 *Comprovante do Sinal:*\n(Estou enviando o print em anexo aqui na conversa)`;
    }

    msg += `\n\nObrigado! 💕`;

    const zapUrl = generateWhatsAppUrl(WHATSAPP_NUMBER, msg);

    // 3. Sincroniza com Google Calendar aguardando até 2.5s com keepalive: true
    try {
      const calendarPromise = fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'booking',
          booking,
          duration: totalDuration,
        }),
        keepalive: true,
      });

      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2500));
      await Promise.race([calendarPromise, timeoutPromise]);
    } catch (err) {
      console.warn("Background Google Calendar sync error:", err);
    }

    // 4. Conclui o fluxo e abre o WhatsApp
    setIsSubmitting(false);
    setShowPixModal(false);
    setShowSuccess(true);

    try {
      window.location.href = zapUrl;
    } catch (e) {
      console.warn("Auto-redirect to WhatsApp error:", e);
    }

    // 5. Limpa os campos do formulário
    setStep(1);
    setSelectedService(null);
    setExtras([]);
    setSelectedDate(undefined);
    setSelectedTime('');
    setName('');
    setPhone('');
    setComprovanteFile(null);
    setComprovantePreview('');
    setComprovanteError('');
  };

  const handleConfirm = () => {
    if (!name.trim() || !phone.trim() || !selectedService || !selectedDate || !selectedTime) return;
    setShowPixModal(true);
  };

  const handlePixSubmit = async () => {
    if (!comprovanteFile && !comprovantePreview) {
      setComprovanteError('O comprovante é obrigatório para garantir o horário.');
      return;
    }

    setIsUploading(true);
    setComprovanteError('');
    let comprovanteUrl = '';

    try {
      let base64 = comprovantePreview;
      if (!base64 && comprovanteFile) {
        base64 = await compressAndGetBase64(comprovanteFile);
      }

      // 1. Tenta upload via backend (Imgur oficial via servidor)
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            filename: comprovanteFile?.name || 'comprovante.jpg',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.url) {
            comprovanteUrl = data.url;
          }
        }
      } catch (backendErr) {
        console.warn('Backend upload error, attempting client Imgur fallback...', backendErr);
      }

      // 2. Fallback direto Imgur do navegador caso backend oscile
      if (!comprovanteUrl && base64) {
        const imgurClientIds = ['546c25a59c58ad7', 'c8c692df5e0cba0', 'e9df0fb99f6dcf7'];
        const cleanB64 = base64.replace(/^data:image\/\w+;base64,/, '');

        for (const cId of imgurClientIds) {
          try {
            const imgurForm = new FormData();
            imgurForm.append('image', cleanB64);
            imgurForm.append('type', 'base64');

            const clientRes = await fetch('https://api.imgur.com/3/image', {
              method: 'POST',
              headers: { Authorization: `Client-ID ${cId}` },
              body: imgurForm,
            });

            if (clientRes.ok) {
              const cData = await clientRes.json().catch(() => ({}));
              if (cData.success && cData.data?.link) {
                comprovanteUrl = cData.data.link.replace('http://', 'https://');
                break;
              }
            }
          } catch (cErr) {
            console.warn(`Client Imgur fallback ${cId} failed:`, cErr);
          }
        }
      }
    } catch (error) {
      console.warn('Upload error, fallback gracefully:', error);
    } finally {
      setIsUploading(false);
    }

    setShowPixModal(false);
    finishBookingFlow(comprovanteUrl);
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 2000);
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

      {/* Modal Pix */}
      <AnimatePresence>
        {showPixModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card p-6 md:p-8 rounded-3xl card-shadow w-full max-w-md border border-primary/20 relative text-center space-y-6 overflow-y-auto max-h-[90vh] no-scrollbar"
            >
              <button
                onClick={() => setShowPixModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Sinal de Agendamento</h3>
                <p className="text-sm text-muted-foreground">
                  Para garantir seu horário, pedimos um sinal de <strong className="text-primary">R$ {SINAL_VALUE},00</strong> via Pix. 
                  O valor será abatido do total no dia do atendimento.
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center p-2">
                <div className="bg-white p-3 rounded-xl">
                  <img 
                    src="/qr-code-pix.png"
                    alt="QR Code Pix"
                    className="w-40 h-40"
                  />
                </div>
              </div>

              {/* Chave Pix */}
              <div className="space-y-2 text-left">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Chave Pix Copia e Cola</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={PIX_KEY} 
                    className="flex-1 bg-secondary border border-border rounded-xl px-4 text-sm text-foreground outline-none"
                  />
                  <button 
                    onClick={handleCopyPix}
                    className="bg-primary/10 text-primary hover:bg-primary/20 p-3 rounded-xl transition-colors flex items-center justify-center min-w-[48px]"
                  >
                    {pixCopiado ? <CheckCircle className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Anexar Comprovante */}
              <div className="space-y-2 text-left pt-2 border-t border-border mt-4">
                <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Comprovante de Pagamento</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "w-full bg-secondary border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors",
                    comprovanteFile ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  )}>
                    {comprovanteFile ? (
                      <>
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-sm font-medium text-center truncate w-full px-4">{comprovanteFile.name}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6" />
                        <span className="text-sm font-medium">Toque para anexar a foto</span>
                      </>
                    )}
                  </div>
                </div>
                {comprovanteError && <p className="text-destructive text-xs mt-1 font-medium">{comprovanteError}</p>}
              </div>

              {/* Submit Button */}
              <button
                onClick={handlePixSubmit}
                disabled={isUploading || (!comprovanteFile && !comprovantePreview)}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl glow-shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar Agendamento'
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BookingSection;
