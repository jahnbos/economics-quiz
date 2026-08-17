/**
 * Economics Midterm Exam Web App - Application Engine
 * Architecture: Standalone Vanilla JavaScript (ES6+)
 */

(() => {
  'use strict';

  // --- Constants & Config ---
  const STORAGE_KEYS = {
    ANSWERS: 'econ_exam_answers_v1',
    FLAGS: 'econ_exam_flags_v1',
    TIME: 'econ_exam_time_v1',
    SUBMITTED: 'econ_exam_submitted_v1',
    THEME: 'econ_exam_theme_v1'
  };

  const DEFAULT_DURATION_SECONDS = 3 * 60 * 60; // 3 Hours (180 minutes)
  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

  // --- Application State ---
  const state = {
    questions: [],
    currentIndex: 0,
    answers: {},       // { [index]: selectedOptionIndex }
    flags: {},         // { [index]: true/false }
    timeRemaining: DEFAULT_DURATION_SECONDS,
    timerInterval: null,
    isSubmitted: false,
    paletteFilter: 'all',
    reviewFilter: 'all',
    theme: 'light'
  };

  // --- DOM Elements ---
  const DOM = {
    app: document.getElementById('app'),
    examView: document.getElementById('examView'),
    resultView: document.getElementById('resultView'),
    
    // Header
    timerDisplay: document.getElementById('timerDisplay'),
    timerCard: document.getElementById('timerCard'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    btnHeaderSubmit: document.getElementById('btnHeaderSubmit'),

    // Progress
    progressText: document.getElementById('progressText'),
    progressBarFill: document.getElementById('progressBarFill'),
    flaggedCount: document.getElementById('flaggedCount'),

    // Question Card
    qNumberBadge: document.getElementById('qNumberBadge'),
    qTopicTag: document.getElementById('qTopicTag'),
    btnFlag: document.getElementById('btnFlag'),
    flagBtnLabel: document.getElementById('flagBtnLabel'),
    btnClearAnswer: document.getElementById('btnClearAnswer'),
    questionText: document.getElementById('questionText'),
    questionDiagramWrap: document.getElementById('questionDiagramWrap'),
    questionDiagramSvg: document.getElementById('questionDiagramSvg'),
    optionsList: document.getElementById('optionsList'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),

    // Palette Sidebar
    paletteGrid: document.getElementById('paletteGrid'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    btnResetExam: document.getElementById('btnResetExam'),

    // Modal
    submitModal: document.getElementById('submitModal'),
    modalAnsweredCount: document.getElementById('modalAnsweredCount'),
    modalUnansweredCount: document.getElementById('modalUnansweredCount'),
    modalFlaggedCount: document.getElementById('modalFlaggedCount'),
    btnModalCancel: document.getElementById('btnModalCancel'),
    btnModalConfirm: document.getElementById('btnModalConfirm'),

    // Results
    scorePercent: document.getElementById('scorePercent'),
    scoreCircleFill: document.getElementById('scoreCircleFill'),
    gradeBadge: document.getElementById('gradeBadge'),
    resultFeedbackText: document.getElementById('resultFeedbackText'),
    statCorrect: document.getElementById('statCorrect'),
    statWrong: document.getElementById('statWrong'),
    statTimeSpent: document.getElementById('statTimeSpent'),
    statTotalScore: document.getElementById('statTotalScore'),
    btnScrollToReview: document.getElementById('btnScrollToReview'),
    btnRetakeExam: document.getElementById('btnRetakeExam'),

    // Review
    reviewSection: document.getElementById('reviewSection'),
    reviewCardsContainer: document.getElementById('reviewCardsContainer'),
    reviewTabs: document.querySelectorAll('.review-tab'),
    revCorrectCount: document.getElementById('revCorrectCount'),
    revWrongCount: document.getElementById('revWrongCount'),
    revFlaggedCount: document.getElementById('revFlaggedCount')
  };



  // --- Initializer ---
  async function init() {
    loadTheme();
    await loadQuestions();
    loadStateFromStorage();
    bindEvents();
    renderCurrentQuestion();
    renderPalette();
    updateProgress();

    if (state.isSubmitted) {
      showResultView();
    } else {
      startTimer();
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- Load Theme ---
  function loadTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    state.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
  }

  // --- Load Questions from data.js or all_questions.json fallback ---
  async function loadQuestions() {
    let data = null;
    if (typeof window !== 'undefined' && window.EXAM_DATA && Array.isArray(window.EXAM_DATA)) {
      data = window.EXAM_DATA;
    } else if (typeof EXAM_DATA !== 'undefined' && Array.isArray(EXAM_DATA)) {
      data = EXAM_DATA;
    }

    if (data && data.length > 0) {
      state.questions = data;
      return true;
    }

    // Fallback: try fetching all_questions.json
    try {
      const response = await fetch('all_questions.json');
      if (response.ok) {
        const jsonData = await response.json();
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          state.questions = jsonData;
          renderCurrentQuestion();
          renderPalette();
          updateProgress();
          return true;
        }
      }
    } catch (err) {
      console.warn('Fallback fetch failed:', err);
    }

    console.error('EXAM_DATA not found. Please ensure data.js is loaded.');
    return false;
  }

  // --- State Persistence (LocalStorage) ---
  function loadStateFromStorage() {
    try {
      const savedAnswers = localStorage.getItem(STORAGE_KEYS.ANSWERS);
      if (savedAnswers) state.answers = JSON.parse(savedAnswers);

      const savedFlags = localStorage.getItem(STORAGE_KEYS.FLAGS);
      if (savedFlags) state.flags = JSON.parse(savedFlags);

      const savedTime = localStorage.getItem(STORAGE_KEYS.TIME);
      if (savedTime) state.timeRemaining = parseInt(savedTime, 10);

      const savedSubmitted = localStorage.getItem(STORAGE_KEYS.SUBMITTED);
      if (savedSubmitted === 'true') state.isSubmitted = true;
    } catch (e) {
      console.warn('Could not read state from localStorage', e);
    }
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(state.answers));
      localStorage.setItem(STORAGE_KEYS.FLAGS, JSON.stringify(state.flags));
      localStorage.setItem(STORAGE_KEYS.TIME, state.timeRemaining.toString());
      localStorage.setItem(STORAGE_KEYS.SUBMITTED, state.isSubmitted ? 'true' : 'false');
    } catch (e) {
      console.warn('Could not save state to localStorage', e);
    }
  }

  // --- Timer Engine ---
  function startTimer() {
    clearInterval(state.timerInterval);
    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
      if (state.timeRemaining > 0) {
        state.timeRemaining--;
        updateTimerDisplay();
        saveStateToStorage();
      } else {
        clearInterval(state.timerInterval);
        alert('หมดเวลาการทำข้อสอบ! ระบบจะทำการส่งคำตอบอัตโนมัติ');
        submitExam();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const hrs = Math.floor(state.timeRemaining / 3600);
    const mins = Math.floor((state.timeRemaining % 3600) / 60);
    const secs = state.timeRemaining % 60;

    const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    DOM.timerDisplay.textContent = formatted;

    if (state.timeRemaining <= 300) { // Less than 5 mins
      DOM.timerCard.classList.add('urgent');
    } else {
      DOM.timerCard.classList.remove('urgent');
    }
  }

  // --- Render Question Card ---
  function renderCurrentQuestion() {
    if (!state.questions.length) return;

    const q = state.questions[state.currentIndex];
    const totalQ = state.questions.length;

    // Header info
    DOM.qNumberBadge.textContent = `ข้อที่ ${state.currentIndex + 1} (ข้อสอบจริง #${q.number})`;
    DOM.qTopicTag.textContent = q.topic || 'เศรษฐศาสตร์ทั่วไป';

    // Flag button state
    const isFlagged = !!state.flags[state.currentIndex];
    DOM.btnFlag.classList.toggle('active-flag', isFlagged);
    DOM.flagBtnLabel.textContent = isFlagged ? 'ปักหมุดแล้ว' : 'ปักหมุดทบทวน';

    // Question Text
    DOM.questionText.textContent = q.question;

    // Check Diagram / Image
    if (q.image) {
      DOM.questionDiagramSvg.innerHTML = `<img src="${q.image}" alt="รูปภาพประกอบข้อสอบข้อที่ ${q.number}" class="question-diagram-img" loading="lazy">`;
      DOM.questionDiagramWrap.style.display = 'flex';
    } else {
      DOM.questionDiagramWrap.style.display = 'none';
      DOM.questionDiagramSvg.innerHTML = '';
    }

    // Render Options
    DOM.optionsList.innerHTML = '';
    const selectedOptIndex = state.answers[state.currentIndex];

    q.options.forEach((optText, optIdx) => {
      const card = document.createElement('div');
      card.className = `option-card ${selectedOptIndex === optIdx ? 'selected' : ''}`;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', selectedOptIndex === optIdx ? 'true' : 'false');
      card.dataset.index = optIdx;

      const letter = OPTION_LETTERS[optIdx] || (optIdx + 1);

      card.innerHTML = `
        <div class="option-letter">${letter}</div>
        <div class="option-text">${optText}</div>
      `;

      card.addEventListener('click', () => selectOption(optIdx));
      DOM.optionsList.appendChild(card);
    });

    // Prev / Next button states
    DOM.btnPrev.disabled = state.currentIndex === 0;
    DOM.btnPrev.style.opacity = state.currentIndex === 0 ? '0.5' : '1';
    DOM.btnPrev.style.cursor = state.currentIndex === 0 ? 'not-allowed' : 'pointer';

    if (state.currentIndex === totalQ - 1) {
      DOM.btnNext.innerHTML = `<span>ตรวจทานและส่ง</span> <i data-lucide="check-circle-2"></i>`;
    } else {
      DOM.btnNext.innerHTML = `<span>ข้อถัดไป</span> <i data-lucide="arrow-right"></i>`;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Select Option ---
  function selectOption(optionIndex) {
    if (state.isSubmitted) return;
    state.answers[state.currentIndex] = optionIndex;
    saveStateToStorage();
    renderCurrentQuestion();
    renderPalette();
    updateProgress();
  }

  // --- Clear Answer ---
  function clearCurrentAnswer() {
    if (state.isSubmitted) return;
    delete state.answers[state.currentIndex];
    saveStateToStorage();
    renderCurrentQuestion();
    renderPalette();
    updateProgress();
  }

  // --- Toggle Flag ---
  function toggleCurrentFlag() {
    if (state.isSubmitted) return;
    state.flags[state.currentIndex] = !state.flags[state.currentIndex];
    if (!state.flags[state.currentIndex]) {
      delete state.flags[state.currentIndex];
    }
    saveStateToStorage();
    renderCurrentQuestion();
    renderPalette();
    updateProgress();
  }

  // --- Progress Updates ---
  function updateProgress() {
    const totalQ = state.questions.length;
    const answeredCount = Object.keys(state.answers).length;
    const flagCount = Object.keys(state.flags).length;
    const pct = totalQ ? Math.round((answeredCount / totalQ) * 100) : 0;

    DOM.progressText.textContent = `ความคืบหน้า: ${answeredCount} / ${totalQ} ข้อ (${pct}%)`;
    DOM.progressBarFill.style.width = `${pct}%`;
    DOM.flaggedCount.textContent = flagCount;
  }

  // --- Render Question Palette ---
  function renderPalette() {
    DOM.paletteGrid.innerHTML = '';
    const totalQ = state.questions.length;

    for (let i = 0; i < totalQ; i++) {
      const isAnswered = state.answers[i] !== undefined;
      const isFlagged = !!state.flags[i];
      const isCurrent = state.currentIndex === i;

      // Filter Check
      if (state.paletteFilter === 'unanswered' && isAnswered) continue;
      if (state.paletteFilter === 'answered' && !isAnswered) continue;
      if (state.paletteFilter === 'flagged' && !isFlagged) continue;

      const btn = document.createElement('button');
      btn.className = `palette-btn ${isAnswered ? 'answered' : ''} ${isFlagged ? 'flagged' : ''} ${isCurrent ? 'current' : ''}`;
      btn.textContent = i + 1;
      btn.title = `ไปยังข้อ ${i + 1} (${isAnswered ? 'ตอบแล้ว' : 'ยังไม่ตอบ'}${isFlagged ? ' • ปักหมุด' : ''})`;

      btn.addEventListener('click', () => {
        state.currentIndex = i;
        renderCurrentQuestion();
        renderPalette();
      });

      DOM.paletteGrid.appendChild(btn);
    }
  }

  // --- Navigation Controls ---
  function goToNext() {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      renderCurrentQuestion();
      renderPalette();
    } else {
      openSubmitModal();
    }
  }

  function goToPrev() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderCurrentQuestion();
      renderPalette();
    }
  }

  // --- Modal Logic ---
  function openSubmitModal() {
    const totalQ = state.questions.length;
    const answeredCount = Object.keys(state.answers).length;
    const unansweredCount = totalQ - answeredCount;
    const flaggedCount = Object.keys(state.flags).length;

    DOM.modalAnsweredCount.textContent = `${answeredCount} ข้อ`;
    DOM.modalUnansweredCount.textContent = `${unansweredCount} ข้อ`;
    DOM.modalFlaggedCount.textContent = `${flaggedCount} ข้อ`;

    DOM.submitModal.style.display = 'flex';
  }

  function closeSubmitModal() {
    DOM.submitModal.style.display = 'none';
  }

  // --- Submit Exam & Score Calculation ---
  function submitExam() {
    closeSubmitModal();
    clearInterval(state.timerInterval);
    state.isSubmitted = true;
    saveStateToStorage();
    showResultView();
  }

  // --- Result & Review Display ---
  function showResultView() {
    DOM.examView.style.display = 'none';
    DOM.resultView.style.display = 'block';

    const totalQ = state.questions.length;
    let correctCount = 0;
    let wrongCount = 0;

    state.questions.forEach((q, idx) => {
      const userAnsIdx = state.answers[idx];
      if (userAnsIdx !== undefined && userAnsIdx === q.correct_index) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });

    const percent = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const timeSpentSecs = DEFAULT_DURATION_SECONDS - state.timeRemaining;
    const spentMins = Math.floor(timeSpentSecs / 60);
    const spentSecs = timeSpentSecs % 60;
    const formattedSpentTime = `${String(spentMins).padStart(2, '0')}:${String(spentSecs).padStart(2, '0')}`;

    // Score Donut Stroke
    const circumference = 2 * Math.PI * 52; // ~326.7
    const offset = circumference - (percent / 100) * circumference;
    DOM.scoreCircleFill.style.strokeDashoffset = offset;
    DOM.scorePercent.textContent = `${percent}%`;

    // Stats
    DOM.statCorrect.textContent = `${correctCount}`;
    DOM.statWrong.textContent = `${wrongCount}`;
    DOM.statTimeSpent.textContent = formattedSpentTime;
    DOM.statTotalScore.textContent = `${correctCount} / ${totalQ}`;

    // Grade & Feedback
    if (percent >= 80) {
      DOM.gradeBadge.textContent = 'ยอดเยี่ยมมาก (Excellent)';
      DOM.gradeBadge.className = 'grade-badge status-correct';
      DOM.resultFeedbackText.textContent = 'คุณมีความเข้าใจหลักเศรษฐศาสตร์ในระดับดีเยี่ยม พร้อมสำหรับทุกสถานการณ์!';
    } else if (percent >= 60) {
      DOM.gradeBadge.textContent = 'ผ่านเกณฑ์มาตรฐาน (Passed)';
      DOM.gradeBadge.className = 'grade-badge status-correct';
      DOM.resultFeedbackText.textContent = 'ผ่านเกณฑ์การทดสอบอย่างน่าพอใจ สามารถศึกษาทบทวนจุดที่ผิดเพื่อเพิ่มความแม่นยำได้';
    } else {
      DOM.gradeBadge.textContent = 'ควรทบทวนเพิ่มเติม (Needs Review)';
      DOM.gradeBadge.className = 'grade-badge status-wrong';
      DOM.resultFeedbackText.textContent = 'ยังมีหลายหัวข้อที่ต้องทบทวน ลองตรวจเฉลยละเอียดด้านล่างเพื่อทำความเข้าใจเหตุผลในแต่ละข้อ';
    }

    // Counts for filter badges
    DOM.revCorrectCount.textContent = correctCount;
    DOM.revWrongCount.textContent = wrongCount;
    DOM.revFlaggedCount.textContent = Object.keys(state.flags).length;

    renderReviewCards();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Render Detailed Review Cards ---
  function renderReviewCards() {
    DOM.reviewCardsContainer.innerHTML = '';

    state.questions.forEach((q, idx) => {
      const userAnsIdx = state.answers[idx];
      const isCorrect = userAnsIdx !== undefined && userAnsIdx === q.correct_index;
      const isFlagged = !!state.flags[idx];

      // Filter Check
      if (state.reviewFilter === 'correct' && !isCorrect) return;
      if (state.reviewFilter === 'wrong' && isCorrect) return;
      if (state.reviewFilter === 'flagged' && !isFlagged) return;

      const card = document.createElement('div');
      card.className = `review-card ${isCorrect ? 'is-correct' : 'is-wrong'}`;

      const imageHtml = q.image
        ? `<div class="diagram-wrapper" style="margin-bottom: 1.25rem;"><div class="diagram-svg-box"><img src="${q.image}" alt="รูปภาพประกอบข้อสอบข้อที่ ${q.number}" class="question-diagram-img" loading="lazy"></div></div>`
        : '';

      let optionsHtml = '';
      q.options.forEach((optText, optIdx) => {
        const letter = OPTION_LETTERS[optIdx] || (optIdx + 1);
        const isThisCorrect = optIdx === q.correct_index;
        const isThisUserSelected = userAnsIdx === optIdx;

        let optClass = 'rev-opt';
        let badgeNote = '';

        if (isThisCorrect) {
          optClass += ' opt-correct';
          badgeNote = `<span style="color: var(--success-text); font-weight: bold; margin-left: auto;">✓ เฉลยที่ถูกต้อง</span>`;
        } else if (isThisUserSelected && !isThisCorrect) {
          optClass += ' opt-user-wrong';
          badgeNote = `<span style="color: var(--danger-text); font-weight: bold; margin-left: auto;">✕ คำตอบที่คุณเลือก</span>`;
        }

        optionsHtml += `
          <div class="${optClass}">
            <strong>[${letter}]</strong>
            <span>${optText}</span>
            ${badgeNote}
          </div>
        `;
      });

      card.innerHTML = `
        <div class="review-card-top">
          <div class="q-meta">
            <span class="q-number-badge">ข้อที่ ${idx + 1} (ข้อสอบ #${q.number})</span>
            <span class="q-topic-tag">${q.topic || 'เศรษฐศาสตร์ทั่วไป'}</span>
            ${isFlagged ? '<span class="flagged-badge"><i data-lucide="bookmark"></i> ปักหมุด</span>' : ''}
          </div>
          <span class="review-badge-status ${isCorrect ? 'status-correct' : 'status-wrong'}">
            <i data-lucide="${isCorrect ? 'check-circle-2' : 'x-circle'}"></i>
            <span>${isCorrect ? 'ถูกต้อง (+1 คะแนน)' : 'ไม่ถูกต้อง (0 คะแนน)'}</span>
          </span>
        </div>

        <h3 class="question-text" style="font-size: 1.1rem;">${q.question}</h3>
        ${imageHtml}

        <div class="review-options">
          ${optionsHtml}
        </div>

        <div class="rev-explanation-box">
          <strong><i data-lucide="info" style="width:16px;height:16px;display:inline-block;vertical-align:middle;"></i> คำอธิบายทางเศรษฐศาสตร์:</strong><br>
          ${q.explanation}
        </div>
      `;

      DOM.reviewCardsContainer.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Reset / Retake Exam ---
  function resetExam() {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการเริ่มทำข้อสอบใหม่ทั้งหมด? ข้อมูลคำตอบเดิมจะถูกล้าง')) {
      localStorage.removeItem(STORAGE_KEYS.ANSWERS);
      localStorage.removeItem(STORAGE_KEYS.FLAGS);
      localStorage.removeItem(STORAGE_KEYS.TIME);
      localStorage.removeItem(STORAGE_KEYS.SUBMITTED);

      state.currentIndex = 0;
      state.answers = {};
      state.flags = {};
      state.timeRemaining = DEFAULT_DURATION_SECONDS;
      state.isSubmitted = false;

      DOM.resultView.style.display = 'none';
      DOM.examView.style.display = 'grid';

      startTimer();
      renderCurrentQuestion();
      renderPalette();
      updateProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Theme toggle
    DOM.btnThemeToggle.addEventListener('click', toggleTheme);

    // Nav
    DOM.btnPrev.addEventListener('click', goToPrev);
    DOM.btnNext.addEventListener('click', goToNext);

    // Question Actions
    DOM.btnFlag.addEventListener('click', toggleCurrentFlag);
    DOM.btnClearAnswer.addEventListener('click', clearCurrentAnswer);

    // Submit
    DOM.btnHeaderSubmit.addEventListener('click', openSubmitModal);
    DOM.btnModalCancel.addEventListener('click', closeSubmitModal);
    DOM.btnModalConfirm.addEventListener('click', submitExam);

    // Palette Filter Tabs
    DOM.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        DOM.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.paletteFilter = tab.dataset.filter;
        renderPalette();
      });
    });

    // Review Filter Tabs
    DOM.reviewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        DOM.reviewTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.reviewFilter = tab.dataset.filter;
        renderReviewCards();
      });
    });

    // Reset & Retake
    DOM.btnResetExam.addEventListener('click', resetExam);
    DOM.btnRetakeExam.addEventListener('click', resetExam);

    // Scroll to review
    DOM.btnScrollToReview.addEventListener('click', () => {
      DOM.reviewSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (state.isSubmitted) return;

      // Number keys 1-4 for option selection
      if (['1', '2', '3', '4'].includes(e.key)) {
        const optIdx = parseInt(e.key, 10) - 1;
        const q = state.questions[state.currentIndex];
        if (q && q.options[optIdx]) {
          selectOption(optIdx);
        }
      }

      // Letter keys A-D
      if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        const letter = e.key.toUpperCase();
        const optIdx = OPTION_LETTERS.indexOf(letter);
        const q = state.questions[state.currentIndex];
        if (q && q.options[optIdx]) {
          selectOption(optIdx);
        }
      }

      // Navigation arrows
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      }

      // Flag shortcut (F key)
      if (e.key === 'f' || e.key === 'F') {
        toggleCurrentFlag();
      }
    });
  }

  // --- Bootstrap App on DOMContentLoaded ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
