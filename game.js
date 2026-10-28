/* ===================================================
   TORNA - FOOTBALL CANVAS PHYSICS & GAME LOOP
   Tactical Physics Soccer with Touch & Drag Controls
=================================================== */

class FootballGame {
  constructor() {
    this.canvas = document.getElementById('footballCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Logical dimensions of football pitch
    this.width = 900;
    this.height = 540;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Goals settings
    this.goalWidth = 30;
    this.goalHeight = 170;
    this.goalY = (this.height - this.goalHeight) / 2;

    // Physics parameters
    this.friction = 0.985;
    this.discFriction = 0.978;
    this.maxPower = 22;
    this.ballRadius = 14;
    this.discRadius = 26;

    // State
    this.ball = null;
    this.team1Discs = [];
    this.team2Discs = [];
    this.currentTurn = 1; // 1 = Team 1 (Left), 2 = Team 2 (Right)
    this.scores = [0, 0];
    this.targetGoals = 2;
    this.isMoving = false;
    this.isGoalScored = false;
    this.isGameOver = false;

    // Drag & Aim controls
    this.selectedDisc = null;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.isDragging = false;

    // Timer
    this.turnDuration = 15;
    this.turnTimeLeft = 15;
    this.timerInterval = null;

    // Teams details
    this.t1Name = "Player 1";
    this.t2Name = "Player 2";
    this.t1Color = "#00e676";
    this.t2Color = "#00b0ff";
    this.isT2Bot = true;

    this.resetPitch();
    this.initListeners();
  }

  setupMatch(p1, p2, roundName = "Quarter-Final", isPractice = false) {
    this.t1Name = p1?.name || "Player 1";
    this.t2Name = p2?.name || "Player 2";
    this.t1Color = this.getTeamColor(p1?.team, "#00e676");
    this.t2Color = this.getTeamColor(p2?.team, "#00b0ff");
    this.isT2Bot = !p2?.isUser;
    this.scores = [0, 0];
    this.isGameOver = false;

    document.getElementById('hud-p1-name').textContent = this.t1Name;
    document.getElementById('hud-p2-name').textContent = this.t2Name;
    document.getElementById('hud-p1-score').textContent = '0';
    document.getElementById('hud-p2-score').textContent = '0';
    document.getElementById('hud-badge-1').style.background = this.t1Color;
    document.getElementById('hud-badge-2').style.background = this.t2Color;
    document.getElementById('hud-round-tag').textContent = roundName;

    this.resetPitch();
    this.startTurn(1);
  }

  getTeamColor(teamName, defaultColor) {
    if (!teamName) return defaultColor;
    if (teamName.includes('Nairobi')) return '#00E676';
    if (teamName.includes('Mombasa')) return '#00B0FF';
    if (teamName.includes('Rift')) return '#FF9100';
    if (teamName.includes('Kisumu')) return '#FF1744';
    return defaultColor;
  }

  resetPitch() {
    // Reset Ball
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      vx: 0,
      vy: 0,
      radius: this.ballRadius
    };

    // Formations (3v3 tactical setup: GK, Defender, Striker)
    // Team 1 (Left to Right)
    this.team1Discs = [
      { id: 'p1_gk', x: 80, y: this.height / 2, vx: 0, vy: 0, radius: this.discRadius, team: 1, num: '1' },
      { id: 'p1_df', x: 230, y: this.height / 2 - 70, vx: 0, vy: 0, radius: this.discRadius, team: 1, num: '4' },
      { id: 'p1_st', x: 230, y: this.height / 2 + 70, vx: 0, vy: 0, radius: this.discRadius, team: 1, num: '9' }
    ];

    // Team 2 (Right to Left)
    this.team2Discs = [
      { id: 'p2_gk', x: this.width - 80, y: this.height / 2, vx: 0, vy: 0, radius: this.discRadius, team: 2, num: '1' },
      { id: 'p2_df', x: this.width - 230, y: this.height / 2 - 70, vx: 0, vy: 0, radius: this.discRadius, team: 2, num: '4' },
      { id: 'p2_st', x: this.width - 230, y: this.height / 2 + 70, vx: 0, vy: 0, radius: this.discRadius, team: 2, num: '9' }
    ];

    this.isGoalScored = false;
  }

