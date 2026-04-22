import React, { useState, useEffect } from 'react';
import { auth, googleProvider, ADMIN_EMAIL, db, SystemState, Vote } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy, setDoc, updateDoc, serverTimestamp, where, Timestamp, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Heart, Sparkles, Check, X, Users, RotateCcw, ChevronRight, Shuffle, LayoutDashboard, Zap, BarChart2, ShieldCheck, Menu, Settings } from 'lucide-react';

const FIXED_DURATION = 20;

// Components
const Header = ({ user, isAdmin }: { user: any, isAdmin: boolean }) => {
  return (
    <header className="flex flex-row justify-between items-center mb-8 md:mb-12 gap-4 px-2">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl glow-pink hidden sm:block">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-black text-primary tracking-tighter leading-none">Bias & Reality</h1>
          <p className="text-[8px] md:text-[10px] uppercase tracking-[0.3em] font-bold text-pink-100/40">Community Consensus</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 text-right bg-white/5 p-2 md:p-3 rounded-xl border border-white/5 backdrop-blur-sm">
        <div className="hidden xs:flex flex-col">
          <span className="text-[8px] uppercase tracking-[0.2em] text-pink-300/40 font-bold leading-none mb-1">
            {isAdmin ? 'Architect' : 'Citizen'}
          </span>
          <span className="text-[10px] md:text-xs font-semibold text-pink-50 truncate max-w-[80px] md:max-w-[120px]">
            {user.displayName || user.email.split('@')[0]}
          </span>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="w-8 h-8 md:w-10 md:h-10 rounded-full glass flex items-center justify-center text-primary hover:bg-primary hover:text-purple-950 transition-all border-primary/30"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </button>
      </div>
    </header>
  );
};

const Auth = ({ user, loading }: { user: User | null, loading: boolean }) => {
  if (loading) return <div className="flex items-center justify-center h-screen">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full shadow-lg"
    />
  </div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen editorial-gradient p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-12 rounded-[2.5rem] text-center max-w-md w-full shadow-2xl"
        >
          <div className="mb-8 flex justify-center">
            <div className="p-5 bg-primary/10 rounded-full glow-pink">
              <Sparkles className="w-12 h-12 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl mb-4 text-primary font-bold tracking-tighter">Bias <span className="font-light opacity-50">&</span> Reality</h1>
          <p className="text-pink-100/60 mb-10 font-light leading-relaxed uppercase tracking-[0.2em] text-[10px]">
            Please sign in via Google to access your exclusive polling suite.
          </p>
          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="w-full py-4 bg-primary text-purple-950 rounded-full flex items-center justify-center gap-3 hover:bg-primary/90 transition-all font-bold uppercase tracking-widest glow-pink"
          >
            <LogIn className="w-5 h-5" />
            Sign in via Google
          </button>
        </motion.div>
      </div>
    );
  }
  return null;
};

