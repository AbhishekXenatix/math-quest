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
  const questProgressDiv = document.getElementById('questProgress');

  // Set welcome message
  const playerName = localStorage.getItem('mathQuestName') || 'Math Explorer';
  welcomeMsg.textContent = `Welcome, ${playerName}!`;

  // Display total coins
  totalCoinsText.textContent = totalCoins;

  // ----- NEW: Quest Map & Puzzle Chains -----
  const MAP_LOCATIONS = [
    { id: 'crystal-cave', name: 'Crystal Cave', icon: '💎', classLevel: '3', topic: 'arithmetic', chainLength: 5, creature: { name: 'Glowbat', emoji: '🦇', fact: 'This bat uses echolocation to find prime numbers!' } },
    { id: 'muddy-swamp', name: 'Muddy Swamp', icon: '🐸', classLevel: '3', topic: 'area-rectangle', chainLength: 5, creature: { name: 'Mudpuppy', emoji: '🐶', fact: 'It can sense right angles with its whiskers!' } },
    { id: 'vine-bridge', name: 'Vine Bridge', icon: '🌿', classLevel: '5', topic: 'fractions', chainLength: 5, creature: { name: 'Vine Snake', emoji: '🐍', fact: 'Its scales are perfect fractals.' } },
    { id: 'sky-temple', name: 'Sky Temple', icon: '🏛️', classLevel: '5', topic: 'area-triangle', chainLength: 5, creature: { name: 'Sun Phoenix', emoji: '🐦‍🔥', fact: 'Rebirths when you solve a geometry problem.' } },
    { id: 'echoing-gorge', name: 'Echoing Gorge', icon: '🏞️', classLevel: '8', topic: 'linear', chainLength: 5, creature: { name: 'Echo Fox', emoji: '🦊', fact: 'It repeats your answer, then tells you if it’s right.' } },
    { id: 'volcano-peak', name: 'Volcano Peak', icon: '🌋', classLevel: '8', topic: 'percentages', chainLength: 5, creature: { name: 'Lavahorn', emoji: '🐲', fact: 'It can calculate the percent of lava in its belly.' } },
    { id: 'ancient-library', name: 'Ancient Library', icon: '📚', classLevel: '10', topic: 'quadratic', chainLength: 5, creature: { name: 'Bookwyrm', emoji: '🐉', fact: 'It eats quadratic equations for breakfast.' } },
    { id: 'star-observatory', name: 'Star Observatory', icon: '🔭', classLevel: '10', topic: 'area-circle', chainLength: 5, creature: { name: 'Celestial Turtle', emoji: '🐢', fact: 'Its shell contains a map of the stars.' } }
  ];

  // Map topic to generator function
  function getGeneratorForTopic(topic) {
    switch(topic) {
      case 'arithmetic': return (level) => genArithmetic(level);
      case 'area-rectangle': return genAreaRectangle;
      case 'area-triangle': return genAreaTriangle;
      case 'area-circle': return genAreaCircle;
      case 'fractions': return genFractionAdd;
      case 'percentages': return genPercent;
      case 'linear': return genLinear;
      case 'quadratic': return genQuadratic;
      default: return (level) => genArithmetic(level);
    }
  }

  // Active quest state (if started from map)
  let activeQuest = null;
  const urlParams = new URLSearchParams(window.location.search);
  const mapNodeId = urlParams.get('mapNode');

  // If we came from map with a node, set up quest
  if (mapNodeId) {
    const location = MAP_LOCATIONS.find(loc => loc.id === mapNodeId);
    if (location) {
      activeQuest = {
        locationId: location.id,
        chainLength: location.chainLength,
        topic: location.topic,
        correctCount: 0,
        creature: location.creature,
        classLevel: location.classLevel
      };
      // Hide class picker because topic is fixed
      document.querySelector('.class-picker').style.display = 'none';
      qText.textContent = `Quest: ${location.name} - Solve 5 ${location.topic} problems!`;
      startNewQuestion(true);
    }
  }

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

  // Class chip listeners (only if not in quest mode)
  document.querySelectorAll('.class-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.class-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentClass = chip.dataset.class;
      startNewQuestion(false);
    });
  });

  newQBtn.addEventListener('click', () => startNewQuestion(!!activeQuest));
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

  function genLinear(level) {
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

  function genQuadratic(level) {
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
    const area = Math.round(Math.PI * r * r * 100) / 100;
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

  // ========== QUESTION BUILDING ==========
  function buildQuestion(topic, level) {
    const generator = getGeneratorForTopic(topic);
    const q = generator(level);

    let opts;
    if (q.correct.includes(",")) {
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

  function startNewQuestion(questMode) {
    if (!questMode && !currentClass) return;
    clearInterval(timerId);

    let topic;
    let level;
    if (questMode && activeQuest) {
      topic = activeQuest.topic;
      level = activeQuest.classLevel;
    } else {
      const pools = {
        "3": [
          { topic: 'arithmetic', weight: 3 },
          { topic: 'area-rectangle', weight: 1 }
        ],
        "5": [
          { topic: 'arithmetic', weight: 3 },
          { topic: 'area-rectangle', weight: 1 },
          { topic: 'area-triangle', weight: 1 },
          { topic: 'fractions', weight: 2 }
        ],
        "8": [
          { topic: 'linear', weight: 3 },
          { topic: 'area-circle', weight: 1 },
          { topic: 'area-triangle', weight: 1 },
          { topic: 'percentages', weight: 2 },
          { topic: 'quadratic', weight: 1 }
        ],
        "10": [
          { topic: 'quadratic', weight: 3 },
          { topic: 'linear', weight: 2 },
          { topic: 'percentages', weight: 2 },
          { topic: 'area-circle', weight: 1 }
        ]
      };
      const pool = pools[currentClass] || pools["3"];
      const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
      let rand = Math.random() * totalWeight;
      let chosenTopic = pool[0].topic;
      for (const item of pool) {
        rand -= item.weight;
        if (rand <= 0) { chosenTopic = item.topic; break; }
      }
      topic = chosenTopic;
      level = currentClass;
    }

    const q = buildQuestion(topic, level);
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

    if (activeQuest) {
      questProgressDiv.textContent = `Quest: ${activeQuest.correctCount} / ${activeQuest.chainLength} solved`;
    } else {
      questProgressDiv.textContent = '';
    }
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

  // ----- Storage Helpers -----
  function getUnlockedLocations() {
    return JSON.parse(localStorage.getItem('unlockedLocations')) || [];
  }
  function unlockLocation(locationId) {
    let unlocked = getUnlockedLocations();
    if (!unlocked.includes(locationId)) {
      unlocked.push(locationId);
      localStorage.setItem('unlockedLocations', JSON.stringify(unlocked));
    }
  }
  function getDiscoveredCreatures() {
    return JSON.parse(localStorage.getItem('discoveredCreatures')) || [];
  }
  function discoverCreature(creatureName) {
    let creatures = getDiscoveredCreatures();
    if (!creatures.includes(creatureName)) {
      creatures.push(creatureName);
      localStorage.setItem('discoveredCreatures', JSON.stringify(creatures));
    }
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

    // Quest mode handling
    if (activeQuest) {
      if (isCorrect) {
        activeQuest.correctCount++;
        sessionScore += 1;
        totalCoins += 1;
        scoreText.textContent = sessionScore;
        totalCoinsText.textContent = totalCoins;
        localStorage.setItem('mathQuestTotalCoins', totalCoins);

        if (activeQuest.correctCount >= activeQuest.chainLength) {
          // Quest completed!
          feedback.textContent = `🎉 Quest complete! You unlocked ${activeQuest.creature.name}!`;
          chestZone.innerHTML = '<span class="pop">🏆✨🪙</span>';
          unlockLocation(activeQuest.locationId);
          discoverCreature(activeQuest.creature.name);
          setTimeout(() => {
            alert(`You've discovered ${activeQuest.creature.name}! Check your Field Guide.`);
            window.location.href = 'map.html';
          }, 1000);
          return;
        } else {
          feedback.textContent = `✅ Correct! (${activeQuest.correctCount}/${activeQuest.chainLength})`;
          chestZone.innerHTML = '<span class="pop">✨🪙</span>';
        }
      } else {
        feedback.textContent = `❌ Not quite — the answer was ${correctAnswer}. Keep going!`;
        chestZone.innerHTML = '<span class="pop">🔒</span>';
      }
      questProgressDiv.textContent = `Quest: ${activeQuest.correctCount} / ${activeQuest.chainLength} solved`;
    } else {
      // Free play mode
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
    }

    solutionBox.textContent = currentSolution;
    solutionBox.classList.add('show');

    // Update living jungle
    updateJungleScene();
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

  // ========== LIVING JUNGLE ==========
  function updateJungleScene() {
    const scene = document.getElementById('jungleScene');
    if (!scene) return;
    scene.innerHTML = '';

    const unlockedCount = getUnlockedLocations().length;

    const elements = [];
    if (totalCoins >= 5) elements.push({ emoji: '🌿', left: '10%', top: '20%', size: '3rem' });
    if (totalCoins >= 10) elements.push({ emoji: '🌺', left: '80%', top: '15%', size: '2.5rem' });
    if (totalCoins >= 15) elements.push({ emoji: '🦋', left: '50%', top: '30%', size: '2rem' });
    if (totalCoins >= 20) elements.push({ emoji: '🦜', left: '30%', top: '60%', size: '2.5rem' });
    if (totalCoins >= 30) elements.push({ emoji: '🐒', left: '70%', top: '50%', size: '3rem' });
    if (unlockedCount >= 1) elements.push({ emoji: '💧', left: '20%', top: '10%', size: '1.5rem' });
    if (unlockedCount >= 2) elements.push({ emoji: '🌸', left: '60%', top: '70%', size: '2rem' });
    if (unlockedCount >= 4) elements.push({ emoji: '🌴', left: '90%', top: '5%', size: '4rem' });
    if (unlockedCount >= 6) elements.push({ emoji: '🌈', left: '40%', top: '80%', size: '3rem' });
    if (totalCoins >= 50) elements.push({ emoji: '🏆', left: '5%', top: '50%', size: '3rem' });

    elements.forEach(el => {
      const div = document.createElement('div');
      div.className = 'jungle-element show';
      div.textContent = el.emoji;
      div.style.left = el.left;
      div.style.top = el.top;
      div.style.fontSize = el.size;
      div.style.animation = 'float 3s ease-in-out infinite';
      scene.appendChild(div);
    });
  }

  // Call on load (practice page)
  if (document.getElementById('jungleScene')) {
    updateJungleScene();
  }

  // ========== MAP PAGE RENDERING ==========
  window.renderMap = function() {
    const grid = document.getElementById('mapGrid');
    if (!grid) return;
    const unlocked = getUnlockedLocations();
    grid.innerHTML = '';
    MAP_LOCATIONS.forEach(loc => {
      const isUnlocked = unlocked.includes(loc.id);
      const node = document.createElement('div');
      node.className = 'map-node ' + (isUnlocked ? 'unlocked' : 'locked');
      node.innerHTML = `
        <div class="icon">${loc.icon}</div>
        <div class="label">${loc.name}</div>
        <div class="status-icon">${isUnlocked ? '🔓' : '🔒'}</div>
      `;
      if (!isUnlocked) {
        node.addEventListener('click', () => {
          alert('Solve the puzzle chain to unlock this location!');
        });
      } else {
        node.addEventListener('click', () => {
          window.location.href = `practice.html?mapNode=${loc.id}`;
        });
      }
      grid.appendChild(node);
    });
  };

  window.renderTreasureStatus = function() {
    const container = document.getElementById('treasureStatus');
    if (!container) return;
    const unlocked = getUnlockedLocations();
    const totalPieces = MAP_LOCATIONS.length;
    const collected = unlocked.length;
    const piecesHTML = Array.from({ length: totalPieces }, (_, i) => {
      return `<div class="piece ${i < collected ? 'collected' : ''}"></div>`;
    }).join('');
    container.innerHTML = `
      <h3>🗝️ Treasure Map Pieces</h3>
      <div class="treasure-pieces">${piecesHTML}</div>
      <p>${collected}/${totalPieces} collected</p>
      ${collected === totalPieces ? '<p>🎉 You found the complete treasure! The jungle thanks you!</p>' : ''}
    `;
  };

  // ========== FIELD GUIDE RENDERING ==========
  window.renderFieldGuide = function() {
    const grid = document.getElementById('guideGrid');
    if (!grid) return;
    const discovered = getDiscoveredCreatures();
    const allCreatures = MAP_LOCATIONS.map(loc => loc.creature);
    grid.innerHTML = '';
    allCreatures.forEach(creature => {
      const isDiscovered = discovered.includes(creature.name);
      const card = document.createElement('div');
      card.className = 'guide-card' + (isDiscovered ? ' discovered' : '');
      card.innerHTML = `
        <div class="creature-img">${isDiscovered ? creature.emoji : '❓'}</div>
        <div class="creature-name">${isDiscovered ? creature.name : '???'}</div>
        ${isDiscovered ? `<div class="creature-fact">${creature.fact}</div>` : ''}
      `;
      grid.appendChild(card);
    });
  };

})();