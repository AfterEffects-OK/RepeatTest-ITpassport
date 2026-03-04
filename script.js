const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let emergencyOsc = null;
let sirenInterval = null;

const Sound = {
    playShoot: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    },
    playHit: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    },
    playError: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    },
    playBonus: () => {
        const now = audioCtx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);
            gain.gain.setValueAtTime(0.1, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.4);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.4);
        });
    },
    playLifeUp: () => {
        const now = audioCtx.currentTime;
        const notes = [587.33, 783.99, 1174.66]; // D5, G5, D6
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.15, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.3);
        });
    },
    startEmergency: () => {
        if (emergencyOsc) return;
        emergencyOsc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        emergencyOsc.type = 'sine';
        emergencyOsc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.1);
        emergencyOsc.connect(gain); gain.connect(audioCtx.destination);
        emergencyOsc.start();
        sirenInterval = setInterval(() => {
            if (!emergencyOsc) return;
            emergencyOsc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4);
            emergencyOsc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.8);
        }, 800);
    },
    stopEmergency: () => {
        if (emergencyOsc) { try { emergencyOsc.stop(); } catch(e){} emergencyOsc = null; }
        if (sirenInterval) { clearInterval(sirenInterval); sirenInterval = null; }
    }
};

// スプレッドシートから読み込んだクイズデータを格納する
let quizBank = [];
let quizDataLoaded = false;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-display');
const timerEl = document.getElementById('timer-display');
const aimEl = document.getElementById('aim-display');
const shotsEl = document.getElementById('shots-count');
const hitsEl = document.getElementById('hits-count');
const accuracyEl = document.getElementById('accuracy-rate');
const accuracyMiniFill = document.getElementById('accuracy-mini-fill');
const lockStatusEl = document.getElementById('lock-status');
const questionEl = document.getElementById('question-text');
const weaponHeat = document.getElementById('weapon-heat');
const distanceBarFill = document.querySelector('#distance-bar');
const distanceText = document.getElementById('distance-text');
const pilotDisplay = document.getElementById('pilot-name-display');
const overlay = document.getElementById('overlay');
const bodyMain = document.getElementById('body-main');
const radarBlipsEl = document.getElementById('radar-blips');
const startForm = document.getElementById('start-form');
const rankingOverlay = document.getElementById('ranking-overlay');
const rankingListContainer = document.getElementById('ranking-list-container');
const myScoresListContainer = document.getElementById('my-scores-list-container');

let width, height;
let player = null, bullets = [], enemies = [];
let score = 0, lives = 3, startTime = 0, gameElapsedTime = 0;
let shotsFired = 0, shotsHit = 0;
let incorrectlyAnswered = [];
let currentQuiz = {}, gameState = 'START';
let selectedCategory = 'all';
let pauseStartTime = 0;
let lastShotTime = 0;
let pilotEmail = "";
const shotCooldown = 250;
const MAX_LIVES = 3;
// TODO: 上記の.gsファイルをデプロイして取得したウェブアプリのURLをここに設定してください。
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwVjD65x3sD8ACec6Z2C2svyN959x-Ck2U2khZDy8oKC1YdppdpbcBVrcn4HSjkbmuD/exec';


let stars = [];
const STAR_COUNT = 150;

function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({ x: Math.random() * width - width / 2, y: Math.random() * height - height / 2, z: Math.random() * 2, size: Math.random() * 2 + 0.5, brightness: Math.random() });
    }
}

