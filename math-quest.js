(function () {
  const TIME_LIMIT = 20;
  let currentClass = null;
  let correctAnswer = null;
  let currentQuestion = "";
  let timeLeft = TIME_LIMIT;
  let timerId = null;
  let sessionScore = 0;        // coins earned this session (displayed)
  let history = [];
  let locked = true;

  // Persistent total coins
  let totalCoins = parseInt(localStorage.getItem('mathQuestTotalCoins')) || 0;

  // DOM elements
  const qText = document.getElementById('qText');
  const optionsGrid = document.getElementById('optionsGrid');
  const timerText = document.getElementById('timerText');
  const scoreText = document.getElementById('scoreText');
  const totalCoinsText = document.getElementById('totalCoinsText');
  const torchFill = document.getElementById('torchFill');
  const newQBtn = document.getElementById('newQBtn');
  const submitBtn = document.getElementById('submitBtn');
  const feedback = document.getElementById('feedback');
  const solutionBox = document.getElementById('solution');
  const chestZone = document.getElementById('chestZone');
  const trail = document.getElementById('trail');
  const welcomeMsg = document.getElementById('welcomeMsg');

  // Set welcome message
  const playerName = localStorage.getItem('mathQuestName') || 'Math Explorer';
  welcomeMsg.textContent = `Welcome, ${playerName}!`;

  // Display total coins
  totalCoinsText.textContent = totalCoins;

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  const currentTheme = localStorage.getItem('mathQuestTheme') || 'education';
  if (currentTheme === 'jungle') {
    document.body.classList.add('jungle');
    themeToggle.textContent = '☀️ Switch to Education';
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('jungle');
    const isJungle = document.body.classList.contains('jungle');
    themeToggle.textContent = isJungle ? '☀️ Switch to Education' : '🌿 Switch to Jungle';
    localStorage.setItem('mathQuestTheme', isJungle ? 'jungle' : 'education');
  });

  // Class chip listeners
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

  // ========== UTILS ==========
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

  // ========== QUESTION GENERATORS ==========
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

  function genAreaRectangle() {
    const l = randInt(2, 15);
    const w = randInt(2, 15);
    const area = l * w;
    const text = `Find the area of a rectangle with length ${l} and width ${w}`;
    const solutionSteps = `Area = length × width = ${l} × ${w} = ${area}`;
    return { text, correct: String(area), solutionSteps };
  }

  function genAreaTriangle() {
    const base = randInt(2, 15);
    const height = randInt(2, 15);
    const area = (base * height) / 2;
    const text = `Find the area of a triangle with base ${base} and height ${height}`;
    const solutionSteps = `Area = (base × height) / 2 = (${base} × ${height}) / 2 = ${area}`;
    return { text, correct: String(area), solutionSteps };
  }

  function genAreaCircle() {
    const r = randInt(2, 10);
    const area = Math.round(Math.PI * r * r * 100) / 100; // round to 2 decimals
    const text = `Find the area of a circle with radius ${r} (π ≈ 3.14)`;
    const solutionSteps = `Area = π × r² ≈ 3.14 × ${r}² = 3.14 × ${r * r} = ${area}`;
    return { text, correct: String(area), solutionSteps };
  }

  function genFractionAdd() {
    const denom1 = randInt(2, 8);
    const denom2 = randInt(2, 8);
    const num1 = randInt(1, denom1 - 1);
    const num2 = randInt(1, denom2 - 1);
    const lcm = denom1 * denom2;
    const newNum1 = num1 * denom2;
    const newNum2 = num2 * denom1;
    const sumNum = newNum1 + newNum2;
    const text = `${num1}/${denom1} + ${num2}/${denom2}`;
    const correct = `${sumNum}/${lcm}`;
    const solutionSteps = `Find common denominator (${lcm})\n` +
      `${num1}/${denom1} = ${newNum1}/${lcm}, ${num2}/${denom2} = ${newNum2}/${lcm}\n` +
      `Sum = ${sumNum}/${lcm}`;
    return { text, correct, solutionSteps };
  }

  function genPercent() {
    const total = randInt(50, 200);
    const percent = randInt(10, 90);
    const result = (total * percent) / 100;
    const text = `What is ${percent}% of ${total}?`;
    const correct = String(result);
    const solutionSteps = `${percent}% of ${total} = (${percent} / 100) × ${total} = ${result}`;
    return { text, correct, solutionSteps };
  }

  // Map class to possible question types (weighted)
  const questionPools = {
    "3": [
      { gen: genArithmetic, weight: 3 },
      { gen: genAreaRectangle, weight: 1 },
    ],
    "5": [
      { gen: genArithmetic, weight: 3 },
      { gen: genAreaRectangle, weight: 1 },
      { gen: genAreaTriangle, weight: 1 },
      { gen: genFractionAdd, weight: 2 },
    ],
    "8": [
      { gen: genLinear, weight: 3 },
      { gen: genAreaCircle, weight: 1 },
      { gen: genAreaTriangle, weight: 1 },
      { gen: genPercent, weight: 2 },
      { gen: genQuadratic, weight: 1 },
    ],
    "10": [
      { gen: genQuadratic, weight: 3 },
      { gen: genLinear, weight: 2 },
      { gen: genPercent, weight: 2 },
      { gen: genAreaCircle, weight: 1 },
    ]
  };

  function weightedRandom(pool) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const item of pool) {
      rand -= item.weight;
      if (rand <= 0) return item.gen;
    }
    return pool[0].gen; // fallback
  }

  function buildQuestion(level) {
    const pool = questionPools[level] || questionPools["3"];
    const generator = weightedRandom(pool);
    const q = generator(level);

    // Generate distractors
    let opts;
    if (q.correct.includes(",")) {
      // quadratic roots: we use a set of custom distractors
      const optsSet = new Set([q.correct]);
      let tries = 0;
      while (optsSet.size < 4 && tries < 60) {
        tries++;
        const r1 = randInt(-8, 8), r2 = randInt(-8, 8);
        optsSet.add([r1, r2].sort((x, y) => x - y).join(", "));
      }
      opts = shuffle(Array.from(optsSet));
    } else {
      const correctNum = parseFloat(q.correct);
      const distractors = new Set();
      let tries = 0;
      while (distractors.size < 3 && tries < 40) {
        tries++;
        const offset = [1,2,3,5,10][randInt(0,4)] * (Math.random() < 0.5 ? -1 : 1);
        let val = correctNum + offset;
        if (String(val) !== q.correct) distractors.add(String(val));
      }
      opts = shuffle([...distractors, q.correct]);
    }
    return { ...q, options: opts };
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
      sessionScore += 1;
      totalCoins += 1;
      scoreText.textContent = sessionScore;
      totalCoinsText.textContent = totalCoins;
      localStorage.setItem('mathQuestTotalCoins', totalCoins);
      feedback.textContent = "🎉 Correct! +1 coin";
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