  startTurn(team) {
    if (this.isGameOver) return;
    this.currentTurn = team;
    this.turnTimeLeft = this.turnDuration;
    this.updateHUDTurnIndicator();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.turnTimeLeft--;
      document.getElementById('turn-timer-display').textContent = this.turnTimeLeft + 's';

      if (this.turnTimeLeft <= 0) {
        clearInterval(this.timerInterval);
        this.switchTurn();
      }
    }, 1000);

    // If it's Bot's turn, trigger AI move after a short realistic hesitation
    if (this.currentTurn === 2 && this.isT2Bot && !this.isMoving) {
      setTimeout(() => this.executeBotMove(), 900);
    }
  }

  switchTurn() {
    if (this.isGameOver) return;
    this.startTurn(this.currentTurn === 1 ? 2 : 1);
  }

  updateHUDTurnIndicator() {
    const p1Label = document.querySelector('.left-side .sub-label');
    const p2Label = document.querySelector('.right-side .sub-label');

    if (this.currentTurn === 1) {
      p1Label.textContent = "YOUR TURN";
      p1Label.style.color = "var(--accent-green)";
      p2Label.textContent = "WAITING";
      p2Label.style.color = "var(--text-muted)";
    } else {
      p1Label.textContent = "WAITING";
      p1Label.style.color = "var(--text-muted)";
      p2Label.textContent = this.isT2Bot ? "BOT THINKING..." : "THEIR TURN";
      p2Label.style.color = "var(--accent-gold)";
    }
    document.getElementById('turn-timer-display').textContent = this.turnTimeLeft + 's';
  }

  // BOT AI MOVE CALCULATION
  executeBotMove() {
    if (this.currentTurn !== 2 || this.isMoving || this.isGameOver) return;

    // Pick best disc to strike ball into Team 1's goal (target: x = 0, y = height/2)
    const targetGoal = { x: 10, y: this.height / 2 };
    let bestDisc = null;
    let minDistance = 999999;

    for (const d of this.team2Discs) {
      const dist = Math.hypot(d.x - this.ball.x, d.y - this.ball.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestDisc = d;
      }
    }

    if (!bestDisc) return;

    // Vector from ball to target goal
    const ballToGoalAngle = Math.atan2(targetGoal.y - this.ball.y, targetGoal.x - this.ball.x);

    // Position behind the ball to hit towards goal
    const hitAngle = Math.atan2(this.ball.y - bestDisc.y, this.ball.x - bestDisc.x);
    // Blend aim with slight human-like randomness
    const finalAngle = (ballToGoalAngle * 0.4 + hitAngle * 0.6) + (Math.random() - 0.5) * 0.2;

    const power = Math.min(this.maxPower * 0.85, 12 + Math.random() * 6);
    bestDisc.vx = Math.cos(finalAngle) * power;
    bestDisc.vy = Math.sin(finalAngle) * power;

    if (window.sound) window.sound.playKick();
    this.isMoving = true;
    clearInterval(this.timerInterval);
  }

  // MOUSE & TOUCH LISTENERS
  initListeners() {
    const getCanvasPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const handleStart = (e) => {
      if (this.isMoving || this.currentTurn !== 1 || this.isGameOver) return;
      const pos = getCanvasPos(e);

      // Check if clicked on any of player's discs
      for (const disc of this.team1Discs) {
        const dist = Math.hypot(disc.x - pos.x, disc.y - pos.y);
        if (dist <= disc.radius * 1.5) {
          this.selectedDisc = disc;
          this.dragStart = { x: disc.x, y: disc.y };
          this.dragCurrent = { x: pos.x, y: pos.y };
          this.isDragging = true;
          break;
        }
      }
    };

    const handleMove = (e) => {
      if (!this.isDragging || !this.selectedDisc) return;
      e.preventDefault();
      const pos = getCanvasPos(e);
      this.dragCurrent = pos;
    };

    const handleEnd = () => {
      if (!this.isDragging || !this.selectedDisc) return;

      // Calculate pull back vector (drag opposite for slingshot)
      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const dragDist = Math.hypot(dx, dy);

      if (dragDist > 10) {
        const powerRatio = Math.min(dragDist / 120, 1.0);
        const power = powerRatio * this.maxPower;
        const angle = Math.atan2(dy, dx);

        this.selectedDisc.vx = Math.cos(angle) * power;
        this.selectedDisc.vy = Math.sin(angle) * power;

        if (window.sound) window.sound.playKick();
        this.isMoving = true;
        clearInterval(this.timerInterval);
      }

      this.selectedDisc = null;
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    this.canvas.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  }

  // MAIN PHYSICS UPDATE LOOP
  updatePhysics() {
    if (!this.ball) return;
    let moving = false;
    const threshold = 0.08;

    // Update ball
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;
    this.ball.vx *= this.friction;
    this.ball.vy *= this.friction;
    if (Math.hypot(this.ball.vx, this.ball.vy) > threshold) moving = true;
    else { this.ball.vx = 0; this.ball.vy = 0; }

    // Update all discs
    const allDiscs = [...this.team1Discs, ...this.team2Discs];
    for (const d of allDiscs) {
      d.x += d.vx;
      d.y += d.vy;
      d.vx *= this.discFriction;
      d.vy *= this.discFriction;
      if (Math.hypot(d.vx, d.vy) > threshold) moving = true;
      else { d.vx = 0; d.vy = 0; }
    }

    // Border collisions & Goal checking
    this.checkPitchBoundaries();

    // Elastic Collisions
    this.checkCollisions();

    // Check if motion has stopped after a turn
    if (this.isMoving && !moving) {
      this.isMoving = false;
      if (!this.isGoalScored && !this.isGameOver) {
        this.switchTurn();
      }
    }
  }

  checkPitchBoundaries() {
    const allBodies = [this.ball, ...this.team1Discs, ...this.team2Discs];

    for (const b of allBodies) {
      // Top & Bottom turf boundaries
      if (b.y - b.radius < 0) {
        b.y = b.radius;
        b.vy *= -0.85;
        if (b === this.ball && window.sound) window.sound.playPostRebound();
      } else if (b.y + b.radius > this.height) {
        b.y = this.height - b.radius;
        b.vy *= -0.85;
        if (b === this.ball && window.sound) window.sound.playPostRebound();
      }

      // Left boundary (Goal aperture or Wall)
      if (b.x - b.radius < 0) {
        const inGoalY = b.y > this.goalY && b.y < this.goalY + this.goalHeight;
        if (inGoalY && b === this.ball) {
          // Goal for Team 2!
          this.triggerGoal(2);
          return;
        } else {
          b.x = b.radius;
          b.vx *= -0.85;
          if (b === this.ball && window.sound) window.sound.playPostRebound();
        }
      }

      // Right boundary (Goal aperture or Wall)
      if (b.x + b.radius > this.width) {
        const inGoalY = b.y > this.goalY && b.y < this.goalY + this.goalHeight;
        if (inGoalY && b === this.ball) {
          // Goal for Team 1!
          this.triggerGoal(1);
          return;
        } else {
          b.x = this.width - b.radius;
          b.vx *= -0.85;
          if (b === this.ball && window.sound) window.sound.playPostRebound();
        }
      }
    }
  }

  checkCollisions() {
    const allDiscs = [...this.team1Discs, ...this.team2Discs];

    // Disc vs Ball
    for (const d of allDiscs) {
      this.resolveCircleCollision(d, this.ball, 1.25);
    }

    // Disc vs Disc
    for (let i = 0; i < allDiscs.length; i++) {
      for (let j = i + 1; j < allDiscs.length; j++) {
        this.resolveCircleCollision(allDiscs[i], allDiscs[j], 1.0);
      }
    }
  }

  resolveCircleCollision(c1, c2, restitution = 1.0) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = c1.radius + c2.radius;

    if (dist < minDist && dist > 0) {
      // Overlap separation
      const overlap = 0.5 * (minDist - dist);
      const nx = dx / dist;
      const ny = dy / dist;

      c1.x -= nx * overlap;
      c1.y -= ny * overlap;
      c2.x += nx * overlap;
      c2.y += ny * overlap;

      // Elastic momentum exchange
      const kx = c1.vx - c2.vx;
      const ky = c1.vy - c2.vy;
      const p = 2 * (nx * kx + ny * ky) / 2; // Equal mass approximation

      c1.vx -= p * nx * restitution;
      c1.vy -= p * ny * restitution;
      c2.vx += p * nx * restitution;
      c2.vy += p * ny * restitution;

      if ((c1 === this.ball || c2 === this.ball) && window.sound) {
        window.sound.playKick();
      }
    }
  }

  triggerGoal(scoringTeam) {
    if (this.isGoalScored || this.isGameOver) return;
    this.isGoalScored = true;
    this.isMoving = false;
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.scores[scoringTeam - 1]++;
    document.getElementById('hud-p1-score').textContent = this.scores[0];
    document.getElementById('hud-p2-score').textContent = this.scores[1];

    if (window.sound) window.sound.playGoalCheer();

    // Show goal banner
    const banner = document.getElementById('goal-overlay');
    const scorerTxt = document.getElementById('scorer-banner');
    scorerTxt.textContent = scoringTeam === 1 ? this.t1Name : this.t2Name;
    banner.classList.remove('hidden');

    setTimeout(() => {
      banner.classList.add('hidden');

      // Check Match Victory
      if (this.scores[0] >= this.targetGoals || this.scores[1] >= this.targetGoals) {
        this.finishMatch();
      } else {
        this.resetPitch();
        this.startTurn(scoringTeam === 1 ? 2 : 1);
      }
    }, 2200);
  }

  finishMatch() {
    this.isGameOver = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const winnerId = this.scores[0] > this.scores[1] ? 1 : 2;
    const winnerName = winnerId === 1 ? this.t1Name : this.t2Name;

    setTimeout(() => {
      if (window.onMatchEndCallback) {
        window.onMatchEndCallback(winnerId, this.scores);
      }
    }, 500);
  }

  // RENDER PITCH & ASSETS
  render() {
    if (!this.ball) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Football Turf Grass with Alternate Stripes
    const stripeWidth = 60;
    for (let x = 0; x < this.width; x += stripeWidth) {
      this.ctx.fillStyle = (Math.floor(x / stripeWidth) % 2 === 0) ? '#1f533a' : '#1a4933';
      this.ctx.fillRect(x, 0, stripeWidth, this.height);
    }

    // 2. White Pitch Markings
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 4;

    // Pitch Border
    this.ctx.strokeRect(6, 6, this.width - 12, this.height - 12);

    // Halfway Line
    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2, 0);
    this.ctx.lineTo(this.width / 2, this.height);
    this.ctx.stroke();

    // Center Circle & Spot
    this.ctx.beginPath();
    this.ctx.arc(this.width / 2, this.height / 2, 70, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(this.width / 2, this.height / 2, 5, 0, Math.PI * 2);
    this.ctx.fill();

    // Penalty Boxes & Spots
    this.ctx.strokeRect(6, (this.height - 240) / 2, 130, 240);
    this.ctx.strokeRect(this.width - 136, (this.height - 240) / 2, 130, 240);

    // Goal Nets
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.fillRect(0, this.goalY, 8, this.goalHeight);
    this.ctx.fillRect(this.width - 8, this.goalY, 8, this.goalHeight);

    // Goal Posts
    this.ctx.fillStyle = '#ffb703';
    this.ctx.beginPath();
    this.ctx.arc(8, this.goalY, 7, 0, Math.PI * 2);
    this.ctx.arc(8, this.goalY + this.goalHeight, 7, 0, Math.PI * 2);
    this.ctx.arc(this.width - 8, this.goalY, 7, 0, Math.PI * 2);
    this.ctx.arc(this.width - 8, this.goalY + this.goalHeight, 7, 0, Math.PI * 2);
    this.ctx.fill();

    // 3. Render Aiming Guideline if dragging
    if (this.isDragging && this.selectedDisc) {
      this.renderAimGuide();
    }

    // 4. Render Discs
    for (const d of this.team1Discs) this.renderDisc(d, this.t1Color, '#fff');
    for (const d of this.team2Discs) this.renderDisc(d, this.t2Color, '#fff');

    // 5. Render Ball
    this.renderBall();
  }

  renderDisc(disc, color, textCol) {
    this.ctx.save();
    // Drop shadow
    this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetY = 4;

    // Disc Base Outer Ring
    this.ctx.beginPath();
    this.ctx.arc(disc.x, disc.y, disc.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#111';
    this.ctx.fill();
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = color;
    this.ctx.stroke();

    // Inner Jersey Colored Core
    this.ctx.shadowColor = 'transparent';
    this.ctx.beginPath();
    this.ctx.arc(disc.x, disc.y, disc.radius - 4, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();

    // Disc Player Number
    this.ctx.fillStyle = textCol;
    this.ctx.font = 'bold 14px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(disc.num, disc.x, disc.y);

    this.ctx.restore();
  }

  renderBall() {
    this.ctx.save();
    // Shadow
    this.ctx.shadowColor = 'rgba(0,0,0,0.6)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 3;

    // White core
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#000';
    this.ctx.stroke();

    // Classic football pentagon dots
    this.ctx.fillStyle = '#1e293b';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, 4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  renderAimGuide() {
    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) return;

    const angle = Math.atan2(dy, dx);
    const powerRatio = Math.min(dist / 120, 1.0);

    // Aim Line with dotted power gradient
    this.ctx.save();
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([6, 6]);
    this.ctx.strokeStyle = `rgba(255, 183, 3, ${0.4 + powerRatio * 0.6})`;

    const lineLen = 70 + powerRatio * 100;
    const endX = this.selectedDisc.x + Math.cos(angle) * lineLen;
    const endY = this.selectedDisc.y + Math.sin(angle) * lineLen;

    this.ctx.beginPath();
    this.ctx.moveTo(this.selectedDisc.x, this.selectedDisc.y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Arrow head
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = '#ffb703';
    this.ctx.beginPath();
    this.ctx.arc(endX, endY, 6, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  loop() {
    this.updatePhysics();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
}

// APPLICATION UI CONTROLLER
function initApp() {
  const game = new FootballGame();
  game.loop();

  // Screen references
  const screens = {
    lobby: document.getElementById('lobby-screen'),
    bracket: document.getElementById('bracket-screen'),
    game: document.getElementById('game-screen'),
    victory: document.getElementById('victory-screen')
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // Update UI stats from tournament state
  function updateTournamentStats() {
    const pool = window.tournament.getPrizePool();
    document.getElementById('top-pool').textContent = `Ksh ${pool.total}`;
    document.getElementById('top-win').textContent = `Ksh ${pool.winnerPrize}`;
    document.getElementById('tourney-id').textContent = window.tournament.currentTournamentId;

    const count = window.tournament.players.length;
    document.getElementById('slots-count').textContent = `${count}/8 Players Registered`;
    document.getElementById('slots-fill').style.width = `${(count / 8) * 100}%`;

    // Render registered chips
    const preview = document.getElementById('registered-preview');
    preview.innerHTML = '';
    window.tournament.players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `<span class="dot" style="background:#00e676"></span> ${p.name} ${p.isUser ? '(YOU)' : ''}`;
      preview.appendChild(chip);
    });
  }

  updateTournamentStats();

  // Team Selection Buttons
  let selectedTeam = "Nairobi Stars";
  document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTeam = btn.getAttribute('data-team');
    });
  });

  // Submit Registration & M-Pesa Code
  document.getElementById('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('player-name').value;
    const phone = document.getElementById('player-phone').value;
    const code = document.getElementById('player-code').value;

    if (!name || !phone || !code) {
      alert("Please fill in all fields including your M-Pesa code.");
      return;
    }

    const ok = window.tournament.registerPlayer(name, phone, code, selectedTeam);
    if (ok) {
      updateTournamentStats();
      alert(`Registration received for ${name}!\nM-Pesa Code: ${code}\nSlot confirmed in Tournament #104.`);

      // Fill remaining with AI competitors for fast instant play
      window.tournament.fillWithBots();
      window.tournament.generateBracket();
      renderBracket();
      showScreen('bracket');
    }
  });

  // Practice Mode Button
  document.getElementById('btn-practice').addEventListener('click', () => {
    if (window.sound) window.sound.init();
    window.tournament.isPracticeMode = true;
    const user = { name: 'You (Practice)', team: selectedTeam, isUser: true };
    const bot = { name: 'Bot Trainer', team: 'Mombasa Sharks', isUser: false };
    game.setupMatch(user, bot, 'Practice Match', true);
    showScreen('game');
  });

  // Render Bracket tree
  function renderBracket() {
    const b = window.tournament.bracket;

    // QF
    b.quarterFinals.forEach((m, idx) => {
      const el = document.getElementById(`match-q${idx + 1}`);
      renderSlot(el, m.p1, m.p2, m.score, m.winner);
    });

    // SF
    b.semiFinals.forEach((m, idx) => {
      const el = document.getElementById(`match-s${idx + 1}`);
      renderSlot(el, m.p1, m.p2, m.score, m.winner);
    });

    // Final
    renderSlot(document.getElementById('match-final'), b.final.p1, b.final.p2, b.final.score, b.final.winner);
  }

  function renderSlot(container, p1, p2, score, winner) {
    if (!container) return;
    const p1El = container.querySelector('.p1');
    const p2El = container.querySelector('.p2');

    p1El.querySelector('.name').textContent = p1 ? p1.name : 'TBD';
    p1El.querySelector('.score').textContent = score ? score[0] : '-';
    p1El.classList.toggle('winner', winner && winner === p1);

    p2El.querySelector('.name').textContent = p2 ? p2.name : 'TBD';
    p2El.querySelector('.score').textContent = score ? score[1] : '-';
    p2El.classList.toggle('winner', winner && winner === p2);
  }

  // Start Next User Match from Bracket
  document.getElementById('btn-start-next-match').addEventListener('click', () => {
    const next = window.tournament.findUserNextMatch();
    if (!next) {
      alert("No pending match found for you in this round!");
      return;
    }

    window.tournament.activeMatch = next.match;
    game.setupMatch(next.match.p1, next.match.p2, next.stage);
    showScreen('game');
  });

  // Match Ended Callback
  window.onMatchEndCallback = (winnerId, scores) => {
    if (window.tournament.isPracticeMode) {
      alert(winnerId === 1 ? "You Won the Practice Match!" : "Bot Won! Try again to master the aim.");
      showScreen('lobby');
      window.tournament.isPracticeMode = false;
      return;
    }

    const match = window.tournament.activeMatch;
    if (match) {
      const winner = winnerId === 1 ? match.p1 : match.p2;
      window.tournament.recordMatchResult(match, winner, scores);
      renderBracket();

      if (winner.isUser) {
        // User won this round!
        if (window.tournament.bracket.champion === winner) {
          // USER WON THE ENTIRE TOURNAMENT!
          triggerChampionPayout(winner);
        } else {
          alert(`VICTORY! You advance to the next round.`);
          showScreen('bracket');
        }
      } else {
        // User was knocked out
        alert(`KNOCKED OUT! Better luck next tournament!`);
        showScreen('bracket');
      }
    }
  };

  // Champion Victory Screen & Payout
  function triggerChampionPayout(winner) {
    const pool = window.tournament.getPrizePool();
    document.getElementById('champion-name').textContent = `Congratulations ${winner.name}!`;
    document.getElementById('payout-amount').textContent = `Ksh ${pool.winnerPrize}`;
    document.getElementById('payout-phone').textContent = winner.phone || 'Your M-Pesa Number';
    showScreen('victory');
  }

  // Return to Lobby after tournament
  document.getElementById('btn-play-again').addEventListener('click', () => {
    window.tournament.resetTournament();
    updateTournamentStats();
    showScreen('lobby');
  });

  // Surrender / Forfeit
  document.getElementById('btn-surrender').addEventListener('click', () => {
    if (confirm("Are you sure you want to forfeit this match?")) {
      game.finishMatch();
    }
  });

  // Sound toggle button
  document.getElementById('btn-sound-toggle').addEventListener('click', (e) => {
    const on = window.sound.toggleSound();
    e.target.textContent = on ? '🔊 Sound ON' : '🔇 Sound OFF';
  });

  // ADMIN CONTROLS MODAL
  const adminModal = document.getElementById('admin-modal');
  document.getElementById('admin-toggle-btn').addEventListener('click', () => {
    adminModal.classList.remove('hidden');
    renderAdminTable();
  });

  document.getElementById('admin-close-btn').addEventListener('click', () => {
    adminModal.classList.add('hidden');
  });

  document.getElementById('adm-fill-bots').addEventListener('click', () => {
    window.tournament.fillWithBots();
    window.tournament.generateBracket();
    updateTournamentStats();
    renderBracket();
    renderAdminTable();
    alert("Remaining tournament slots filled!");
  });

  document.getElementById('adm-reset-tourney').addEventListener('click', () => {
    if (confirm("Reset current tournament?")) {
      window.tournament.resetTournament();
      updateTournamentStats();
      renderAdminTable();
      showScreen('lobby');
    }
  });

  document.getElementById('adm-save-phone').addEventListener('click', () => {
    const val = document.getElementById('adm-phone-input').value;
    document.getElementById('mpesa-pay-target').textContent = val;
    alert("Admin M-Pesa display updated!");
  });

  function renderAdminTable() {
    const table = document.getElementById('admin-players-table');
    table.innerHTML = '';
    window.tournament.players.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <span>#${idx + 1} <strong>${p.name}</strong> (${p.phone})</span>
        <span style="color:#ffb703; font-family:monospace;">${p.code}</span>
      `;
      table.appendChild(row);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
