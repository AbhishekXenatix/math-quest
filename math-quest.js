(function () {
  const TIME_LIMIT = 20;
  let currentClass = null;
  let correctAnswer = null;
  let currentQuestion = "";
  let timeLeft = TIME_LIMIT;
  let timerId = null;
  let score = 0;
  let history = [];
  let locked = true;

  const qText = document.getElementById('qText');
  const optionsGrid = document.getElementById('optionsGrid');
  const timerText = document.getElementById('timerText');
  const scoreText = document.getElementById('scoreText');
  const torchFill = document.getElementById('torchFill');
  const newQBtn = document.getElementById('newQBtn');
  const submitBtn = document.getElementById('submitBtn');
  const feedback = document.getElementById('feedback');
  const solutionBox = document.getElementById('solution');
  const chestZone = document.getElementById('chestZone');
  const trail = document.getElementById('trail');

  document.querySelectorAll('.class-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.class-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentClass = chip.dataset.class;
      startNewQuestion();
    });
  });

  newQBtn.addEventListener('click', startNewQuestion);
  submitBtn.addEventListener('click', () => lockIn(getSelected()));

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function distractors(correctVal, count) {
    const out = new Set();
    let tries = 0;
    while (out.size < count && tries < 60) {
      tries++;
      const offset = [1,2,3,5,10][randInt(0,4)] * (Math.random() < 0.5 ? -1 : 1);
      const val = correctVal + offset;
      if (val !== correctVal) out.add(String(val));
    }
    return Array.from(out);
  }

  function genArithmetic(level) {
    let a, b, op, text, result;
    if (level === "3") {
      a = randInt(1, 20); b = randInt(1, 20);
      op = ["+", "-", "×"][randInt(0, 2)];
    } else {
      a = randInt(10, 100); b = randInt(2, 12);
      op = ["+", "-", "×", "÷"][randInt(0, 3)];
      if (op === "÷") a = a * b;
    }
    switch (op) {
      case "+": result = a + b; break;
      case "-": result = a - b; break;
      case "×": result = a * b; break;
      case "÷": result = a / b; break;
    }
    text = `${a} ${op} ${b}`;
    const solutionSteps = `Step 1: Compute ${text}\nStep 2: Result = ${result}`;
    return { text, correct: String(result), solutionSteps };
  }

  function genLinear() {
    const root = randInt(-10, 10);
    const coeff = randInt(1, 9);
    const cnst = randInt(-20, 20);
    const rhs = coeff * root + cnst;
    const cnstStr = cnst >= 0 ? `+ ${cnst}` : `- ${Math.abs(cnst)}`;
    const text = `${coeff}x ${cnstStr} = ${rhs}`;
    const solutionSteps =
      `Step 1: ${coeff}x = ${rhs} ${cnst >= 0 ? "-" : "+"} ${Math.abs(cnst)}\n` +
      `Step 2: ${coeff}x = ${rhs - cnst}\n` +
      `Step 3: x = ${root}`;
    return { text, correct: String(root), solutionSteps };
  }

  function genQuadratic() {
    const r1 = randInt(-8, 8);
    const r2 = randInt(-8, 8);
    const b = -(r1 + r2);
    const c = r1 * r2;
    const bStr = b >= 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`;
    const cStr = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
    const text = `x² ${bStr} ${cStr} = 0`;
    const roots = [r1, r2].sort((x, y) => x - y);
    const correct = roots.join(", ");
    const solutionSteps =
      `Step 1: Factor -> (x - ${r1})(x - ${r2}) = 0\n` +
      `Step 2: Set each factor to zero\n` +
      `Step 3: x = ${correct}`;
    return { text, correct, solutionSteps };
  }

  function genQuadraticDistractor() {
    const r1 = randInt(-8, 8), r2 = randInt(-8, 8);
    return [r1, r2].sort((x, y) => x - y).join(", ");
  }

  function buildQuestion(level) {
    if (level === "3" || level === "5") {
      const q = genArithmetic(level);
      const opts = shuffle([...distractors(Number(q.correct), 3), q.correct]);
      return { ...q, options: opts };
    } else if (level === "8") {
      const q = genLinear();
      const opts = shuffle([...distractors(Number(q.correct), 3), q.correct]);
      return { ...q, options: opts };
    } else {
      const q = genQuadratic();
      const opts = new Set([q.correct]);
      let tries = 0;
      while (opts.size < 4 && tries < 60) {
        tries++;
        opts.add(genQuadraticDistractor());
      }
      return { ...q, options: shuffle(Array.from(opts)) };
    }
  }

  let currentSolution = "";

  function startNewQuestion() {
    if (!currentClass) return;
    clearInterval(timerId);
    const q = buildQuestion(currentClass);
    currentQuestion = q.text;
    correctAnswer = q.correct;
    currentSolution = q.solutionSteps;

    qText.textContent = q.text;
    renderOptions(q.options);
    feedback.textContent = "";
    solutionBox.classList.remove('show');
    solutionBox.textContent = "";
    chestZone.innerHTML = "";
    locked = false;
    submitBtn.disabled = true;

    timeLeft = TIME_LIMIT;
    updateTorch();
    timerId = setInterval(tick, 1000);
  }

  function renderOptions(options) {
    optionsGrid.innerHTML = "";
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.textContent = opt;
      btn.dataset.value = opt;
      btn.addEventListener('click', () => selectOption(btn));
      optionsGrid.appendChild(btn);
    });
  }

  function selectOption(btn) {
    if (locked) return;
    document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    submitBtn.disabled = false;
  }

  function getSelected() {
    const sel = document.querySelector('.opt-btn.selected');
    return sel ? sel.dataset.value : null;
  }

  function tick() {
    timeLeft -= 1;
    updateTorch();
    if (timeLeft <= 0) {
      clearInterval(timerId);
      lockIn(getSelected(), true);
    }
  }

  function updateTorch() {
    timerText.textContent = Math.max(timeLeft, 0);
    const pct = Math.max(timeLeft / TIME_LIMIT, 0) * 100;
    torchFill.style.width = pct + "%";
    torchFill.classList.remove('warn', 'danger');
    if (timeLeft <= 5) torchFill.classList.add('danger');
    else if (timeLeft <= 10) torchFill.classList.add('warn');
  }

  function lockIn(selected, timedOut) {
    if (locked) return;
    locked = true;
    clearInterval(timerId);
    submitBtn.disabled = true;
    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);

    const isCorrect = selected === correctAnswer;
    document.querySelectorAll('.opt-btn').forEach(b => {
      if (b.dataset.value === correctAnswer) b.classList.add('correct');
      else if (b.dataset.value === selected) b.classList.add('wrong');
    });

    history.push(isCorrect ? 1 : 0);
    renderTrail();

    if (isCorrect) {
      score += 1;
      scoreText.textContent = score;
      feedback.textContent = "🎉 Correct! Treasure collected!";
      chestZone.innerHTML = '<span class="pop">🎁✨🪙</span>';
    } else if (timedOut && !selected) {
      feedback.textContent = `⏰ Time's up! The answer was ${correctAnswer}`;
      chestZone.innerHTML = '<span class="pop">🔒</span>';
    } else {
      feedback.textContent = `❌ Not quite — the answer was ${correctAnswer}`;
      chestZone.innerHTML = '<span class="pop">🔒</span>';
      qText.parentElement.parentElement.classList.add('shake');
      setTimeout(() => qText.parentElement.parentElement.classList.remove('shake'), 400);
    }

    solutionBox.textContent = currentSolution;
    solutionBox.classList.add('show');
  }

  function renderTrail() {
    trail.innerHTML = "";
    history.forEach((h, i) => {
      const s = document.createElement('div');
      s.className = 'step ' + (h ? 'good' : 'bad');
      s.textContent = h ? '★' : '✕';
      trail.appendChild(s);
    });
  }
})();