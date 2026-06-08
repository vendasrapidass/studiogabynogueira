import { motion } from 'framer-motion';

const LocationSection = () => {
  const handleDirections = () => {
    window.open('https://www.google.com/maps/dir/?api=1&destination=Rua+Uirapuru,+746+-+Capela+Velha,+Arauc%C3%A1ria+-+PR', '_blank');
  };

  return (
    <section className="py-24 px-4 md:px-6 max-w-5xl mx-auto space-y-8">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-3xl md:text-4xl font-bold text-center mb-4"
      >
        Localização
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="glass p-6 md:p-8 rounded-3xl card-shadow space-y-6"
      >
        <div className="h-64 md:h-80 rounded-2xl overflow-hidden">
          <iframe
            src="https://maps.google.com/maps?q=Rua%20Uirapuru,%20746%20-%20Capela%20Velha,%20Arauc%C3%A1ria%20-%20PR&t=&z=15&ie=UTF8&iwloc=&output=embed"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            title="Localização STUDIO GABY NOGUEIRA"
          />
        </div>

        <button
          onClick={handleDirections}
          className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:opacity-90 active:scale-[0.98] glow-shadow"
        >
          📍 Ir até o Studio
        </button>

        <img
          src="https://i.imgur.com/fXzy800.webp"
          alt="Fachada do Studio"
          className="w-full h-48 md:h-64 object-cover rounded-2xl"
          loading="lazy"
          width={2539}
          height={850}
        />

        <div className="text-center">
          <p className="font-bold text-lg">R. Uirapuru, 746</p>
          <p className="text-sm text-muted-foreground">Capela Velha, Araucária - PR • CEP 83706-070</p>
        </div>
      </motion.div>
    </section>
  );
};

export default LocationSection;
