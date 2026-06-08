import { useState, useEffect } from 'react';
import { isOpenNow } from '@/lib/types';
import { motion } from 'framer-motion';

const HeroSection = () => {
  const [open, setOpen] = useState(isOpenNow());

  useEffect(() => {
    const interval = setInterval(() => setOpen(isOpenNow()), 60000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBooking = () => {
    document.getElementById('agendar')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      <img
        src="https://i.imgur.com/EcTYFNk.webp"
        alt="STUDIO GABY NOGUEIRA"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
        loading="eager"
        fetchPriority="high"
        width={1069}
        height={1600}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 text-center px-6 max-w-4xl"
      >
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass card-shadow text-sm font-medium">
          <span className={`w-2 h-2 rounded-full animate-pulse ${open ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{open ? 'Aberto Agora' : 'Fechado Agora'}</span>
        </div>

        <h1 className="text-4xl md:text-7xl font-bold mb-6">
          Realce a sua{' '}
          <span className="text-primary">beleza natural.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Olhar marcante, unhas impecáveis e o cuidado exclusivo que você merece. Agende sua experiência no STUDIO GABY NOGUEIRA.
        </p>

        <motion.button
          onClick={scrollToBooking}
          animate={{
            boxShadow: [
              '0 0 20px hsl(6 48% 68% / 0.3), 0 0 40px hsl(6 48% 68% / 0.15)',
              '0 0 30px hsl(6 48% 68% / 0.5), 0 0 60px hsl(6 48% 68% / 0.3)',
              '0 0 20px hsl(6 48% 68% / 0.3), 0 0 40px hsl(6 48% 68% / 0.15)',
            ],
            scale: [1, 1.03, 1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex items-center justify-center px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all active:scale-95 text-lg"
        >
          Agendar Horário
        </motion.button>
      </motion.div>
    </section>
  );
};

export default HeroSection;
