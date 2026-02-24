        (function() {
            function escapeHtml(text) {
                if (text == null) return '';
                const div = document.createElement('div');
                div.textContent = String(text);
                return div.innerHTML;
            }

            // Estado global da aplicação
            let currentQuestions = [];
            let userAnswers = [];
            let userAnswerStatus = [];
            let timerInterval = null;
            let startTime = null;
            let timeLimit = null;
            let simuladoConfig = {};

            // Elementos DOM
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
            // Controles de quantidade
            const customQuantity = document.getElementById('custom-quantity');
            const customTimer = document.getElementById('custom-timer');
            const showFeedbackCheck = document.getElementById('show-feedback');

            // Event listeners para habilitar/desabilitar campos personalizados
            document.querySelectorAll('input[name="quantity"]').forEach(radio => {
                radio.addEventListener('change', function() {
                    customQuantity.disabled = this.value !== 'custom';
                });
            });

            document.querySelectorAll('input[name="timer"]').forEach(radio => {
                radio.addEventListener('change', function() {
                    customTimer.disabled = this.value !== 'custom';
                });
            });

            // Dashboard: puxar título do simulado da API (slug desta página = lpic1)
            (async function loadSimuladoInfo() {
                try {
                    const res = await fetch('/api/simulados');
                    const json = await res.json();
                    if (json.success && json.data && json.data.length) {
                        const slug = 'lpic1';
                        const sim = json.data.find(s => s.slug === slug);
                        if (sim && sim.title) {
                            const el = document.getElementById('simulado-title');
                            if (el) el.textContent = sim.title;
                        }
                    }
                } catch (_) {}
            })();

            async function loadExamData(examCode) {
                try {
                    const url = examCode === 'mixed'
                        ? '/api/simulados/lpic1/questions'
                        : `/api/simulados/lpic1/questions?exam=${examCode}`;

                    const res = await fetch(url);
                    const json = await res.json();

                    if (!json.success) throw new Error(json.error);

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
                            if (want.length === 1 || (want.length === 2 && want[1] === '.')) {
                                const letterIdx = 'abcdef'.indexOf(want[0]);
                                if (letterIdx >= 0 && letterIdx < opts.length) return letterIdx;
                            }
                        }
                        return null;
                    }

                    return json.data.map(q => {
                        const correct = q.type === 'multiple' ? getCorrectIndex(q) : null;
                        return {
                            id: q.id,
                            type: q.type,
                            question: q.question,
                            options: q.options || [],
                            answer: q.answer,
                            correct,
                            difficulty: q.difficulty,
                            hint: q.hint,
                            weight: q.weight || 1
                        };
                    });
                } catch (e) {
                    alert('Erro ao carregar questões. Verifique o console para mais detalhes.');
                    console.error(e);
                    return [];
                }
            }

            // Selecionar questões baseado na configuração (pool = questões já carregadas da API)
            function selectQuestions(pool, config) {
                if (config.exam === '101') {
                    simuladoExamSpan.textContent = 'Exame 101';
                } else if (config.exam === '102') {
                    simuladoExamSpan.textContent = 'Exame 102';
                } else {
                    simuladoExamSpan.textContent = 'Exame 101 + 102 (Misto)';
                }

                // Filtrar por tipo de questão
                if (config.mode !== 'mixed') {
                    pool = pool.filter(q => q.type === config.mode);
                }

                // Determinar quantidade
                let quantity = 60; // default
                if (config.quantity === 'all') {
                    quantity = pool.length;
                } else if (config.quantity === 'custom') {
                    quantity = Math.min(parseInt(customQuantity.value) || 60, pool.length);
                } else {
                    quantity = parseInt(config.quantity) || 60;
                }

                // Sempre embaralhar questões ao iniciar o simulado
                let selected = shuffleArray([...pool]);
                selected = selected.slice(0, quantity);

                return selected;
            }

            // Embaralhar array
            function shuffleArray(array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            }

            // Iniciar simulado
            async function startSimulado() {
                const examCode = document.querySelector('input[name="exam"]:checked').value;

                // Mostrar loading
                startBtn.disabled = true;
                startBtn.textContent = '⏳ Carregando...';

                const allQuestions = await loadExamData(examCode);

                if (!allQuestions.length) {
                    startBtn.disabled = false;
                    startBtn.textContent = '🚀 Iniciar Simulado';
                    return;
                }

                // Coletar configurações
                simuladoConfig = {
                    exam: examCode,
                    mode: document.querySelector('input[name="mode"]:checked').value,
                    quantity: document.querySelector('input[name="quantity"]:checked').value,
                    timer: document.querySelector('input[name="timer"]:checked').value
                };

                currentQuestions = selectQuestions(allQuestions, simuladoConfig);

                startBtn.disabled = false;
                startBtn.textContent = '🚀 Iniciar Simulado';

                // Inicializar arrays de respostas
                userAnswers = new Array(currentQuestions.length).fill(null);
                userAnswerStatus = new Array(currentQuestions.length).fill(null);
                
                // Configurar timer
                if (simuladoConfig.timer === '60') {
                    timeLimit = 60 * 60; // 60 minutos em segundos
                } else if (simuladoConfig.timer === 'custom') {
                    timeLimit = (parseInt(customTimer.value) || 60) * 60;
                } else {
                    timeLimit = null;
                }
                
                startTime = Date.now();
                
                // Atualizar interface
                totalQuestionsSpan.textContent = currentQuestions.length;
                updateTimer();
                
                // Renderizar questões
                renderQuiz();
                
                // Mostrar tela do simulado
                configScreen.classList.add('hidden');
                simuladoScreen.classList.remove('hidden');
                reportScreen.classList.add('hidden');
            }

            // Renderizar questões
            function renderQuiz() {
                quizContainer.innerHTML = '';
                
                currentQuestions.forEach((q, index) => {
                    const card = document.createElement('div');
                    card.className = 'question-card';
                    card.id = `q-${index}`;

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
                        // Renderizar input de texto
                        const container = document.createElement('div');
                        container.className = 'text-input-container';
                        
                        // Dica se existir
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
                        input.id = `text-input-${index}`;
                        input.placeholder = 'Digite o comando ou resposta...';
                        input.autocomplete = 'off';
                        input.autocorrect = 'off';
                        input.autocapitalize = 'off';
                        input.spellcheck = false;
                        input.disabled = userAnswerStatus[index] !== null;
                        if (userAnswers[index]) {
                            input.value = userAnswers[index];
                        }
                        
                        const button = document.createElement('button');
                        button.textContent = 'Responder';
                        button.className = 'text-submit-btn';
                        button.dataset.index = index;
                        button.disabled = userAnswerStatus[index] !== null;
                        button.addEventListener('click', handleTextSubmit);

                        // Permitir Enter para submeter
                        input.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter' && !button.disabled) {
                                button.click();
                            }
                        });
                        
                        inputRow.appendChild(input);
                        inputRow.appendChild(button);
                        container.appendChild(inputRow);
                        card.appendChild(container);
                    } else {
                        // Renderizar opções de múltipla escolha
                        const optionsDiv = document.createElement('div');
                        optionsDiv.className = 'options';

                        q.options.forEach((opt, optIndex) => {
                            const optDiv = document.createElement('div');
                            optDiv.className = 'option';

                            const radio = document.createElement('input');
                            radio.type = 'radio';
                            radio.name = `q-${index}`;
                            radio.value = optIndex;
                            radio.dataset.index = index;
                            radio.dataset.optIndex = optIndex;
                            radio.addEventListener('change', handleOptionSelect);
                            radio.disabled = userAnswerStatus[index] !== null;

                            if (userAnswers[index] === optIndex) {
                                radio.checked = true;
                            }

                            const label = document.createElement('span');
                            label.innerText = `${String.fromCharCode(65 + optIndex)}) ${opt}`;

                            optDiv.appendChild(radio);
                            optDiv.appendChild(label);
                            optionsDiv.appendChild(optDiv);
                        });

                        card.appendChild(optionsDiv);
                    }

                    const feedbackDiv = document.createElement('div');
                    feedbackDiv.className = 'feedback';
                    feedbackDiv.id = `fb-${index}`;
                    card.appendChild(feedbackDiv);

                    quizContainer.appendChild(card);
                });
                
                updateAllCards();
                updateProgress();
            }

            // Manipular seleção de múltipla escolha
            function handleOptionSelect(event) {
                const index = parseInt(event.target.dataset.index);
                const selectedValue = parseInt(event.target.value);
                
                const q = currentQuestions[index];
                const isCorrect = (q.correct != null && selectedValue === q.correct);
                
                userAnswers[index] = selectedValue;
                userAnswerStatus[index] = isCorrect ? 'correct' : 'incorrect';
                
                if (!showFeedbackCheck || showFeedbackCheck.checked) {
                    updateSingleCard(index);
                }
                
                updateScoreAndProgress();
            }

            // Manipular submissão de texto
            function handleTextSubmit(event) {
                const index = parseInt(event.target.dataset.index);
                const input = document.getElementById(`text-input-${index}`);
                const userAnswer = input.value.trim().toLowerCase().replace(/\s+/g, ' ');
                
                if (!userAnswer) {
                    input.focus();
                    return;
                }
                
                const q = currentQuestions[index];
                
                // Verificar resposta: comparar com todas as respostas aceitas (case-insensitive, espaços normalizados)
                const accepted = (q.answer || []).map(a => a.trim().toLowerCase().replace(/\s+/g, ' '));
                const isCorrect = accepted.includes(userAnswer);
                
                userAnswers[index] = input.value.trim();
                userAnswerStatus[index] = isCorrect ? 'correct' : 'incorrect';
                
                input.disabled = true;
                event.target.disabled = true;
                
                if (!showFeedbackCheck || showFeedbackCheck.checked) {
                    updateSingleCard(index);
                }
                
                updateScoreAndProgress();
            }

            // Atualizar um único cartão
            function updateSingleCard(index) {
                const card = document.getElementById(`q-${index}`);
                const feedbackDiv = document.getElementById(`fb-${index}`);
                if (!card || !feedbackDiv) return;

                const q = currentQuestions[index];
                const status = userAnswerStatus[index];
                
                card.classList.remove('correct', 'incorrect');

                if (status === 'correct') {
                    card.classList.add('correct');
                    if (q.type === 'text') {
                        feedbackDiv.className = 'feedback correct-feedback';
                        feedbackDiv.innerText = `✓ Correto! (Sua resposta: ${userAnswers[index]})`;
                    } else {
                        feedbackDiv.className = 'feedback correct-feedback';
                        const answerIndex = userAnswers[index];
                        feedbackDiv.innerText = `✓ Correto! (Sua resposta: ${String.fromCharCode(65 + answerIndex)})`;
                    }
                } else if (status === 'incorrect') {
                    card.classList.add('incorrect');
                    if (q.type === 'text') {
                        feedbackDiv.className = 'feedback incorrect-feedback';
                        const accepted = (q.answer || []).join(' ou ');
                        feedbackDiv.innerText = `✗ Incorreto. Sua resposta: "${userAnswers[index]}". Resposta(s) aceita(s): ${accepted}`;
                    } else {
                        const optionsDiv = card.querySelector('.options');
                        const optionDivs = optionsDiv ? optionsDiv.querySelectorAll('.option') : [];
                        if (q.correct != null && q.correct >= 0 && optionDivs[q.correct]) {
                            optionDivs[q.correct].classList.add('correct-answer');
                        }
                        feedbackDiv.className = 'feedback incorrect-feedback';
                        if (q.correct != null && q.options && q.options[q.correct] != null) {
                            feedbackDiv.innerText = `✗ Incorreto. A correta é ${String.fromCharCode(65 + q.correct)}: ${q.options[q.correct]}`;
                        } else {
                            feedbackDiv.innerText = '✗ Incorreto.';
                        }
                    }
                }
            }

            // Atualizar todos os cartões
            function updateAllCards() {
                for (let i = 0; i < currentQuestions.length; i++) {
                    if (userAnswerStatus[i]) {
                        updateSingleCard(i);
                    }
                }
            }

            // Atualizar pontuação e progresso
            function updateScoreAndProgress() {
                const correctCount = userAnswerStatus.filter(s => s === 'correct').length;
                const answered = userAnswerStatus.filter(s => s !== null).length;
                
                correctCountSpan.textContent = correctCount;
                currentQuestionSpan.textContent = answered;
            }

            // Atualizar timer
            function updateTimer() {
                if (!startTime) return;
                
                const now = Date.now();
                const elapsed = Math.floor((now - startTime) / 1000);
                
                let displaySeconds = elapsed;
                if (timeLimit) {
                    const remaining = timeLimit - elapsed;
                    if (remaining <= 0) {
                        // Tempo esgotado
                        finishSimulado();
                        return;
                    }
                    displaySeconds = remaining;
                    
                    // Aviso quando faltam 5 minutos
                    if (remaining < 300) {
                        timerDisplay.classList.add('warning');
                    } else {
                        timerDisplay.classList.remove('warning');
                    }
                }
                
                const minutes = Math.floor(displaySeconds / 60);
                const seconds = displaySeconds % 60;
                timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            // Salvar sessão no localStorage e na nuvem (Supabase) para Meu Progresso por usuário
            function saveSessionToStorage(sessionData) {
                try {
                    const key = 'linuxgeek_progress';
                    const existing = JSON.parse(localStorage.getItem(key) || '[]');
                    existing.push(sessionData);
                    if (existing.length > 200) existing.shift();
                    localStorage.setItem(key, JSON.stringify(existing));
                    console.log('[Simulado] Sessão salva no dispositivo (localStorage). Total:', existing.length);
                } catch (e) {
                    console.warn('Não foi possível salvar progresso:', e);
                }
                if (typeof window.saveProgressToCloud === 'function') {
                    window.saveProgressToCloud(sessionData);
                } else {
                    console.warn('[Simulado] saveProgressToCloud não disponível. Abra o Console (F12) e recarregue a página do simulado antes de finalizar.');
                }
            }

            // Finalizar simulado e mostrar relatório
            function finishSimulado() {
                console.log('[Simulado] Finalizar clicado — salvando resultado...');
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                
                // Salvar sessão para a página Meu Progresso
                const correctCount = userAnswerStatus.filter(s => s === 'correct').length;
                const total = currentQuestions.length;
                const score = total ? Math.round((correctCount / total) * 100) : 0;
                const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
                saveSessionToStorage({
                    id: sessionId,
                    simulado: 'lpic1',
                    simuladoLabel: 'LPIC-1',
                    exam: simuladoConfig.exam,
                    mode: simuladoConfig.mode,
                    date: new Date().toISOString().split('T')[0],
                    dateTimestamp: Date.now(),
                    duration: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
                    total: total,
                    correct: correctCount,
                    wrong: userAnswerStatus.filter(s => s === 'incorrect').length,
                    score: score,
                    passed: score >= 70,
                    topicsStats: {},
                    weakTopics: []
                });
                
                // Mostrar relatório
                showReport();
            }

            function formatTime(seconds) {
                const m = Math.floor(seconds / 60);
                const s = seconds % 60;
                return `${m}min ${s}s`;
            }

            // Mostrar relatório
            function showReport() {
                const correctCount = userAnswerStatus.filter(s => s === 'correct').length;
                const totalCount = currentQuestions.length;
                const wrongCount = userAnswerStatus.filter(s => s === 'incorrect').length;
                const score = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
                const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

                document.getElementById('result-correct').textContent = correctCount;
                document.getElementById('result-wrong').textContent = wrongCount;
                document.getElementById('result-total-info').textContent = `${correctCount}/${totalCount} questões`;
                document.getElementById('result-time').textContent = formatTime(elapsed);
                document.getElementById('result-pct').textContent = `${score}%`;
                document.getElementById('result-bar').style.width = `${score}%`;
                document.getElementById('result-bar').className = `result-bar-fill ${score >= 70 ? 'pass' : 'fail'}`;
                const passLabel = document.getElementById('result-pass-label');
                passLabel.textContent = score >= 70 ? '🎉 Aprovado!' : '📚 Continue praticando';
                passLabel.className = `result-pass-label ${score >= 70 ? 'pass' : 'fail'}`;

                simuladoScreen.classList.add('hidden');
                reportScreen.classList.remove('hidden');
            }

            // Resetar para nova configuração
            function backToConfig() {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                
                configScreen.classList.remove('hidden');
                simuladoScreen.classList.add('hidden');
                reportScreen.classList.add('hidden');
            }

            // Revisar questões erradas
            function reviewErrors() {
                // Filtrar apenas questões erradas
                const wrongQuestions = currentQuestions.filter((_, index) => 
                    userAnswerStatus[index] === 'incorrect'
                );
                
                if (wrongQuestions.length === 0) {
                    alert('Parabéns! Você não errou nenhuma questão.');
                    return;
                }
                
                // Implementar revisão
                alert(`Funcionalidade de revisão será implementada em breve. Você errou ${wrongQuestions.length} questões.`);
            }

            // Inicialização
            // Event listeners
            startBtn.addEventListener('click', startSimulado);
            finishBtn.addEventListener('click', finishSimulado);
            newSimuladoBtn.addEventListener('click', backToConfig);
            document.getElementById('new-simulado-btn').addEventListener('click', () => {
                window.location.href = 'index.html';
            });

            // Atualizar timer a cada segundo
            setInterval(() => {
                if (!simuladoScreen.classList.contains('hidden') && startTime) {
                    updateTimer();
                    updateProgress();
                }
            }, 1000);

            function updateProgress() {
                // Já implementado em updateScoreAndProgress
            }
        })();
