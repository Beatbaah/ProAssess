import React from 'react';
import { useAssessment } from '../context/AssessmentContext';
import { Clock, HelpCircle, AlertTriangle } from 'lucide-react';

export const AssessmentInterface: React.FC = () => {
  const { questions, answers, activeCategory, currentQuestionIndex, timeLeft, selectAnswer, nextQuestion, submitCategory } = useAssessment();

  const [showSubmitModal, setShowSubmitModal] = React.useState(false);
  const [isEarlySubmit, setIsEarlySubmit] = React.useState(false);

  if (!activeCategory) return null;

  const activeQuestions = questions.filter(q => q.category === activeCategory);
  const localIndex = activeQuestions.findIndex(q => q === questions[currentQuestionIndex]);
  const currentQuestion = questions[currentQuestionIndex];

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
        <AlertTriangle size={28} className="text-amber-500" />
        <p className="font-semibold text-slate-800">Unable to load question.</p>
        <p className="text-sm text-slate-500">Please wait or try re-starting the section.</p>
      </div>
    );
  }

  const secondsLeft = timeLeft[activeCategory];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isTimeCritical = secondsLeft < 120;

  const answeredInCat = activeQuestions.filter(q => answers[q.id] !== undefined).length;
  const progressPercent = Math.round((answeredInCat / activeQuestions.length) * 100);
  const selectedOption = answers[currentQuestion.id];
  const isLastQuestion = localIndex === activeQuestions.length - 1;
  const hasAnswered = selectedOption !== undefined;

  const letterOf = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 sm:px-10 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium uppercase tracking-wide">
              {activeCategory} Reasoning
            </span>
            <h1 className="text-base font-semibold text-slate-800">Candidate Proficiency Test</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-sm font-medium transition-all ${
              isTimeCritical ? 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse' : 'text-slate-700 bg-slate-50 border-slate-200'
            }`}>
              <Clock size={14} className={isTimeCritical ? 'text-rose-500' : 'text-slate-400'} />
              {formattedTime}
            </div>

            {isLastQuestion ? (
              <button id="btn-header-submit-section"
                onClick={() => { setIsEarlySubmit(false); setShowSubmitModal(true); }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer">
                Submit Section
              </button>
            ) : (
              <button id="btn-header-submit-early"
                onClick={() => { setIsEarlySubmit(true); setShowSubmitModal(true); }}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer">
                Finish Early
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden progress-shine">
          <div className="bg-[#002366] h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-slate-400 font-medium">
          <span>Question {localIndex + 1} of {activeQuestions.length}</span>
          <span>{answeredInCat} of {activeQuestions.length} answered</span>
        </div>
      </header>

      {/* Question card */}
      <section className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-10">

          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Question {localIndex + 1}
          </p>
          <p id="question-text" className="text-lg sm:text-xl font-medium text-slate-900 leading-relaxed mb-8">
            {currentQuestion.text}
          </p>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              return (
                <button key={idx} id={`btn-option-${idx}`}
                  onClick={() => selectAnswer(currentQuestion.id, idx)}
                  className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-[#002366] bg-[#002366]/5'
                      : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? 'border-[#002366] bg-[#002366]' : 'border-slate-300 group-hover:border-slate-400'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className={`text-sm leading-snug ${isSelected ? 'text-[#002366] font-medium' : 'text-slate-700'}`}>
                    <span className="font-mono text-slate-400 mr-2">{letterOf(idx)}.</span>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 sm:px-10 py-4 flex items-center justify-end gap-4">
        {!hasAnswered && (
          <p className="mr-auto text-xs text-slate-400 italic">Select an answer to continue</p>
        )}

        {isLastQuestion ? (
          <button id="btn-submit-category-section"
            onClick={() => { setIsEarlySubmit(false); setShowSubmitModal(true); }}
            disabled={!hasAnswered}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              hasAnswered
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}>
            Submit Section
          </button>
        ) : (
          <button id="btn-next-question" onClick={nextQuestion} disabled={!hasAnswered}
            className={`px-8 py-2.5 rounded-lg text-sm font-medium transition-all ${
              hasAnswered
                ? 'bg-[#002366] hover:bg-[#00308f] text-white cursor-pointer shadow-sm btn-primary'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}>
            Save & Next
          </button>
        )}
      </footer>

      {/* Submit modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-sm w-full overflow-hidden animate-fade-in">
            <div className="p-6 text-center space-y-3">
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <HelpCircle size={22} className="text-[#002366]" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {isEarlySubmit ? 'Finish section early?' : 'Submit section?'}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {isEarlySubmit
                  ? 'Unanswered questions will be marked incorrect. You cannot return to this section.'
                  : 'Once submitted you cannot change your answers for this section.'}
              </p>

              <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-600 space-y-1 text-left">
                <div className="flex justify-between">
                  <span>Answered</span>
                  <span className="font-mono font-semibold text-slate-800">{answeredInCat} / {activeQuestions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining</span>
                  <span className="font-mono font-semibold text-rose-600">{activeQuestions.length - answeredInCat}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex gap-2.5 justify-end border-t border-slate-100">
              <button type="button" onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer">
                Go Back
              </button>
              <button type="button"
                onClick={() => { setShowSubmitModal(false); submitCategory(); }}
                className="px-5 py-2 bg-[#002366] hover:bg-[#00308f] text-white rounded-lg text-xs font-medium transition-colors cursor-pointer">
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