const CountdownTimer = ({ endsAt, onEnd, offset = 0 }: { endsAt: any, onEnd?: () => void, offset?: number }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!endsAt) return;

    const interval = setInterval(() => {
      const target = endsAt.toDate ? endsAt.toDate().getTime() : endsAt;
      const now = Date.now() + offset;
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        setIsFinished(true);
        clearInterval(interval);
        if (onEnd) onEnd();
        return;
      }

      const mins = Math.floor(diff / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTimeLeft(`${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt, onEnd]);

  return (
    <div className="flex flex-col items-center">
      <span className={`text-4xl font-black tracking-[0.05em] transition-colors duration-500 ${isFinished ? 'text-red-400' : 'text-primary active-glow'}`}>
        {timeLeft}
      </span>
      <span className="text-[10px] uppercase opacity-40 font-bold tracking-[0.4em] mt-2">Remaining Clarity</span>
    </div>
  );
};

const AdminPanel = ({ currentPoll, votes, clockOffset = 0 }: { currentPoll: SystemState, votes: Vote[], clockOffset?: number }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'manager' | 'analytics' | 'voters'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [totalYes, setTotalYes] = useState(0);
  const [totalNo, setTotalNo] = useState(0);
  const [selectedPoll, setSelectedPoll] = useState(currentPoll.currentPollNumber || 1);
  const [randomizedVoters, setRandomizedVoters] = useState<{ yes: Vote | null, no: Vote | null } | null>(null);

  const handleRandomize = () => {
    const pollVotes = votes.filter(v => v.pollNumber === selectedPoll);
    const yesVoters = pollVotes.filter(v => v.choice === 'yes');
    const noVoters = pollVotes.filter(v => v.choice === 'no');

    const randomYes = yesVoters.length > 0 ? yesVoters[Math.floor(Math.random() * yesVoters.length)] : null;
    const randomNo = noVoters.length > 0 ? noVoters[Math.floor(Math.random() * noVoters.length)] : null;

    setRandomizedVoters({ yes: randomYes, no: randomNo });
  };

  useEffect(() => {
    if (currentPoll.currentPollNumber > 0) {
      setSelectedPoll(currentPoll.currentPollNumber);
    }
  }, [currentPoll.currentPollNumber]);

  useEffect(() => {
    const activeVotes = votes.filter(v => v.pollNumber === selectedPoll);
    setTotalYes(activeVotes.filter(v => v.choice === 'yes').length);
    setTotalNo(activeVotes.filter(v => v.choice === 'no').length);
  }, [votes, selectedPoll]);

  const handlePush = async () => {
    if (currentPoll.currentPollNumber >= 10 && currentPoll.isActive) return;
    const stateRef = doc(db, 'system', 'state');
    const endsAt = Timestamp.fromMillis(Date.now() + clockOffset + FIXED_DURATION * 1000);
    
    if (!currentPoll.isActive && currentPoll.currentPollNumber > 0 && currentPoll.currentPollNumber < 10) {
      const nextNum = currentPoll.currentPollNumber + 1;
      await updateDoc(stateRef, { 
        currentPollNumber: nextNum,
        isActive: true,
        lastPushedAt: serverTimestamp(),
        durationSeconds: FIXED_DURATION,
        endsAt
      });
    } else {
      const nextNum = (currentPoll.currentPollNumber || 0) + 1;
      await setDoc(stateRef, {
        currentPollNumber: nextNum > 10 ? 10 : nextNum,
        isActive: true,
        lastPushedAt: serverTimestamp(),
        durationSeconds: FIXED_DURATION,
        endsAt
      });
    }
  };

  const handleStop = async () => {
    const stateRef = doc(db, 'system', 'state');
    await updateDoc(stateRef, { isActive: false });
  };

  const handleReset = async () => {
    if (!window.confirm("Are you certain you wish to wipe ALL session data and accumulated votes? This action is absolute.")) return;
    const stateRef = doc(db, 'system', 'state');
    await setDoc(stateRef, { currentPollNumber: 0, isActive: false });
    try {
      const votesSnap = await getDocs(collection(db, 'votes'));
      const batch = writeBatch(db);
      votesSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.error("Collection wipe failed:", err);
    }
  };

  const pollVotes = votes.filter(v => v.pollNumber === selectedPoll);
  const totalInSelected = pollVotes.length;
  const yesInSelected = pollVotes.filter(v => v.choice === 'yes').length;
  const noInSelected = pollVotes.filter(v => v.choice === 'no').length;

  const sections = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'manager', label: 'Poll Manager', icon: Zap },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'voters', label: 'Auditor Room', icon: ShieldCheck },
  ] as const;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[700px] relative pb-20">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 gap-2 sticky top-8 h-fit">
        <div className="glass p-4 rounded-3xl flex flex-col gap-2">
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-primary/40 px-4 mb-2">Navigation</p>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group ${
                activeSection === section.id 
                  ? 'bg-primary text-purple-950 shadow-lg glow-pink' 
                  : 'text-pink-100/60 hover:bg-white/5 hover:text-pink-100'
              }`}
            >
              <section.icon className={`w-5 h-5 ${activeSection === section.id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
              <span className="font-bold tracking-tight">{section.label}</span>
              {activeSection === section.id && (
                <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-purple-950 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="glass p-6 rounded-3xl mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-2 h-2 rounded-full ${currentPoll.isActive ? 'bg-primary animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[10px] uppercase font-black tracking-widest text-pink-100/50">System Link: {currentPoll.isActive ? 'Live' : 'Idle'}</span>
          </div>
          <p className="text-[10px] text-pink-100/30 leading-relaxed italic">
            Architect session monitoring is active. All terminal actions are logged.
          </p>
        </div>
      </aside>

      {/* Mobile Nav Toggle */}
      <div className="lg:hidden flex items-center justify-between glass p-4 rounded-2xl mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${currentPoll.isActive ? 'bg-primary animate-pulse' : 'bg-red-400'}`} />
          <span className="text-xs font-bold uppercase tracking-widest text-pink-50">
            {sections.find(s => s.id === activeSection)?.label}
          </span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white/5 rounded-xl text-primary"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-0 z-50 lg:hidden p-4 pointer-events-none"
          >
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-72 h-full glass p-6 rounded-3xl flex flex-col gap-2 pointer-events-auto shadow-2xl border-r border-white/10">
              <div className="flex justify-between items-center mb-8 px-2">
                <span className="text-xl font-black text-primary tracking-tighter">Architect Menu</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-pink-100/40"><X className="w-5 h-5"/></button>
              </div>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
                    activeSection === section.id 
                      ? 'bg-primary text-purple-950 glow-pink' 
                      : 'text-pink-100/60 hover:bg-white/5'
                  }`}
                >
                  <section.icon className="w-5 h-5" />
                  <span className="font-bold tracking-tight">{section.label}</span>
                </button>
              ))}
              <div className="mt-auto pt-6 border-t border-white/5 opacity-40">
                <p className="text-[10px] uppercase font-bold tracking-widest text-center">Bias & Reality Admin v1.2</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeSection === 'overview' && (
              <div className="flex flex-col gap-6">
                <div className="glass p-8 rounded-[2.5rem]">
                  <h2 className="text-3xl font-bold mb-8 text-pink-50 tracking-tight flex items-center gap-3">
                    <LayoutDashboard className="w-8 h-8 text-primary" />
                    Poll Sequence Summary
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(10)].map((_, i) => {
                      const num = i + 1;
                      const isFinalized = num < currentPoll.currentPollNumber;
                      const isCurrent = num === currentPoll.currentPollNumber;
                      const isQueued = num > currentPoll.currentPollNumber;
                      const isHiding = num === currentPoll.currentPollNumber && !currentPoll.isActive;
                      
                      return (
                        <div key={num} className={`p-6 rounded-3xl border transition-all ${
                          isCurrent ? 'bg-primary/5 border-primary shadow-[0_0_20px_rgba(255,160,200,0.1)]' : 'bg-white/2 border-white/5'
                        }`}>
                          <div className="flex justify-between items-start mb-4">
                            <span className={`text-2xl font-black ${isQueued ? 'opacity-20' : 'text-primary'}`}>
                              {num.toString().padStart(2, '0')}
                            </span>
                            <div className={`poll-dot ${isFinalized ? 'filled' : ''} ${isCurrent ? 'current' : ''}`} />
                          </div>
                          <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${isCurrent ? 'text-primary' : 'text-white/30'}`}>
                            {isFinalized ? 'Finalized' : isCurrent ? (isHiding ? 'Standby' : 'Active') : 'Scheduled'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'manager' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass rounded-[2.5rem] p-12 flex flex-col justify-center items-center relative overflow-hidden min-h-[450px]">
                  <div className="absolute top-8 left-8 text-[10px] uppercase tracking-[0.4em] text-primary font-bold opacity-70">Control Nexus</div>
                  <div className="text-center mb-8">
                    <p className="text-8xl text-primary mb-4 font-black tracking-tighter">
                      {currentPoll.isActive ? currentPoll.currentPollNumber.toString().padStart(2, '0') : (currentPoll.currentPollNumber + 1).toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs tracking-[0.6em] uppercase text-pink-200/40 font-bold mb-6">
                      {currentPoll.isActive ? 'Pulse Phase' : 'Next Cycle'}
                    </p>
                    {currentPoll.isActive && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-6 bg-white/5 rounded-3xl border border-white/5"
                      >
                        <CountdownTimer endsAt={currentPoll.endsAt} onEnd={handleStop} offset={clockOffset} />
                      </motion.div>
                    )}
                  </div>
                  <div className="flex flex-col w-full gap-4 max-w-sm">
                    {currentPoll.isActive ? (
                      <button 
                        onClick={handleStop}
                        className="w-full py-5 bg-red-500/80 text-white rounded-full font-bold uppercase tracking-widest hover:bg-red-500 transition-all flex items-center justify-center gap-3 group"
                      >
                        <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Terminal Cease
                      </button>
                    ) : (
                      <button 
                        onClick={handlePush}
                        disabled={currentPoll.currentPollNumber >= 10}
                        className="w-full py-5 bg-primary text-purple-950 rounded-full font-bold uppercase tracking-widest glow-pink hover:bg-pink-300 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale group"
                      >
                        <Zap className="w-5 h-5 group-hover:animate-bounce" />
                        Initiate Push {currentPoll.currentPollNumber + 1}
                      </button>
                    )}
                    <button 
                      onClick={handleReset}
                      className="py-3 text-pink-100/20 hover:text-red-400 transition-all text-[10px] uppercase tracking-[0.3em] font-bold flex items-center justify-center gap-2 group"
                    >
                      <RotateCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-700" />
                      Emergency Reset All
                    </button>
                  </div>
                </div>

                <div className="glass p-12 rounded-[2.5rem] flex flex-col justify-center">
                  <h3 className="text-xl font-bold text-pink-100 mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Protocol Instructions
                  </h3>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">1</div>
                      <p className="text-sm text-pink-100/60 leading-relaxed">Ensure all screens are synced before initiating a push. Each push lasts exactly 20 seconds.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">2</div>
                      <p className="text-sm text-pink-100/60 leading-relaxed">Closing a poll manually will finalize it immediately. Users who haven't voted will be locked out.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">3</div>
                      <p className="text-sm text-pink-100/60 leading-relaxed">The "Emergency Reset" is destructive. Use it only between complete community sessions.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'analytics' && (
              <div className="flex flex-col gap-8">
                <div className="glass rounded-[2.5rem] p-12 relative min-h-[400px]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                      <h2 className="text-4xl font-black text-pink-50 tracking-tighter mb-2">Real-time Metrics</h2>
                      <p className="text-xs font-bold uppercase tracking-[0.4em] text-primary/40">Response Distribution Analysis</p>
                    </div>
                    <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5 h-fit overflow-x-auto scroll-hide">
                      {[...Array(10)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedPoll(i + 1)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            selectedPoll === i + 1 ? 'bg-primary text-purple-950' : 'text-pink-100/40 hover:text-pink-100'
                          }`}
                        >
                          P{(i + 1).toString().padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="flex flex-col gap-8">
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-end px-2">
                          <span className="text-4xl text-primary font-black tracking-tighter">{yesInSelected}</span>
                          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-primary/60 italic">Affirmative Force</span>
                        </div>
                        <div className="w-full h-4 bg-pink-900/20 rounded-full p-1 border border-white/5">
                          <motion.div 
                            initial={false}
                            animate={{ width: `${(yesInSelected / (totalInSelected || 1)) * 100}%` }}
                            className="h-full bg-primary rounded-full glow-pink"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-end px-2">
                          <span className="text-4xl text-purple-300 font-black tracking-tighter">{noInSelected}</span>
                          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-purple-400/60 italic">Negative Tension</span>
                        </div>
                        <div className="w-full h-4 bg-pink-900/20 rounded-full p-1 border border-white/5">
                          <motion.div 
                            initial={false}
                            animate={{ width: `${(noInSelected / (totalInSelected || 1)) * 100}%` }}
                            className="h-full bg-secondary rounded-full"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-12 bg-white/5 rounded-[2.5rem] border border-white/5 text-center">
                      <p className="text-6xl font-black text-pink-50 mb-2 tracking-tighter">{totalInSelected}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.5em] text-primary mb-6">Total Responses</p>
                      <div className="w-16 h-1 bg-primary/20 rounded-full mb-6" />
                      <p className="text-sm text-pink-100/40 italic font-medium max-w-xs uppercase tracking-widest leading-loose">
                        Consensus strength: {totalInSelected > 0 ? (Math.max(yesInSelected, noInSelected) / totalInSelected * 100).toFixed(0) : 0}% Dominance
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'voters' && (
              <div className="glass rounded-[3rem] p-10 flex flex-col relative overflow-hidden min-h-[600px]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                  <div>
                    <h2 className="text-3xl font-bold text-pink-50 tracking-tight">Auditor Room</h2>
                    <p className="text-xs tracking-[0.4em] uppercase text-primary/40 font-bold mt-1">Granular Vote Inspection</p>
                  </div>
                  <button 
                    onClick={handleRandomize}
                    className="glass px-6 py-3 rounded-2xl text-primary hover:bg-primary/20 transition-all border border-primary/30 flex items-center gap-3 group glow-pink-hover"
                  >
                    <Shuffle className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                    <span className="text-xs uppercase font-black tracking-widest">Randomize Spotlights</span>
                  </button>
                </div>
                
                <AnimatePresence>
                  {randomizedVoters && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
                    >
                      <div className="bg-primary/10 border border-primary/20 p-8 rounded-[2rem] relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute -right-6 -bottom-6 opacity-5 rotate-12">
                          <Check className="w-48 h-48 text-primary" />
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-black mb-4 flex items-center gap-2">
                           Affirmation Spotlight
                        </span>
                        {randomizedVoters.yes ? (
                          <>
                            <p className="text-3xl text-pink-50 font-black tracking-tighter mb-1 leading-tight">{randomizedVoters.yes.userName}</p>
                            <p className="text-xs text-pink-100/40 font-bold uppercase tracking-widest">{randomizedVoters.yes.userEmail}</p>
                          </>
                        ) : (
                          <p className="text-pink-100/20 italic text-xl">Void.</p>
                        )}
                      </div>
                      <div className="bg-purple-900/20 border border-purple-500/20 p-8 rounded-[2rem] relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute -right-6 -bottom-6 opacity-5 rotate-12">
                          <X className="w-48 h-48 text-purple-400" />
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.4em] text-purple-400 font-black mb-4 flex items-center gap-2">
                           Negation Spotlight
                        </span>
                        {randomizedVoters.no ? (
                          <>
                            <p className="text-3xl text-pink-50 font-black tracking-tighter mb-1 leading-tight">{randomizedVoters.no.userName}</p>
                            <p className="text-xs text-pink-100/40 font-bold uppercase tracking-widest">{randomizedVoters.no.userEmail}</p>
                          </>
                        ) : (
                          <p className="text-pink-100/20 italic text-xl">Void.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex-1 flex flex-col overflow-hidden">
                   <div className="flex gap-2 mb-6 overflow-x-auto scroll-hide pb-2">
                      {[...Array(10)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedPoll(i + 1)}
                          className={`w-12 h-12 rounded-full shrink-0 text-xs font-black transition-all border ${
                            selectedPoll === i + 1 
                              ? 'bg-primary text-purple-950 border-primary' 
                              : 'bg-white/2 text-pink-100/30 border-white/5 hover:border-white/20'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                   </div>

                  <div className="overflow-y-auto scroll-hide pr-2">
                    <table className="w-full text-left">
                      <thead className="text-[10px] uppercase tracking-[0.3em] text-pink-100/30 border-b border-white/5 sticky top-0 bg-transparent backdrop-blur-md">
                        <tr>
                          <th className="pb-6 font-black">Identity</th>
                          <th className="pb-6 font-black text-center">Batch</th>
                          <th className="pb-6 font-black text-right">Impact</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {votes.filter(v => v.pollNumber === selectedPoll).map((v, idx) => (
                          <tr key={idx} className="group hover:bg-white/2 transition-colors border-b border-white/2">
                            <td className="py-6">
                              <div className="flex flex-col">
                                <span className="text-xl text-pink-100 font-black tracking-tighter mb-0.5 group-hover:text-primary transition-colors">{v.userName}</span>
                                <span className="text-[10px] text-pink-100/30 font-bold uppercase tracking-widest">{v.userEmail}</span>
                              </div>
                            </td>
                            <td className="py-6 text-center text-[10px] font-black uppercase tracking-widest text-white/20">
                              Session {v.pollNumber.toString().padStart(2, '0')}
                            </td>
                            <td className={`py-6 text-right text-2xl font-black ${v.choice === 'yes' ? 'text-primary' : 'text-purple-400'}`}>
                              {v.choice.toUpperCase()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

const UserVote = ({ user, currentPoll, userVote, clockOffset = 0 }: { user: User, currentPoll: SystemState, userVote: Vote | null, clockOffset?: number }) => {
  const [casting, setCasting] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!currentPoll.endsAt || !currentPoll.isActive) {
      setIsTimedOut(false);
      return;
    }
    
    const checkTimeout = () => {
      const target = currentPoll.endsAt.toDate ? currentPoll.endsAt.toDate().getTime() : currentPoll.endsAt;
      const now = Date.now() + clockOffset;
      if (now >= target) {
        setIsTimedOut(true);
      } else {
        setIsTimedOut(false);
      }
    };

    checkTimeout();
    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [currentPoll.endsAt, currentPoll.isActive, clockOffset]);

  const castVote = async (choice: 'yes' | 'no') => {
    if (casting || userVote || isTimedOut || !currentPoll.isActive) return;
    setCasting(true);
    try {
      const voteId = `${currentPoll.currentPollNumber}_${user.uid}`;
      await setDoc(doc(db, 'votes', voteId), {
        pollNumber: currentPoll.currentPollNumber,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'Sweet Soul',
        choice,
        timestamp: serverTimestamp()
      });
      console.log("Vote success:", voteId);
    } catch (err) {
      console.error("Vote failed:", err);
      alert("Metaphysical disruption: " + (err instanceof Error ? err.message : "Rule violation"));
    } finally {
      setCasting(false);
    }
  };

  const showWaitingRoom = !currentPoll.isActive || isTimedOut;

  return (
    <div className="min-h-screen editorial-gradient flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-start px-4 mt-4 mb-8">
        <AnimatePresence mode="wait">
          {showWaitingRoom ? (
            <motion.div 
              key="inactive"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full glass p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col items-center"
            >
              <div className="mb-6 p-4 bg-primary/10 rounded-full inline-block glow-pink border border-primary/20">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="px-3 py-1 rounded-full bg-pink-900/20 border border-pink-900/30 text-[10px] font-black text-pink-300 tracking-[0.4em] uppercase mb-4">
                Poll number {currentPoll.currentPollNumber}
              </div>
              <div className="w-10 h-0.5 bg-primary/20 rounded-full mb-6" />
              <p className="text-pink-100/60 font-light text-sm md:text-lg tracking-wide uppercase leading-relaxed text-center">
                {isTimedOut 
                  ? 'The session window has closed. Awaiting synchronization.' 
                  : 'The next session is being synthesized.'}
              </p>
            </motion.div>
          ) : userVote ? (
            <motion.div 
              key="voted"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md md:max-w-xl glass p-8 md:p-12 rounded-[2.5rem] border-2 border-primary/30 shadow-2xl relative overflow-hidden flex flex-col items-center"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-[80px] rounded-full" />
              <div className="mb-6 flex justify-center">
                <div className="p-4 bg-primary/10 rounded-full glow-pink border border-primary/30">
                  <Check className="w-8 h-8 md:w-12 md:h-12 text-primary" />
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary tracking-[0.4em] uppercase mb-6">
                Poll number {userVote.pollNumber}
              </div>
              <div className="flex flex-col items-center gap-3">
                <p className="text-pink-100/30 font-bold uppercase tracking-[0.5em] text-[9px]">Decision Recorded</p>
                <span className={`text-5xl md:text-7xl font-black active-glow tracking-tighter ${userVote.choice === 'yes' ? 'text-primary' : 'text-purple-300'}`}>
                  {userVote.choice.toUpperCase()}
                </span>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 w-full">
                <p className="text-[9px] text-pink-100/40 font-black tracking-[0.5em] uppercase text-center">Identity Verified</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="active"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-lg md:max-w-xl glass p-6 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10 flex flex-col items-center"
            >
              <div className="flex flex-col items-center w-full gap-6 md:gap-8 text-center">
                <div className="flex flex-col items-center">
                  <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary tracking-[0.4em] uppercase mb-3">
                    Poll number {currentPoll.currentPollNumber}
                  </div>
                  <div className="w-10 h-0.5 bg-primary/30 rounded-full mb-4" />
                  <div className="p-3 bg-primary/10 rounded-full border border-primary/20 glow-pink mb-2">
                    <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                  </div>
                  <p className="text-pink-100/40 text-[9px] uppercase tracking-[0.5em] font-bold">Session Active</p>
                </div>

                {currentPoll.isActive && (
                  <div className="glass px-6 py-3 md:px-8 md:py-4 rounded-2xl border border-primary/20 bg-white/5 backdrop-blur-md shadow-lg">
                    <CountdownTimer endsAt={currentPoll.endsAt} offset={clockOffset} />
                  </div>
                )}
                
                <div className="flex flex-row w-full gap-3 h-14 md:h-16">
                  <button 
                    onClick={() => castVote('yes')}
                    disabled={casting || !!userVote || isTimedOut || !currentPoll.isActive}
                    className="flex-1 group relative overflow-hidden bg-primary text-white rounded-xl text-lg md:text-xl font-black tracking-tighter glow-pink hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    YES
                  </button>
                  <button 
                    onClick={() => castVote('no')}
                    disabled={casting || !!userVote || isTimedOut || !currentPoll.isActive}
                    className="flex-1 group relative overflow-hidden bg-purple-950/40 border-2 border-white/10 text-primary rounded-xl text-lg md:text-xl font-black tracking-tighter hover:bg-purple-900/60 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    NO
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemState, setSystemState] = useState<SystemState>({ currentPollNumber: 0, isActive: false });
  const [votes, setVotes] = useState<Vote[]>([]);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Coarse clock sync on load
  useEffect(() => {
    const sync = async () => {
      try {
        const start = Date.now();
        const resp = await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' });
        const serverDate = resp.headers.get('Date');
        if (serverDate) {
          const serverTime = new Date(serverDate).getTime();
          const end = Date.now();
          const latency = (end - start) / 2;
          setClockOffset(serverTime + latency - end);
        }
      } catch (e) {
        console.warn("Initial clock sync failed:", e);
      }
    };
    sync();
  }, []);

  useEffect(() => {
    if (!user) {
      setVotes([]);
      setUserVote(null);
      return;
    }

    // Diagnostic log for the user to confirm database connection
    console.log("Rose Quartz Diagnostics:", {
      userId: user.uid,
      email: user.email,
      databaseId: db.app.options.projectId,
      pollNumber: systemState.currentPollNumber
    });

    // Listener for system state
    const unsubState = onSnapshot(doc(db, 'system', 'state'), (s) => {
      if (s.exists()) {
        const data = s.data() as SystemState;
        
        // Refined clock sync whenever a push occurs
        if (data.lastPushedAt && !s.metadata.hasPendingWrites) {
          const serverT = data.lastPushedAt.toMillis ? data.lastPushedAt.toMillis() : data.lastPushedAt;
          if (Math.abs(serverT - Date.now()) < 3600000) { // Within 1 hour
            const newOffset = serverT - Date.now();
            // We use a small threshold to avoid jitter, but 9s definitely triggers it
            if (Math.abs(newOffset - clockOffset) > 1000) {
              setClockOffset(newOffset);
            }
          }
        }
        
        setSystemState(data);
      } else if (user.email === ADMIN_EMAIL) {
        // Auto-bootstrap if it's the admin and document is missing
        console.log("Bootstrapping system state...");
        setDoc(doc(db, 'system', 'state'), { 
          currentPollNumber: 0, 
          isActive: false,
          durationSeconds: 20
        }).catch(err => console.error("Bootstrap failed. Check rules for /system/state. Error:", err));
      }
    });

    return () => unsubState();
  }, [user, systemState.currentPollNumber]);

  useEffect(() => {
    if (!user) return;

    const isAdmin = user.email === ADMIN_EMAIL;
    // Removing orderBy to ensure all docs are fetched even if timestamp is pending (optimistic updates)
    const votesQuery = isAdmin 
      ? query(collection(db, 'votes'))
      : query(collection(db, 'votes'), where('userId', '==', user.uid));

    const unsubVotes = onSnapshot(votesQuery, (snap) => {
      // Sort locally to avoid query constraints on pending timestamps
      const vData = snap.docs
        .map(d => d.data() as Vote)
        .sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
          return tB - tA;
        });
      setVotes(vData);
    }, (err) => {
      console.error("Votes listener error:", err);
    });

    return () => unsubVotes();
  }, [user]);

  useEffect(() => {
    if (!user || votes.length === 0) {
      setUserVote(null);
      return;
    }
    // Refined userVote detection: Ensure we only look at local user's vote even if admin
    const currentVote = votes.find(v => 
      v.pollNumber === systemState.currentPollNumber && 
      v.userId === user.uid
    );
    setUserVote(currentVote || null);
  }, [votes, systemState.currentPollNumber, user?.uid]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <div className="min-h-screen editorial-gradient selection:bg-primary/40 selection:text-white">
      <Auth user={user} loading={loading} />
      
      {user && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
          <Header user={user} isAdmin={isAdmin} />

          <main>
            <AnimatePresence mode="wait">
              {isAdmin ? (
                <motion.div
                  key="admin"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <AdminPanel currentPoll={systemState} votes={votes} clockOffset={clockOffset} />
                </motion.div>
              ) : (
                <motion.div
                  key="user"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                >
                  <UserVote user={user} currentPoll={systemState} userVote={userVote} clockOffset={clockOffset} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
          
          <footer className="mt-20 py-12 border-t border-pink-900/20 text-center flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="h-[1px] w-20 bg-pink-900/40" />
              <Heart className="w-4 h-4 text-primary opacity-40" />
              <div className="h-[1px] w-20 bg-pink-900/40" />
            </div>
            <p className="text-pink-100/20 text-[10px] font-bold uppercase tracking-[0.6em]">
              Bias & Reality Syndicate &bull; Immortalizing Voice Since 2026
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
