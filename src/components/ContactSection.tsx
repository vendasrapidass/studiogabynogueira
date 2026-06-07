import { WHATSAPP_NUMBER, generateWhatsAppUrl } from '@/lib/types';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Clock, Sparkles } from 'lucide-react';

const ContactSection = () => (
  <section className="py-24 px-4 md:px-6 max-w-5xl mx-auto">
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border border-border"
    >
      {/* Background glow effects */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-success/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative glass p-10 md:p-14">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex justify-center mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Atendimento rápido
          </span>
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-3xl md:text-4xl font-bold text-center mb-3"
        >
          Tem alguma{' '}
          <span className="text-primary">dúvida</span>?
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-muted-foreground text-center mb-10 max-w-md mx-auto text-lg"
        >
          Fale diretamente com a gente pelo WhatsApp. Respondemos rapidinho!
        </motion.p>

        {/* Info cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-lg mx-auto"
        >
          {[
            { icon: MessageCircle, label: 'Resposta rápida' },
            { icon: Phone, label: 'Atendimento direto' },
            { icon: Clock, label: 'Seg a Sáb' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary/50 border border-border">
              <Icon className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground font-medium">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex justify-center"
        >
          <a
            href={generateWhatsAppUrl(WHATSAPP_NUMBER, 'Olá Studio Gaby Nogueira, tenho uma dúvida!')}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 px-10 py-4 bg-success text-success-foreground font-bold rounded-2xl transition-all hover:shadow-[0_0_30px_-5px_hsl(142_76%_36%/0.5)] hover:scale-[1.03] active:scale-95"
          >
            <MessageCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
            Chamar no WhatsApp
          </a>
        </motion.div>
      </div>
    </motion.div>
  </section>
);

export default ContactSection;
