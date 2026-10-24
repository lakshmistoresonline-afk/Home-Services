import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/src/config/firebase';
import { type User, type UserRole, getProfile, setGlobalLoggingOut } from '@/src/api/client';
import { logAction } from '@/src/api/auditApi';
import { checkMobileUnique } from '@/src/api/authApi';
import { THRISSUR_WARDS } from '@/src/data/wards';
import { notificationService } from '@/src/services/notifications';


type AuthState = {
  user: User | null;
  loading: boolean;
  isLoggingOut: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { full_name: string; email: string; mobile: string; password: string; wardName: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
  hasPermission: (permId: string) => boolean;
  canModify: () => boolean;
  canAssign: () => boolean;
  canClose: () => boolean;
  canComment: () => boolean;
  canViewAll: () => boolean;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isRegistering = React.useRef(false);

  const getProfileData = async (uid: string): Promise<User | null> => {
    try {
      const profile = await getProfile(uid);
      if (profile) {
          if (!profile.role) {
            profile.role = 'citizen';
            await updateDoc(doc(db, 'users', uid), { role: 'citizen', updatedAt: serverTimestamp() });
          }

          // Optimization: Load and cache role permissions once per login/refresh
          try {
            const roleRef = doc(db, "roles", profile.role);
            const roleSnap = await getDoc(roleRef);
            if (roleSnap.exists()) {
              profile.permissions = roleSnap.data().permissions || [];
            }
          } catch (e) {
            console.warn(`Could not load permissions for role: ${profile.role}`, e);
          }
      }
      return profile;
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
    return null;
  };

  useEffect(() => {
    if (!auth) {
      console.error('Firebase Auth instance is undefined. Check firebase configuration.');
      setLoading(false);
      return;
    }

    if (typeof onAuthStateChanged !== 'function') {
      console.error('onAuthStateChanged is not a function. Firebase imports might be corrupted.', { onAuthStateChanged });
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // If we are currently registering, the profile won't exist yet.
        // We let the register function handle state setting.
        if (isRegistering.current) {
           return;
        }

        const profile = await getProfileData(fbUser.uid);
        if (profile) {
          setUser(profile);
        } else {
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Web Fallback: If auth doesn't settle within 3 seconds, stop loading
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        setLoading((prev) => {
           if (prev) {
             console.warn('Auth state settlement timed out on web root. Forcing loading false.');
             return false;
           }
           return false;
        });
      }, 3000);
      return () => {
        unsubscribe();
        clearTimeout(timer);
      };
    }

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const emailNorm = email.trim().toLowerCase();
      console.log(`Attempting login for: ${emailNorm.replace(/(.{2}).*(@.*)/, "$1***$2")}`);

      const cred = await signInWithEmailAndPassword(auth, emailNorm, password);
      const profile = await getProfileData(cred.user.uid);

      if (!profile) {
        await signOut(auth);
        throw new Error('Your user profile was not found. Please contact support.');
      }

      if (!profile.isActive) {
        await signOut(auth);
        throw new Error('Account is deactivated');
      }

      setUser(profile);
      await logAction({ action: 'LOGIN', entityType: 'auth', entityId: profile.uid });
      return profile;
    } catch (error: any) {
      console.error('Login error:', error);
      let message = 'Login failed';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Please check your connection.';
      }
      throw new Error(message);
    }
  };

  const register = async (data: { full_name: string; email: string; mobile: string; password: string; wardName: string }) => {
    let cred;
    try {
      isRegistering.current = true;
      const emailNorm = data.email.trim().toLowerCase();

      // 1. Create Auth Account
      cred = await createUserWithEmailAndPassword(auth, emailNorm, data.password);

      // Delay for auth state settlement
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (authError: any) {
      isRegistering.current = false;
      console.error('Registration Auth Error:', authError);
      let msg = 'Registration failed';
      if (authError.code === 'auth/email-already-in-use') msg = 'Email already registered';
      else if (authError.code === 'auth/weak-password') msg = 'Password is too weak';
      else if (authError.code === 'auth/invalid-email') msg = 'Invalid email address';
      throw new Error(msg);
    }

    try {
      // 2. Uniqueness Check
      const isUnique = await checkMobileUnique(data.mobile);
      if (!isUnique) {
        await cred.user.delete();
        throw new Error('Mobile number already registered');
      }

      const ward = THRISSUR_WARDS.find(w => w.name === data.wardName);
      const wardNumber = ward ? ward.wardNumber : null;
      const wardId = wardNumber ? `ward_${wardNumber}` : null;

      const profileData = {
        uid: cred.user.uid,
        fullName: data.full_name || '',
        email: data.email || '',
        mobile: data.mobile || '',
        mobileNumber: data.mobile || '',
        role: 'citizen',
        status: 'active',
        wardNumber: wardNumber,
        wardName: data.wardName || null,
        wardId: wardId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        activeComplaintCount: 0,
        completedComplaintCount: 0,
        averageResolutionTime: 0,
        rating: 5.0,
        permissions: [],
      };

      // 3. Create Firestore Document
      await setDoc(doc(db, 'users', cred.user.uid), profileData);

      // Optimization: Construct user state from known data instead of re-reading immediately
      const newUserState: User = {
        ...profileData,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: []
      } as any;

      setUser(newUserState);

      // 4. Background Tasks (Non-blocking)
      notificationService.notifyAccountCreated(cred.user.uid, 'citizen', data.full_name).catch(() => {});
      logAction({ action: 'REGISTER', entityType: 'auth', entityId: cred.user.uid }).catch(() => {});

      isRegistering.current = false;
      return newUserState;
    } catch (firestoreError: any) {
      isRegistering.current = false;
      console.error('Registration Firestore Error:', firestoreError);
      try {
        await cred.user.delete();
      } catch (e) {}
      throw new Error(firestoreError.message || 'Failed to initialize user profile');
    }
  };

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      setGlobalLoggingOut(true);
      const uid = user?.uid;
      if (uid) {
        await logAction({ action: 'LOGOUT', entityType: 'auth', entityId: uid }).catch(e => {
          console.warn('Silent failure logging logout:', e);
        });
      }

      setUser(null);
      await signOut(auth);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      throw error;
    } finally {
      setIsLoggingOut(false);
      setGlobalLoggingOut(false);
    }
  };

  const refresh = async () => {
    if (auth.currentUser) {
      const profile = await getProfileData(auth.currentUser.uid);
      setUser(profile);
    }
  };

  const updatePushToken = async (token: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { pushToken: token, updatedAt: serverTimestamp() });
      setUser({ ...user, pushToken: token });
    } catch (e) {
      console.error('Failed to update push token:', e);
    }
  };

  const hasPermission = useCallback((permId: string) => {
    if (!user) return false;
    if (user.permissions?.includes('all')) return true;
    return user.permissions?.includes(permId) || false;
  }, [user]);

  const canModify = useCallback(() => {
    if (!user) return false;
    if (user.role === 'readonly_super_admin') return false;
    return true;
  }, [user]);

  const canAssign = useCallback(() => {
    if (!user) return false;
    if (user.role === 'readonly_super_admin') return false;
    return user.role === 'super_admin' || user.role === 'ward_admin';
  }, [user]);

  const canClose = useCallback(() => {
    if (!user) return false;
    if (user.role === 'readonly_super_admin') return false;
    return user.role === 'super_admin';
  }, [user]);

  const canComment = useCallback(() => {
    if (!user) return false;
    if (user.role === 'readonly_super_admin') return false;
    return true;
  }, [user]);

  const canViewAll = useCallback(() => {
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'readonly_super_admin';
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, loading, isLoggingOut, login, register, logout, refresh, setUser, hasPermission,
      canModify, canAssign, canClose, canComment, canViewAll
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
