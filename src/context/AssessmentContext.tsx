import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { ClientQuestion, Category, AssessmentState, AssessmentResult } from '../types';

export interface IntegrityEvent {
  type: 'blur' | 'tab_hidden' | 'fullscreen_exit' | 'copy_attempt';
  timestamp: string;
}

export interface ShuffledOption {
  options: string[];  // options in display order
  map: number[];      // map[displayedIdx] = originalIdx
}

interface AssessmentContextType {
  questions: ClientQuestion[];
  answers: Record<string, number>;
  activeCategory: Category | null;
  currentQuestionIndex: number;
  timeLeft: Record<Category, number>;
  completedCategories: Category[];
  isSubmitting: boolean;
  result: AssessmentResult | null;
  loading: boolean;
  // Integrity
  integrityEvents: IntegrityEvent[];
  reportIntegrityEvent: (type: IntegrityEvent['type']) => void;
  shuffledOptions: Record<string, ShuffledOption>;
  lockedAnswers: Set<string>;
  lockAnswer: (questionId: string) => void;
  startCategory: (category: Category) => void;
  selectAnswer: (questionId: string, displayedOptionIndex: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  setCurrentQuestion: (index: number) => void;
  submitCategory: () => void;
  submitFullAssessment: () => Promise<AssessmentResult>;
  resetAssessment: () => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

const SECONDS_PER_CATEGORY = 20 * 60; // 20 minutes per category
const SPEED_FLAG_THRESHOLD = 3 * 60;  // flag if a category is completed in < 3 minutes

// Deterministic shuffle seeded by a string (used for option order — consistent on draft resume)
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let s = Array.from(seed).reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    const j = ((s >>> 0) % (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Fisher-Yates shuffle (random — used for question order per session)
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const initialTimeLeft: Record<Category, number> = {
  Numerical: SECONDS_PER_CATEGORY,
  Verbal: SECONDS_PER_CATEGORY,
  Logical: SECONDS_PER_CATEGORY,
  Spatial: SECONDS_PER_CATEGORY
};

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<Record<Category, number>>(initialTimeLeft);
  const [completedCategories, setCompletedCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Integrity tracking
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);
  const [categoryStartTimes, setCategoryStartTimes] = useState<Partial<Record<Category, number>>>({});
  const [shuffledOptions, setShuffledOptions] = useState<Record<string, ShuffledOption>>({});
  const [lockedAnswers, setLockedAnswers] = useState<Set<string>>(new Set());

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch questions from backend on mount/auth load
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch('/api/questions');
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          // Shuffle question order within each category (random per session)
          const categories: Category[] = ['Numerical', 'Verbal', 'Logical', 'Spatial'];
          const shuffledQs = categories.flatMap(cat => {
            const catQs = data.questions.filter((q: ClientQuestion) => q.category === cat);
            return shuffle(catQs);
          });
          setQuestions(shuffledQs);

          // Build seeded option shuffles (deterministic per questionId — consistent on resume)
          const opts: Record<string, ShuffledOption> = {};
          shuffledQs.forEach((q: ClientQuestion) => {
            const indices = seededShuffle(q.options.map((_, i) => i), q.id);
            opts[q.id] = { options: indices.map(i => q.options[i]), map: indices };
          });
          setShuffledOptions(opts);
        }
      } catch (err) {
        console.error('Error fetching questions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const reportIntegrityEvent = (type: IntegrityEvent['type']) => {
    setIntegrityEvents(prev => [...prev, { type, timestamp: new Date().toISOString() }]);
  };

  // 2. Load draft state from Firestore (or local storage fallback) if user is In Progress
  useEffect(() => {
    if (!user) {
      // Clear state on logout
      setAnswers({});
      setActiveCategory(null);
      setCurrentQuestionIndex(0);
      setTimeLeft(initialTimeLeft);
      setCompletedCategories([]);
      setResult(null);
      return;
    }

    const loadUserData = async () => {
      if (profile?.role === 'recruiter') {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // A. Check if user already has a Completed status. If so, fetch their Results
        if (profile?.status === 'Completed') {
          const resultsCol = collection(db, 'results');
          const q = query(resultsCol, where('userId', '==', user.uid));
          let snapshot;
          try {
            snapshot = await getDocs(q);
          } catch (err: any) {
            handleFirestoreError(err, OperationType.GET, 'results');
          }
          if (snapshot && !snapshot.empty) {
            // Find the most recent result
            const results = snapshot.docs.map(doc => doc.data() as AssessmentResult);
            results.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
            setResult(results[0]);
          }
        } else {
          // B. Load active draft (progress backup) from Firestore
          const draftRef = doc(db, 'drafts', user.uid);
          let draftSnap;
          try {
            draftSnap = await getDoc(draftRef);
          } catch (err: any) {
            handleFirestoreError(err, OperationType.GET, `drafts/${user.uid}`);
          }
          
          if (draftSnap && draftSnap.exists()) {
            const draftData = draftSnap.data();
            if (draftData.answers) setAnswers(draftData.answers);
            if (draftData.completedCategories) setCompletedCategories(draftData.completedCategories);
            if (draftData.activeCategory) setActiveCategory(draftData.activeCategory);
            if (draftData.currentQuestionIndex !== undefined) setCurrentQuestionIndex(draftData.currentQuestionIndex);

            // Recompute remaining time from the wall-clock start timestamp so a page
            // refresh always resumes at the correct second rather than a stale saved value.
            if (draftData.timeLeft) {
              let restoredTime = { ...draftData.timeLeft };
              if (draftData.activeCategory && draftData.categoryStartedAt) {
                const elapsed = (Date.now() - new Date(draftData.categoryStartedAt).getTime()) / 1000;
                restoredTime[draftData.activeCategory as Category] = Math.max(
                  0,
                  Math.round(SECONDS_PER_CATEGORY - elapsed)
                );
                // Restore categoryStartTimes so speed-flag calculation survives a refresh
                setCategoryStartTimes(prev => ({
                  ...prev,
                  [draftData.activeCategory]: new Date(draftData.categoryStartedAt).getTime()
                }));
              }
              setTimeLeft(restoredTime);
            }
          }
        }
      } catch (err) {
        console.error('Error loading candidate progress draft:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      loadUserData();
    }
  }, [user, profile]);

  // 3. Save progress backup to Firestore (Drafts collection) on change
  const saveProgressDraft = async (
    currAnswers: Record<string, number>,
    currCompleted: Category[],
    currTime: Record<Category, number>,
    currActive: Category | null,
    currIndex: number,
    currCategoryStartedAt?: string | null
  ) => {
    if (!user || profile?.status === 'Completed') return;
    try {
      const draftRef = doc(db, 'drafts', user.uid);
      await setDoc(draftRef, {
        userId: user.uid,
        answers: currAnswers,
        completedCategories: currCompleted,
        timeLeft: currTime,
        activeCategory: currActive,
        currentQuestionIndex: currIndex,
        // Wall-clock start time for the active category — used to recompute
        // the correct timeLeft on page refresh instead of restoring a stale value.
        categoryStartedAt: currCategoryStartedAt ?? null,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Could not back up progress draft to cloud:', err);
    }
  };

  // 4. Timer effect for the active category
  useEffect(() => {
    if (activeCategory && !completedCategories.includes(activeCategory)) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const updatedTime = prev[activeCategory] - 1;
          
          if (updatedTime <= 0) {
            // Timer expired! Conclude category automatically
            if (timerRef.current) clearInterval(timerRef.current);
            submitCategory();
            return {
              ...prev,
              [activeCategory]: 0
            };
          }
          
          const newTimeLeft = {
            ...prev,
            [activeCategory]: updatedTime
          };

          // Periodically save progress draft (every 30 seconds).
          // categoryStartedAt is already in Firestore from startCategory(); we pass it
          // through so the periodic save doesn't accidentally overwrite it with null.
          if (updatedTime % 30 === 0) {
            const startedAt = categoryStartTimes[activeCategory]
              ? new Date(categoryStartTimes[activeCategory]!).toISOString()
              : null;
            saveProgressDraft(answers, completedCategories, newTimeLeft, activeCategory, currentQuestionIndex, startedAt);
          }

          return newTimeLeft;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCategory, completedCategories]);

  // 5. Actions
  const startCategory = (category: Category) => {
    if (completedCategories.includes(category)) return;
    const startedAt = new Date().toISOString();
    setActiveCategory(category);
    setCategoryStartTimes(prev => ({ ...prev, [category]: Date.now() }));

    const globalIndex = questions.findIndex(q => q.category === category);
    setCurrentQuestionIndex(globalIndex >= 0 ? globalIndex : 0);

    if (profile && profile.status === 'Not Started') {
      setDoc(doc(db, 'users', user!.uid), { status: 'In Progress', currentCategory: category }, { merge: true });
    }
    saveProgressDraft(answers, completedCategories, timeLeft, category, globalIndex >= 0 ? globalIndex : 0, startedAt);
  };

  // displayedOptionIndex is the index in the shuffled options array;
  // we convert it back to the original index before storing.
  const selectAnswer = (questionId: string, displayedOptionIndex: number) => {
    const originalIndex = shuffledOptions[questionId]?.map[displayedOptionIndex] ?? displayedOptionIndex;
    const updatedAnswers = { ...answers, [questionId]: originalIndex };
    setAnswers(updatedAnswers);
    saveProgressDraft(updatedAnswers, completedCategories, timeLeft, activeCategory, currentQuestionIndex);
  };

  const lockAnswer = (questionId: string) => {
    setLockedAnswers(prev => new Set(prev).add(questionId));
  };

  const activeCategoryQuestions = questions.filter(q => q.category === activeCategory);
  
  const nextQuestion = () => {
    if (!activeCategory) return;
    
    // Check if next question is still in same category
    const nextIdx = currentQuestionIndex + 1;
    if (nextIdx < questions.length && questions[nextIdx].category === activeCategory) {
      setCurrentQuestionIndex(nextIdx);
      saveProgressDraft(answers, completedCategories, timeLeft, activeCategory, nextIdx);
    }
  };

  const prevQuestion = () => {
    if (!activeCategory) return;
    
    const prevIdx = currentQuestionIndex - 1;
    if (prevIdx >= 0 && questions[prevIdx].category === activeCategory) {
      setCurrentQuestionIndex(prevIdx);
      saveProgressDraft(answers, completedCategories, timeLeft, activeCategory, prevIdx);
    }
  };

  const setCurrentQuestion = (index: number) => {
    if (index >= 0 && index < questions.length && questions[index].category === activeCategory) {
      setCurrentQuestionIndex(index);
    }
  };

  const submitCategory = () => {
    if (!activeCategory) return;
    
    const updatedCompleted = [...completedCategories, activeCategory];
    setCompletedCategories(updatedCompleted);
    
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveCategory(null);
    setCurrentQuestionIndex(0);

    // Persist draft immediately; clear categoryStartedAt since this section is done
    saveProgressDraft(answers, updatedCompleted, timeLeft, null, 0, null);

    // Sync with main user status
    if (user) {
      setDoc(doc(db, 'users', user.uid), {
        currentCategory: null,
        completedCategories: updatedCompleted
      }, { merge: true });
    }
  };

  const submitFullAssessment = async (): Promise<AssessmentResult> => {
    if (!user) throw new Error('User not logged in');
    setIsSubmitting(true);

    // Build integrity summary
    const now = Date.now();
    const speedFlags: Partial<Record<Category, boolean>> = {};
    (Object.keys(categoryStartTimes) as Category[]).forEach(cat => {
      const elapsed = (now - (categoryStartTimes[cat] ?? now)) / 1000;
      const timeUsed = SECONDS_PER_CATEGORY - (timeLeft[cat] ?? SECONDS_PER_CATEGORY);
      if (timeUsed < SPEED_FLAG_THRESHOLD) speedFlags[cat] = true;
    });
    const integrityData = {
      blurCount: integrityEvents.filter(e => e.type === 'blur' || e.type === 'tab_hidden').length,
      copyAttempts: integrityEvents.filter(e => e.type === 'copy_attempt').length,
      fullscreenExits: integrityEvents.filter(e => e.type === 'fullscreen_exit').length,
      speedFlags,
      events: integrityEvents,
    };

    try {
      const response = await fetch('/api/submit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          userDisplayName: profile?.displayName || user.displayName || 'Candidate',
          answers,
          integrityData,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit assessment');
      }

      const data = await response.json();
      setResult(data.result);

      // Save results and update user status directly on the client side using Candidate credentials
      try {
        const resultDocRef = doc(db, 'results', data.result.id);
        await setDoc(resultDocRef, data.result);

        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          status: 'Completed',
          lastSubmittedAt: data.result.submittedAt,
          aggregateScore: data.result.totalScore,
          completedCategories: ['Numerical', 'Verbal', 'Logical', 'Spatial']
        }, { merge: true });

        // Delete draft since assessment is completed
        const draftDocRef = doc(db, 'drafts', user.uid);
        await setDoc(draftDocRef, {
          userId: user.uid,
          answers: answers,
          completedCategories: ['Numerical', 'Verbal', 'Logical', 'Spatial'],
          timeLeft: timeLeft,
          activeCategory: null,
          currentQuestionIndex: 0,
          updatedAt: new Date().toISOString()
        });
      } catch (clientWriteErr) {
        console.warn('Client-side sync of result completed: ', clientWriteErr);
      }
      
      // Update local completed states
      setCompletedCategories(['Numerical', 'Verbal', 'Logical', 'Spatial']);
      setActiveCategory(null);
      
      return data.result;
    } catch (err: any) {
      console.error('Error submitting assessment:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAssessment = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setAnswers({});
      setActiveCategory(null);
      setCurrentQuestionIndex(0);
      setTimeLeft(initialTimeLeft);
      setCompletedCategories([]);
      setResult(null);
      setIntegrityEvents([]);
      setCategoryStartTimes({});
      setLockedAnswers(new Set());

      // Reset Draft in Firestore
      await setDoc(doc(db, 'drafts', user.uid), {
        userId: user.uid,
        answers: {},
        completedCategories: [],
        timeLeft: initialTimeLeft,
        activeCategory: null,
        currentQuestionIndex: 0,
        updatedAt: new Date().toISOString()
      });

      // Reset profile status to Not Started
      await setDoc(doc(db, 'users', user.uid), {
        status: 'Not Started',
        currentCategory: null,
        completedCategories: [],
        aggregateScore: null
      }, { merge: true });
    } catch (err) {
      console.error('Error resetting assessment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AssessmentContext.Provider value={{
      questions,
      answers,
      activeCategory,
      currentQuestionIndex,
      timeLeft,
      completedCategories,
      isSubmitting,
      result,
      loading,
      integrityEvents,
      reportIntegrityEvent,
      shuffledOptions,
      lockedAnswers,
      lockAnswer,
      startCategory,
      selectAnswer,
      nextQuestion,
      prevQuestion,
      setCurrentQuestion,
      submitCategory,
      submitFullAssessment,
      resetAssessment
    }}>
      {children}
    </AssessmentContext.Provider>
  );
};

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};
