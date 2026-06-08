import { GALLERY_IMAGES } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const GallerySection = () => {
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
    }, 15);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 bg-secondary/30 overflow-hidden">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-3xl font-bold text-center mb-10 text-primary"
      >
        Nossos Trabalhos
      </motion.h2>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        ref={ref}
        className="flex gap-4 overflow-x-auto no-scrollbar px-6 pb-4"
      >
        {GALLERY_IMAGES.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`Trabalho ${i + 1}`}
            loading="lazy"
            width={256}
            height={320}
            className="h-72 md:h-80 w-56 md:w-64 object-cover rounded-2xl flex-shrink-0 hover:scale-105 transition-transform duration-500 cursor-pointer card-shadow"
          />
        ))}
      </motion.div>
    </section>
  );
};

export default GallerySection;
