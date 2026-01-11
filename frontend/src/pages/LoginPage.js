import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, initData } from '../lib/api';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Lock, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_route-manager-27/artifacts/sd598o43_LogoBerlinesTAB.png';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error('Veuillez entrer un mot de passe');
      return;
    }

    setLoading(true);
    try {
      // Initialize data first
      await initData();
      
      const response = await apiLogin(password);
      if (response.data.success) {
        login(response.data.admin);
        toast.success(`Bienvenue, ${response.data.admin.name}!`);
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error('Mot de passe invalide');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" data-testid="login-page">
      <div className="w-full max-w-md px-4">
        <Card className="border-0 shadow-xl bg-white/95 dark:bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-8 pb-10 px-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src={LOGO_URL} 
                alt="Les Berlines Trip à Bord" 
                className="h-28 object-contain"
                data-testid="login-logo"
              />
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-foreground mb-1">
                Gestion des horaires
              </h1>
              <p className="text-muted-foreground">connexion</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12 text-base"
                  data-testid="password-input"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold bg-[#4CAF50] hover:bg-[#43A047] text-white"
                data-testid="login-button"
              >
                {loading ? 'Connexion...' : 'SE CONNECTER'}
              </Button>
            </form>

            {/* Help Section */}
            <div className="mt-10 pt-6 border-t border-border">
              <p className="text-center text-muted-foreground mb-4">Besoin d'aide?</p>
              <div className="flex justify-center items-center gap-6 text-sm">
                <a 
                  href="tel:4385217779" 
                  className="flex items-center gap-2 text-[#4CAF50] hover:underline"
                  data-testid="help-phone"
                >
                  <Phone className="h-4 w-4" />
                  438 521-7779
                </a>
                <span className="text-border">|</span>
                <a 
                  href="mailto:info@berlinestab.com" 
                  className="flex items-center gap-2 text-[#4CAF50] hover:underline"
                  data-testid="help-email"
                >
                  <Mail className="h-4 w-4" />
                  info@berlinestab.com
                </a>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                1600 boulevard sainte Sophie, Sainte-Sophie, QC, Canada, Quebec
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
