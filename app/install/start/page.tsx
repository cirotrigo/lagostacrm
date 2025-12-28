'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, User, Mail, Lock, Rocket, Circle, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';

type InstallerMeta = { enabled: boolean; requiresToken: boolean };

const STORAGE_TOKEN = 'crm_install_token';
const STORAGE_PROJECT = 'crm_install_project';
const STORAGE_INSTALLER_TOKEN = 'crm_install_installer_token';
const STORAGE_USER_NAME = 'crm_install_user_name';
const STORAGE_USER_EMAIL = 'crm_install_user_email';
const STORAGE_USER_PASS_HASH = 'crm_install_user_pass_hash';
const STORAGE_SESSION_LOCKED = 'crm_install_session_locked';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_crm_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

type Step = 'name' | 'email' | 'password' | 'vercel' | 'supabase' | 'validating' | 'ready' | 'locked';

// Checklist items para o visual de "controle de missão"
const CHECKLIST = [
  { id: 'name', label: 'Identificação do tripulante', icon: User },
  { id: 'email', label: 'Canal de comunicação', icon: Mail },
  { id: 'password', label: 'Código de acesso', icon: Lock },
  { id: 'vercel', label: 'Sistema de deploy', icon: Rocket },
  { id: 'supabase', label: 'Base de dados', icon: Circle },
] as const;

