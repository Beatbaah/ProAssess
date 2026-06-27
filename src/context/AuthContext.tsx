import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User,
  updateProfile as updateAuthProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string, contactNumber?: string, role?: 'candidate' | 'recruiter') => Promise<void>;
  logout: () => Promise<void>;
  updateProfileInfo: (displayName: string, contactNumber?: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // Listen for Auth changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Unsubscribe from previous profile listener if any
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(currentUser);
      
      if (currentUser) {
        // Set up real-time listener for user profile in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Initial fetch
        try {
          const userSnap = await getDoc(userDocRef);
          const isDemo = currentUser.email === 'demo.candidate@proassess.com';
          const isBeatriceEmail = currentUser.email === 'beatbaah@gmail.com';
          const isBeatrice = isDemo || isBeatriceEmail;

          if (!userSnap.exists()) {
            // Create user profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: isBeatrice ? 'Beatrice' : (currentUser.displayName || 'Beatrice'),
              contactNumber: '',
              status: 'Not Started',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          } else {
            const existingData = userSnap.data() as UserProfile;
            if (isBeatrice && (existingData.displayName === 'Demo Candidate' || existingData.displayName === 'Candidate' || !existingData.displayName || existingData.displayName === 'Anonymous')) {
              existingData.displayName = 'Beatrice';
              await setDoc(userDocRef, { displayName: 'Beatrice' }, { merge: true });
            }
            setProfile(existingData);
          }
        } catch (err: any) {
          console.error("Error loading user profile:", err);
        }

        // Real-time updates
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        }, (err) => {
          console.error("Real-time profile listener error:", err);
        });

        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login error:", err);
      let errMsg = "Failed to sign in. Please verify your credentials.";
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = "Incorrect email or password.";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "Invalid email address format.";
      }
      setError(errMsg);
      setLoading(false);
      throw new Error(errMsg);
    }
  };

  const signup = async (email: string, password: string, displayName: string, contactNumber?: string, role: 'candidate' | 'recruiter' = 'candidate') => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      
      // Update auth display name
      await updateAuthProfile(newUser, { displayName });
      
      // Save profile to Firestore
      const newProfile: UserProfile = {
        uid: newUser.uid,
        email: newUser.email || email,
        displayName,
        contactNumber: contactNumber || '',
        status: 'Not Started',
        createdAt: new Date().toISOString(),
        role
      };
      
      await setDoc(doc(db, 'users', newUser.uid), newProfile);
      setProfile(newProfile);
    } catch (err: any) {
      console.error("Signup error:", err);
      let errMsg = "Failed to register candidate. Please try again.";
      if (err.code === 'auth/email-already-in-use') {
        errMsg = "This email is already registered.";
      } else if (err.code === 'auth/weak-password') {
        errMsg = "Password must be at least 6 characters long.";
      }
      setError(errMsg);
      setLoading(false);
      throw new Error(errMsg);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Logout error:", err);
      setError("Failed to log out cleanly.");
      setLoading(false);
    }
  };

  const updateProfileInfo = async (displayName: string, contactNumber?: string) => {
    if (!user) return;
    setError(null);
    try {
      await updateAuthProfile(user, { displayName });
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        contactNumber: contactNumber || ''
      }, { merge: true });
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError("Failed to update candidate profile.");
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      error,
      login,
      signup,
      logout,
      updateProfileInfo,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
