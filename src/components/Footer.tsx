import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const Footer = () => (
  <footer className="py-12 text-center border-t border-border">
    <p className="text-muted-foreground text-sm">© 2026 Studio Gaby Nogueira. Todos os direitos reservados.</p>
    <Link
      to="/admin"
      className="mt-4 inline-flex items-center justify-center w-8 h-8 rounded-full text-primary/30 hover:text-primary/60 transition-colors"
      aria-label="Admin"
    >
      <ShieldCheck className="w-4 h-4" />
    </Link>
  </footer>
);

export default Footer;
