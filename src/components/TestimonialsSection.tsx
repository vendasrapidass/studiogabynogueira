import { Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import dep1 from '@/assets/depoimento-1.png';
import dep2 from '@/assets/depoimento-2.png';
import dep3 from '@/assets/depoimento-3.png';
import dep4 from '@/assets/depoimento-4.png';

const TESTIMONIALS = [dep1, dep2, dep3, dep4];

const TestimonialsSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const interval = setInterval(() => {
      setScrollPos((prev) => {
        const maxScroll = el.scrollWidth - el.clientWidth;
        const next = prev + 1;
        if (next >= maxScroll) {
          el.scrollTo({ left: 0 });
          return 0;
        }
        el.scrollTo({ left: next });
        return next;
      });
    }, 20);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 px-4 md:px-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center gap-2 mb-10"
      >
        <h2 className="text-3xl font-bold text-primary">Avaliações</h2>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="w-5 h-5 fill-primary text-primary" />
          ))}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        ref={ref}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-4"
      >
        {TESTIMONIALS.map((img, i) => (
          <div key={i} className="flex-shrink-0 w-[260px] md:w-[320px] h-[70px] rounded-xl overflow-hidden bg-secondary/40 border border-border flex items-center justify-center p-3 card-shadow">
            <img
              src={img}
              alt={`Avaliação ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </motion.div>
    </section>
  );
};

export default TestimonialsSection;