export default function InstallStartPage() {
  const router = useRouter();
  
  const [meta, setMeta] = useState<InstallerMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Dados do usuário
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  
  // Tokens
  const [installerToken, setInstallerToken] = useState('');
  const [vercelToken, setVercelToken] = useState('');
  const [supabaseToken, setSupabaseToken] = useState('');
  
  // Completed steps tracking
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const mxSpring = useSpring(mx, { stiffness: 100, damping: 30, mass: 0.8 });
  const mySpring = useSpring(my, { stiffness: 100, damping: 30, mass: 0.8 });
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 20);
    my.set(((e.clientY - rect.top) / rect.height - 0.5) * 15);
  };
  
  const firstName = userName.split(' ')[0] || '';
  
  // Carrega meta do instalador
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/installer/meta');
        const data = await res.json();
        if (!cancelled) setMeta(data);
      } catch (err) {
        if (!cancelled) setMetaError(err instanceof Error ? err.message : 'Erro ao carregar');
      }
    })();
    return () => { cancelled = true; };
  }, []);
  
  // Verifica sessão existente
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_TOKEN);
    const savedProject = localStorage.getItem(STORAGE_PROJECT);
    const savedInstallerToken = localStorage.getItem(STORAGE_INSTALLER_TOKEN);
    const savedName = localStorage.getItem(STORAGE_USER_NAME);
    const savedEmail = localStorage.getItem(STORAGE_USER_EMAIL);
    const savedPassHash = localStorage.getItem(STORAGE_USER_PASS_HASH);
    const sessionLocked = localStorage.getItem(STORAGE_SESSION_LOCKED);
    const savedSupabaseToken = localStorage.getItem('crm_install_supabase_token');
    
    if (savedInstallerToken) setInstallerToken(savedInstallerToken);
    
    // Se tem sessão salva com senha, precisa desbloquear
    if (savedPassHash && sessionLocked === 'true') {
      setStep('locked');
      return;
    }
    
    // Se já tem tudo completo, vai pro wizard
    if (savedToken && savedProject && savedName && savedEmail && savedPassHash && savedSupabaseToken) {
      router.push('/install/wizard');
      return;
    }
    
    // Restaura dados salvos
    if (savedName) {
      setUserName(savedName);
      setCompletedSteps(prev => new Set(prev).add('name'));
    }
    if (savedEmail) {
      setUserEmail(savedEmail);
      setCompletedSteps(prev => new Set(prev).add('email'));
    }
    if (savedPassHash) {
      setCompletedSteps(prev => new Set(prev).add('password'));
    }
    if (savedToken) {
      setVercelToken(savedToken);
      setCompletedSteps(prev => new Set(prev).add('vercel'));
    }
    if (savedSupabaseToken) {
      setSupabaseToken(savedSupabaseToken);
      setCompletedSteps(prev => new Set(prev).add('supabase'));
    }
  }, [router]);
  
  // Auto-focus no input quando muda de step
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [step]);
  
  const markComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set(prev).add(stepId));
  };
  
  const handleUnlock = async () => {
    const savedPassHash = localStorage.getItem(STORAGE_USER_PASS_HASH);
    if (!savedPassHash) return;
    
    setError('');
    setIsLoading(true);
    
    const inputHash = await hashPassword(unlockPassword);
    
    if (inputHash === savedPassHash) {
      localStorage.setItem(STORAGE_SESSION_LOCKED, 'false');
      const savedToken = localStorage.getItem(STORAGE_TOKEN);
      const savedProject = localStorage.getItem(STORAGE_PROJECT);
      const savedSupabaseToken = localStorage.getItem('crm_install_supabase_token');
      
      if (savedToken && savedProject && savedSupabaseToken) {
        router.push('/install/wizard');
      } else if (savedToken && savedProject) {
        setStep('supabase');
      } else {
        setStep('vercel');
      }
    } else {
      setError('Senha incorreta');
    }
    
    setIsLoading(false);
  };
  
  const handleNameSubmit = () => {
    const name = userName.trim();
    if (!name || name.length < 2) {
      setError('Digite seu nome');
      return;
    }
    setError('');
    localStorage.setItem(STORAGE_USER_NAME, name);
    markComplete('name');
    setStep('email');
  };
  
  const handleEmailSubmit = () => {
    const email = userEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Digite um e-mail válido');
      return;
    }
    setError('');
    localStorage.setItem(STORAGE_USER_EMAIL, email);
    markComplete('email');
    setStep('password');
  };
  
  const handlePasswordSubmit = async () => {
    const pass = userPassword;
    if (!pass || pass.length < 6) {
      setError('Mínimo 6 caracteres');
      return;
    }
    setError('');
    
    const hash = await hashPassword(pass);
    localStorage.setItem(STORAGE_USER_PASS_HASH, hash);
    localStorage.setItem(STORAGE_SESSION_LOCKED, 'false');
    sessionStorage.setItem('crm_install_user_pass', pass);
    
    markComplete('password');
    setStep('vercel');
  };
  
  const handleVercelSubmit = async () => {
    const t = vercelToken.trim();
    if (!t || t.length < 20) {
      setError('Token inválido');
      return;
    }
    
    if (meta?.requiresToken && !installerToken.trim()) {
      setError('Installer token obrigatório');
      return;
    }
    
    setError('');
    setIsLoading(true);
    setStep('validating');
    
    try {
      const res = await fetch('/api/installer/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: t,
          installerToken: installerToken.trim() || undefined,
          domain: typeof window !== 'undefined' ? window.location.hostname : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao validar token');
      
      localStorage.setItem(STORAGE_TOKEN, t);
      localStorage.setItem(STORAGE_PROJECT, JSON.stringify(data.project));
      if (installerToken.trim()) localStorage.setItem(STORAGE_INSTALLER_TOKEN, installerToken.trim());
      
      markComplete('vercel');
      setStep('supabase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar token');
      setStep('vercel');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSupabaseSubmit = () => {
    const t = supabaseToken.trim();
    if (!t || !t.startsWith('sbp_')) {
      setError('Token Supabase inválido');
      return;
    }
    
    setError('');
    localStorage.setItem('crm_install_supabase_token', t);
    markComplete('supabase');
    setStep('ready');
    
    // Pequeno delay para mostrar o checklist completo antes de ir pro wizard
    setTimeout(() => router.push('/install/wizard'), 1500);
  };
  
  // Auto-submit quando cola token
  useEffect(() => {
    if (step === 'vercel' && vercelToken.trim().length >= 20 && !isLoading) {
      const handle = setTimeout(() => void handleVercelSubmit(), 600);
      return () => clearTimeout(handle);
    }
  }, [vercelToken, step, isLoading]);
  
  useEffect(() => {
    if (step === 'supabase' && supabaseToken.trim().startsWith('sbp_') && supabaseToken.trim().length >= 20) {
      const handle = setTimeout(() => void handleSupabaseSubmit(), 600);
      return () => clearTimeout(handle);
    }
  }, [supabaseToken, step]);
  
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };
  
  // Calcula o step atual para o checklist
  const currentStepIndex = CHECKLIST.findIndex(c => c.id === step) ?? -1;
  
  if (!meta && !metaError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Iniciando sistemas...</p>
        </motion.div>
      </div>
    );
  }
  
  if (metaError || (meta && !meta.enabled)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Missão cancelada</h1>
          <p className="text-slate-400">{metaError || 'Base de lançamento indisponível.'}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className="min-h-screen flex bg-slate-950 relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      {/* Background com estrelas e nebulosas */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grade de pontos (estrelas distantes) */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Nebulosas */}
        <motion.div
          className="absolute -top-[30%] -right-[20%] w-[70%] h-[70%] rounded-full blur-[150px] bg-cyan-500/10"
          style={{ x: mxSpring, y: mySpring }}
        />
        <motion.div
          className="absolute top-[50%] -left-[20%] w-[60%] h-[60%] rounded-full blur-[130px] bg-teal-500/8"
          style={{ x: mxSpring, y: mySpring }}
        />
        <motion.div
          className="absolute -bottom-[20%] right-[10%] w-[40%] h-[40%] rounded-full blur-[100px] bg-indigo-500/8"
          style={{ x: mxSpring, y: mySpring }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.7)_100%)]" />
      </div>
      
      {/* Layout em duas colunas */}
      <div className="flex-1 flex items-center justify-center relative z-10 px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-cyan-400 text-sm font-medium">Pré-lançamento</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">
              {step === 'locked' ? 'Sessão protegida' : 
               step === 'ready' ? `Pronto para decolar, ${firstName}!` :
               firstName ? `Olá, ${firstName}` : 'Preparação para a missão'}
            </h1>
            <p className="text-slate-400 text-lg">
              {step === 'locked' ? 'Digite sua senha para continuar' :
               step === 'ready' ? 'Todos os sistemas verificados' :
               'Configure os sistemas antes do lançamento'}
            </p>
          </motion.div>
          
          {/* Checklist visual */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8 space-y-3"
          >
            {CHECKLIST.map((item, index) => {
              const isCompleted = completedSteps.has(item.id);
              const isCurrent = step === item.id || (step === 'validating' && item.id === 'vercel');
              const isPending = !isCompleted && !isCurrent;
              const Icon = item.icon;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : isCurrent 
                        ? 'bg-cyan-500/10 border-cyan-500/30' 
                        : 'bg-white/5 border-white/10 opacity-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'bg-emerald-500/20' 
                      : isCurrent 
                        ? 'bg-cyan-500/20' 
                        : 'bg-white/10'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : isCurrent ? (
                      <Icon className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <Icon className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isCompleted ? 'text-emerald-400' : isCurrent ? 'text-white' : 'text-slate-500'
                    }`}>
                      {item.label}
                    </p>
                    {isCompleted && item.id === 'name' && (
                      <p className="text-sm text-emerald-400/70">{userName}</p>
                    )}
                    {isCompleted && item.id === 'email' && (
                      <p className="text-sm text-emerald-400/70">{userEmail}</p>
                    )}
                  </div>
                  {isCompleted && (
                    <span className="text-xs text-emerald-400 font-medium px-2 py-1 rounded-full bg-emerald-500/20">
                      OK
                    </span>
                  )}
                  {isCurrent && !isCompleted && (
                    <ChevronRight className="w-5 h-5 text-cyan-400 animate-pulse" />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
          
          {/* Input area */}
          <AnimatePresence mode="wait">
            {step === 'locked' && (
              <motion.div
                key="locked"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <input
                  ref={inputRef}
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleUnlock)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent text-center text-lg"
                  placeholder="Sua senha"
                  autoFocus
                />
                <button
                  onClick={handleUnlock}
                  disabled={isLoading}
                  className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-white font-semibold transition-all"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Desbloquear'}
                </button>
              </motion.div>
            )}
            
            {step === 'name' && (
              <motion.div
                key="name"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleNameSubmit)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent text-center text-lg"
                    placeholder="Como você gostaria de ser chamado?"
                    autoFocus
                  />
                  <p className="text-slate-500 text-sm mt-2 text-center">Ex: Thales, Maria, João</p>
                </div>
                <button
                  onClick={handleNameSubmit}
                  className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  Confirmar <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}
            
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <input
                  ref={inputRef}
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleEmailSubmit)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent text-center text-lg"
                  placeholder="seu@email.com"
                  autoFocus
                />
                <button
                  onClick={handleEmailSubmit}
                  className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  Confirmar <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}
            
            {step === 'password' && (
              <motion.div
                key="password"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <input
                    ref={inputRef}
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handlePasswordSubmit)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent text-center text-lg"
                    placeholder="Crie uma senha"
                    autoFocus
                  />
                  <p className="text-slate-500 text-sm mt-2 text-center">Mínimo 6 caracteres • Será sua senha de acesso</p>
                </div>
                <button
                  onClick={handlePasswordSubmit}
                  className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  Confirmar <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}
            
            {step === 'vercel' && (
              <motion.div
                key="vercel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {meta?.requiresToken && (
                  <input
                    type="password"
                    value={installerToken}
                    onChange={(e) => setInstallerToken(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent"
                    placeholder="Installer token"
                  />
                )}
                <input
                  ref={inputRef}
                  type="password"
                  value={vercelToken}
                  onChange={(e) => setVercelToken(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent text-center"
                  placeholder="Cole seu token da Vercel"
                  autoFocus
                />
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 py-2"
                >
                  Gerar token na Vercel <ExternalLink className="w-4 h-4" />
                </a>
              </motion.div>
            )}
            
            {step === 'validating' && (
              <motion.div
                key="validating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Verificando conexão com a Vercel...</p>
              </motion.div>
            )}
            
            {step === 'supabase' && (
              <motion.div
                key="supabase"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <input
                  ref={inputRef}
                  type="password"
                  value={supabaseToken}
                  onChange={(e) => setSupabaseToken(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent text-center"
                  placeholder="Cole seu token do Supabase"
                  autoFocus
                />
                <a
                  href="https://supabase.com/dashboard/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 py-2"
                >
                  Gerar token no Supabase <ExternalLink className="w-4 h-4" />
                </a>
              </motion.div>
            )}
            
            {step === 'ready' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center mx-auto mb-6"
                >
                  <Rocket className="w-10 h-10 text-white" />
                </motion.div>
                <p className="text-slate-400 mb-2">Iniciando sequência de lançamento...</p>
                <div className="flex items-center justify-center gap-1">
                  <motion.span 
                    className="w-2 h-2 rounded-full bg-cyan-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  />
                  <motion.span 
                    className="w-2 h-2 rounded-full bg-cyan-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.span 
                    className="w-2 h-2 rounded-full bg-cyan-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
