import { useState, useEffect } from 'react';
import AdminPanel from '@/components/AdminPanel';
import { Scissors } from 'lucide-react';

const REMEMBER_KEY = 'classea_admin_remembered';

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(REMEMBER_KEY) === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (password === '1107') {
      setIsAuthenticated(true);
      setPassword('');
      setError(false);
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, 'true');
      }
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (isAuthenticated) {
    return <AdminPanel />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo/Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 shadow-[0_0_30px_-5px_hsl(45_97%_54%/0.3)]">
            <Scissors className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">STUDIO GABY NOGUEIRA</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel Administrativo</p>
        </div>

        {/* Login Card */}
        <div className="bg-card/80 backdrop-blur-xl p-8 rounded-2xl border border-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-15px_rgba(0,0,0,0.5)]">
          <div className="space-y-5">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className={`w-full bg-background/50 border ${error ? 'border-destructive' : 'border-primary/10 focus:border-primary/40'} p-4 rounded-xl outline-none transition-all text-foreground placeholder:text-muted-foreground/40`}
              />
              {error && (
                <p className="text-destructive text-xs mt-2 animate-pulse">Senha incorreta</p>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 rounded-md border border-primary/20 bg-background/50 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                  {remember && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                </div>
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Lembrar deste dispositivo</span>
            </label>

            <button
              onClick={handleLogin}
              className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:shadow-[0_0_25px_-5px_hsl(45_97%_54%/0.5)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
