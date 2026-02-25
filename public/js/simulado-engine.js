(function() {
    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    const params = new URLSearchParams(window.location.search);
    const slug = (params.get('slug') || '').trim();
    if (!slug) {
        window.location.href = 'simulados.html';
        return;
    }

    let currentQuestions = [];
    let userAnswers = [];
    let userAnswerStatus = [];
    let timerInterval = null;
    let startTime = null;
    let timeLimit = null;
    let simuladoConfig = {};
    let simuladoTitle = slug;
    let examsList = [];

    const configScreen = document.getElementById('config-screen');
    const simuladoScreen = document.getElementById('simulado-screen');
    const reportScreen = document.getElementById('report-screen');
    const quizContainer = document.getElementById('quiz-container');
    const startBtn = document.getElementById('start-simulado');
    const finishBtn = document.getElementById('finish-simulado');
    const newSimuladoBtn = document.getElementById('new-simulado');
    const timerDisplay = document.getElementById('timer-display');
    const currentQuestionSpan = document.getElementById('current-question');
    const totalQuestionsSpan = document.getElementById('total-questions');
    const correctCountSpan = document.getElementById('correct-count');
    const simuladoExamSpan = document.getElementById('simulado-exam');
    const customQuantity = document.getElementById('custom-quantity');
    const customTimer = document.getElementById('custom-timer');

    document.querySelectorAll('input[name="quantity"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (customQuantity) customQuantity.disabled = this.value !== 'custom';
        });
    });

    document.querySelectorAll('input[name="timer"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (customTimer) customTimer.disabled = this.value !== 'custom';
        });
    });

    async function loadSimuladoAndExams() {
        const titleEl = document.getElementById('simulado-title');
        const examOptionsEl = document.getElementById('exam-options');
        const examLoadingEl = document.getElementById('exam-options-loading');
        if (!examOptionsEl) return;

        try {
            const [simRes, examsRes] = await Promise.all([
                fetch('/api/simulados'),
                fetch('/api/simulados/' + encodeURIComponent(slug) + '/exams')
            ]);
            const simJson = await simRes.json();
            const examsJson = await examsRes.json();

            if (simJson.success && simJson.data && simJson.data.length) {
                const sim = simJson.data.find(s => (s.slug || '').trim() === slug);
                if (sim && sim.title) {
                    simuladoTitle = sim.title;
                    if (titleEl) titleEl.textContent = sim.title;
                }
            }

            if (!examsJson.success || !examsJson.exams || !examsJson.exams.length) {
                examOptionsEl.innerHTML = '<span class="config-loading">Nenhum exame disponível para este simulado.</span>';
                return;
            }

            examsList = examsJson.exams;
            const questionTypes = examsJson.question_types || ['multiple'];

            let html = '';
            examsList.forEach((exam, i) => {
                const code = (exam.code || '').trim();
                if (!code) return;
                const checked = i === 0 ? ' checked' : '';
                html += '<label class="radio-option">' +
                    '<input type="radio" name="exam" value="' + escapeHtml(code) + '"' + checked + '>' +
                    '<span>Exame ' + escapeHtml(code) + '</span></label>';
            });
            if (examsList.length > 1) {
                html += '<label class="radio-option">' +
                    '<input type="radio" name="exam" value="mixed">' +
                    '<span>Misto — todos os exames</span></label>';
            }
            if (examLoadingEl) examLoadingEl.remove();
            examOptionsEl.innerHTML = html;

            const modeMultiple = document.getElementById('mode-option-multiple');
            const modeText = document.getElementById('mode-option-text');
            const hasMultiple = questionTypes.includes('multiple');
            const hasText = questionTypes.includes('text');
            if (modeMultiple) {
                modeMultiple.classList.toggle('disabled', !hasMultiple);
                const input = modeMultiple && modeMultiple.querySelector('input[name="mode"]');
                if (input) input.disabled = !hasMultiple;
            }
            if (modeText) {
                modeText.classList.toggle('disabled', !hasText);
                const input = modeText && modeText.querySelector('input[name="mode"]');
                if (input) input.disabled = !hasText;
            }
            const firstMode = hasMultiple ? 'multiple' : (hasText ? 'text' : 'multiple');
            const checkedMode = document.querySelector('input[name="mode"]:checked');
            if (checkedMode && checkedMode.disabled) {
                const toCheck = document.querySelector('input[name="mode"][value="' + firstMode + '"]');
                if (toCheck) toCheck.checked = true;
            }
        } catch (e) {
            examOptionsEl.innerHTML = '<span class="config-loading" style="color:var(--red)">Erro ao carregar exames.</span>';
            console.error(e);
        }
    }

    (function initLoad() { loadSimuladoAndExams(); })();

    async function loadExamData(examCode) {
        try {
            const url = examCode === 'mixed'
                ? '/api/simulados/' + encodeURIComponent(slug) + '/questions'
                : '/api/simulados/' + encodeURIComponent(slug) + '/questions?exam=' + encodeURIComponent(examCode);
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Falha na API');

            function getCorrectIndex(question) {
                const opts = question.options || [];
                if (!opts.length) return null;
                if (typeof question.answer === 'number' && question.answer >= 0 && question.answer < opts.length)
                    return question.answer;
                let answerText = null;
                if (Array.isArray(question.answer) && question.answer.length)
                    answerText = String(question.answer[0]).trim();
                else if (typeof question.answer === 'string' && question.answer.trim())
                    answerText = question.answer.trim();
                if (answerText) {
                    const want = answerText.toLowerCase();
                    let idx = opts.findIndex(o => String(o).trim().toLowerCase() === want);
                    if (idx >= 0) return idx;
                    const letterIdx = 'abcdef'.indexOf(want[0]);
                    if (letterIdx >= 0 && letterIdx < opts.length) return letterIdx;
                }
                return null;
            }

            return (json.data || []).map(q => {
                const correct = q.type === 'multiple' ? getCorrectIndex(q) : null;
                const answer = q.answer;
                const answerArr = Array.isArray(answer) ? answer : (answer != null ? [String(answer)] : []);
                return {
                    id: q.id,
                    type: q.type,
                    question: q.question,
                    options: q.options || [],
                    answer: answerArr,
                    correct,
                    difficulty: q.difficulty,
                    hint: q.hint,
                    weight: q.weight || 1
                };
            });
        } catch (e) {
            alert('Erro ao carregar questões. Verifique o console.');
            console.error(e);
            return [];
        }
    }

    function selectQuestions(pool, config) {
        const examCode = config.exam;
        const examLabel = examCode === 'mixed'
            ? 'Misto — todos'
            : 'Exame ' + examCode;
        if (simuladoExamSpan) simuladoExamSpan.textContent = examLabel;

        let poolFiltered = pool;
        if (config.mode !== 'mixed') {
            poolFiltered = pool.filter(q => q.type === config.mode);
        }

        let quantity = poolFiltered.length;
        if (config.quantity === 'custom' && customQuantity) {
            quantity = Math.min(Math.max(1, parseInt(customQuantity.value, 10) || 50), poolFiltered.length);
        }

        let selected = shuffleArray([...poolFiltered]);
        selected = selected.slice(0, quantity);
        return selected;
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async function startSimulado() {
        const examRadio = document.querySelector('input[name="exam"]:checked');
        if (!examRadio) {
            alert('Selecione um exame.');
            return;
        }
        const examCode = examRadio.value;

        startBtn.disabled = true;
        startBtn.textContent = '⏳ Carregando...';

        const allQuestions = await loadExamData(examCode);

        if (!allQuestions.length) {
            startBtn.disabled = false;
            startBtn.textContent = '🚀 Iniciar Simulado';
            return;
        }

        simuladoConfig = {
            exam: examCode,
            mode: (document.querySelector('input[name="mode"]:checked') || {}).value || 'multiple',
            quantity: (document.querySelector('input[name="quantity"]:checked') || {}).value || 'all',
            timer: (document.querySelector('input[name="timer"]:checked') || {}).value || 'none'
        };

        currentQuestions = selectQuestions(allQuestions, simuladoConfig);
        if (customQuantity) customQuantity.max = String(allQuestions.length);

        startBtn.disabled = false;
        startBtn.textContent = '🚀 Iniciar Simulado';

        userAnswers = new Array(currentQuestions.length).fill(null);
        userAnswerStatus = new Array(currentQuestions.length).fill(null);

        if (simuladoConfig.timer === '60') {
            timeLimit = 60 * 60;
        } else if (simuladoConfig.timer === 'custom' && customTimer) {
            timeLimit = (parseInt(customTimer.value, 10) || 60) * 60;
        } else {
            timeLimit = null;
        }

        startTime = Date.now();
        if (totalQuestionsSpan) totalQuestionsSpan.textContent = currentQuestions.length;
        updateTimer();
        renderQuiz();
        configScreen.classList.add('hidden');
        simuladoScreen.classList.remove('hidden');
        reportScreen.classList.add('hidden');
    }

    function renderQuiz() {
        if (!quizContainer) return;
        quizContainer.innerHTML = '';

        currentQuestions.forEach((q, index) => {
            const card = document.createElement('div');
            card.className = 'question-card';
            card.id = 'q-' + index;

            const header = document.createElement('div');
            header.className = 'question-header';
            const title = document.createElement('div');
            title.className = 'question-title';
            const badge = document.createElement('span');
            badge.className = q.type === 'text' ? 'question-type-badge text' : 'question-type-badge';
            badge.textContent = q.type === 'text' ? '✏️ Digitação' : '✅ Múltipla';
            title.innerHTML = (index + 1) + '. ' + escapeHtml(q.question) + ' ';
            title.appendChild(badge);
            header.appendChild(title);
            card.appendChild(header);

            if (q.type === 'text') {
                const container = document.createElement('div');
                container.className = 'text-input-container';
                if (q.hint) {
                    const hintDiv = document.createElement('div');
                    hintDiv.className = 'text-hint';
                    hintDiv.innerHTML = '💡 Dica: ' + escapeHtml(q.hint);
                    container.appendChild(hintDiv);
                }
                const inputRow = document.createElement('div');
                inputRow.className = 'text-input-row';
                const input = document.createElement('input');
                input.type = 'text';
                input.id = 'text-input-' + index;
                input.placeholder = 'Digite o comando ou resposta...';
                input.autocomplete = input.autocorrect = input.autocapitalize = 'off';
                input.spellcheck = false;
                input.disabled = userAnswerStatus[index] !== null;
                if (userAnswers[index]) input.value = userAnswers[index];
                const button = document.createElement('button');
                button.textContent = 'Responder';
                button.className = 'text-submit-btn';
                button.dataset.index = String(index);
                button.disabled = userAnswerStatus[index] !== null;
                button.addEventListener('click', handleTextSubmit);
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !button.disabled) button.click();
                });
                inputRow.appendChild(input);
                inputRow.appendChild(button);
                container.appendChild(inputRow);
                card.appendChild(container);
            } else {
                const optionsDiv = document.createElement('div');
                optionsDiv.className = 'options';
                (q.options || []).forEach((opt, optIndex) => {
                    const optDiv = document.createElement('div');
                    optDiv.className = 'option';
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'q-' + index;
                    radio.value = optIndex;
                    radio.dataset.index = String(index);
                    radio.dataset.optIndex = String(optIndex);
                    radio.addEventListener('change', handleOptionSelect);
                    radio.disabled = userAnswerStatus[index] !== null;
                    if (userAnswers[index] === optIndex) radio.checked = true;
                    const label = document.createElement('span');
                    label.innerText = String.fromCharCode(65 + optIndex) + ') ' + opt;
                    optDiv.appendChild(radio);
                    optDiv.appendChild(label);
                    optionsDiv.appendChild(optDiv);
                });
                card.appendChild(optionsDiv);
            }

            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'feedback';
            feedbackDiv.id = 'fb-' + index;
            card.appendChild(feedbackDiv);
            quizContainer.appendChild(card);
        });

        updateAllCards();
        updateProgress();
    }

    function handleOptionSelect(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const selectedValue = parseInt(event.target.value, 10);
        const q = currentQuestions[index];
        const isCorrect = (q.correct != null && selectedValue === q.correct);
        userAnswers[index] = selectedValue;
        userAnswerStatus[index] = isCorrect ? 'correct' : 'incorrect';
        updateSingleCard(index);
        updateScoreAndProgress();
    }

    function handleTextSubmit(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const input = document.getElementById('text-input-' + index);
        const userAnswer = (input && input.value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!userAnswer) {
            if (input) input.focus();
            return;
        }
        const q = currentQuestions[index];
        const accepted = (q.answer || []).map(a => String(a).trim().toLowerCase().replace(/\s+/g, ' '));
        const isCorrect = accepted.includes(userAnswer);
        userAnswers[index] = (input && input.value || '').trim();
        userAnswerStatus[index] = isCorrect ? 'correct' : 'incorrect';
        if (input) input.disabled = true;
        event.target.disabled = true;
        updateSingleCard(index);
        updateScoreAndProgress();
    }

    function updateSingleCard(index) {
        const card = document.getElementById('q-' + index);
        const feedbackDiv = document.getElementById('fb-' + index);
        if (!card || !feedbackDiv) return;
        const q = currentQuestions[index];
        const status = userAnswerStatus[index];
        card.classList.remove('correct', 'incorrect');
        if (status === 'correct') {
            card.classList.add('correct');
            feedbackDiv.className = 'feedback correct-feedback';
            if (q.type === 'text') {
                feedbackDiv.innerText = '✓ Correto! (Sua resposta: ' + (userAnswers[index] || '') + ')';
            } else {
                feedbackDiv.innerText = '✓ Correto! (Sua resposta: ' + String.fromCharCode(65 + (userAnswers[index] ?? 0)) + ')';
            }
        } else if (status === 'incorrect') {
            card.classList.add('incorrect');
            if (q.type === 'text') {
                feedbackDiv.className = 'feedback incorrect-feedback';
                feedbackDiv.innerText = '✗ Incorreto. Resposta(s) aceita(s): ' + (q.answer || []).join(' ou ');
            } else {
                const optionsDiv = card.querySelector('.options');
                const optionDivs = optionsDiv ? optionsDiv.querySelectorAll('.option') : [];
                optionDivs.forEach((opt, i) => opt.classList.remove('correct-answer', 'wrong-answer'));
                if (q.correct != null && optionDivs[q.correct]) optionDivs[q.correct].classList.add('correct-answer');
                const selectedIdx = userAnswers[index];
                if (selectedIdx != null && selectedIdx !== q.correct && optionDivs[selectedIdx]) optionDivs[selectedIdx].classList.add('wrong-answer');
                feedbackDiv.className = 'feedback incorrect-feedback';
                feedbackDiv.innerText = q.correct != null && q.options && q.options[q.correct] != null
                    ? '✗ Incorreto. A correta é ' + String.fromCharCode(65 + q.correct) + ': ' + q.options[q.correct]
                    : '✗ Incorreto.';
            }
        }
        if (status !== null) {
            const opts = card.querySelector('.options');
            if (opts) opts.querySelectorAll('input').forEach(inp => { inp.disabled = true; });
        }
    }

    function updateAllCards() {
        for (let i = 0; i < currentQuestions.length; i++) {
            if (userAnswerStatus[i]) updateSingleCard(i);
        }
    }

    function updateScoreAndProgress() {
        const correctCount = userAnswerStatus.filter(s => s === 'correct').length;
        if (correctCountSpan) correctCountSpan.textContent = correctCount;
        const answered = userAnswerStatus.filter(s => s !== null).length;
        if (currentQuestionSpan) currentQuestionSpan.textContent = answered;
    }

    function updateTimer() {
        if (!startTime) return;
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        let displaySeconds = elapsed;
        if (timeLimit) {
            const remaining = timeLimit - elapsed;
            if (remaining <= 0) {
                finishSimulado();
                return;
            }
            displaySeconds = remaining;
            if (timerDisplay) {
                if (remaining < 300) timerDisplay.classList.add('warning');
                else timerDisplay.classList.remove('warning');
            }
        }
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        if (timerDisplay) timerDisplay.textContent = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }

    function saveSessionToStorage(sessionData) {
        try {
            const key = 'linuxgeek_progress';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push(sessionData);
            if (existing.length > 200) existing.shift();
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {}
        if (typeof window.saveProgressToCloud === 'function') {
            window.saveProgressToCloud(sessionData);
        }
    }

    function finishSimulado() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        const correctCount = userAnswerStatus.filter(s => s === 'correct').length;
        const total = currentQuestions.length;
        const score = total ? Math.round((correctCount / total) * 100) : 0;
        const sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString();
        saveSessionToStorage({
            id: sessionId,
            simulado: slug,
            simuladoLabel: simuladoTitle,
            exam: simuladoConfig.exam,
            mode: simuladoConfig.mode,
            date: new Date().toISOString().split('T')[0],
            dateTimestamp: Date.now(),
            duration: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
            total,
            correct: correctCount,
            wrong: userAnswerStatus.filter(s => s === 'incorrect').length,
            score,
            passed: score >= 70,
            topicsStats: {},
            weakTopics: []
        });
        showReport();
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m + 'min ' + s + 's';
    }

    function showReport() {
        const correctCount = userAnswerStatus.filter(s => s === 'correct').length;
        const totalCount = currentQuestions.length;
        const score = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
        const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

        const resultCorrect = document.getElementById('result-correct');
        const resultWrong = document.getElementById('result-wrong');
        const resultTotalInfo = document.getElementById('result-total-info');
        const resultTime = document.getElementById('result-time');
        const resultPct = document.getElementById('result-pct');
        const resultBar = document.getElementById('result-bar');
        const resultPassLabel = document.getElementById('result-pass-label');
        if (resultCorrect) resultCorrect.textContent = correctCount;
        if (resultWrong) resultWrong.textContent = userAnswerStatus.filter(s => s === 'incorrect').length;
        if (resultTotalInfo) resultTotalInfo.textContent = correctCount + '/' + totalCount + ' questões';
        if (resultTime) resultTime.textContent = formatTime(elapsed);
        if (resultPct) resultPct.textContent = score + '%';
        if (resultBar) {
            resultBar.style.width = score + '%';
            resultBar.className = 'result-bar-fill ' + (score >= 70 ? 'pass' : 'fail');
        }
        if (resultPassLabel) {
            resultPassLabel.textContent = score >= 70 ? '🎉 Aprovado!' : '📚 Continue praticando';
            resultPassLabel.className = 'result-pass-label ' + (score >= 70 ? 'pass' : 'fail');
        }
        simuladoScreen.classList.add('hidden');
        reportScreen.classList.remove('hidden');
    }

    function backToConfig() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        configScreen.classList.remove('hidden');
        simuladoScreen.classList.add('hidden');
        reportScreen.classList.add('hidden');
    }

    startBtn.addEventListener('click', startSimulado);
    if (finishBtn) finishBtn.addEventListener('click', finishSimulado);
    if (newSimuladoBtn) newSimuladoBtn.addEventListener('click', backToConfig);
    const newSimuladoBtn2 = document.getElementById('new-simulado-btn');
    if (newSimuladoBtn2) {
        newSimuladoBtn2.addEventListener('click', () => {
            window.location.href = 'simulados.html';
        });
    }

    setInterval(function() {
        if (simuladoScreen && !simuladoScreen.classList.contains('hidden') && startTime) {
            updateTimer();
            updateProgress();
        }
    }, 1000);

    function updateProgress() {}
})();
