import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { ClientQuestion, Category, AssessmentState, AssessmentResult } from '../types';

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
  startCategory: (category: Category) => void;
  selectAnswer: (questionId: string, optionIndex: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  setCurrentQuestion: (index: number) => void;
  submitCategory: () => void;
  submitFullAssessment: () => Promise<AssessmentResult>;
  resetAssessment: () => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

const SECONDS_PER_CATEGORY = 20 * 60; // 20 minutes per category

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch questions from backend on mount/auth load
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch('/api/questions');
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        }
      } catch (err) {
        console.error('Error fetching questions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

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
            if (draftData.timeLeft) setTimeLeft(draftData.timeLeft);
            if (draftData.activeCategory) setActiveCategory(draftData.activeCategory);
            if (draftData.currentQuestionIndex !== undefined) setCurrentQuestionIndex(draftData.currentQuestionIndex);
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
    currIndex: number
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

          // Periodically save progress draft (every 10 seconds)
          if (updatedTime % 10 === 0) {
            saveProgressDraft(answers, completedCategories, newTimeLeft, activeCategory, currentQuestionIndex);
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
    
    // Set active category and reset index relative to this category's questions
    setActiveCategory(category);
    
    // Find first question of this category
    const catQuestions = questions.filter(q => q.category === category);
    const globalIndex = questions.findIndex(q => q.category === category);
    setCurrentQuestionIndex(globalIndex >= 0 ? globalIndex : 0);

    // Save state update in Firestore draft and locally
    if (profile && profile.status === 'Not Started') {
      // Set status to In Progress
      setDoc(doc(db, 'users', user!.uid), {
        status: 'In Progress',
        currentCategory: category
      }, { merge: true });
    }

    saveProgressDraft(answers, completedCategories, timeLeft, category, globalIndex >= 0 ? globalIndex : 0);
  };

  const selectAnswer = (questionId: string, optionIndex: number) => {
    const updatedAnswers = {
      ...answers,
      [questionId]: optionIndex
    };
    setAnswers(updatedAnswers);
    saveProgressDraft(updatedAnswers, completedCategories, timeLeft, activeCategory, currentQuestionIndex);
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

    // Persist draft immediately
    saveProgressDraft(answers, updatedCompleted, timeLeft, null, 0);

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
    
    try {
      const response = await fetch('/api/submit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          userDisplayName: profile?.displayName || user.displayName || 'Candidate',
          answers
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
      // Clear answers, reset timers, delete drafts
      setAnswers({});
      setActiveCategory(null);
      setCurrentQuestionIndex(0);
      setTimeLeft(initialTimeLeft);
      setCompletedCategories([]);
      setResult(null);

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
