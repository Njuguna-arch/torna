/* ===================================================
   TORNA - TOURNAMENT & M-PESA FINANCIAL MANAGER
   Knockout 8-player engine, brackets, payouts & admin
=================================================== */

class TournamentManager {
  constructor() {
    this.totalSlots = 8;
    this.entryFee = 100; // Ksh 100
    this.platformCutRate = 0.30; // 30%
    this.adminPhone = "0712 345 678 (TORNA ADMIN)";

    this.currentTournamentId = 104;
    this.players = [];
    this.userPlayer = null; // Current device player

    // Bracket state
    this.bracket = {
      quarterFinals: [
        { id: 'q1', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 'q2', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 'q3', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 'q4', p1: null, p2: null, winner: null, score: [0, 0] },
      ],
      semiFinals: [
        { id: 's1', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 's2', p1: null, p2: null, winner: null, score: [0, 0] },
      ],
      final: { id: 'fin', p1: null, p2: null, winner: null, score: [0, 0] },
      champion: null
    };

    this.activeMatch = null;
    this.isPracticeMode = false;

    this.initDefaultBots();
  }

  // Calculate prize pool values
  getPrizePool() {
    const total = this.totalSlots * this.entryFee; // Ksh 800
    const commission = Math.round(total * this.platformCutRate); // Ksh 240
    const winnerPrize = total - commission; // Ksh 560
    return { total, commission, winnerPrize };
  }

  initDefaultBots() {
    // Initial 2 dummy players waiting in lobby to show lively activity
    this.players = [
      { id: 'bot-1', name: 'MombasaShark', phone: '0722***101', code: 'SDF91KA3X', team: 'Mombasa Sharks', isUser: false },
      { id: 'bot-2', name: 'RiftRhino', phone: '0711***452', code: 'SDG44LA8Z', team: 'Rift Valley Rhinos', isUser: false },
    ];
  }

  registerPlayer(name, phone, code, team) {
    if (this.players.length >= this.totalSlots) {
      alert("This tournament is currently full! Wait for the next round.");
      return false;
    }

    const player = {
      id: 'usr-' + Date.now(),
      name: name.trim() || 'Player',
      phone: phone.trim(),
      code: code.trim().toUpperCase(),
      team: team || 'Nairobi Stars',
      isUser: true
    };

    this.userPlayer = player;
    this.players.push(player);
    return true;
  }

  fillWithBots() {
    const botNames = [
      'SimbaStriker', 'GorFan99', 'TurboKip', 'CoastSpeed',
      'NakuruSniper', 'EldoretAce', 'DribbleKing'
    ];
    const teams = ['Mombasa Sharks', 'Kisumu Hawks', 'Rift Valley Rhinos', 'Nairobi Stars'];

    while (this.players.length < this.totalSlots) {
      const idx = this.players.length;
      const bName = botNames[idx % botNames.length] + (idx > 4 ? idx : '');
      const bTeam = teams[idx % teams.length];
      const randomCode = 'MP' + Math.random().toString(36).substring(2, 9).toUpperCase();

      this.players.push({
        id: 'bot-' + (idx + 1),
        name: bName,
        phone: '07' + Math.floor(10000000 + Math.random() * 90000000),
        code: randomCode,
        team: bTeam,
        isUser: false
      });
    }
  }

  generateBracket() {
    // Shuffle slots
    const pool = [...this.players];
    // Ensure 8 players
    if (pool.length < 8) this.fillWithBots();

    this.bracket.quarterFinals[0].p1 = pool[0];
    this.bracket.quarterFinals[0].p2 = pool[1];
    this.bracket.quarterFinals[1].p1 = pool[2];
    this.bracket.quarterFinals[1].p2 = pool[3];
    this.bracket.quarterFinals[2].p1 = pool[4];
    this.bracket.quarterFinals[2].p2 = pool[5];
    this.bracket.quarterFinals[3].p1 = pool[6];
    this.bracket.quarterFinals[3].p2 = pool[7];
  }

  findUserNextMatch() {
    if (!this.userPlayer) return null;

    // Check Quarterfinals
    for (const m of this.bracket.quarterFinals) {
      if ((m.p1?.id === this.userPlayer.id || m.p2?.id === this.userPlayer.id) && !m.winner) {
        return { stage: 'Quarter-Final', match: m };
      }
    }

    // Check Semifinals
    for (const m of this.bracket.semiFinals) {
      if ((m.p1?.id === this.userPlayer.id || m.p2?.id === this.userPlayer.id) && !m.winner) {
        return { stage: 'Semi-Final', match: m };
      }
    }

    // Check Final
    const fm = this.bracket.final;
    if ((fm.p1?.id === this.userPlayer.id || fm.p2?.id === this.userPlayer.id) && !fm.winner) {
      return { stage: 'Grand Final', match: fm };
    }

    return null;
  }

  // Simulate other bot matches in the round
  simulateBotMatches() {
    // Simulate QF
    for (const m of this.bracket.quarterFinals) {
      if (!m.winner && m.p1 && m.p2) {
        // If user is playing in this match, don't auto-simulate
        if (m.p1.isUser || m.p2.isUser) continue;
        const winner = Math.random() > 0.5 ? m.p1 : m.p2;
        m.winner = winner;
        m.score = winner === m.p1 ? [2, Math.floor(Math.random() * 2)] : [Math.floor(Math.random() * 2), 2];
      }
    }

    // Advance to SF if QFs are done
    const qfDone = this.bracket.quarterFinals.every(m => m.winner);
    if (qfDone) {
      this.bracket.semiFinals[0].p1 = this.bracket.quarterFinals[0].winner;
      this.bracket.semiFinals[0].p2 = this.bracket.quarterFinals[1].winner;
      this.bracket.semiFinals[1].p1 = this.bracket.quarterFinals[2].winner;
      this.bracket.semiFinals[1].p2 = this.bracket.quarterFinals[3].winner;

      // Simulate bot-vs-bot in SF
      for (const m of this.bracket.semiFinals) {
        if (!m.winner && m.p1 && m.p2) {
          if (m.p1.isUser || m.p2.isUser) continue;
          const winner = Math.random() > 0.5 ? m.p1 : m.p2;
          m.winner = winner;
          m.score = winner === m.p1 ? [2, Math.floor(Math.random() * 2)] : [Math.floor(Math.random() * 2), 2];
        }
      }
    }

    // Advance to Final if SFs are done
    const sfDone = this.bracket.semiFinals.every(m => m.winner);
    if (sfDone) {
      this.bracket.final.p1 = this.bracket.semiFinals[0].winner;
      this.bracket.final.p2 = this.bracket.semiFinals[1].winner;
    }
  }

  recordMatchResult(matchObj, winner, score) {
    matchObj.winner = winner;
    matchObj.score = score;

    this.simulateBotMatches();

    if (this.bracket.final.winner) {
      this.bracket.champion = this.bracket.final.winner;
    }
  }

  resetTournament() {
    this.currentTournamentId++;
    this.players = [];
    this.userPlayer = null;
    this.bracket = {
      quarterFinals: [
        { id: 'q1', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 'q2', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 'q3', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 'q4', p1: null, p2: null, winner: null, score: [0, 0] },
      ],
      semiFinals: [
        { id: 's1', p1: null, p2: null, winner: null, score: [0, 0] },
        { id: 's2', p1: null, p2: null, winner: null, score: [0, 0] },
      ],
      final: { id: 'fin', p1: null, p2: null, winner: null, score: [0, 0] },
      champion: null
    };
    this.initDefaultBots();
  }
}

window.tournament = new TournamentManager();
