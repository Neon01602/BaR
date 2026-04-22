import React, { useState, useEffect } from 'react';
import { auth, googleProvider, ADMIN_EMAIL, db, SystemState, Vote } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy, setDoc, updateDoc, serverTimestamp, where, Timestamp, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Heart, Sparkles, Check, X, Users, RotateCcw, ChevronRight } from 'lucide-react';

// Components
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

const CountdownTimer = ({ endsAt, onEnd }: { endsAt: any, onEnd?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!endsAt) return;

    const interval = setInterval(() => {
      const target = endsAt.toDate ? endsAt.toDate().getTime() : endsAt;
      const now = Date.now();
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

const AdminPanel = ({ currentPoll, votes }: { currentPoll: SystemState, votes: Vote[] }) => {
  const [totalYes, setTotalYes] = useState(0);
  const [totalNo, setTotalNo] = useState(0);
  const [selectedPoll, setSelectedPoll] = useState(currentPoll.currentPollNumber || 1);
  const FIXED_DURATION = 20;

  useEffect(() => {
    // Only auto-snap if the admin hasn't manually diverged significantly or if it's the first load
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
    const endsAt = Timestamp.fromMillis(Date.now() + FIXED_DURATION * 1000);
    
    if (!currentPoll.isActive && currentPoll.currentPollNumber > 0 && currentPoll.currentPollNumber < 10) {
      // Re-push/Next push if currently inactive but not reset
      const nextNum = currentPoll.currentPollNumber + 1;
      await updateDoc(stateRef, { 
        currentPollNumber: nextNum,
        isActive: true,
        lastPushedAt: serverTimestamp(),
        durationSeconds: FIXED_DURATION,
        endsAt
      });
    } else {
      // Initial or restart
      const nextNum = currentPoll.currentPollNumber + 1;
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

    // Programmatically clear all votes (for small to medium sets)
    try {
      const votesSnap = await getDocs(collection(db, 'votes'));
      const batch = writeBatch(db);
      votesSnap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Collection wipe failed:", err);
    }
  };

  const pollVotes = votes.filter(v => v.pollNumber === selectedPoll);
  const totalInSelected = pollVotes.length;
  const yesInSelected = pollVotes.filter(v => v.choice === 'yes').length;
  const noInSelected = pollVotes.filter(v => v.choice === 'no').length;

  return (
    <div className="grid grid-cols-12 gap-8 pb-20">
      {/* Sidebar: Poll Sequence */}
      <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="glass p-8 rounded-[2rem] h-full flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-8 text-pink-200 tracking-tight">Poll Sequence</h2>
            <div className="space-y-5">
              {[...Array(10)].map((_, i) => {
                const num = i + 1;
                const isFinalized = num < currentPoll.currentPollNumber;
                const isCurrent = num === currentPoll.currentPollNumber;
                const isQueued = num > currentPoll.currentPollNumber;
                const isHiding = num === currentPoll.currentPollNumber && !currentPoll.isActive;
                
                return (
                  <div key={num} className={`flex items-center gap-4 group transition-opacity ${isQueued ? 'opacity-30' : 'opacity-100'}`}>
                    <div className={`poll-dot ${isFinalized ? 'filled' : ''} ${isCurrent ? 'current' : ''}`} />
                    <span className={`text-sm tracking-widest uppercase ${isCurrent ? 'text-primary font-bold active-glow' : 'text-pink-100/60 font-medium italic'}`}>
                      Session {num.toString().padStart(2, '0')}: {isFinalized ? 'Finalized' : isCurrent ? (isHiding ? 'Hidden' : 'Active') : 'Queued'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pt-6 border-t border-pink-900/30 mt-8">
            <p className="text-[10px] text-primary uppercase tracking-[0.3em] font-bold opacity-70">
              Platform Status: {(currentPoll.currentPollNumber * 10)}% Completion
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="col-span-12 lg:col-span-8 flex flex-col gap-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Master Controls */}
          <div className="glass rounded-[2.5rem] p-10 flex flex-col justify-center items-center relative overflow-hidden h-[420px]">
            <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.4em] text-primary font-bold opacity-70">Master Controls</div>
            <div className="text-center mb-6">
              <p className="text-6xl text-primary mb-2 font-bold tracking-tighter">
                {currentPoll.isActive ? currentPoll.currentPollNumber.toString().padStart(2, '0') : (currentPoll.currentPollNumber + 1).toString().padStart(2, '0')}
              </p>
              <p className="text-xs tracking-[0.5em] uppercase text-pink-200/40 font-bold mb-4">
                {currentPoll.isActive ? 'Active Phase' : 'Next Expected Phase'}
              </p>
              
              {currentPoll.isActive && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CountdownTimer endsAt={currentPoll.endsAt} onEnd={handleStop} />
                </motion.div>
              )}
            </div>
            
            <div className="flex flex-col w-full gap-4">
              {currentPoll.isActive ? (
                <button 
                  onClick={handleStop}
                  className="w-full py-4 bg-red-400 text-white rounded-full font-bold uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Terminal Stop
                </button>
              ) : (
                <button 
                  onClick={handlePush}
                  disabled={currentPoll.currentPollNumber >= 10}
                  className="w-full py-4 bg-primary text-white rounded-full font-bold uppercase tracking-widest glow-pink hover:bg-pink-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  Initiate Push #{currentPoll.currentPollNumber + 1}
                </button>
              )}
              <button 
                onClick={handleReset}
                className="py-2 text-pink-100/20 hover:text-red-400 transition-all text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3 h-3" />
                Emergency Reset
              </button>
            </div>
          </div>

          {/* Real-time Metrics */}
          <div className="glass rounded-[2.5rem] p-10 flex flex-col justify-between relative h-[340px]">
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold opacity-70">Real-time Metrics</span>
              <div className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[8px] font-bold text-primary tracking-widest uppercase">
                Poll {selectedPoll.toString().padStart(2, '0')} {selectedPoll === currentPoll.currentPollNumber && currentPoll.isActive ? 'LIVE' : 'FINAL'}
              </div>
            </div>
            
            <div className="flex flex-col gap-6 mt-8">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <span className="text-3xl text-pink-100 font-bold tracking-tight">{yesInSelected}</span>
                  <span className="text-[10px] uppercase opacity-40 tracking-widest font-bold">Yes Affirmations ({totalInSelected > 0 ? Math.round((yesInSelected / totalInSelected) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-[6px] bg-pink-900/40 rounded-full overflow-hidden">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${(yesInSelected / (totalInSelected || 1)) * 100}%` }}
                    className="h-full bg-primary glow-pink"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <span className="text-3xl text-purple-200 font-bold tracking-tight">{noInSelected}</span>
                  <span className="text-[10px] uppercase opacity-40 tracking-widest font-bold">No Negations ({totalInSelected > 0 ? Math.round((noInSelected / totalInSelected) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-[6px] bg-pink-900/40 rounded-full overflow-hidden">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${(noInSelected / (totalInSelected || 1)) * 100}%` }}
                    className="h-full bg-secondary"
                  />
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/40 block mb-1">Total Voices Collected</span>
              <span className="text-xl font-bold text-pink-100/80 tracking-tight">{totalInSelected} Responses</span>
            </div>
          </div>
        </div>

        {/* Voter Details Breakdown */}
        <div className="glass rounded-[2.5rem] p-8 flex flex-col relative overflow-hidden min-h-[500px]">
          <div className="absolute top-6 left-8 text-[10px] uppercase tracking-[0.4em] text-primary font-bold opacity-70">Voter Details Breakdown</div>
          
          <div className="mt-12 flex flex-wrap gap-2 mb-6 border-b border-pink-900/20 pb-4">
            {[...Array(10)].map((_, i) => {
              const num = i + 1;
              const hasVotes = votes.some(v => v.pollNumber === num);
              return (
                <button
                  key={num}
                  onClick={() => setSelectedPoll(num)}
                  className={`w-10 h-10 rounded-full text-xs font-bold transition-all border ${
                    selectedPoll === num 
                      ? 'bg-primary text-white border-primary' 
                      : hasVotes 
                        ? 'bg-pink-900/20 text-pink-100 border-pink-900/30' 
                        : 'bg-transparent text-pink-100/10 border-white/5'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <div className="overflow-y-auto scroll-hide flex-1">
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-[0.25em] text-pink-100/40 border-b border-pink-900/30">
                <tr>
                  <th className="pb-4 font-bold">Voter Identity</th>
                  <th className="pb-4 font-bold text-center">Context</th>
                  <th className="pb-4 font-bold text-right">Judgment</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-pink-900/10">
                {votes.filter(v => v.pollNumber === selectedPoll).map((v, idx) => (
                  <tr key={idx} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4 pr-4">
                      <div className="flex flex-col">
                        <span className="text-lg text-pink-200 font-bold leading-none mb-1">{v.userName}</span>
                        <span className="text-[10px] opacity-30 font-medium tracking-tight uppercase tracking-[0.1em]">{v.userEmail}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center opacity-40 text-[10px] font-bold tracking-widest uppercase">
                      Poll {v.pollNumber.toString().padStart(2, '0')}
                    </td>
                    <td className={`py-4 text-right text-xl font-bold ${v.choice === 'yes' ? 'text-primary active-glow' : 'text-purple-400'}`}>
                      {v.choice.toUpperCase()}
                    </td>
                  </tr>
                ))}
                {votes.filter(v => v.pollNumber === selectedPoll).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-pink-100/20 italic font-light serif text-xl">
                      Awaiting the first breath of data for Poll {selectedPoll}...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

const UserVote = ({ user, currentPoll, userVote }: { user: User, currentPoll: SystemState, userVote: Vote | null }) => {
  const [casting, setCasting] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!currentPoll.endsAt || !currentPoll.isActive) {
      setIsTimedOut(false);
      return;
    }
    
    const checkTimeout = () => {
      const target = currentPoll.endsAt.toDate ? currentPoll.endsAt.toDate().getTime() : currentPoll.endsAt;
      if (Date.now() >= target) {
        setIsTimedOut(true);
      } else {
        setIsTimedOut(false);
      }
    };

    checkTimeout();
    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [currentPoll.endsAt, currentPoll.isActive]);

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
    <div className="min-h-[60vh] flex flex-col items-center justify-start text-center px-4 py-8 md:py-12">
      <AnimatePresence mode="wait">
        {showWaitingRoom ? (
          <motion.div 
            key="inactive"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-md w-full glass p-10 md:p-16 rounded-[3rem] border border-white/10 shadow-2xl flex flex-col items-center"
          >
            <div className="mb-8 p-5 bg-primary/10 rounded-full inline-block glow-pink border border-primary/20">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div className="px-4 py-1.5 rounded-full bg-pink-900/20 border border-pink-900/30 text-[10px] font-black text-pink-300 tracking-[0.4em] uppercase mb-6">
              Poll number {currentPoll.currentPollNumber}
            </div>
            <div className="w-12 h-0.5 bg-primary/20 rounded-full mb-8" />
            <p className="text-pink-100/60 font-light text-base md:text-xl tracking-wide uppercase leading-relaxed max-w-[280px] md:max-w-none">
              {isTimedOut 
                ? 'The session window has closed. Awaiting synchronization.' 
                : 'The next session is being synthesized.'}
            </p>
          </motion.div>
        ) : userVote ? (
          <motion.div 
            key="voted"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md md:max-w-xl glass p-10 md:p-16 rounded-[3rem] border-2 border-primary/30 shadow-2xl relative overflow-hidden flex flex-col items-center"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-[80px] rounded-full" />
            <div className="mb-8 flex justify-center">
              <div className="p-5 bg-primary/10 rounded-full glow-pink border border-primary/30">
                <Check className="w-10 h-10 md:w-16 md:h-16 text-primary" />
              </div>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary tracking-[0.4em] uppercase mb-8">
              Poll number {userVote.pollNumber}
            </div>
            <div className="flex flex-col items-center gap-4">
              <p className="text-pink-100/30 font-bold uppercase tracking-[0.5em] text-[10px]">Decision Recorded</p>
              <span className={`text-6xl md:text-8xl font-black active-glow tracking-tighter ${userVote.choice === 'yes' ? 'text-primary' : 'text-purple-300'}`}>
                {userVote.choice.toUpperCase()}
              </span>
            </div>
            <div className="mt-12 pt-8 border-t border-white/10 w-full">
              <p className="text-[10px] text-pink-100/40 font-black tracking-[0.5em] uppercase">Identity Verified</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="active"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg md:max-w-2xl glass p-8 md:p-16 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/10 flex flex-col items-center"
          >
            <div className="flex flex-col items-center w-full gap-8 md:gap-12 text-center">
              {/* Status Header */}
              <div className="flex flex-col items-center">
                <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] md:text-xs font-black text-primary tracking-[0.4em] uppercase mb-4">
                  Poll number {currentPoll.currentPollNumber}
                </div>
                <div className="w-12 h-0.5 bg-primary/30 rounded-full mb-6" />
                <div className="p-4 bg-primary/10 rounded-full border border-primary/20 glow-pink mb-4">
                  <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                </div>
                <p className="text-pink-100/40 text-[10px] md:text-xs uppercase tracking-[0.5em] font-bold">Session Active</p>
              </div>

              {/* Centered Timer */}
              {currentPoll.isActive && (
                <div className="glass px-6 py-4 md:px-10 md:py-6 rounded-[2rem] border border-primary/20 bg-white/5 backdrop-blur-md shadow-xl">
                  <CountdownTimer endsAt={currentPoll.endsAt} />
                </div>
              )}
              
              {/* Side-by-Side Buttons */}
              <div className="flex flex-row w-full gap-3 md:gap-6 h-20 md:h-28">
                <button 
                  onClick={() => castVote('yes')}
                  disabled={casting || !!userVote || isTimedOut || !currentPoll.isActive}
                  className="flex-1 group relative overflow-hidden bg-primary text-white rounded-2xl md:rounded-3xl text-xl md:text-3xl font-black tracking-tighter glow-pink hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(244,114,182,0.15)]"
                >
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  YES
                </button>
                <button 
                  onClick={() => castVote('no')}
                  disabled={casting || !!userVote || isTimedOut || !currentPoll.isActive}
                  className="flex-1 group relative overflow-hidden bg-purple-950/40 border-2 border-white/10 text-primary rounded-2xl md:rounded-3xl text-xl md:text-3xl font-black tracking-tighter hover:bg-purple-900/60 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
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
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemState, setSystemState] = useState<SystemState>({ currentPollNumber: 0, isActive: false });
  const [votes, setVotes] = useState<Vote[]>([]);
  const [userVote, setUserVote] = useState<Vote | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => {
      unsubAuth();
    };
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
        setSystemState(s.data() as SystemState);
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
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-pink-900/50 pb-6 mb-8 md:mb-12 gap-6">
            <div className="flex flex-col">
              <span className="text-primary text-[10px] tracking-[0.5em] font-bold uppercase mb-1 opacity-70">
                {isAdmin ? 'Administrative Suite' : 'Community Voice'}
              </span>
              <div className="flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-primary glow-pink" />
                <h1 className="text-3xl md:text-5xl font-bold text-pink-100 tracking-tighter leading-none">
                  Bias <span className="font-light opacity-50">&</span> Reality
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-left md:text-right bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.2em] text-pink-300/40 font-bold">
                  Secure Session
                </span>
                <span className="text-xs font-semibold text-pink-50">{user.displayName || user.email}</span>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="w-10 h-10 rounded-full glass flex items-center justify-center text-primary hover:bg-primary hover:text-purple-950 transition-all border-primary/30"
                title="Terminate Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main>
            <AnimatePresence mode="wait">
              {isAdmin ? (
                <motion.div
                  key="admin"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <AdminPanel currentPoll={systemState} votes={votes} />
                </motion.div>
              ) : (
                <motion.div
                  key="user"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                >
                  <UserVote user={user} currentPoll={systemState} userVote={userVote} />
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
