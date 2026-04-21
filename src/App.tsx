import React, { useState, useEffect } from 'react';
import { auth, googleProvider, ADMIN_EMAIL, db, SystemState, Vote } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy, setDoc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
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
          <h1 className="text-5xl mb-4 text-primary serif italic">Bias and Reality, <span className="not-italic font-light opacity-80">Welcome</span></h1>
          <p className="text-pink-100/60 mb-10 font-light leading-relaxed">
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

const AdminPanel = ({ currentPoll, votes }: { currentPoll: SystemState, votes: Vote[] }) => {
  const [totalYes, setTotalYes] = useState(0);
  const [totalNo, setTotalNo] = useState(0);

  useEffect(() => {
    const activeVotes = votes.filter(v => v.pollNumber === currentPoll.currentPollNumber);
    setTotalYes(activeVotes.filter(v => v.choice === 'yes').length);
    setTotalNo(activeVotes.filter(v => v.choice === 'no').length);
  }, [votes, currentPoll.currentPollNumber]);

  const handlePush = async () => {
    if (currentPoll.currentPollNumber >= 10 && currentPoll.isActive) return;
    
    const stateRef = doc(db, 'system', 'state');
    if (!currentPoll.isActive && currentPoll.currentPollNumber > 0) {
      // Just activate
      await updateDoc(stateRef, { isActive: true });
    } else {
      // Increment and activate
      await setDoc(stateRef, {
        currentPollNumber: currentPoll.currentPollNumber + 1,
        isActive: true
      });
    }
  };

  const handleStop = async () => {
    const stateRef = doc(db, 'system', 'state');
    await updateDoc(stateRef, { isActive: false });
  };

  const handleReset = async () => {
    const stateRef = doc(db, 'system', 'state');
    await setDoc(stateRef, { currentPollNumber: 0, isActive: false });
  };

  const pollVotes = (num: number) => votes.filter(v => v.pollNumber === num);

  return (
    <div className="grid grid-cols-12 gap-8 pb-20">
      {/* Sidebar: Poll Sequence */}
      <section className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="glass p-8 rounded-[2rem] h-full flex flex-col justify-between">
          <div>
            <h2 className="serif text-3xl italic mb-8 text-pink-200">Poll Sequence</h2>
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
          <div className="glass rounded-[2.5rem] p-10 flex flex-col justify-center items-center relative overflow-hidden h-[340px]">
            <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.4em] text-primary font-bold opacity-70">Master Controls</div>
            <div className="text-center mb-8">
              <p className="serif text-8xl italic text-primary mb-2 font-light tracking-tighter">
                {currentPoll.currentPollNumber.toString().padStart(2, '0')}
              </p>
              <p className="text-xs tracking-[0.5em] uppercase text-pink-200/40 font-bold">Current Phase</p>
            </div>
            
            <div className="flex flex-col w-full gap-3">
              {currentPoll.isActive ? (
                <button 
                  onClick={handleStop}
                  className="w-full py-4 bg-red-400 text-purple-950 rounded-full font-bold uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Stop Current Poll
                </button>
              ) : (
                <button 
                  onClick={handlePush}
                  disabled={currentPoll.currentPollNumber >= 10}
                  className="w-full py-4 bg-primary text-purple-950 rounded-full font-bold uppercase tracking-widest glow-pink hover:bg-pink-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  {currentPoll.currentPollNumber === 0 ? 'Start First Poll' : 'Push Next Poll'}
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
            <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.4em] text-primary font-bold opacity-70">Real-time Metrics</div>
            
            <div className="flex flex-col gap-6 mt-8">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <span className="serif italic text-4xl text-pink-100">{totalYes}</span>
                  <span className="text-[10px] uppercase opacity-40 tracking-widest font-bold">Yes Affirmations</span>
                </div>
                <div className="w-full h-[6px] bg-pink-900/40 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(totalYes / (totalYes + totalNo || 1)) * 100}%` }}
                    className="h-full bg-primary glow-pink"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <span className="serif italic text-4xl text-purple-200">{totalNo}</span>
                  <span className="text-[10px] uppercase opacity-40 tracking-widest font-bold">No Negations</span>
                </div>
                <div className="w-full h-[6px] bg-pink-900/40 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(totalNo / (totalYes + totalNo || 1)) * 100}%` }}
                    className="h-full bg-secondary"
                  />
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/40 block mb-1">Total Voices Collected</span>
              <span className="serif text-2xl italic text-pink-100/80">{votes.filter(v => v.pollNumber === currentPoll.currentPollNumber).length} Responses</span>
            </div>
          </div>
        </div>

        {/* Voter Details Breakdown */}
        <div className="glass rounded-[2.5rem] p-8 flex flex-col relative overflow-hidden min-h-[400px]">
          <div className="absolute top-6 left-8 text-[10px] uppercase tracking-[0.4em] text-primary font-bold opacity-70">Voter Details Breakdown</div>
          
          <div className="mt-12 overflow-y-auto scroll-hide flex-1">
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-[0.25em] text-pink-100/40 border-b border-pink-900/30">
                <tr>
                  <th className="pb-4 font-bold">Voter Identity</th>
                  <th className="pb-4 font-bold text-center">Context</th>
                  <th className="pb-4 font-bold text-right">Judgment</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-pink-900/10">
                {votes.filter(v => v.pollNumber === currentPoll.currentPollNumber).map((v, idx) => (
                  <tr key={idx} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4 pr-4">
                      <div className="flex flex-col">
                        <span className="serif italic text-lg text-pink-200 leading-none mb-1">{v.userName}</span>
                        <span className="text-[10px] opacity-30 font-medium tracking-tight uppercase">{v.userEmail}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center opacity-40 text-[10px] font-bold tracking-widest uppercase">
                      Poll {v.pollNumber.toString().padStart(2, '0')}
                    </td>
                    <td className={`py-4 text-right serif text-xl italic font-bold ${v.choice === 'yes' ? 'text-primary active-glow' : 'text-purple-400'}`}>
                      {v.choice.toUpperCase()}
                    </td>
                  </tr>
                ))}
                {votes.filter(v => v.pollNumber === currentPoll.currentPollNumber).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-pink-100/20 italic font-light serif text-xl">
                      Awaiting the first breath of data...
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

  const castVote = async (choice: 'yes' | 'no') => {
    if (casting || userVote) return;
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
    } catch (err) {
      console.error(err);
    } finally {
      setCasting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-10">
      <AnimatePresence mode="wait">
        {!currentPoll.isActive ? (
          <motion.div 
            key="inactive"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="max-w-md w-full"
          >
            <div className="mb-8 p-6 bg-primary/10 rounded-full inline-block glow-pink border border-primary/20">
              <Sparkles className="w-12 h-12 md:w-16 md:h-16 text-primary" />
            </div>
            <h2 className="serif text-4xl md:text-5xl mb-6 text-pink-100 italic">The stage is being set...</h2>
            <p className="text-pink-100/40 font-light text-base md:text-lg tracking-wide">
              Please preserve your anticipation. The next revelation is being prepared for you.
            </p>
          </motion.div>
        ) : userVote ? (
          <motion.div 
            key="voted"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border-primary/30 border-2 max-w-lg w-full relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-[80px] rounded-full" />
            <div className="mb-8 flex justify-center">
              <div className="p-5 bg-primary/10 rounded-full glow-pink border border-primary/30">
                <Check className="w-10 h-10 md:w-14 md:h-14 text-primary" />
              </div>
            </div>
            <h2 className="serif text-3xl md:text-5xl mb-6 text-pink-100">Your voice was <span className="italic font-light">immortalized.</span></h2>
            <p className="text-pink-100/30 font-bold uppercase tracking-[0.4em] text-[10px] mb-3">System Record</p>
            <span className={`serif text-5xl md:text-7xl italic font-bold active-glow ${userVote.choice === 'yes' ? 'text-primary' : 'text-purple-300'}`}>
              {userVote.choice.toUpperCase()}
            </span>
            <div className="mt-12 pt-8 border-t border-pink-900/40">
              <p className="text-sm text-pink-100/40 italic font-light tracking-wide serif text-center">Gratitude for your intentional presence.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="active"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl glass p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl relative overflow-hidden border-2 border-white/5"
          >
            <div className="absolute top-6 right-6 md:top-10 md:right-10">
              <div className="bg-primary/20 text-primary px-3 py-1 md:px-5 md:py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.4em] border border-primary/30">
                Session {currentPoll.currentPollNumber.toString().padStart(2, '0')}
              </div>
            </div>
            
            <div className="flex flex-col items-center mb-10 md:mb-16">
              <div className="w-12 h-1 bg-primary/30 rounded-full mb-6 md:mb-8" />
              <h2 className="serif text-4xl md:text-6xl text-pink-100 leading-tight md:leading-none mb-4 italic font-light">Divine <span className="not-italic font-bold tracking-tighter">Judgment.</span></h2>
              <p className="text-pink-100/40 text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold">What truth resonates within you?</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10 h-auto md:h-60">
              <button 
                onClick={() => castVote('yes')}
                disabled={casting}
                className="group relative h-28 md:h-full overflow-hidden bg-primary text-purple-950 rounded-[1.5rem] md:rounded-[2.5rem] serif text-3xl md:text-5xl italic font-bold glow-pink hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                Yes
              </button>
              <button 
                onClick={() => castVote('no')}
                disabled={casting}
                className="group relative h-28 md:h-full overflow-hidden bg-purple-900/40 border-2 border-primary/30 text-primary rounded-[1.5rem] md:rounded-[2.5rem] serif text-3xl md:text-5xl italic font-bold hover:bg-purple-900/60 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                No
              </button>
            </div>
            
            <div className="mt-10 md:mt-14 flex items-center justify-center gap-4 text-pink-100/30">
              <div className="h-[1px] w-8 md:w-12 bg-pink-900/50" />
              <p className="text-[10px] uppercase tracking-[0.3em] md:tracking-[0.5em] font-bold">Silence is not an option</p>
              <div className="h-[1px] w-8 md:w-12 bg-pink-900/50" />
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

    const unsubState = onSnapshot(doc(db, 'system', 'state'), (s) => {
      if (s.exists()) {
        setSystemState(s.data() as SystemState);
      }
    });

    const isAdmin = user.email === ADMIN_EMAIL;
    let votesQuery;
    if (isAdmin) {
      votesQuery = query(collection(db, 'votes'), orderBy('timestamp', 'desc'));
    } else {
      votesQuery = query(collection(db, 'votes'), where('userId', '==', user.uid));
    }

    const unsubVotes = onSnapshot(votesQuery, (snap) => {
      const vData = snap.docs.map(d => d.data() as Vote);
      setVotes(vData);
      
      const currentVote = vData.find(v => v.pollNumber === systemState.currentPollNumber);
      setUserVote(currentVote || null);
    });

    return () => {
      unsubState();
      unsubVotes();
    };
  }, [user, systemState.currentPollNumber]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <div className="min-h-screen editorial-gradient selection:bg-primary/40 selection:text-white">
      <Auth user={user} loading={loading} />
      
      {user && (
        <div className="max-w-7xl mx-auto p-4 md:p-12 lg:p-16">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-pink-900/50 pb-10 mb-16 gap-6">
            <div className="flex flex-col">
              <span className="text-primary text-[10px] tracking-[0.5em] font-bold uppercase mb-2 opacity-70">
                {isAdmin ? 'Administrative Suite' : 'Community Voice'}
              </span>
              <div className="flex items-center gap-4">
                <Sparkles className="w-10 h-10 text-primary glow-pink" />
                <h1 className="serif text-7xl font-normal italic text-pink-100 tracking-tight leading-none">
                  Rose Quartz <span className="not-italic font-light opacity-60">Polling</span>
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-left md:text-right bg-white/5 p-4 rounded-3xl border border-white/5 backdrop-blur-sm">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-[0.2em] text-pink-300/40 font-bold mb-1">
                  Secure Session
                </span>
                <span className="text-sm font-semibold text-pink-50">{user.displayName || user.email}</span>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="w-12 h-12 rounded-full glass flex items-center justify-center text-primary hover:bg-primary hover:text-purple-950 transition-all border-primary/30"
                title="Terminate Session"
              >
                <LogOut className="w-5 h-5" />
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
          
          <footer className="mt-32 py-16 border-t border-pink-900/20 text-center flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="h-[1px] w-20 bg-pink-900/40" />
              <Heart className="w-4 h-4 text-primary opacity-40" />
              <div className="h-[1px] w-20 bg-pink-900/40" />
            </div>
            <p className="text-pink-100/20 text-[10px] font-bold uppercase tracking-[0.6em]">
              The Rose Quartz Collective &bull; Immortalizing Voice Since 2026
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
