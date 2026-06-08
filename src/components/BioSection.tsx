import { motion } from 'framer-motion';

const BioSection = () => {
  return (
    <section id="sobre" className="py-24 px-4 md:px-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Photo Column */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative flex justify-center"
        >
          <div className="relative w-72 h-96 md:w-80 md:h-[450px]">
            {/* Background glowing frame */}
            <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-xl -translate-x-2 translate-y-2" />
            <div className="absolute inset-0 border border-primary/20 rounded-3xl -translate-x-3 translate-y-3 pointer-events-none" />
            
            {/* Main Image */}
            <img
              src="https://i.imgur.com/r7gD5UX.webp"
              alt="Gabrielly - Lash & Nail Designer"
              className="w-full h-full object-cover rounded-3xl card-shadow border border-border"
              loading="lazy"
              width={320}
              height={450}
            />
          </div>
        </motion.div>

        {/* Text Column */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6 text-left"
        >
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-primary font-bold">A Profissional</span>
            <h2 className="text-3xl md:text-4xl font-bold">Sobre mim 🎓</h2>
          </div>
          
          <div className="glass p-6 md:p-8 rounded-2xl border border-border/60 card-shadow space-y-4">
            <p className="text-lg text-foreground/90 leading-relaxed font-medium">
              Sou Gabrielly, 21 anos, Lash e Nail Designer Especializada.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Tenho como missão unir beleza, saúde e praticidade para realçar o que há de mais bonito em cada mulher — sem exageros e com muito carinho.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BioSection;