function drawSpaceBackground() {
    ctx.save(); ctx.translate(width / 2, height / 2);
    stars.forEach(star => {
        star.z -= 0.002; if (star.z <= 0) star.z = 2;
        const scale = 400 / star.z; const px = star.x * (scale / 400); const py = star.y * (scale / 400);
        const opacity = Math.min(1, (2 - star.z) * star.brightness);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`; ctx.beginPath(); ctx.arc(px, py, star.size * (1 / star.z), 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

function formatTime(ms) {
    const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

class Player {
    constructor() { this.x = width / 2; this.y = height / 2; this.targetX = this.x; this.targetY = this.y; this.recoil = 0; this.lockedEnemy = null; }
    update() {
        this.x += (this.targetX - this.x) * 0.15; this.y += (this.targetY - this.y) * 0.15; this.recoil *= 0.8;
        this.lockedEnemy = null;
        for (const en of enemies) {
            const p = en.getPos(); const hw = (en.w * p.s) / 2, hh = (en.h * p.s) / 2;
            if (this.x > p.x - hw && this.x < p.x + hw && this.y > p.y - hh && this.y < p.y + hh) { this.lockedEnemy = en; break; }
        }
        if (this.lockedEnemy) { lockStatusEl.innerText = "LOCK ON"; lockStatusEl.className = "locked-on"; }
        else { lockStatusEl.innerText = "---"; lockStatusEl.className = "no-lock"; }
    }
    draw() {
        const size = 40 + this.recoil; const color = this.lockedEnemy ? '#ff4b2b' : '#00f2fe';
        if (this.lockedEnemy) {
            const p = this.lockedEnemy.getPos(); const fw = this.lockedEnemy.w * p.s + 20; const fh = this.lockedEnemy.h * p.s + 20;
            ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = '#ff4b2b'; ctx.lineWidth = 2;
            const cl = 15;
            ctx.beginPath(); ctx.moveTo(-fw/2, -fh/2 + cl); ctx.lineTo(-fw/2, -fh/2); ctx.lineTo(-fw/2 + cl, -fh/2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fw/2 - cl, -fh/2); ctx.lineTo(fw/2, -fh/2); ctx.lineTo(fw/2, -fh/2 + cl); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-fw/2, fh/2 - cl); ctx.lineTo(-fw/2, fh/2); ctx.lineTo(-fw/2 + cl, fh/2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(fw/2 - cl, fh/2); ctx.lineTo(fw/2, fh/2); ctx.lineTo(fw/2, fh/2 - cl); ctx.stroke();
            ctx.restore();
        }
        ctx.save(); ctx.translate(this.x, this.y); ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); if(!this.lockedEnemy) ctx.setLineDash([5, 5]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-4, 0); ctx.moveTo(15, 0); ctx.lineTo(4, 0);
        ctx.moveTo(0, -15); ctx.lineTo(0, -4); ctx.moveTo(0, 15); ctx.lineTo(0, 4); ctx.stroke();
        ctx.restore();
    }
}

class Bullet {
    constructor(tx, ty) { this.z = 1.0; this.tx = tx; this.ty = ty; }
    update() { this.z -= 0.05; return this.z <= 0; }
    draw() { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(this.tx, this.ty, Math.max(1, this.z * 15), 0, Math.PI * 2); ctx.fill(); }
}

class Enemy {
    constructor(text, isCorrect, col, row) { this.text = text; this.isCorrect = isCorrect; this.col = col; this.row = row; this.z = 0; this.w = 200; this.h = 60; }
    update() { this.z += 0.0004; return this.z >= 2.0; }
    getPos() { const scale = Math.max(0.1, 0.2 + this.z * 2); return { x: width/2 + (this.col * 300 * this.z), y: height/2 + (this.row * 180 * this.z), s: scale }; }
    draw() {
        const p = this.getPos(); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.s, p.s); ctx.globalAlpha = Math.min(1, this.z * 5);
        let color = this.z > 1.2 ? "#ff4b2b" : (this.z > 0.6 ? "#ffcc00" : "#00f2fe");
        ctx.fillStyle = "rgba(0, 15, 30, 0.9)"; ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h); ctx.strokeRect(-this.w/2, -this.h/2, this.w, this.h);
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const maxWidth = this.w - 20;
        const lineHeight = 20;
        const strText = String(this.text);
        let line = '';
        let lines = [];
        for (let i = 0; i < strText.length; i++) {
            const testLine = line + strText[i];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line.length > 0) {
                lines.push(line);
                line = strText[i];
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        const startY = -((lines.length - 1) * lineHeight) / 2;
        lines.forEach((l, i) => ctx.fillText(l, 0, startY + (i * lineHeight)));
        ctx.restore();
    }
}

function initGame() {
    player = new Player(); bullets = []; enemies = []; score = 0; lives = 3; shotsFired = 0; shotsHit = 0; incorrectlyAnswered = [];
    startTime = Date.now(); gameState = 'PLAYING';
    overlay.classList.add('hidden'); document.getElementById('stats-overlay').classList.add('hidden'); document.getElementById('start-form').classList.add('hidden');
    accuracyMiniFill.style.width = "0%";
    nextQuestion();
}

function nextQuestion() {
    // カテゴリで問題をフィルタリング
    const questionPool = selectedCategory === 'all' 
        ? quizBank 
        : quizBank.filter(q => q.category === selectedCategory);

    if (questionPool.length === 0) {
        // 該当カテゴリに問題がない、またはそもそもクイズバンクが空の場合
        questionEl.innerText = selectedCategory === 'all'
            ? "利用可能なクイズがありません。"
            : `カテゴリ「${selectedCategory}」に利用可能なクイズがありません。`;
        enemies = []; // 敵をクリア
        return;
    }
    // スプレッドシートから読み込んだデータからランダムに1つ問題を選ぶ
    const quizFromSheet = questionPool[Math.floor(Math.random() * questionPool.length)];

    // 15個以上の不正解プールからランダムに3つを抽出する
    const shuffledDistractors = quizFromSheet.distractorPool.sort(() => 0.5 - Math.random());
    const selectedDistractors = shuffledDistractors.slice(0, 3);

    // 現在の質問オブジェクトを生成
    currentQuiz = {
        q: quizFromSheet.q,
        a: quizFromSheet.a,
        d: selectedDistractors,
        explanation: quizFromSheet.explanation, // 解説とカテゴリも保持
        category: quizFromSheet.category
    };

    questionEl.innerText = currentQuiz.q; 
    enemies = [];
    const opts = [currentQuiz.a, ...currentQuiz.d].sort(() => Math.random() - 0.5); const dirs = [{c:-1,r:-1}, {c:1,r:-1}, {c:-1,r:1}, {c:1,r:1}];
    opts.forEach((o, i) => enemies.push(new Enemy(o, o === currentQuiz.a, dirs[i].c, dirs[i].r)));
}

function gameLoop() {
    if (gameState === 'PAUSED') {
        requestAnimationFrame(gameLoop);
        return;
    }

    ctx.clearRect(0, 0, width, height); drawSpaceBackground();
    if (gameState === 'PLAYING') {
        gameElapsedTime = Date.now() - startTime; timerEl.innerText = formatTime(gameElapsedTime);
        player.update(); aimEl.innerText = `X:${Math.floor(player.x)} Y:${Math.floor(player.y)}`;
        shotsEl.innerText = String(shotsFired).padStart(3, '0');
        hitsEl.innerText = String(shotsHit).padStart(3, '0');
        
        const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
        accuracyEl.innerText = acc + "%";
        accuracyMiniFill.style.width = acc + "%";
        accuracyMiniFill.style.background = acc > 70 ? 'var(--success)' : (acc > 40 ? 'var(--warning)' : 'var(--danger)');

        let maxZ = 0;
        let questionResolvedByTimeout = false;
        let missedCorrect = false;

        // 敵の位置を更新し、画面外に出たかチェックします
        for (const en of enemies) {
            if (en.update()) { // 画面外に出たらtrueを返す
                questionResolvedByTimeout = true;
                if (en.isCorrect) {
                    missedCorrect = true;
                }
            }
        }

        // いずれかの敵が画面外に出たら、問題をリセットします
        if (questionResolvedByTimeout) {
            if (missedCorrect) {
                lives--;
                Sound.playError();
                incorrectlyAnswered.push({
                    question: currentQuiz.q,
                    yourAnswer: '(時間切れ/見逃し)',
                    correctAnswer: currentQuiz.a,
                    explanation: currentQuiz.explanation
                });
            }
            nextQuestion();
        }

        // 敵を描画します
        enemies.forEach((en) => {
            if (en.z > maxZ) maxZ = en.z;
            en.draw();
        });

        // 距離インジケーターを更新
        distanceBarFill.style.width = Math.min(100, (maxZ / 2.0) * 100) + "%";
        if (maxZ > 1.2) { 
            distanceBarFill.style.background = "var(--danger)"; 
            distanceText.innerText = "WARNING"; 
            bodyMain.classList.add('warning-active'); 
            Sound.startEmergency(); 
        } else if (maxZ > 0.6) {
            distanceBarFill.style.background = "var(--warning)";
            distanceText.innerText = "APPROACH"; 
            bodyMain.classList.remove('warning-active');
            Sound.stopEmergency();
        } else { 
            distanceBarFill.style.background = "var(--success)"; 
            distanceText.innerText = "SAFE"; 
            bodyMain.classList.remove('warning-active'); 
            Sound.stopEmergency(); 
        }

        // 弾丸のループを逆順に変更 (削除時のインデックスずれ防止)
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            if (b.update()) { bullets.splice(bi, 1); continue; } 
            b.draw();
            
            // 敵との当たり判定
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const en = enemies[ei];
                const p = en.getPos(); const hw = (en.w * p.s)/2, hh = (en.h * p.s)/2;
                if (b.tx > p.x-hw && b.tx < p.x+hw && b.ty > p.y-hh && b.ty < p.y+hh) {
                    bullets.splice(bi, 1);
                    if (en.isCorrect) { 
                        shotsHit++;
                        let points = 0;
                        if (en.z > 1.2) points = 50;
                        else if (en.z > 0.6) points = 100;
                        else points = 180;
                        
                        if (shotsHit > 0 && shotsHit % 20 === 0) {
                            points += 200;
                            showBonusEffect("BONUS +200");
                            Sound.playBonus();
                        }
                        
                        const oldScore = score;
                        score += points; 

                        const oldThreshold = Math.floor(oldScore / 4000);
                        const newThreshold = Math.floor(score / 4000);

                        if (newThreshold > oldThreshold) {
                            if (lives >= MAX_LIVES) {
                                score += 250;
                                showBonusEffect("BONUS +250");
                                Sound.playBonus();
                            } else {
                                lives = Math.min(MAX_LIVES, lives + 1);
                                showBonusEffect("LIFE UP!");
                                Sound.playLifeUp();
                            }
                        }
                        
                        Sound.playHit(); 
                        nextQuestion(); 
                        break; // 弾が消えたのでこの弾の処理は終了
                    } else { 
                        lives--; 
                        Sound.playError(); 
                        incorrectlyAnswered.push({
                            question: currentQuiz.q,
                            yourAnswer: en.text,
                            correctAnswer: currentQuiz.a,
                            explanation: currentQuiz.explanation
                        });
                        enemies.splice(ei, 1); 
                        break; // 弾が消えたのでこの弾の処理は終了
                    }
                }
            }
        }
        player.draw();
        weaponHeat.style.width = Math.max(0, 100 - (Date.now() - lastShotTime) / 5) + "%";
        if (lives <= 0) { 
            gameState = 'GAMEOVER'; 
            Sound.stopEmergency(); 
            showGameOver();
        }
    }
    scoreEl.innerText = String(score).padStart(6, '0');
    document.getElementById('lives-display').innerText = '❤'.repeat(Math.max(0, Math.min(lives, MAX_LIVES)));
    document.getElementById('health-bar').style.width = (lives / 3) * 100 + "%";

    radarBlipsEl.innerHTML = '';
    enemies.forEach(en => {
        const blip = document.createElement('div'); blip.className = 'blip';
        blip.style.left = (50 + en.col * en.z * 20) + '%'; blip.style.top = (50 + en.row * en.z * 20) + '%';
        blip.style.backgroundColor = '#fff'; radarBlipsEl.appendChild(blip);
    });
    requestAnimationFrame(gameLoop);
}

/**
 * スコアをGoogle Apps Scriptバックエンドに送信します。
 * @param {object} scoreData - 送信するスコアデータ
 */
async function submitScore(scoreData) {
    if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL === '') {
        console.warn('ウェブアプリURLが設定されていません。スコアは送信されません。');
        return;
    }

    try {
        // Google Apps ScriptへのPOSTは 'no-cors' モードで送信するのが簡単です。
        // これにより、クライアント側はレスポンス内容を読み取れませんが、
        // データを一方的に送信するだけなら問題ありません。
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scoreData)
        });
        console.log('スコアがバックエンドに送信されました。');
    } catch (error) {
        console.error('スコアの送信中にエラーが発生しました:', error);
    }
}

function showGameOver() {
    overlay.classList.remove('hidden');
    const statsOverlay = document.getElementById('stats-overlay');
    statsOverlay.classList.remove('hidden');
    const statsContainer = document.getElementById('final-stats-container');
    const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
    
    let reviewHtml = '';
    if (incorrectlyAnswered.length > 0) {
        reviewHtml = `
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255, 75, 43, 0.4); text-align: left;">
                <h4 style="color: var(--warning); margin: 0 0 15px 0; font-size: 20px; letter-spacing: 1px;">MISSION REVIEW</h4>
                ${incorrectlyAnswered.map((item, index) => `
                    <div class="review-card" onclick="openReviewModal(${index})" style="margin-bottom: 20px; background: rgba(255,255,255,0.03); padding: 12px;">
                        <p style="font-size: 16px; color: rgba(255,255,255,0.8); margin: 0 0 8px 0; line-height: 1.5;">Q: ${item.question}</p>
                        <p style="margin: 4px 0; font-size: 17px; line-height: 1.4;"><span style="color: var(--danger); font-weight: bold;">YOURS:</span> ${item.yourAnswer}</p>
                        <p style="margin: 4px 0; font-size: 17px; line-height: 1.4;"><span style="color: var(--success); font-weight: bold;">ANSWER:</span> ${item.correctAnswer}</p>
                        <p style="margin: 12px 0 0 0; font-size: 15px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.2); padding: 8px; line-height: 1.5;">
                            <span style="color: var(--primary); font-weight: bold;">解説:</span> ${item.explanation || '解説はありません。'}
                        </p>
                        <p style="text-align: right; font-size: 10px; color: var(--primary); margin: 5px 0 0 0; opacity: 0.7;">▶ CLICK TO EXPAND</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    statsContainer.innerHTML = `
        <div style="margin-bottom: 10px;">
            <p style="margin: 5px 0;"><span class="label">PILOT</span> ${pilotDisplay.innerText}</p>
            <p style="margin: 5px 0;"><span class="label">SCORE</span> ${score}</p>
            <p style="margin: 5px 0;"><span class="label">TIME</span> ${timerEl.innerText}</p>
        </div>
        <div class="result-graph-container">
            <span class="label">FINAL ACCURACY: ${acc}%</span>
            <div class="result-bar-bg">
                <div id="result-bar-fill" class="result-bar-fill"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.4); margin-top: 4px;">
                <span>0%</span><span>50%</span><span>100%</span>
            </div>
        </div>
        ${reviewHtml}
    `;

    // バックエンドに送信するスコアデータを作成
    const finalScoreData = {
        name: pilotDisplay.innerText,
        email: pilotEmail,
        score: score,
        elapsedTime: timerEl.innerText,
        accuracy: acc,
        hits: shotsHit
    };
    submitScore(finalScoreData);

    setTimeout(() => {
        const fill = document.getElementById('result-bar-fill');
        if (fill) fill.style.width = acc + "%";
    }, 100);
}

function openReviewModal(index) {
    const item = incorrectlyAnswered[index];
    if (!item) return;
    
    const modal = document.getElementById('review-modal');
    const content = document.getElementById('modal-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 30px;">
            <p style="color: var(--primary); font-size: 14px; margin-bottom: 5px; font-weight: bold;">QUESTION</p>
            <p style="font-size: 24px; line-height: 1.4; margin: 0;">${item.question}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            <div style="background: rgba(255, 75, 43, 0.1); padding: 15px; border: 1px solid var(--danger);">
                <p style="color: var(--danger); font-size: 14px; margin-bottom: 5px; font-weight: bold;">YOUR ANSWER</p>
                <p style="font-size: 20px; margin: 0;">${item.yourAnswer}</p>
            </div>
            <div style="background: rgba(0, 255, 135, 0.1); padding: 15px; border: 1px solid var(--success);">
                <p style="color: var(--success); font-size: 14px; margin-bottom: 5px; font-weight: bold;">CORRECT ANSWER</p>
                <p style="font-size: 20px; margin: 0;">${item.correctAnswer}</p>
            </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-left: 4px solid var(--primary);">
            <p style="color: var(--primary); font-size: 14px; margin-bottom: 10px; font-weight: bold;">EXPLANATION</p>
            <p style="font-size: 22px; line-height: 1.6; margin: 0;">${item.explanation || '解説はありません。'}</p>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

/**
 * ランキングデータを処理し、表示します。
 */
async function fetchAndRenderRanking() {
    rankingListContainer.innerHTML = `<p style="text-align: center; color: var(--secondary);">LOADING RANKING...</p>`;
    myScoresListContainer.innerHTML = `<p style="text-align: center; color: var(--secondary);">LOADING MY SCORES...</p>`;
    try {
        // type=rankingパラメータを付与してGETリクエストを送信
        const response = await fetch(GAS_WEB_APP_URL + '?type=ranking');
        if (!response.ok) throw new Error('Failed to load ranking data.');
        const scores = await response.json();

        // 全体のリーダーボードを処理
        if (!Array.isArray(scores) || scores.length === 0) {
            rankingListContainer.innerHTML = '<p style="text-align: center;">NO RANKING DATA AVAILABLE.</p>';
        } else {
            // プレイヤーごとの最高スコアを抽出
            const bestScores = {};
            scores.forEach(score => {
                // データ型を数値に統一
                score.score = Number(score.score) || 0;
                score.accuracy = Number(score.accuracy) || 0;
                score.hits = Number(score.hits) || 0;

                // プレイヤーを一意に識別するキーを作成
                const playerKey = `${score.name || 'GUEST'}|${score.email || ''}`;
                const existing = bestScores[playerKey];

                if (!existing) {
                    bestScores[playerKey] = score;
                } else {
                    // より良いスコアか判定
                    if (score.score > existing.score) {
                        bestScores[playerKey] = score;
                    } else if (score.score === existing.score) {
                        if (score.accuracy > existing.accuracy) {
                            bestScores[playerKey] = score;
                        } else if (score.accuracy === existing.accuracy && score.hits > existing.hits) {
                            bestScores[playerKey] = score;
                        }
                    }
                }
            });

            // 最終的なランキングリストをソート
            const rankedList = Object.values(bestScores).sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
                return b.hits - a.hits;
            });

            // HTMLを生成して表示
            renderRanking(rankedList, rankingListContainer);
        }

        // 個人のスコア履歴を処理
        const currentPilotEmail = document.getElementById('input-email').value;
        if (currentPilotEmail) {
            const myScores = scores.filter(score => score.email === currentPilotEmail)
                                   .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // 新しい順
            if (myScores.length > 0) {
                renderMyScores(myScores);
            } else {
                myScoresListContainer.innerHTML = '<p style="text-align: center;">YOUR SCORE HISTORY IS EMPTY.</p>';
            }
        } else {
            myScoresListContainer.innerHTML = '<p style="text-align: center;">ENTER YOUR EMAIL TO SEE YOUR SCORE HISTORY.</p>';
        }

    } catch (error) {
        console.error('Ranking fetch error:', error);
        rankingListContainer.innerHTML = `<p style="text-align: center; color: var(--danger);">FAILED TO LOAD RANKING</p>`;
        myScoresListContainer.innerHTML = `<p style="text-align: center; color: var(--danger);">FAILED TO LOAD YOUR SCORES</p>`;
    }
}

function renderRanking(rankedList, container) {
    const currentPilotName = localStorage.getItem('pilotName') || document.getElementById('input-name').value || 'GUEST';
    const currentPilotEmail = localStorage.getItem('pilotEmail') || document.getElementById('input-email').value;

    let html = `
        <div class="ranking-table">
            <div class="ranking-header">
                <div>RANK</div>
                <div class="ranking-pilot-name">PILOT</div>
                <div>SCORE</div>
                <div>ACCURACY</div>
            </div>
            ${rankedList.map((p, index) => {
                const isMyRank = (p.name === (currentPilotName || 'GUEST').toUpperCase() && p.email === currentPilotEmail);
                return `<div class="ranking-row ${isMyRank ? 'my-rank' : ''}">
                    <div>#${index + 1}</div>
                    <div class="ranking-pilot-name">${p.name || 'GUEST'}</div>
                    <div>${p.score}</div>
                    <div>${p.accuracy}%</div>
                </div>
            `}).join('')}
        </div>
    `;
    container.innerHTML = html;
}

function renderMyScores(myScores) {
    // 個人スコアの中から最高スコアを見つける
    const myBestScore = myScores.reduce((best, current) => {
        if (!best) return current;
        if (current.score > best.score) return current;
        if (current.score === best.score && current.accuracy > best.accuracy) return current;
        if (current.score === best.score && current.accuracy === best.accuracy && current.hits > best.hits) return current;
        return best;
    }, null);

    let html = `
        <div class="ranking-table">
            <div class="ranking-header" style="grid-template-columns: 4fr 2fr 2fr;">
                <div>TIMESTAMP</div>
                <div>SCORE</div>
                <div>ACCURACY</div>
            </div>
            ${myScores.map(p => {
                const isBest = (p === myBestScore);
                return `<div class="ranking-row ${isBest ? 'my-best-score' : ''}" style="grid-template-columns: 4fr 2fr 2fr;">
                    <div>${p.timestamp}</div>
                    <div>${p.score}</div>
                    <div>${p.accuracy}%</div>
                </div>
            `}).join('')}
        </div>
    `;
    myScoresListContainer.innerHTML = html;
}

async function initializeApp() {
    const startBtn = document.getElementById('start-btn');
    const categorySelect = document.getElementById('category-select');
    startBtn.disabled = true;
    startBtn.innerText = 'LOADING QUIZ DATA...';

    const url = GAS_WEB_APP_URL + '?type=quiz';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        quizBank = data;
        quizDataLoaded = true;

        if (quizBank.length === 0) {
            console.warn('スプレッドシートから読み込んだクイズが0件です。');
            document.getElementById('overlay-title').innerText = 'NO QUIZZES FOUND';
            const startForm = document.getElementById('start-form');
            startForm.innerHTML = `<p style="color:var(--warning); font-size: 12px; text-align: center; line-height: 1.6;">利用可能なクイズが見つかりませんでした。<br><br>【確認してください】<br>スプレッドシート「問題集」シートに、<br>以下の条件を満たす行がありますか？<br><br>1. 問題文、正解、不正解(3つ以上)が入力されている<br>2. 「表示・非表示フラグ」のチェックがOFFになっている</p>`;
            startBtn.style.display = 'none'; // スタートボタンを非表示にする
            return; // 処理を中断
        }

        // カテゴリリストを生成してプルダウンに追加
        const categories = [...new Set(quizBank.map(q => q.category).filter(Boolean))];
        categories.sort(); // アルファベット順にソート
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat.toUpperCase();
            categorySelect.appendChild(option);
        });
        categorySelect.disabled = false; // プルダウンを有効化

        console.log(`${quizBank.length}件のクイズをスプレッドシートから読み込みました。`);
        
        startBtn.disabled = false;
        startBtn.innerText = 'INITIALIZE SYSTEM';
    } catch (error) {
        console.error('クイズデータの読み込みに失敗しました:', error);
        document.getElementById('overlay-title').innerText = 'LOAD ERROR';
        const errorMessage = error.message || '不明なエラーが発生しました。';
        startForm.innerHTML = `<p style="color:var(--danger); font-size: 12px; text-align: center; line-height: 1.6;">クイズデータの読み込みに失敗しました。<br><br>【考えられる原因】<br>1. GASのデプロイが最新でない<br>2. シート名が「問題集」でない<br>3. スプレッドシートのアクセス権限がない<br><br>詳細は開発者コンソール(F12)を確認してください。<br><br><span style="font-size:10px; color: rgba(255,255,255,0.5);">エラー: ${errorMessage}</span></p>`;
    }
}

function showBonusEffect(text) {
    const el = document.createElement('div');
    el.className = 'bonus-effect';
    el.innerText = text;
    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

function shoot() {
    if (gameState !== 'PLAYING' || Date.now() - lastShotTime < shotCooldown) return;
    bullets.push(new Bullet(player.x, player.y)); shotsFired++;
    Sound.playShoot(); player.recoil = 15; lastShotTime = Date.now();
}

function resize() { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height; initStars(); }

// --- イベントリスナーと初期化 ---

window.addEventListener('resize', resize);
window.addEventListener('mousemove', e => { if (player) { player.targetX = e.clientX; player.targetY = e.clientY; } });
window.addEventListener('mousedown', e => { if (gameState === 'PLAYING' && !e.target.closest('.btn') && !e.target.closest('input')) shoot(); });
window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'p') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
            togglePause();
        }
    }
});

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseStartTime = Date.now();
        document.getElementById('pause-overlay').classList.remove('hidden');
        Sound.stopEmergency();
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        startTime += (Date.now() - pauseStartTime);
        document.getElementById('pause-overlay').classList.add('hidden');
    }
}

function showRanking() {
    startForm.classList.add('hidden');
    rankingOverlay.classList.remove('hidden');
    fetchAndRenderRanking();
}

function hideRanking() {
    rankingOverlay.classList.add('hidden');
    startForm.classList.remove('hidden');
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const contentId = button.id.replace('-tab-btn', '-content');
            document.getElementById(contentId).classList.add('active');
        });
    });
}

document.getElementById('start-btn').addEventListener('click', () => {
    if (!quizDataLoaded) {
        alert('クイズデータをロード中です。しばらく待ってからもう一度お試しください。');
        return;
    }
    const nameInput = document.getElementById('input-name');
    const emailInput = document.getElementById('input-email');
    const categorySelect = document.getElementById('category-select');
    const nameVal = nameInput.value || 'GUEST';
    pilotEmail = emailInput.value || '';
    selectedCategory = categorySelect.value;

    // 情報を保存
    localStorage.setItem('pilotName', nameInput.value);
    localStorage.setItem('pilotEmail', pilotEmail);

    pilotDisplay.innerText = nameVal.toUpperCase();
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
    initGame();
});

document.getElementById('restart-btn').addEventListener('click', () => {
    // ゲームオーバー画面からリスタートする際は、名前入力画面に戻さず即再開
    overlay.classList.add('hidden');
    document.getElementById('stats-overlay').classList.add('hidden');
    initGame();
});

document.getElementById('ranking-btn').addEventListener('click', showRanking);
document.getElementById('back-from-ranking-btn').addEventListener('click', hideRanking);

document.getElementById('back-to-start-btn').addEventListener('click', () => {
    document.getElementById('stats-overlay').classList.add('hidden');
    document.getElementById('start-form').classList.remove('hidden');
    gameState = 'START';
});

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('review-modal').classList.add('hidden');
});

// --- アプリケーション起動 ---

resize();
requestAnimationFrame(gameLoop);

// 保存されたプレイヤー情報を読み込み
const savedName = localStorage.getItem('pilotName');
const savedEmail = localStorage.getItem('pilotEmail');
if (savedName) document.getElementById('input-name').value = savedName;
if (savedEmail) document.getElementById('input-email').value = savedEmail;

setupTabs();
initializeApp(); // クイズデータの読み込みを開始