export type Category = 'Numerical' | 'Verbal' | 'Logical' | 'Spatial';

export interface Question {
  id: string; // e.g. "q1", "q2"
  category: Category;
  text: string;
  options: string[];
  correctAnswerIndex: number; // Hidden from client in production, stored securely in DB
  explanation: string;
}

// Client-facing Question does not leak the correctAnswerIndex
export interface ClientQuestion {
  id: string;
  category: Category;
  text: string;
  options: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  contactNumber?: string;
  createdAt: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  currentCategory?: Category;
  currentQuestionIndex?: number;
  role?: 'candidate' | 'recruiter';
}

export interface AssessmentState {
  currentCategory: Category | null;
  currentQuestionIndex: number; // Index within the category or overall
  answers: Record<string, number>; // questionId -> selectedOptionIndex
  timeLeft: Record<Category, number>; // seconds remaining per category
  completedCategories: Category[];
  startedAt: Record<Category, string | null>;
}

export interface AssessmentResult {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  scores: Record<Category, number>; // score out of 25 for each
  totalScore: number; // aggregate score out of 100
  submittedAt: string;
  categoryPercentages: Record<Category, number>;
  feedback: string; // Professional summary feedback on strengths
}
