/* ===================================================
   TORNA - FOOTBALL CANVAS PHYSICS & GRAPHICS ENGINE
   Tactical Physics Soccer with Neon Laser Aim & 3D Visuals
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
    this.goalWidth = 32;
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
    this.currentTurn = 1; // 1 = Team 1 (Left - User), 2 = Team 2 (Right - Opponent)
    this.scores = [0, 0];
    this.targetGoals = 2;
    this.isMoving = false;
    this.isGoalScored = false;
    this.isGameOver = false;

    // Visuals & Graphics state
    this.ballAngle = 0;
    this.animTick = 0;
    this.particles = [];
    this.speedTrails = [];

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
    // CRITICAL: Ensure local human user is ALWAYS Team 1 (Left Side)
    // This guarantees 100% turn consistency across all 3 tournament rounds!
    let localPlayer = p1;
    let opponentPlayer = p2;
    if (p2 && p2.isUser && !p1?.isUser) {
      localPlayer = p2;
      opponentPlayer = p1;
    }

    this.t1Name = localPlayer?.name || "Player 1";
    this.t2Name = opponentPlayer?.name || "Player 2";
    this.t1Color = this.getTeamColor(localPlayer?.team, "#00e676");
    this.t2Color = this.getTeamColor(opponentPlayer?.team, "#00b0ff");
    this.isT2Bot = !opponentPlayer?.isUser;
    this.scores = [0, 0];
    this.isGameOver = false;
    this.isMoving = false;
    this.selectedDisc = null;
    this.isDragging = false;
    this.particles = [];
    this.speedTrails = [];

    if (this.timerInterval) clearInterval(this.timerInterval);

    document.getElementById('hud-p1-name').textContent = this.t1Name;
    document.getElementById('hud-p2-name').textContent = this.t2Name;
    document.getElementById('hud-p1-score').textContent = '0';
    document.getElementById('hud-p2-score').textContent = '0';
    document.getElementById('hud-badge-1').style.background = this.t1Color;
    document.getElementById('hud-badge-2').style.background = this.t2Color;
    document.getElementById('hud-round-tag').textContent = roundName;

    this.resetPitch();
    // User ALWAYS takes opening kickoff turn 1
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
    // Team 1 (Left to Right) - Human Player
    this.team1Discs = [
      { id: 'p1_gk', x: 80, y: this.height / 2, vx: 0, vy: 0, radius: this.discRadius, team: 1, num: '1' },
      { id: 'p1_df', x: 230, y: this.height / 2 - 75, vx: 0, vy: 0, radius: this.discRadius, team: 1, num: '4' },
      { id: 'p1_st', x: 230, y: this.height / 2 + 75, vx: 0, vy: 0, radius: this.discRadius, team: 1, num: '9' }
    ];

    // Team 2 (Right to Left) - Opponent
    this.team2Discs = [
      { id: 'p2_gk', x: this.width - 80, y: this.height / 2, vx: 0, vy: 0, radius: this.discRadius, team: 2, num: '1' },
      { id: 'p2_df', x: this.width - 230, y: this.height / 2 - 75, vx: 0, vy: 0, radius: this.discRadius, team: 2, num: '4' },
      { id: 'p2_st', x: this.width - 230, y: this.height / 2 + 75, vx: 0, vy: 0, radius: this.discRadius, team: 2, num: '9' }
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

    // If it's Bot's turn, trigger AI move after realistic human-like hesitation
    if (this.currentTurn === 2 && this.isT2Bot && !this.isMoving) {
      setTimeout(() => this.executeBotMove(), 850);
    }
  }

  switchTurn() {
    if (this.isGameOver) return;
    this.startTurn(this.currentTurn === 1 ? 2 : 1);
  }

  updateHUDTurnIndicator() {
    const p1Label = document.querySelector('.left-side .sub-label');
    const p2Label = document.querySelector('.right-side .sub-label');
    const timerDisplay = document.getElementById('turn-timer-display');

    if (this.currentTurn === 1) {
      p1Label.textContent = "YOUR TURN";
      p1Label.style.color = "#00e676";
      p2Label.textContent = "WAITING";
      p2Label.style.color = "var(--text-muted)";
      timerDisplay.style.borderColor = "#00f0ff";
      timerDisplay.style.color = "#00f0ff";
    } else {
      p1Label.textContent = "WAITING";
      p1Label.style.color = "var(--text-muted)";
      p2Label.textContent = this.isT2Bot ? "BOT THINKING..." : "THEIR TURN";
      p2Label.style.color = "#ffb703";
      timerDisplay.style.borderColor = "#ffb703";
      timerDisplay.style.color = "#ffb703";
    }
    timerDisplay.textContent = this.turnTimeLeft + 's';
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
    // Blend aim with slight realistic randomness
    const finalAngle = (ballToGoalAngle * 0.4 + hitAngle * 0.6) + (Math.random() - 0.5) * 0.18;

    const power = Math.min(this.maxPower * 0.85, 13 + Math.random() * 5.5);
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

      // Check if clicked on any of human player's discs (Team 1)
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
        const powerRatio = Math.min(dragDist / 125, 1.0);
        const power = powerRatio * this.maxPower;
        const angle = Math.atan2(dy, dx);

        this.selectedDisc.vx = Math.cos(angle) * power;
        this.selectedDisc.vy = Math.sin(angle) * power;

        // Spawn kick dust particles
        this.spawnImpactParticles(this.selectedDisc.x, this.selectedDisc.y, '#00f0ff', 12);

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

  // PARTICLE SYSTEM
  spawnImpactParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2.5,
        color: color,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03
      });
    }
  }

  spawnGoalConfetti(goalX, goalY) {
    const colors = ['#00e676', '#00f0ff', '#ff007f', '#ffd60a', '#ffffff', '#7928ca'];
    for (let i = 0; i < 70; i++) {
      const angle = (goalX < 100) ? (Math.random() * Math.PI - Math.PI / 2) : (Math.random() * Math.PI + Math.PI / 2);
      const speed = 3 + Math.random() * 9;
      this.particles.push({
        x: goalX,
        y: goalY + (Math.random() - 0.5) * this.goalHeight,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.015 + Math.random() * 0.015
      });
    }
  }

  // MAIN PHYSICS UPDATE LOOP
  updatePhysics() {
    if (!this.ball) return;
    this.animTick++;
    let moving = false;
    const threshold = 0.08;

    // Update ball
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;
    this.ball.vx *= this.friction;
    this.ball.vy *= this.friction;

    const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy);
    if (ballSpeed > threshold) {
      moving = true;
      this.ballAngle += ballSpeed * 0.06;

      // Speed trail for high-power blasts
      if (ballSpeed > 6 && this.animTick % 2 === 0) {
        this.speedTrails.push({
          x: this.ball.x,
          y: this.ball.y,
          radius: this.ball.radius * 0.8,
          alpha: 0.6
        });
      }
    } else {
      this.ball.vx = 0;
      this.ball.vy = 0;
    }

    // Update speed trails
    for (let i = this.speedTrails.length - 1; i >= 0; i--) {
      this.speedTrails[i].alpha -= 0.07;
      if (this.speedTrails[i].alpha <= 0) {
        this.speedTrails.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

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
      if (b.y - b.radius < 18) {
        b.y = 18 + b.radius;
        b.vy *= -0.85;
        if (b === this.ball) {
          this.spawnImpactParticles(b.x, b.y, '#ffffff', 5);
          if (window.sound) window.sound.playPostRebound();
        }
      } else if (b.y + b.radius > this.height - 18) {
        b.y = this.height - 18 - b.radius;
        b.vy *= -0.85;
        if (b === this.ball) {
          this.spawnImpactParticles(b.x, b.y, '#ffffff', 5);
          if (window.sound) window.sound.playPostRebound();
        }
      }

      // Left boundary (Goal aperture or Wall)
      if (b.x - b.radius < 12) {
        const inGoalY = b.y > this.goalY && b.y < this.goalY + this.goalHeight;
        if (inGoalY && b === this.ball) {
          // Goal for Team 2!
          this.triggerGoal(2);
          return;
        } else {
          b.x = 12 + b.radius;
          b.vx *= -0.85;
          if (b === this.ball) {
            this.spawnImpactParticles(b.x, b.y, '#ffffff', 5);
            if (window.sound) window.sound.playPostRebound();
          }
        }
      }

      // Right boundary (Goal aperture or Wall)
      if (b.x + b.radius > this.width - 12) {
        const inGoalY = b.y > this.goalY && b.y < this.goalY + this.goalHeight;
        if (inGoalY && b === this.ball) {
          // Goal for Team 1 (User)!
          this.triggerGoal(1);
          return;
        } else {
          b.x = this.width - 12 - b.radius;
          b.vx *= -0.85;
          if (b === this.ball) {
            this.spawnImpactParticles(b.x, b.y, '#ffffff', 5);
            if (window.sound) window.sound.playPostRebound();
          }
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
      const p = 2 * (nx * kx + ny * ky) / 2;

      c1.vx -= p * nx * restitution;
      c1.vy -= p * ny * restitution;
      c2.vx += p * nx * restitution;
      c2.vy += p * ny * restitution;

      const midX = (c1.x + c2.x) / 2;
      const midY = (c1.y + c2.y) / 2;
      this.spawnImpactParticles(midX, midY, '#00f0ff', 6);

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

    // Confetti explosion from the net
    const goalX = scoringTeam === 1 ? this.width - 15 : 15;
    this.spawnGoalConfetti(goalX, this.goalY + this.goalHeight / 2);

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
        // Conceding team kicks off
        this.startTurn(scoringTeam === 1 ? 2 : 1);
      }
    }, 2200);
  }

  finishMatch() {
    this.isGameOver = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const winnerId = this.scores[0] > this.scores[1] ? 1 : 2;

    setTimeout(() => {
      if (window.onMatchEndCallback) {
        window.onMatchEndCallback(winnerId, this.scores);
      }
    }, 500);
  }

  // ==========================================
  // GRAPHICS & RENDERING SYSTEM
  // ==========================================

  render() {
    if (!this.ball) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. STADIUM BACKGROUND & LED BOARDS
    this.renderStadiumBorders();

    // 2. DETAILED GRASS TURF
    this.renderPitchTurf();

    // 3. PITCH MARKINGS & WATERMARK
    this.renderPitchMarkings();

    // 4. 3D METALLIC GOALS & HEXAGONAL NETTING
    this.renderGoals();

    // 5. CORNER FLAGS
    this.renderCornerFlags();

    // 6. SPEED TRAILS & PARTICLES
    this.renderSpeedTrails();
    this.renderParticles();

    // 7. NEON LASER AIMING POINTER (ELECTRIC CYAN - NO YELLOW)
    if (this.isDragging && this.selectedDisc) {
      this.renderNeonAimGuide();
    }

    // 8. 3D GLOSSY PLAYER DISCS
    for (const d of this.team1Discs) this.renderDisc(d, this.t1Color, '#ffffff');
    for (const d of this.team2Discs) this.renderDisc(d, this.t2Color, '#ffffff');

    // 9. 3D SOCCER BALL WITH ROTATION
    this.renderBall();
  }

  renderStadiumBorders() {
    // Outer stadium border
    this.ctx.fillStyle = '#080d12';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Top LED Banner Board
    this.ctx.fillStyle = '#0b1622';
    this.ctx.fillRect(0, 0, this.width, 18);
    // Bottom LED Banner Board
    this.ctx.fillRect(0, this.height - 18, this.width, 18);

    // Scrolling LED Text effect
    const offset = (this.animTick * 0.8) % 360;
    this.ctx.save();
    this.ctx.font = 'bold 9px "Teko", sans-serif';
    this.ctx.letterSpacing = '1px';
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 4;
    const adText = "⚽ TORNA PREMIER TOURNAMENT  •  🏆 WIN KSH 560 INSTANT CASH  •  ⚡ M-PESA PAYOUTS  •  🇰🇪 FAIR PLAY ARENA  •  ";
    for (let x = -offset; x < this.width + 400; x += 360) {
      this.ctx.fillText(adText, x, 13);
      this.ctx.fillText(adText, x, this.height - 5);
    }
    this.ctx.restore();
  }

  renderPitchTurf() {
    const turfX = 12;
    const turfY = 18;
    const turfW = this.width - 24;
    const turfH = this.height - 36;

    // Base Grass Green
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(turfX, turfY, turfW, turfH);
    this.ctx.clip();

    // Alternating Mowed Grass Bands with high contrast
    const bandWidth = 56;
    for (let x = turfX; x < turfX + turfW; x += bandWidth) {
      const isEven = Math.floor((x - turfX) / bandWidth) % 2 === 0;
      this.ctx.fillStyle = isEven ? '#1b4d32' : '#143d27';
      this.ctx.fillRect(x, turfY, bandWidth, turfH);
    }

    // Subtle cross-cut diagonal lawn stripes for authentic stadium feel
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    this.ctx.lineWidth = 14;
    for (let d = -turfH; d < turfW + turfH; d += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(turfX + d, turfY);
      this.ctx.lineTo(turfX + d + turfH, turfY + turfH);
      this.ctx.stroke();
    }

    // Stadium Floodlight Vignette (brighter in center, darker on sides)
    const radial = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, 80,
      this.width / 2, this.height / 2, 420
    );
    radial.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    radial.addColorStop(0.7, 'rgba(0, 0, 0, 0.0)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    this.ctx.fillStyle = radial;
    this.ctx.fillRect(turfX, turfY, turfW, turfH);

    this.ctx.restore();
  }

  renderPitchMarkings() {
    const px = 12;
    const py = 18;
    const pw = this.width - 24;
    const ph = this.height - 36;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    this.ctx.lineWidth = 3;

    // Pitch Boundary Line
    this.ctx.strokeRect(px + 4, py + 4, pw - 8, ph - 8);

    // Halfway Line
    this.ctx.beginPath();
    this.ctx.moveTo(this.width / 2, py + 4);
    this.ctx.lineTo(this.width / 2, py + ph - 4);
    this.ctx.stroke();

    // Center Circle
    this.ctx.beginPath();
    this.ctx.arc(this.width / 2, this.height / 2, 75, 0, Math.PI * 2);
    this.ctx.stroke();

    // Center Spot
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(this.width / 2, this.height / 2, 4.5, 0, Math.PI * 2);
    this.ctx.fill();

    // WATERMARK LOGO IN CENTER CIRCLE
    this.ctx.font = 'bold 22px "Teko", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.fillText("TORNA", this.width / 2, this.height / 2 - 14);
    this.ctx.font = '9px "Inter", sans-serif';
    this.ctx.fillText("CHAMPIONSHIP", this.width / 2, this.height / 2 + 10);

    // Penalty Boxes & Goal Areas
    const boxH = 240;
    const boxW = 125;
    const boxY = (this.height - boxH) / 2;

    // Left Penalty Box & Spot
    this.ctx.strokeRect(px + 4, boxY, boxW, boxH);
    this.ctx.strokeRect(px + 4, (this.height - 130) / 2, 45, 130);
    this.ctx.beginPath();
    this.ctx.arc(px + 95, this.height / 2, 3.5, 0, Math.PI * 2);
    this.ctx.fill();
    // Penalty Arc
    this.ctx.beginPath();
    this.ctx.arc(px + 95, this.height / 2, 45, -0.7, 0.7);
    this.ctx.stroke();

    // Right Penalty Box & Spot
    this.ctx.strokeRect(px + pw - 4 - boxW, boxY, boxW, boxH);
    this.ctx.strokeRect(px + pw - 4 - 45, (this.height - 130) / 2, 45, 130);
    this.ctx.beginPath();
    this.ctx.arc(px + pw - 95, this.height / 2, 3.5, 0, Math.PI * 2);
    this.ctx.fill();
    // Penalty Arc
    this.ctx.beginPath();
    this.ctx.arc(px + pw - 95, this.height / 2, 45, Math.PI - 0.7, Math.PI + 0.7);
    this.ctx.stroke();

    this.ctx.restore();
  }

  renderGoals() {
    this.ctx.save();

    // Left Goal Netting (3D mesh)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.fillRect(0, this.goalY, 16, this.goalHeight);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1;
    for (let y = this.goalY; y <= this.goalY + this.goalHeight; y += 12) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(16, y);
      this.ctx.stroke();
    }

    // Right Goal Netting
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.fillRect(this.width - 16, this.goalY, 16, this.goalHeight);
    for (let y = this.goalY; y <= this.goalY + this.goalHeight; y += 12) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.width - 16, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    // 3D Metallic White Goal Posts (Left)
    this.render3DPost(16, this.goalY);
    this.render3DPost(16, this.goalY + this.goalHeight);

    // 3D Metallic White Goal Posts (Right)
    this.render3DPost(this.width - 16, this.goalY);
    this.render3DPost(this.width - 16, this.goalY + this.goalHeight);

    this.ctx.restore();
  }

  render3DPost(x, y) {
    this.ctx.save();
    // Post shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetY = 3;

    // Metallic white-silver radial gradient
    const grad = this.ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#475569';
    this.ctx.stroke();

    this.ctx.restore();
  }

  renderCornerFlags() {
    const corners = [
      { x: 16, y: 22 },
      { x: this.width - 16, y: 22 },
      { x: 16, y: this.height - 22 },
      { x: this.width - 16, y: this.height - 22 }
    ];

    this.ctx.save();
    for (const c of corners) {
      // Corner quadrant arc
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
      this.ctx.stroke();

      // Flag pole
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(c.x - 1, c.y - 12, 2, 12);

      // Red pennant flag
      this.ctx.fillStyle = '#ff1744';
      this.ctx.beginPath();
      this.ctx.moveTo(c.x + 1, c.y - 12);
      this.ctx.lineTo(c.x + 10, c.y - 8);
      this.ctx.lineTo(c.x + 1, c.y - 4);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  renderSpeedTrails() {
    this.ctx.save();
    for (const t of this.speedTrails) {
      this.ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.35})`;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  renderParticles() {
    this.ctx.save();
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  // ==========================================
  // NEON LASER AIMING POINTER (ELECTRIC CYAN)
  // Replaced old yellow with high-tech cyan/aqua laser
  // ==========================================
  renderNeonAimGuide() {
    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return;

    const angle = Math.atan2(dy, dx);
    const powerRatio = Math.min(dist / 125, 1.0);

    const laserCyan = '#00f0ff';
    const laserGlow = '#00e5ff';

    this.ctx.save();

    // 1. LASER TRAJECTORY LINE
    const lineLen = 80 + powerRatio * 130;
    const endX = this.selectedDisc.x + Math.cos(angle) * lineLen;
    const endY = this.selectedDisc.y + Math.sin(angle) * lineLen;

    // Outer Laser Glow
    this.ctx.shadowColor = laserGlow;
    this.ctx.shadowBlur = 12;
    this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + powerRatio * 0.55})`;
    this.ctx.lineWidth = 4 + powerRatio * 2;
    this.ctx.setLineDash([8, 6]);

    this.ctx.beginPath();
    this.ctx.moveTo(this.selectedDisc.x, this.selectedDisc.y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Core Solid White-Cyan Line
    this.ctx.shadowBlur = 0;
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.selectedDisc.x, this.selectedDisc.y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // 2. POWER BEADS ALONG LASER LINE
    const numBeads = 5;
    for (let i = 1; i <= numBeads; i++) {
      const t = (i / (numBeads + 1));
      const bx = this.selectedDisc.x + Math.cos(angle) * (lineLen * t);
      const by = this.selectedDisc.y + Math.sin(angle) * (lineLen * t);

      this.ctx.fillStyle = (t <= powerRatio) ? laserCyan : 'rgba(255, 255, 255, 0.4)';
      this.ctx.beginPath();
      this.ctx.arc(bx, by, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 3. TARGET RETICLE & ARROWHEAD (ELECTRIC CYAN)
    this.ctx.shadowColor = laserCyan;
    this.ctx.shadowBlur = 10;
    this.ctx.fillStyle = laserCyan;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;

    // Diamond Crosshair at target tip
    this.ctx.beginPath();
    this.ctx.arc(endX, endY, 7 + powerRatio * 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Inner White Dot
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(endX, endY, 3, 0, Math.PI * 2);
    this.ctx.fill();

    // 4. POWER PERCENTAGE BADGE
    const pct = Math.round(powerRatio * 100);
    this.ctx.font = 'bold 12px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#000000';
    this.ctx.shadowBlur = 4;
    this.ctx.fillText(`${pct}% POWER`, endX, endY - 14);

    this.ctx.restore();
  }

  // ==========================================
  // 3D GLOSSY PLAYER DISCS
  // ==========================================
  renderDisc(disc, color, textCol) {
    this.ctx.save();

    // Dynamic Pulsing Turn Aura for active human player discs
    const isPlayerTurn = (this.currentTurn === 1 && disc.team === 1 && !this.isMoving && !this.isGameOver);
    if (isPlayerTurn) {
      const pulse = Math.sin(this.animTick * 0.1) * 3;
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 10;
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.arc(disc.x, disc.y, disc.radius + 5 + pulse, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Disc Ground Shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetY = 5;

    // Outer Metallic Chrome Ring (Beveled edge)
    const chromeGrad = this.ctx.createLinearGradient(
      disc.x - disc.radius, disc.y - disc.radius,
      disc.x + disc.radius, disc.y + disc.radius
    );
    chromeGrad.addColorStop(0, '#f8fafc');
    chromeGrad.addColorStop(0.5, '#475569');
    chromeGrad.addColorStop(1, '#0f172a');

    this.ctx.fillStyle = chromeGrad;
    this.ctx.beginPath();
    this.ctx.arc(disc.x, disc.y, disc.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Inner Jersey Colored Core with 3D Glossy Radial Gradient
    this.ctx.shadowColor = 'transparent';
    const jerseyGrad = this.ctx.createRadialGradient(
      disc.x - 6, disc.y - 6, 2,
      disc.x, disc.y, disc.radius - 4
    );
    jerseyGrad.addColorStop(0, '#ffffff');
    jerseyGrad.addColorStop(0.25, color);
    jerseyGrad.addColorStop(1, '#000000');

    this.ctx.fillStyle = jerseyGrad;
    this.ctx.beginPath();
    this.ctx.arc(disc.x, disc.y, disc.radius - 4, 0, Math.PI * 2);
    this.ctx.fill();

    // Jersey Team Ring Accent
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(disc.x, disc.y, disc.radius - 8, 0, Math.PI * 2);
    this.ctx.stroke();

    // Jersey Squad Number with 3D Shadow
    this.ctx.fillStyle = '#000000';
    this.ctx.font = 'bold 15px "Inter", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(disc.num, disc.x + 1, disc.y + 1);

    this.ctx.fillStyle = textCol;
    this.ctx.fillText(disc.num, disc.x, disc.y);

    this.ctx.restore();
  }

  // ==========================================
  // 3D SOCCER BALL WITH ROTATION & SHADOW
  // ==========================================
  renderBall() {
    this.ctx.save();

    // Dynamic Ball Shadow (stretches with movement)
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetY = 4;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.beginPath();
    this.ctx.ellipse(this.ball.x, this.ball.y + 4, this.ball.radius * 1.1, this.ball.radius * 0.7, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 3D Sphere Radial Lighting
    this.ctx.shadowColor = 'transparent';
    const sphereGrad = this.ctx.createRadialGradient(
      this.ball.x - 5, this.ball.y - 5, 2,
      this.ball.x, this.ball.y, this.ball.radius
    );
    sphereGrad.addColorStop(0, '#ffffff');
    sphereGrad.addColorStop(0.7, '#e2e8f0');
    sphereGrad.addColorStop(1, '#64748b');

    this.ctx.fillStyle = sphereGrad;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = '#334155';
    this.ctx.stroke();

    // ROTATING TELSTAR PENTAGONS (Oriented to this.ballAngle)
    this.ctx.save();
    this.ctx.translate(this.ball.x, this.ball.y);
    this.ctx.rotate(this.ballAngle);

    // Center Pentagon
    this.ctx.fillStyle = '#0f172a';
    this.ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
      const px = Math.cos(a) * 5;
      const py = Math.sin(a) * 5;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Perimeter Pentagons
    for (let p = 0; p < 3; p++) {
      const ringAngle = (p * 2 * Math.PI / 3) + Math.PI / 6;
      const cx = Math.cos(ringAngle) * 9.5;
      const cy = Math.sin(ringAngle) * 9.5;

      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    // Specular Highlight Glint
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x - 4, this.ball.y - 4, 3, 0, Math.PI * 2);
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
    // next.match.p1 is guaranteed to be the user!
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
      // winnerId === 1 is always the user (Team 1)
      const winner = (winnerId === 1) ? match.p1 : match.p2;
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
        <span style="color:#00f0ff; font-family:monospace;">${p.code}</span>
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
