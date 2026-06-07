import HeroSection from '@/components/HeroSection';
import BookingSection from '@/components/BookingSection';
import GallerySection from '@/components/GallerySection';
import BioSection from '@/components/BioSection';
import InstagramSection from '@/components/InstagramSection';
import LocationSection from '@/components/LocationSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import ContactSection from '@/components/ContactSection';
import Footer from '@/components/Footer';

const Index = () => (
  <main className="min-h-screen bg-background">
    <HeroSection />
    <BookingSection />
    <GallerySection />
    <BioSection />
    <InstagramSection />
    <LocationSection />
    <TestimonialsSection />
    <ContactSection />
    <Footer />
  </main>
);

export default Index;
