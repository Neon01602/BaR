import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = 'ahmadabdullah007860@gmail.com';

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();

export interface SystemState {
  currentPollNumber: number;
  isActive: boolean;
  lastPushedAt?: any;
  durationSeconds?: number;
  endsAt?: any;
}

export interface Vote {
  pollNumber: number;
  userId: string;
  userEmail: string;
  userName: string;
  choice: 'yes' | 'no';
  timestamp: any;
}
