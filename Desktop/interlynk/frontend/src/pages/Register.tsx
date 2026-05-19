import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/store/useAppStore';
import { authApi } from '@/api/client';

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser, setTokens } = useAuthStore();
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      // Call the registration API
      const response = await authApi.register(
        formData.email,
        formData.username,
        formData.name,
        formData.password
      );
      
      // Backend returns accessToken, frontend expects token
      const { accessToken, refreshToken, user: backendUser } = response.data;
      
      if (!accessToken || !backendUser) {
        setError('Registration failed. Please try again.');
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
      console.error('Registration failed:', err);
      setError('Registration failed. Username or email may already be in use.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-primary">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
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
          <h1 className="text-3xl font-bold text-text-primary">Create an account</h1>
          <p className="text-text-secondary mt-2">Join Interlynk and start collaborating</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
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
              label="Full Name"
              type="text"
              placeholder="John Doe"
              name="name"
              value={formData.name}
              onChange={handleChange}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Username"
              type="text"
              placeholder="johndoe"
              name="username"
              value={formData.username}
              onChange={handleChange}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              name="email"
              value={formData.email}
              onChange={handleChange}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                name="password"
                value={formData.password}
                onChange={handleChange}
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

            <Input
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-border bg-surface-elevated text-primary focus:ring-primary focus:ring-offset-0"
                required
              />
              <span className="text-sm text-text-secondary">
                I agree to the{' '}
                <button type="button" className="text-primary hover:underline">
                  Terms of Service
                </button>{' '}
                and{' '}
                <button type="button" className="text-primary hover:underline">
                  Privacy Policy
                </button>
              </span>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              rightIcon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
            >
              Create Account
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-elevated px-2 text-text-muted">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" type="button">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </Button>
              <Button variant="secondary" type="button">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </Button>
            </div>
          </form>
        </Card>

        <p className="text-center text-text-secondary mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default RegisterPage;
