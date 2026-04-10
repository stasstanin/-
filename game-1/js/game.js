    (function() {
        'use strict';
        
        // ========== DOM ELEMENTS ==========
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        const menuOverlay = document.getElementById('menuOverlay');
        const shopOverlay = document.getElementById('shopOverlay');
        const deathOverlay = document.getElementById('deathOverlay');
        const winOverlay = document.getElementById('winOverlay');
        const rewardBanner = document.getElementById('rewardBanner');
        const levelIndicator = document.getElementById('levelIndicator');
        
        const btnPlay = document.getElementById('btnPlay');
        const btnShop = document.getElementById('btnShop');
        const btnShopBack = document.getElementById('btnShopBack');
        const btnRestart = document.getElementById('btnRestart');
        const btnMenu = document.getElementById('btnMenu');
        const btnWinMenu = document.getElementById('btnWinMenu');
        
        const menuCoinsEl = document.getElementById('menuCoins');
        const menuLivesEl = document.getElementById('menuLives');
        const shopCoinsEl = document.getElementById('shopCoins');
        const shopGridEl = document.getElementById('shopGrid');
        const deathTitleEl = document.getElementById('deathTitle');
        const deathMessageEl = document.getElementById('deathMessage');
        const finalCoinsEl = document.getElementById('finalCoins');
        
        // ========== CONSTANTS ==========
        const TOTAL_LEVELS = 6;
        const GRAVITY = 0.4;
        const FLAP_POWER = -9;
        const MAX_VELOCITY = 14;
        const BOUNCE_FACTOR = -0.4;
        const THREAT_SPEED = 0.7; // Уменьшил с 1.5 до 0.7 - угроза поднимается медленнее
        
        // ========== GAME STATE ==========
        let gameState = 'menu';
        let currentLevel = 0;
        let taps = 0;
        let lives = 0;
        let coins = 300;
        let levelsCompleted = 0;
        let cameraShake = 0;
        let cameraOffsetY = 0;
        let gameCompletedOnce = false;
        
        // Cat
        let cat = {
            x: 0,
            y: 0,
            vy: 0,
            width: 60,
            height: 70,
            color: '#ff9966',
            eyeScale: 1,
            flapFrame: 0
        };
        
        // Skins
        let skins = [
            { id: 'default', name: 'Рыжий', color: '#ff9966', price: 0, unlocked: true, special: false },
            { id: 'black', name: 'Чёрный', color: '#2d2d2d', price: 100, unlocked: false, special: false },
            { id: 'white', name: 'Белый', color: '#f0f0f0', price: 100, unlocked: false, special: false },
            { id: 'gray', name: 'Серый', color: '#707070', price: 150, unlocked: false, special: false },
            { id: 'orange', name: 'Оранж', color: '#ff6600', price: 200, unlocked: false, special: false },
            { id: 'cyan', name: 'Бирюзовый', color: '#40e0d0', price: 300, unlocked: false, special: false },
            { id: 'golden', name: 'Золотой', color: '#ffd700', price: -1, unlocked: false, special: true }
        ];
        let selectedSkin = 'default';
        
        // Levels - ТОЧНО 6 уровней
        const levels = [
            { name: 'Подвал', targetTaps: 30, bg: '#1e2530', threat: 'water', threatColor: '#2980b9', ceilingColor: '#5d4037', ceilingType: 'wood' },
            { name: 'Собаки', targetTaps: 60, bg: '#6b5b00', threat: 'dog', threatColor: '#6d4c41', ceilingColor: '#757575', ceilingType: 'concrete' },
            { name: 'Плантация', targetTaps: 125, bg: '#1b5e20', threat: 'bees', threatColor: '#f9a825', ceilingColor: '#33691e', ceilingType: 'leaves' },
            { name: 'Землетрясение', targetTaps: 0, bg: '#37474f', isQTE: true, qteTarget: 15 },
            { name: 'Ледяная пещера', targetTaps: 250, bg: '#4a6fa5', threat: 'ice', threatColor: '#b3e5fc', ceilingColor: '#81d4fa', ceilingType: 'ice' },
            { name: 'Чердак', targetTaps: 500, bg: '#4e342e', threat: 'dust', threatColor: '#9e9e9e', ceilingColor: '#3e2723', ceilingType: 'wood', hasChandelier: true }
        ];
        
        // Escape state
        let escapeState = {
            active: false,
            threatY: 0,
            holeOpen: false,
            holeWidth: 0
        };
        
        // QTE state
        let qteState = {
            clicks: 0,
            target: 15,
            active: false,
            direction: 0,
            debris: []
        };
        
        // Particles
        let particles = [];
        
        // ========== HELPER FUNCTIONS ==========
        function clamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        }
        
        function getCurrentLevel() {
            if (currentLevel >= 0 && currentLevel < levels.length) {
                return levels[currentLevel];
            }
            return levels[0];
        }
        
        // ========== CANVAS SETUP ==========
        function resizeCanvas() {
            const container = document.getElementById('gameContainer');
            const containerW = container.clientWidth;
            const containerH = container.clientHeight;
            
            const gameRatio = 9 / 16;
            let w, h;
            
            if (containerW / containerH > gameRatio) {
                h = containerH;
                w = h * gameRatio;
            } else {
                w = containerW;
                h = w / gameRatio;
            }
            
            canvas.width = 400;
            canvas.height = Math.floor(400 / gameRatio);
            canvas.style.width = Math.floor(w) + 'px';
            canvas.style.height = Math.floor(h) + 'px';
            
            cat.x = canvas.width / 2 - cat.width / 2;
        }
        
        // ========== GAME INIT ==========
        function initGame() {
            // Reset all game state
            cat.y = canvas.height / 2;
            cat.vy = 0;
            cat.x = canvas.width / 2 - cat.width / 2;
            taps = 0;
            cameraShake = 0;
            cameraOffsetY = 0;
            
            escapeState = {
                active: false,
                threatY: canvas.height + 150, // Начинаем угрозу чуть ниже
                holeOpen: false,
                holeWidth: 0
            };
            
            const level = getCurrentLevel();
            qteState = {
                clicks: 0,
                target: level.isQTE ? level.qteTarget : 15,
                active: false,
                direction: 0,
                debris: []
            };
            
            particles = [];
        }
        
        // ========== GAME LOOP ==========
        function gameLoop() {
            if (gameState === 'playing' || gameState === 'escape' || gameState === 'QTE') {
                update();
            }
            render();
            requestAnimationFrame(gameLoop);
        }
        
        function update() {
            const level = getCurrentLevel();
            
            if (!level) {
                console.error('No level found for index:', currentLevel);
                gameState = 'menu';
                return;
            }
            
            if (level.isQTE) {
                updateQTE(level);
                return;
            }
            
            // Physics
            cat.vy += GRAVITY;
            cat.vy = clamp(cat.vy, -MAX_VELOCITY, MAX_VELOCITY);
            cat.y += cat.vy;
            cat.flapFrame = Math.max(0, cat.flapFrame - 0.15);
            
            // Ceiling collision
            const ceilingY = 60 - cameraOffsetY;
            if (cat.y < ceilingY) {
                if (escapeState.holeOpen) {
                    const holeCenter = canvas.width / 2;
                    const halfHole = escapeState.holeWidth / 2;
                    const catCenterX = cat.x + cat.width / 2;
                    
                    if (catCenterX > holeCenter - halfHole && catCenterX < holeCenter + halfHole) {
                        nextLevel();
                        return;
                    }
                }
                
                cat.y = ceilingY;
                cat.vy *= BOUNCE_FACTOR;
                cat.vy = Math.max(cat.vy, 4);
                createDebris(cat.x + cat.width / 2, ceilingY, level.ceilingColor || '#444');
            }
            
            // Floor collision (vase)
            const vaseY = canvas.height - 80;
            if (cat.y + cat.height > vaseY) {
                handleDeath('ВАЗА РАЗБИТА!');
                return;
            }
            
            // Start escape when target reached
            if (taps >= level.targetTaps && !escapeState.active) {
                startEscape();
            }
            
            // Update escape
            if (escapeState.active) {
                updateEscape(level);
            }
            
            // Update particles
            particles = particles.filter(function(p) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15;
                p.life -= 0.025;
                return p.life > 0;
            });
            
            // Camera shake decay
            cameraShake *= 0.92;
            
            // Eye scale based on threat
            if (escapeState.active) {
                const threatDist = escapeState.threatY - cat.y;
                cat.eyeScale = 1 + clamp((350 - threatDist) / 350, 0, 1) * 0.6;
            } else {
                cat.eyeScale = 1;
            }
        }
        
        function updateEscape(level) {
            // Threat rises SLOWLY
            escapeState.threatY -= THREAT_SPEED;
            
            // Threat collision with bigger buffer for fairness
            if (cat.y + cat.height > escapeState.threatY + 15) { // Увеличил буфер с 5 до 15
                let msg = 'ПОЙМАН!';
                if (level.threat === 'water') msg = 'УТОПИЛСЯ!';
                if (level.threat === 'bees') msg = 'УЖАЛЕН ПЧЁЛАМИ!';
                if (level.threat === 'ice') msg = 'ЗАМЁРЗ!';
                if (level.threat === 'dust') msg = 'ЗАДЫХАЕТСЯ!';
                handleDeath(msg);
                return;
            }
            
            // Open hole EARLIER - when threat is still low on screen
            // Было 250, стало 400 - дыра открывается когда угроза ещё в нижней половине
            if (escapeState.threatY < canvas.height - 200 && !escapeState.holeOpen) {
                escapeState.holeOpen = true;
                escapeState.holeWidth = canvas.width / 2.2; // Чуть шире дыра
                cameraShake = 18;
                createHoleParticles();
            }
            
            // Chandelier logic for final level
            if (level.hasChandelier && escapeState.holeOpen) {
                cameraOffsetY += 0.4; // Чуть медленнее камера
                
                const chandelierY = 130;
                const chandelierX = canvas.width / 2;
                const dist = Math.hypot((cat.x + cat.width/2) - chandelierX, cat.y - chandelierY);
                
                if (dist < 55) {
                    showFinalDeath();
                    return;
                }
            }
        }
        
        function updateQTE(level) {
            cameraShake = 4 + Math.sin(Date.now() / 60) * 4;
            
            // Spawn debris
            if (Math.random() < 0.04) {
                qteState.debris.push({
                    x: Math.random() * canvas.width,
                    y: -30,
                    size: 12 + Math.random() * 25,
                    vy: 3 + Math.random() * 4,
                    rotation: 0,
                    rotSpeed: (Math.random() - 0.5) * 0.15
                });
            }
            
            // Update debris
            qteState.debris = qteState.debris.filter(function(d) {
                d.y += d.vy;
                d.rotation += d.rotSpeed;
                return d.y < canvas.height + 60;
            });
            
            // Cat running
            if (qteState.direction !== 0) {
                cat.x += qteState.direction * 6;
                cat.x = clamp(cat.x, 20, canvas.width - cat.width - 20);
            }
            
            // QTE complete
            if (qteState.clicks >= qteState.target && qteState.active) {
                qteState.active = false;
                cameraShake = 25;
                
                setTimeout(function() {
                    nextLevel();
                }, 800);
            }
        }
        
        // ========== ESCAPE ==========
        function startEscape() {
            escapeState.active = true;
            escapeState.threatY = canvas.height + 150; // Начинаем ниже экрана
            gameState = 'escape';
        }
        
        function createHoleParticles() {
            for (let i = 0; i < 25; i++) {
                particles.push({
                    x: canvas.width / 2 + (Math.random() - 0.5) * escapeState.holeWidth,
                    y: 60,
                    vx: (Math.random() - 0.5) * 10,
                    vy: -Math.random() * 6 - 3,
                    size: 4 + Math.random() * 8,
                    color: levels[currentLevel].ceilingColor || '#444',
                    life: 1
                });
            }
        }
        
        function createDebris(x, y, color) {
            for (let i = 0; i < 4; i++) {
                particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 5,
                    vy: Math.random() * 2 + 1,
                    size: 2 + Math.random() * 4,
                    color: color,
                    life: 0.7
                });
            }
        }
        
        // ========== DEATH ==========
        function handleDeath(message) {
            if (lives > 0) {
                lives--;
                cat.y = canvas.height / 2;
                cat.vy = 0;
                
                if (escapeState.active) {
                    escapeState.threatY = canvas.height + 150;
                    escapeState.holeOpen = false;
                    escapeState.holeWidth = 0;
                    gameState = 'playing';
                }
                
                createReviveEffect();
                return;
            }
            
            gameState = 'death';
            deathTitleEl.textContent = 'КОТ ПОГИБ!';
            deathMessageEl.textContent = message;
            deathOverlay.classList.remove('hidden');
        }
        
        function showFinalDeath() {
            gameState = 'death';
            deathTitleEl.textContent = 'ЛЮСТРА УПАЛА!';
            deathMessageEl.textContent = 'Абсолютный конец...';
            deathOverlay.classList.remove('hidden');
        }
        
        function createReviveEffect() {
            for (let i = 0; i < 15; i++) {
                particles.push({
                    x: cat.x + cat.width / 2,
                    y: cat.y + cat.height / 2,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    size: 6,
                    color: '#ff6b6b',
                    life: 0.8
                });
            }
        }
        
        // ========== LEVEL MANAGEMENT ==========
        function nextLevel() {
            currentLevel++;
            levelsCompleted++;
            
            // Award life every 2 levels
            if (levelsCompleted % 2 === 0) {
                lives++;
            }
            
            // Award coins for completed level
            const prevLevel = levels[currentLevel - 1];
            if (prevLevel) {
                coins += prevLevel.targetTaps || 50;
            }
            
            // Check for game completion
            if (currentLevel >= TOTAL_LEVELS) {
                showWin();
            } else {
                gameState = 'playing';
                initGame();
            }
            
            saveGame();
            updateMenuUI();
        }
        
        function showWin() {
            gameState = 'win';
            
            // Unlock golden cat ONLY on first completion
            if (!gameCompletedOnce) {
                for (let i = 0; i < skins.length; i++) {
                    if (skins[i].id === 'golden') {
                        skins[i].unlocked = true;
                        break;
                    }
                }
                gameCompletedOnce = true;
                rewardBanner.style.display = 'block';
            } else {
                rewardBanner.style.display = 'none';
            }
            
            finalCoinsEl.textContent = coins;
            winOverlay.classList.remove('hidden');
            saveGame();
        }
        
        function updateMenuUI() {
            menuCoinsEl.textContent = coins;
            menuLivesEl.textContent = lives;
            levelIndicator.textContent = 'Уровень: ' + (currentLevel + 1) + '/' + TOTAL_LEVELS;
        }
        
        // ========== RENDER ==========
        function render() {
            ctx.save();
            
            if (cameraShake > 0.5) {
                ctx.translate(
                    (Math.random() - 0.5) * cameraShake,
                    (Math.random() - 0.5) * cameraShake
                );
            }
            
            const level = getCurrentLevel();
            
            drawBackground(level);
            
            if (level.isQTE) {
                drawQTE(level);
            } else {
                drawGameplay(level);
            }
            
            ctx.restore();
        }
        
        function drawBackground(level) {
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, level.bg || '#1a1a2a');
            grad.addColorStop(1, shadeColor(level.bg || '#1a1a2a', -25));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Ambient dots
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            for (let i = 0; i < 30; i++) {
                const x = ((Date.now() / 3000 + i * 0.5) % 1) * canvas.width;
                const y = (i / 30) * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        function drawGameplay(level) {
            drawCeiling(level);
            
            if (escapeState.holeOpen) {
                ctx.fillStyle = '#050510';
                const holeCenter = canvas.width / 2;
                ctx.fillRect(holeCenter - escapeState.holeWidth / 2, -10, escapeState.holeWidth, 70);
            }
            
            drawVase();
            
            if (escapeState.active) {
                drawThreat(level);
            }
            
            drawParticles();
            drawCat();
            
            if (level.hasChandelier && escapeState.holeOpen) {
                drawChandelier();
            }
            
            drawUI(level);
        }
        
        function drawCeiling(level) {
            const ceilingY = Math.max(0, -cameraOffsetY);
            
            ctx.fillStyle = level.ceilingColor || '#444';
            ctx.fillRect(0, ceilingY, canvas.width, 60);
            
            ctx.strokeStyle = shadeColor(level.ceilingColor || '#444', -15);
            ctx.lineWidth = 2;
            
            if (level.ceilingType === 'wood') {
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath();
                    ctx.moveTo(0, ceilingY + 8 + i * 11);
                    ctx.lineTo(canvas.width, ceilingY + 8 + i * 11);
                    ctx.stroke();
                }
            } else if (level.ceilingType === 'ice') {
                for (let i = 0; i < 7; i++) {
                    const x = (i / 7) * canvas.width;
                    ctx.beginPath();
                    ctx.moveTo(x, ceilingY);
                    ctx.lineTo(x + 25, ceilingY + 60);
                    ctx.stroke();
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(0, ceilingY + 12 + i * 14);
                    ctx.lineTo(canvas.width, ceilingY + 12 + i * 14);
                    ctx.stroke();
                }
            }
            
            // Cracks when threat is close
            if (escapeState.active && escapeState.threatY < canvas.height - 100 && !escapeState.holeOpen) {
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 2;
                for (let i = 0; i < 6; i++) {
                    const x = canvas.width / 2 + (Math.random() - 0.5) * 120;
                    ctx.beginPath();
                    ctx.moveTo(x, ceilingY);
                    ctx.lineTo(x + (Math.random() - 0.5) * 25, ceilingY + 45);
                    ctx.stroke();
                }
            }
        }
        
        function drawVase() {
            const y = canvas.height - 75;
            const cx = canvas.width / 2;
            
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.moveTo(cx - 35, y);
            ctx.quadraticCurveTo(cx - 45, y + 35, cx - 25, y + 60);
            ctx.lineTo(cx + 25, y + 60);
            ctx.quadraticCurveTo(cx + 45, y + 35, cx + 35, y);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#A0522D';
            ctx.beginPath();
            ctx.ellipse(cx, y, 35, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.ellipse(cx - 18, y + 25, 6, 16, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        function drawThreat(level) {
            const threatY = escapeState.threatY - cameraOffsetY;
            
            if (level.threat === 'water') {
                ctx.fillStyle = level.threatColor;
                ctx.beginPath();
                ctx.moveTo(0, threatY);
                for (let x = 0; x <= canvas.width; x += 8) {
                    const waveY = threatY + Math.sin(x / 25 + Date.now() / 180) * 7;
                    ctx.lineTo(x, waveY);
                }
                ctx.lineTo(canvas.width, canvas.height + 20);
                ctx.lineTo(0, canvas.height + 20);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                for (let i = 0; i < 8; i++) {
                    const x = (i / 8) * canvas.width + Math.sin(Date.now() / 400 + i) * 15;
                    ctx.beginPath();
                    ctx.arc(x, threatY + Math.sin(x / 25 + Date.now() / 180) * 7, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            else if (level.threat === 'dog') {
                ctx.fillStyle = '#6d4c41';
                ctx.beginPath();
                ctx.ellipse(canvas.width / 2, threatY, 110, 90, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(canvas.width / 2 - 35, threatY - 8, 22, 0, Math.PI * 2);
                ctx.arc(canvas.width / 2 + 35, threatY - 8, 22, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.arc(canvas.width / 2 - 35, threatY - 8, 10, 0, Math.PI * 2);
                ctx.arc(canvas.width / 2 + 35, threatY - 8, 10, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.ellipse(canvas.width / 2, threatY + 25, 18, 13, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (level.threat === 'bees') {
                ctx.fillStyle = level.threatColor;
                for (let i = 0; i < 40; i++) {
                    const bx = (i % 10) * 42 + Math.sin(Date.now() / 80 + i) * 18;
                    const by = threatY + Math.floor(i / 10) * 35 + Math.cos(Date.now() / 120 + i) * 12;
                    
                    ctx.beginPath();
                    ctx.ellipse(bx, by, 7, 5, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            else if (level.threat === 'ice') {
                ctx.fillStyle = level.threatColor;
                for (let i = 0; i < 7; i++) {
                    const x = (i + 0.5) * (canvas.width / 7);
                    const spikeHeight = canvas.height - threatY;
                    
                    ctx.beginPath();
                    ctx.moveTo(x - 18, canvas.height);
                    ctx.lineTo(x, threatY);
                    ctx.lineTo(x + 18, canvas.height);
                    ctx.closePath();
                    ctx.fill();
                    
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.beginPath();
                    ctx.moveTo(x - 8, canvas.height - spikeHeight * 0.25);
                    ctx.lineTo(x - 4, threatY + 15);
                    ctx.lineTo(x, canvas.height - spikeHeight * 0.45);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = level.threatColor;
                }
            }
            else if (level.threat === 'dust') {
                ctx.fillStyle = 'rgba(120, 120, 120, 0.55)';
                for (let i = 0; i < 25; i++) {
                    const dx = Math.sin(i * 1.8) * 140 + canvas.width / 2;
                    const dy = threatY + (i % 5) * 28 + Math.cos(Date.now() / 250 + i) * 8;
                    const size = 18 + Math.random() * 25;
                    
                    ctx.beginPath();
                    ctx.arc(dx, dy, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        
        function drawCat() {
            const x = cat.x;
            const y = cat.y - cameraOffsetY;
            const w = cat.width;
            const h = cat.height;
            
            ctx.save();
            
            const rotation = cat.vy * 0.018;
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate(rotation);
            
            // Golden glow effect
            if (selectedSkin === 'golden' && skins[6] && skins[6].unlocked) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 15;
            }
            
            // Body
            ctx.fillStyle = cat.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, w / 2 - 4, h / 2 - 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Head
            ctx.beginPath();
            ctx.ellipse(0, -h / 2 + 14, 20, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Ears
            ctx.beginPath();
            ctx.moveTo(-16, -h / 2 + 4);
            ctx.lineTo(-22, -h / 2 - 14);
            ctx.lineTo(-9, -h / 2 + 7);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(16, -h / 2 + 4);
            ctx.lineTo(22, -h / 2 - 14);
            ctx.lineTo(9, -h / 2 + 7);
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0;
            
            // Inner ears
            ctx.fillStyle = '#ffbbbb';
            ctx.beginPath();
            ctx.moveTo(-14, -h / 2 + 2);
            ctx.lineTo(-18, -h / 2 - 7);
            ctx.lineTo(-11, -h / 2 + 4);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(14, -h / 2 + 2);
            ctx.lineTo(18, -h / 2 - 7);
            ctx.lineTo(11, -h / 2 + 4);
            ctx.closePath();
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(-7, -h / 2 + 10, 6 * cat.eyeScale, 7 * cat.eyeScale, 0, 0, Math.PI * 2);
            ctx.ellipse(7, -h / 2 + 10, 6 * cat.eyeScale, 7 * cat.eyeScale, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupils
            ctx.fillStyle = '#222';
            const pupilSize = 2.5 * cat.eyeScale;
            ctx.beginPath();
            ctx.arc(-7, -h / 2 + 10, pupilSize, 0, Math.PI * 2);
            ctx.arc(7, -h / 2 + 10, pupilSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Nose
            ctx.fillStyle = '#ffaaaa';
            ctx.beginPath();
            ctx.ellipse(0, -h / 2 + 17, 3.5, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Whiskers
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(-13, -h / 2 + 18 + i * 2);
                ctx.lineTo(-26, -h / 2 + 16 + i * 4);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(13, -h / 2 + 18 + i * 2);
                ctx.lineTo(26, -h / 2 + 16 + i * 4);
                ctx.stroke();
            }
            
            // Paws
            const pawOffset = Math.sin(cat.flapFrame * 2.5) * 4;
            ctx.fillStyle = cat.color;
            
            ctx.beginPath();
            ctx.ellipse(-w / 3, h / 4 + pawOffset, 7, 9, -0.25, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.ellipse(w / 3, h / 4 - pawOffset, 7, 9, 0.25, 0, Math.PI * 2);
            ctx.fill();
            
            // Tail
            ctx.strokeStyle = cat.color;
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, h / 3);
            ctx.quadraticCurveTo(-18, h / 2 + 18, -28 + Math.sin(Date.now() / 180) * 4, h / 2 + 35);
            ctx.stroke();
            
            ctx.restore();
        }
        
        function drawChandelier() {
            const y = 130;
            const x = canvas.width / 2;
            
            ctx.strokeStyle = '#b8860b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, y - 35);
            ctx.stroke();
            
            ctx.fillStyle = '#daa520';
            ctx.beginPath();
            ctx.ellipse(x, y, 45, 25, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
                const lx = x + Math.cos(angle) * 30;
                const ly = y + Math.sin(angle) * 15;
                
                ctx.fillStyle = 'rgba(255, 200, 80, 0.45)';
                ctx.beginPath();
                ctx.arc(lx, ly, 12, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(lx, ly, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        function drawParticles() {
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                ctx.fillStyle = p.color;
                ctx.globalAlpha = clamp(p.life, 0, 1);
                ctx.beginPath();
                ctx.arc(p.x, p.y - cameraOffsetY, clamp(p.size, 1, 20), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        
        function drawUI(level) {
            // Tap counter
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            roundRect(ctx, 12, 12, 140, 46, 8);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Nunito, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Тапы: ' + taps + '/' + level.targetTaps, 22, 40);
            
            // Lives
            for (let i = 0; i < lives; i++) {
                drawHeart(28 + i * 32, 72);
            }
            
            // Level name
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            roundRect(ctx, canvas.width - 120, 12, 108, 32, 8);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px Nunito, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(level.name, canvas.width - 22, 33);
            
            // Level counter
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            roundRect(ctx, canvas.width - 55, 50, 43, 22, 6);
            ctx.fill();
            
            ctx.fillStyle = '#f7c548';
            ctx.font = 'bold 11px Nunito, sans-serif';
            ctx.fillText((currentLevel + 1) + '/' + TOTAL_LEVELS, canvas.width - 12, 66);
            
            // Escape messages
            if (escapeState.active && !escapeState.holeOpen) {
                ctx.fillStyle = '#f1c40f';
                ctx.font = 'bold 22px Nunito, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('УГРОЗА!', canvas.width / 2, 140);
            }
            
            if (escapeState.holeOpen) {
                ctx.fillStyle = '#f1c40f';
                ctx.font = 'bold 18px Nunito, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ЛЕТИ В ДЫРУ!', canvas.width / 2, 95);
                
                ctx.beginPath();
                ctx.moveTo(canvas.width / 2, 120);
                ctx.lineTo(canvas.width / 2 - 12, 138);
                ctx.lineTo(canvas.width / 2 + 12, 138);
                ctx.closePath();
                ctx.fill();
            }
        }
        
        function drawQTE(level) {
            // Debris
            ctx.fillStyle = '#555';
            for (let i = 0; i < qteState.debris.length; i++) {
                const d = qteState.debris[i];
                ctx.save();
                ctx.translate(d.x, d.y);
                ctx.rotate(d.rotation);
                ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
                ctx.restore();
            }
            
            // Cat on ground
            cat.y = canvas.height - 140;
            drawCat();
            
            // Floor
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, canvas.height - 55, canvas.width, 55);
            
            // Warning
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 26px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ЗЕМЛЕТРЯСЕНИЕ!', canvas.width / 2, 140);
            
            // Level indicator
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            roundRect(ctx, canvas.width - 55, 12, 43, 22, 6);
            ctx.fill();
            
            ctx.fillStyle = '#f7c548';
            ctx.font = 'bold 11px Nunito, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText((currentLevel + 1) + '/' + TOTAL_LEVELS, canvas.width - 12, 28);
            
            // Instructions or button
            if (!qteState.active) {
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                roundRect(ctx, canvas.width / 2 - 95, canvas.height / 2 - 55, 190, 110, 12);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px Nunito, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Уклоняйся от обломков!', canvas.width / 2, canvas.height / 2 - 25);
                ctx.fillText('Нажми по центру', canvas.width / 2, canvas.height / 2 + 5);
                ctx.fillText('чтобы начать побег', canvas.width / 2, canvas.height / 2 + 28);
            } else {
                const btnY = canvas.height / 2 + 45;
                
                // Button shadow
                ctx.fillStyle = '#a93226';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, btnY + 4, 62, 0, Math.PI * 2);
                ctx.fill();
                
                // Button
                ctx.fillStyle = '#c0392b';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, btnY, 62, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, btnY - 4, 52, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 18px Nunito, sans-serif';
                ctx.fillText('ЖМИ!', canvas.width / 2, btnY);
                
                // Progress
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                roundRect(ctx, canvas.width / 2 - 95, btnY + 85, 190, 18, 5);
                ctx.fill();
                
                const progress = qteState.clicks / qteState.target;
                ctx.fillStyle = '#27ae60';
                roundRect(ctx, canvas.width / 2 - 93, btnY + 87, 186 * progress, 14, 4);
                ctx.fill();
                
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Nunito, sans-serif';
                ctx.fillText(qteState.clicks + ' / ' + qteState.target, canvas.width / 2, btnY + 99);
            }
        }
        
        function drawHeart(x, y) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(x, y + 4);
            ctx.bezierCurveTo(x, y, x - 9, y, x - 9, y + 7);
            ctx.bezierCurveTo(x - 9, y + 13, x, y + 17, x, y + 21);
            ctx.bezierCurveTo(x, y + 17, x + 9, y + 13, x + 9, y + 7);
            ctx.bezierCurveTo(x + 9, y, x, y, x, y + 4);
            ctx.fill();
        }
        
        function roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }
        
        // ========== UTILITIES ==========
        function shadeColor(color, percent) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = clamp((num >> 16) + amt, 0, 255);
            const G = clamp(((num >> 8) & 0x00FF) + amt, 0, 255);
            const B = clamp((num & 0x0000FF) + amt, 0, 255);
            return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
        }
        
        // ========== INPUT ==========
        function handleInput(x, y) {
            if (gameState !== 'playing' && gameState !== 'escape' && gameState !== 'QTE') return;
            
            const level = getCurrentLevel();
            if (!level) return;
            
            if (level.isQTE) {
                handleQTEInput(x, y);
                return;
            }
            
            taps++;
            cat.vy = FLAP_POWER;
            cat.flapFrame = 1;
            
            for (let i = 0; i < 3; i++) {
                particles.push({
                    x: cat.x + cat.width / 2 + (Math.random() - 0.5) * 25,
                    y: cat.y + cat.height,
                    vx: (Math.random() - 0.5) * 2.5,
                    vy: Math.random() * 2 + 1,
                    size: 3,
                    color: 'rgba(255,255,255,0.4)',
                    life: 0.4
                });
            }
        }
        
        function handleQTEInput(x, y) {
            const centerX = canvas.width / 2;
            
            if (!qteState.active) {
                if (x > centerX - 90 && x < centerX + 90 &&
                    y > canvas.height / 2 - 80 && y < canvas.height / 2 + 80) {
                    qteState.active = true;
                    cameraShake = 12;
                }
                return;
            }
            
            const btnY = canvas.height / 2 + 45;
            const dist = Math.hypot(x - centerX, y - btnY);
            
            if (dist < 62) {
                qteState.clicks++;
                cameraShake = 6;
                
                particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    size: 8,
                    color: '#e74c3c',
                    life: 0.45
                });
            }
        }
        
        // ========== SHOP ==========
        function openShop() {
            shopCoinsEl.textContent = coins;
            menuOverlay.classList.add('hidden');
            shopOverlay.classList.remove('hidden');
            renderShop();
        }
        
        function closeShop() {
            shopOverlay.classList.add('hidden');
            menuOverlay.classList.remove('hidden');
            menuCoinsEl.textContent = coins;
        }
        
        function renderShop() {
            shopGridEl.innerHTML = '';
            
            for (let i = 0; i < skins.length; i++) {
                const skin = skins[i];
                const item = document.createElement('div');
                
                let classes = ['skin-item'];
                if (selectedSkin === skin.id) classes.push('selected');
                if (!skin.unlocked) classes.push('locked');
                if (skin.unlocked && selectedSkin !== skin.id) classes.push('unlocked');
                item.className = classes.join(' ');
                
                let innerHTML = '<svg class="skin-preview" viewBox="0 0 50 50">';
                
                if (skin.id === 'golden') {
                    innerHTML += '<defs><linearGradient id="goldGrad' + i + '" x1="0%" y1="0%" x2="100%" y2="100%">';
                    innerHTML += '<stop offset="0%" style="stop-color:#ffd700"/>';
                    innerHTML += '<stop offset="50%" style="stop-color:#ffec8b"/>';
                    innerHTML += '<stop offset="100%" style="stop-color:#daa520"/>';
                    innerHTML += '</linearGradient></defs>';
                    innerHTML += '<ellipse cx="25" cy="28" rx="18" ry="16" fill="url(#goldGrad' + i + ')"/>';
                    innerHTML += '<circle cx="25" cy="16" r="11" fill="url(#goldGrad' + i + ')"/>';
                } else {
                    innerHTML += '<ellipse cx="25" cy="28" rx="18" ry="16" fill="' + skin.color + '"/>';
                    innerHTML += '<circle cx="25" cy="16" r="11" fill="' + skin.color + '"/>';
                }
                innerHTML += '</svg>';
                
                if (!skin.unlocked) {
                    if (skin.special) {
                        innerHTML += '<span class="skin-label">ФИНАЛ</span>';
                    } else {
                        innerHTML += '<span class="skin-price">' + skin.price + '</span>';
                    }
                } else if (selectedSkin === skin.id) {
                    innerHTML += '<span class="skin-label">ВЫБРАН</span>';
                } else {
                    innerHTML += '<span class="skin-label">надеть</span>';
                }
                
                item.innerHTML = innerHTML;
                
                item.addEventListener('click', function() {
                    selectSkin(skin);
                });
                
                shopGridEl.appendChild(item);
            }
        }
        
        function selectSkin(skin) {
            if (!skin.unlocked) {
                if (skin.special) return;
                if (coins >= skin.price) {
                    coins -= skin.price;
                    skin.unlocked = true;
                    shopCoinsEl.textContent = coins;
                    saveGame();
                } else {
                    return;
                }
            }
            
            selectedSkin = skin.id;
            cat.color = skin.color;
            saveGame();
            renderShop();
        }
        
        // ========== GAME CONTROLS ==========
        function startGame() {
            menuOverlay.classList.add('hidden');
            gameState = 'playing';
            initGame();
        }
        
        function restartGame() {
            deathOverlay.classList.add('hidden');
            currentLevel = 0;
            lives = 0;
            levelsCompleted = 0;
            gameState = 'playing';
            initGame();
            updateMenuUI();
            saveGame();
        }
        
        function goToMenu() {
            deathOverlay.classList.add('hidden');
            winOverlay.classList.add('hidden');
            gameState = 'menu';
            updateMenuUI();
            menuOverlay.classList.remove('hidden');
        }
        
        // ========== SAVE/LOAD ==========
        function saveGame() {
            try {
                const data = {
                    coins: coins,
                    currentLevel: currentLevel,
                    lives: lives,
                    levelsCompleted: levelsCompleted,
                    selectedSkin: selectedSkin,
                    gameCompletedOnce: gameCompletedOnce,
                    skins: skins.map(function(s) { return { id: s.id, unlocked: s.unlocked }; })
                };
                localStorage.setItem('verticalCat_v3', JSON.stringify(data));
            } catch (e) {
                console.warn('Could not save game:', e);
            }
        }
        
        function loadGame() {
            try {
                const data = localStorage.getItem('verticalCat_v3');
                if (data) {
                    const parsed = JSON.parse(data);
                    if (typeof parsed.coins === 'number') coins = parsed.coins;
                    if (typeof parsed.currentLevel === 'number') currentLevel = clamp(parsed.currentLevel, 0, TOTAL_LEVELS - 1);
                    if (typeof parsed.lives === 'number') lives = parsed.lives;
                    if (typeof parsed.levelsCompleted === 'number') levelsCompleted = parsed.levelsCompleted;
                    if (typeof parsed.selectedSkin === 'string') selectedSkin = parsed.selectedSkin;
                    if (typeof parsed.gameCompletedOnce === 'boolean') gameCompletedOnce = parsed.gameCompletedOnce;
                    
                    if (Array.isArray(parsed.skins)) {
                        for (let i = 0; i < parsed.skins.length; i++) {
                            const saved = parsed.skins[i];
                            for (let j = 0; j < skins.length; j++) {
                                if (skins[j].id === saved.id) {
                                    skins[j].unlocked = saved.unlocked;
                                    break;
                                }
                            }
                        }
                    }
                    
                    for (let i = 0; i < skins.length; i++) {
                        if (skins[i].id === selectedSkin && skins[i].unlocked) {
                            cat.color = skins[i].color;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not load game:', e);
            }
            
            updateMenuUI();
        }
        
        // ========== EVENT LISTENERS ==========
        btnPlay.addEventListener('click', startGame);
        btnShop.addEventListener('click', openShop);
        btnShopBack.addEventListener('click', closeShop);
        btnRestart.addEventListener('click', restartGame);
        btnMenu.addEventListener('click', goToMenu);
        btnWinMenu.addEventListener('click', goToMenu);
        
        canvas.addEventListener('click', function(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            handleInput(x, y);
        });
        
        canvas.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            handleInput(x, y);
        }, { passive: false });
        
        document.addEventListener('keydown', function(e) {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                handleInput(canvas.width / 2, canvas.height / 2);
            }
            
            const level = getCurrentLevel();
            if (level && level.isQTE && !qteState.active) {
                if (e.code === 'ArrowLeft') {
                    qteState.direction = -1;
                    cat.x = clamp(cat.x - 25, 20, canvas.width - cat.width - 20);
                }
                if (e.code === 'ArrowRight') {
                    qteState.direction = 1;
                    cat.x = clamp(cat.x + 25, 20, canvas.width - cat.width - 20);
                }
            }
        });
        
        window.addEventListener('resize', resizeCanvas);
        
        // ========== INIT ==========
        resizeCanvas();
        loadGame();
        gameLoop();
