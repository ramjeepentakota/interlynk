import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/store/useAppStore';
import { authApi } from '@/api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setTokens } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Try to login with backend API 
      const response = await authApi.login(email, password);
      
      // Backend returns accessToken, frontend expects token
      const { accessToken, refreshToken, user: backendUser } = response.data;
      
      if (!accessToken || !backendUser) {
        setError('Invalid response from server. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Transform backend user to frontend user format
      const frontendUser = {
        id: String(backendUser.id),
        email: backendUser.email,
        username: backendUser.username,
        displayName: backendUser.displayName,
        avatar: backendUser.avatarUrl,
        status: backendUser.presence || 'online',
        role: backendUser.roles?.[0] || 'USER',
        roles: backendUser.roles || [],
        createdAt: backendUser.createdAt,
        updatedAt: backendUser.lastSeenAt || backendUser.createdAt,
      };
      
      setUser(frontendUser);
      setTokens(accessToken, refreshToken);
      navigate('/');
    } catch (err: unknown) {
      // Don't fallback to demo mode - require proper authentication
      console.error('Login failed:', err);
      setError('Invalid username or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-primary">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-500 mb-4">
            <span className="text-3xl text-white font-bold">I</span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Welcome back</h1>
          <p className="text-text-secondary mt-2">Sign in to your Interlynk account</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error"
              >
                {error}
              </motion.div>
            )}

            <Input
              label="Username or Email"
              type="text"
              placeholder="Enter your username or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-text-muted hover:text-text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border bg-surface-elevated text-primary focus:ring-primary focus:ring-offset-0"
                />
                <span className="text-sm text-text-secondary">Remember me</span>
              </label>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              rightIcon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
            >
              Sign In
            </Button>

            <p className="text-center text-sm text-text-muted mt-4">
              Contact your administrator to create an account.
            </p>


          </form>
        </Card>


      </motion.div>
    </div>
  );
}

export default LoginPage;
