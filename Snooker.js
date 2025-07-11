        // 游戏变量
        const canvas = document.getElementById('snookerCanvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('canvasContainer');
        const powerMeter = document.getElementById('powerMeter');
        const powerValue = document.getElementById('powerValue');
        const gameMessage = document.getElementById('gameMessage');
        const playerStat = document.getElementById('playerStat');
        const aiStat = document.getElementById('aiStat');
        const aimingGuide = document.getElementById('aimingGuide');
        
        // 尺寸设置
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // 游戏状态
        let playerScore = 0;
        let aiScore = 0;
        let playerTurn = true;
        let aimingAngle = 0;
        let power = 30; // 0-100
        let balls = [];
        let cueBall = null;
        let gameActive = true;
        let ballsMoving = false;
        let gameState = "playerAiming"; // playerAiming, playerPowering, playerShooting, aiThinking, aiShooting
        let mouseDown = false;
        let dragStartX, dragStartY;
        let dragVectorX, dragVectorY;
        // 斯诺克规则相关变量
        let snookerPhase = "reds"; // "reds" 红球阶段，"colors" 彩球阶段
        let currentTargetType = "red"; // 当前目标球类型
        let colorOrder = ["yellow", "green", "brown", "blue", "pink", "black"];
        let colorOrderIndex = 0;
        let firstContactType = null; // 本杆首次碰撞球类型
        let foulThisTurn = false; // 本杆是否犯规
        let foulPoints = 0; // 犯规分数
        let pottedBallsThisTurn = []; // 本杆进袋球类型
        // 口袋位置
        const pockets = [];
        // 彩球标准点位
        const colorBallPositions = {};
        // AI难度
        let aiLevel = "normal";
        document.getElementById('aiLevel').onchange = function() {
            aiLevel = this.value;
        };
        // Ball 类
        class Ball {
            constructor(x, y, radius, color, points, type) {
                this.x = x;
                this.y = y;
                this.radius = radius;
                this.color = color;
                this.dx = 0;
                this.dy = 0;
                this.points = points;
                this.inPocket = false;
                this.type = type;
                this.highlight = false;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.strokeStyle = this.highlight ? "#fff" : "#000";
                ctx.lineWidth = this.highlight ? 3 : 1;
                ctx.stroke();
                ctx.beginPath();
                if (this.type !== 'cue') {
                    ctx.arc(this.x - this.radius*0.3, this.y - this.radius*0.3, this.radius*0.3, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                    ctx.fill();
                } else {
                    ctx.arc(this.x - this.radius*0.2, this.y - this.radius*0.2, this.radius*0.2, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                    ctx.fill();
                }
                if (this.type !== 'cue' && !this.inPocket) {
                    ctx.font = this.radius / 1.5 + "px 'Arial Rounded MT Bold', 'Arial'";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = this.color === "#ffff00" ? "#000" : "white";
                    ctx.fillText(this.points.toString(), this.x, this.y);
                }
            }
            update() {
                this.dx *= 0.985;
                this.dy *= 0.985;
                if (Math.abs(this.dx) < 0.05 && Math.abs(this.dy) < 0.05) {
                    this.dx = 0;
                    this.dy = 0;
                } else {
                    this.x += this.dx;
                    this.y += this.dy;
                    if (this.x - this.radius < 0) {
                        this.x = this.radius;
                        this.dx = -this.dx * 0.9;
                    } else if (this.x + this.radius > canvas.width) {
                        this.x = canvas.width - this.radius;
                        this.dx = -this.dx * 0.9;
                    }
                    if (this.y - this.radius < 0) {
                        this.y = this.radius;
                        this.dy = -this.dy * 0.9;
                    } else if (this.y + this.radius > canvas.height) {
                        this.y = canvas.height - this.radius;
                        this.dy = -this.dy * 0.9;
                    }
                }
                this.checkPocket();
            }
            checkPocket() {
                pockets.forEach(pocket => {
                    const distance = Math.sqrt((this.x - pocket.x)**2 + (this.y - pocket.y)**2);
                    if (distance < 20) {
                        this.inPocket = true;
                        if (this.type !== 'cue') {
                            pottedBallsThisTurn.push(this.type);
                            // 红球阶段，彩球进袋立即复位
                            if (snookerPhase === "reds" && ["yellow","green","brown","blue","pink","black"].includes(this.type)) {
                                resetColorBallPosition(this);
                                this.inPocket = false;
                            }
                        }
                        if (this.type === 'cue') {
                            foulThisTurn = true;
                            foulPoints = Math.max(4, getTargetBallPoints());
                            gameMessage.textContent = "犯规！白球入袋 - 对方得" + foulPoints + "分！";
                            gameMessage.style.color = "#f87171";
                            setTimeout(() => {
                                gameMessage.textContent = playerTurn ? "轮到你了" : "对手击球中...";
                                gameMessage.style.color = "#06d6a0";
                            }, 2000);
                            setTimeout(() => {
                                this.x = 120;
                                this.y = canvas.height / 2;
                                this.dx = 0;
                                this.dy = 0;
                                this.inPocket = false;
                                if (!balls.includes(this)) balls.push(this);
                            }, 1200);
                        }
                    }
                });
            }
            collideWith(otherBall) {
                const dx = otherBall.x - this.x;
                const dy = otherBall.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < this.radius + otherBall.radius) {
                    const angle = Math.atan2(dy, dx);
                    const vx1 = this.dx;
                    const vy1 = this.dy;
                    const vx2 = otherBall.dx;
                    const vy2 = otherBall.dy;
                    const vx1Final = vx2 * 0.8;
                    const vy1Final = vy2 * 0.8;
                    const vx2Final = vx1 * 0.8;
                    const vy2Final = vy1 * 0.8;
                    const overlap = (this.radius + otherBall.radius - distance) / 2;
                    this.x -= overlap * Math.cos(angle);
                    this.y -= overlap * Math.sin(angle);
                    otherBall.x += overlap * Math.cos(angle);
                    otherBall.y += overlap * Math.sin(angle);
                    this.dx = vx1Final;
                    this.dy = vy1Final;
                    otherBall.dx = vx2Final;
                    otherBall.dy = vy2Final;
                    if (this.type === 'cue') this.highlight = true;
                    if (otherBall.type === 'cue') otherBall.highlight = true;
                    // 记录首次碰撞类型并判定犯规
                    if (this.type === 'cue' && !firstContactType && otherBall.type !== 'cue') {
                        firstContactType = otherBall.type;
                        if (!isLegalFirstContact(firstContactType)) {
                            foulThisTurn = true;
                            foulPoints = Math.max(4, getTargetBallPoints());
                        }
                    }
                    if (otherBall.type === 'cue' && !firstContactType && this.type !== 'cue') {
                        firstContactType = this.type;
                        if (!isLegalFirstContact(firstContactType)) {
                            foulThisTurn = true;
                            foulPoints = Math.max(4, getTargetBallPoints());
                        }
                    }
                }
            }
        }
        // 初始化游戏
        function initGame() {
            balls = [];
            pockets.length = 0;
            const pocketSize = 20;
            pockets.push({x: pocketSize, y: pocketSize});
            pockets.push({x: canvas.width/2, y: pocketSize/2});
            pockets.push({x: canvas.width - pocketSize, y: pocketSize});
            pockets.push({x: pocketSize, y: canvas.height - pocketSize});
            pockets.push({x: canvas.width/2, y: canvas.height - pocketSize/2});
            pockets.push({x: canvas.width - pocketSize, y: canvas.height - pocketSize});
            const tableW = canvas.width;
            const tableH = canvas.height;
            const ballRadius = 9.5 + 1; // 统一所有球的半径为黑球大小
            // D区相关
            const dCenterX = tableW / 4;
            const dCenterY = tableH / 2;
            const dRadius = tableH * 0.143;
            // 白球（D区左侧）
            cueBall = new Ball(dCenterX - dRadius * 0.7, dCenterY, ballRadius, "#f0f0f0", 0, "cue");
            balls.push(cueBall);
            // 黄球（D区下）
            balls.push(new Ball(dCenterX, dCenterY + dRadius, ballRadius, "#ffd944", 2, "yellow"));
            colorBallPositions["yellow"] = {x: dCenterX, y: dCenterY + dRadius};
            // 绿球（D区上）
            balls.push(new Ball(dCenterX, dCenterY - dRadius, ballRadius, "#4ade80", 3, "green"));
            colorBallPositions["green"] = {x: dCenterX, y: dCenterY - dRadius};
            // 棕球（D区正中）
            balls.push(new Ball(dCenterX, dCenterY, ballRadius, "#a16240", 4, "brown"));
            colorBallPositions["brown"] = {x: dCenterX, y: dCenterY};
            // 蓝球（球台正中）
            const blueX = tableW / 2;
            const blueY = tableH / 2;
            balls.push(new Ball(blueX, blueY, ballRadius, "#5b92ff", 5, "blue"));
            colorBallPositions["blue"] = {x: blueX, y: blueY};
            // 粉球（蓝球和红球三角之间）
            const pinkX = tableW * 3/4;
            const pinkY = tableH / 2;
            balls.push(new Ball(pinkX, pinkY, ballRadius, "#ff7eb8", 6, "pink"));
            colorBallPositions["pink"] = {x: pinkX, y: pinkY};
            // 红球三角（靠近右侧，基于粉球点右侧）
            const reds = [];
            const triangleRows = 5;
            let redCount = 0;
            const triStartX = pinkX + ballRadius * Math.sqrt(3) * (triangleRows - 1);
            for (let row = 0; row < triangleRows; row++) {
                for (let i = 0; i <= row; i++) {
                    if (redCount >= 15) break;
                    const x = triStartX + row * ballRadius * Math.sqrt(3);
                    const y = pinkY - row * ballRadius + i * 2 * ballRadius;
                    reds.push(new Ball(x, y, ballRadius, "#ff5e56", 1, "red"));
                    redCount++;
                }
            }
            reds.forEach(ball => balls.push(ball));
            // 黑球（最右侧）
            const blackX = tableW * 7.5/8;
            const blackY = tableH / 2;
            balls.push(new Ball(blackX, blackY, ballRadius, "#2a2a2e", 7, "black"));
            colorBallPositions["black"] = {x: blackX, y: blackY};
            createBallStatusList();
            // 规则变量重置
            snookerPhase = "reds";
            currentTargetType = "red";
            colorOrderIndex = 0;
            firstContactType = null;
            foulThisTurn = false;
            foulPoints = 0;
            pottedBallsThisTurn = [];
        }
        // 创建球状态列表
        function createBallStatusList() {
            const ballStatusList = document.getElementById('ballStatusList');
            ballStatusList.innerHTML = '';
            
            const statusRows = [
                {color: "#ff5e56", name: "红球", points: "1", type: "red"},
                {color: "#ffd944", name: "黄球", points: "2", type: "yellow"},
                {color: "#4ade80", name: "绿球", points: "3", type: "green"},
                {color: "#a16240", name: "棕球", points: "4", type: "brown"},
                {color: "#5b92ff", name: "蓝球", points: "5", type: "blue"},
                {color: "#ff7eb8", name: "粉球", points: "6", type: "pink"},
                {color: "#2a2a2e", name: "黑球", points: "7", type: "black"}
            ];
            
            statusRows.forEach(ball => {
                const ballStatus = document.createElement('div');
                ballStatus.className = 'ball-status';
                ballStatus.innerHTML = `
                    <div class="ball-color" style="background-color: ${ball.color};"></div>
                    <div>${ball.name}</div>
                    <div class="status-indicator out">未入袋</div>
                `;
                ballStatusList.appendChild(ballStatus);
            });
        }
        // 更新球状态列表
        function updateBallStatusList() {
            const ballStatuses = document.querySelectorAll('.ball-status');
            
            // 红球状态
            const redCount = balls.filter(ball => ball.type === 'red' && !ball.inPocket).length;
            ballStatuses[0].querySelector('.status-indicator').textContent = `${redCount}颗在台`;
            
            // 彩色球状态
            ['yellow', 'green', 'brown', 'blue', 'pink', 'black'].forEach((type, index) => {
                const status = document.querySelector(`.ball-status:nth-child(${index+2}) .status-indicator`);
                const ballIn = balls.find(ball => ball.type === type && ball.inPocket);
                status.textContent = ballIn ? "已入袋" : "未入袋";
                status.className = ballIn ? "status-indicator in" : "status-indicator out";
            });
        }
        // 绘制桌台
        function drawTable() {
            // 桌台主体
            ctx.fillStyle = "#135e4c";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 木纹边框
            ctx.strokeStyle = "#2d1717";
            ctx.lineWidth = 14;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            // 木纹效果
            ctx.strokeStyle = "rgba(86, 54, 54, 0.4)";
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 8]);
            ctx.beginPath();
            ctx.rect(5, 5, canvas.width - 10, canvas.height - 10);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 桌台标记
            const midX = canvas.width/4;
            const midY = canvas.height/2;
            
            ctx.strokeStyle = "rgba(168, 242, 228, 0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(midX, 0);
            ctx.lineTo(midX, canvas.height);
            ctx.moveTo(midX*3, 0);
            ctx.lineTo(midX*3, canvas.height);
            
            // 中央标记
            ctx.moveTo(midX - 40, midY);
            ctx.arc(midX, midY, 40, Math.PI, 0, false);
            ctx.stroke();
            
            // 口袋
            ctx.fillStyle = "#0a1120";
            pockets.forEach(pock => {
                ctx.beginPath();
                ctx.arc(pock.x, pock.y, 18, 0, Math.PI * 2);
                ctx.fill();
                
                // 口袋内衬效果
                ctx.beginPath();
                ctx.arc(pock.x, pock.y, 14, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                ctx.fill();
            });
        }
        // 辅助函数：计算与库边的反弹点
        function getCushionBounce(x, y, angleRad, radius) {
            let dx = Math.cos(angleRad);
            let dy = Math.sin(angleRad);
            let t = Infinity;
            let nx = 0, ny = 0;
            // 左边界
            if (dx < 0) {
                let tx = (radius - x) / dx;
                if (tx > 0 && tx < t) { t = tx; nx = radius; ny = y + dy * tx; }
            }
            // 右边界
            if (dx > 0) {
                let tx = (canvas.width - radius - x) / dx;
                if (tx > 0 && tx < t) { t = tx; nx = canvas.width - radius; ny = y + dy * tx; }
            }
            // 上边界
            if (dy < 0) {
                let ty = (radius - y) / dy;
                if (ty > 0 && ty < t) { t = ty; nx = x + dx * ty; ny = radius; }
            }
            // 下边界
            if (dy > 0) {
                let ty = (canvas.height - radius - y) / dy;
                if (ty > 0 && ty < t) { t = ty; nx = x + dx * ty; ny = canvas.height - radius; }
            }
            return {x: nx, y: ny, t: t};
        }
        // 辅助函数：查找最近目标球
        function findNearestTargetBall() {
            let candidates = balls.filter(ball => !ball.inPocket && ball.type !== 'cue');
            if (candidates.length === 0) return null;
            let minDist = Infinity, target = null;
            for (let ball of candidates) {
                let dist = Math.hypot(ball.x - cueBall.x, ball.y - cueBall.y);
                if (dist < minDist) { minDist = dist; target = ball; }
            }
            return target;
        }
        // 辅助函数：查找最近袋口
        function findNearestPocket(ball) {
            let minDist = Infinity, target = null;
            for (let pocket of pockets) {
                let dist = Math.hypot(ball.x - pocket.x, ball.y - pocket.y);
                if (dist < minDist) { minDist = dist; target = pocket; }
            }
            return target;
        }
        // 绘制瞄准线和力度反馈
        function drawAimingFeedback() {
            const angleRad = aimingAngle * Math.PI / 180;
            // 1. 主瞄准线（穿过球台，虚线，细线）
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cueBall.x, cueBall.y);
            ctx.lineTo(cueBall.x + Math.cos(angleRad) * 2000, cueBall.y + Math.sin(angleRad) * 2000);
            ctx.strokeStyle = 'rgba(0,255,255,0.7)';
            ctx.lineWidth = 1; // 改为细线
            ctx.setLineDash([16, 12]);
            ctx.shadowColor = 'rgba(0,255,255,0.3)';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.restore();
            // 2. 白球反弹轨迹（虚线）
            const bounce = getCushionBounce(cueBall.x, cueBall.y, angleRad, cueBall.radius);
            if (bounce.t < 2000) {
                // 反弹方向
                let reflectAngle = angleRad;
                if (bounce.x === cueBall.radius || bounce.x === canvas.width - cueBall.radius) reflectAngle = Math.PI - angleRad;
                if (bounce.y === cueBall.radius || bounce.y === canvas.height - cueBall.radius) reflectAngle = -angleRad;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(bounce.x, bounce.y);
                ctx.lineTo(bounce.x + Math.cos(reflectAngle) * 600, bounce.y + Math.sin(reflectAngle) * 600);
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 2;
                ctx.setLineDash([12, 10]);
                ctx.stroke();
                ctx.restore();
            }
            // 4. 原有方向指示器
            ctx.beginPath();
            const endX = cueBall.x + Math.cos(angleRad) * 180;
            const endY = cueBall.y + Math.sin(angleRad) * 180;
            ctx.arc(endX, endY, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(6, 214, 160, 0.5)';
            ctx.fill();
            // 5. 力度反馈
            if (gameState === "playerPowering") {
                ctx.beginPath();
                ctx.moveTo(dragStartX, dragStartY);
                ctx.lineTo(dragStartX + dragVectorX, dragStartY + dragVectorY);
                ctx.strokeStyle = '#06d6a0';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cueBall.x, cueBall.y);
                ctx.lineTo(cueBall.x + Math.cos(angleRad) * power * 1.8, cueBall.y + Math.sin(angleRad) * power * 1.8);
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
                ctx.lineWidth = 4;
                ctx.setLineDash([]);
                ctx.stroke();
            }
        }
        // 更新分数显示
        function updateScores() {
            document.getElementById('playerScore').textContent = playerScore;
            document.getElementById('aiScore').textContent = aiScore;
            // 得分播报
            if (playerScore > lastPlayerScore) {
                speak(`玩家得分，当前${playerScore}分`);
            }
            if (aiScore > lastAiScore) {
                speak(`AI得分，当前${aiScore}分`);
            }
            lastPlayerScore = playerScore;
            lastAiScore = aiScore;
            
            // 更新玩家状态卡片
            if (playerTurn) {
                playerStat.classList.add('active');
                aiStat.classList.remove('active');
            } else {
                playerStat.classList.remove('active');
                aiStat.classList.add('active');
            }
        }
        // 是否有球在移动
        function areBallsMoving() {
            return balls.some(ball => !ball.inPocket && (ball.dx !== 0 || ball.dy !== 0));
        }
        // AI对手回合
        function aiMove() {
            gameMessage.textContent = "AI分析中...";
            gameState = "aiThinking";
            setTimeout(() => {
                let availableBalls = balls.filter(ball => !ball.inPocket && ball.type !== 'cue');
                let targetBalls = [];
                if (snookerPhase === "reds") {
                    if (currentTargetType === "red") {
                        targetBalls = availableBalls.filter(ball => ball.type === 'red');
                    } else {
                        targetBalls = availableBalls.filter(ball => ["yellow","green","brown","blue","pink","black"].includes(ball.type));
                    }
                } else if (snookerPhase === "colors") {
                    // 修正：推进到下一个还在台面的彩球
                    while (colorOrderIndex < colorOrder.length && balls.findIndex(b => b.type === colorOrder[colorOrderIndex] && !b.inPocket) === -1) {
                        colorOrderIndex++;
                    }
                    if (colorOrderIndex < colorOrder.length) {
                        currentTargetType = colorOrder[colorOrderIndex];
                        targetBalls = availableBalls.filter(ball => ball.type === currentTargetType);
                    } else {
                        targetBalls = [];
                    }
                }
                if (targetBalls.length > 0) {
                    let targetBall;
                    let dx, dy;
                    if (aiLevel === "easy") {
                        // 简单：随机选球，瞄准误差大，力度随机
                        targetBall = targetBalls[Math.floor(Math.random() * targetBalls.length)];
                        dx = targetBall.x - cueBall.x + (Math.random() - 0.5) * 80;
                        dy = targetBall.y - cueBall.y + (Math.random() - 0.5) * 80;
                        aimingAngle = Math.atan2(dy, dx) * 180 / Math.PI;
                        power = 20 + Math.random() * 40;
                    } else if (aiLevel === "normal") {
                        // 普通：选最近目标球，瞄准有小误差，力度较合理
                        targetBall = targetBalls.reduce((a, b) => {
                            let da = Math.hypot(a.x - cueBall.x, a.y - cueBall.y);
                            let db = Math.hypot(b.x - cueBall.x, b.y - cueBall.y);
                            return da < db ? a : b;
                        });
                        dx = targetBall.x - cueBall.x + (Math.random() - 0.5) * 20;
                        dy = targetBall.y - cueBall.y + (Math.random() - 0.5) * 20;
                        aimingAngle = Math.atan2(dy, dx) * 180 / Math.PI;
                        power = 30 + Math.random() * 50;
                    } else {
                        // 困难（大师级+走位）：选择最容易进袋且无遮挡，并考虑走位的目标球和袋口
                        let best = null;
                        let bestScore = -Infinity;
                        for (let ball of targetBalls) {
                            for (let pocket of pockets) {
                                let toPocketX = pocket.x - ball.x;
                                let toPocketY = pocket.y - ball.y;
                                let toPocketDist = Math.hypot(toPocketX, toPocketY);
                                let toBallX = ball.x - cueBall.x;
                                let toBallY = ball.y - cueBall.y;
                                let toBallDist = Math.hypot(toBallX, toBallY);
                                let dot = (toPocketX * toBallX + toPocketY * toBallY) / (toPocketDist * toBallDist);
                                let angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                                // 检查路径无遮挡
                                let pathClear = true;
                                for (let other of balls) {
                                    if (other === cueBall || other === ball || other.inPocket) continue;
                                    // 白球到目标球
                                    let d1 = pointLineDistance(other.x, other.y, cueBall.x, cueBall.y, ball.x, ball.y);
                                    if (d1 < other.radius * 1.1 && isBetween(other.x, other.y, cueBall.x, cueBall.y, ball.x, ball.y)) {
                                        pathClear = false;
                                        break;
                                    }
                                    // 目标球到袋口
                                    let d2 = pointLineDistance(other.x, other.y, ball.x, ball.y, pocket.x, pocket.y);
                                    if (d2 < other.radius * 1.1 && isBetween(other.x, other.y, ball.x, ball.y, pocket.x, pocket.y)) {
                                        pathClear = false;
                                        break;
                                    }
                                }
                                if (!pathClear) continue;
                                // 预测白球落点（简单：白球沿目标球到袋口方向反弹）
                                let impactAngle = Math.atan2(pocket.y - ball.y, pocket.x - ball.x);
                                let whiteAfterX = ball.x + Math.cos(impactAngle) * 20;
                                let whiteAfterY = ball.y + Math.sin(impactAngle) * 20;
                                // 下一个目标球
                                let nextTarget = null;
                                if (snookerPhase === "reds") {
                                    if (currentTargetType === "red") {
                                        nextTarget = balls.find(b => b.type === "red" && !b.inPocket && b !== ball);
                                    } else {
                                        nextTarget = balls.find(b => ["yellow","green","brown","blue","pink","black"].includes(b.type) && !b.inPocket && b !== ball);
                                    }
                                } else if (snookerPhase === "colors") {
                                    nextTarget = balls.find(b => b.type === currentTargetType && !b.inPocket && b !== ball);
                                }
                                let posScore = 0;
                                if (nextTarget) {
                                    let dist = Math.hypot(whiteAfterX - nextTarget.x, whiteAfterY - nextTarget.y);
                                    posScore = 100 - dist; // 距离越近分越高
                                }
                                // 综合评分：夹角越小越好，距离适中最好，走位分加权
                                let score = -angle * 5 - Math.abs(toBallDist - 80) + posScore * 0.5;
                                if (score > bestScore) {
                                    bestScore = score;
                                    best = {ball, pocket, toBallX, toBallY, toBallDist};
                                }
                            }
                        }
                        if (best) {
                            aimingAngle = Math.atan2(best.toBallY, best.toBallX) * 180 / Math.PI;
                            power = Math.max(25, Math.min(60, best.toBallDist * 0.7));
                        } else {
                            // 没有理想目标，随便打
                            targetBall = targetBalls[0];
                            dx = targetBall.x - cueBall.x;
                            dy = targetBall.y - cueBall.y;
                            aimingAngle = Math.atan2(dy, dx) * 180 / Math.PI;
                            power = 40;
                        }
                    }
                    powerMeter.style.width = power + '%';
                    powerValue.textContent = Math.round(power) + '%';
                    gameMessage.textContent = "AI准备击球...";
                    setTimeout(() => {
                        shootBall();
                    }, 500);
                } else {
                    // 修正：如果彩球阶段且所有彩球都下台，直接判定游戏结束
                    if (snookerPhase === "colors") {
                        let allColorsDown = true;
                        for (let i = 0; i < colorOrder.length; i++) {
                            if (balls.find(b => b.type === colorOrder[i] && !b.inPocket)) {
                                allColorsDown = false;
                                break;
                            }
                        }
                        if (allColorsDown) {
                            gameActive = false;
                            setTimeout(() => {
                                gameMessage.textContent = `游戏结束！玩家: ${playerScore} vs AI: ${aiScore}`;
                                let message;
                                if (playerScore > aiScore) {
                                    message = "恭喜你获胜！";
                                } else if (aiScore > playerScore) {
                                    message = "AI获胜！";
                                } else {
                                    message = "平局！加赛黑球";
                                }
                                setTimeout(() => {
                                    alert(`游戏结束！\n玩家分数: ${playerScore}\nAI分数: ${aiScore}\n${message}`);
                                    resetGame();
                                }, 1500);
                            }, 500);
                            return;
                        }
                    }
                    gameMessage.textContent = "无目标球可打";
                }
            }, 800);
        }
        // 击球动作
        function shootBall() {
            gameMessage.textContent = playerTurn ? "击球中..." : "AI击球中...";
            // 播放击球音效
            const hitAudio = document.getElementById('hitSound');
            if (hitAudio) {
                hitAudio.currentTime = 0;
                hitAudio.play();
            }
            const angleRad = aimingAngle * Math.PI / 180;
            const force = power * 0.7;
            cueBall.dx = Math.cos(angleRad) * force;
            cueBall.dy = Math.sin(angleRad) * force;
            gameState = playerTurn ? "playerShooting" : "aiShooting";
            // ====== 新增：每杆前重置判定变量 ======
            firstContactType = null;
            foulThisTurn = false;
            foulPoints = 0;
            pottedBallsThisTurn = [];
            // ====== 设置目标球类型 ======
            if (snookerPhase === "reds") {
                if (currentTargetType === "red") {
                    // 红球阶段，目标为红球
                    currentTargetType = "red";
                } else {
                    // 红球进袋后，目标为彩球
                    currentTargetType = "color";
                }
            } else if (snookerPhase === "colors") {
                // 彩球阶段，按顺序
                currentTargetType = colorOrder[colorOrderIndex];
            }
            // 重置力度
            setTimeout(() => {
                power = 30;
                powerMeter.style.width = '30%';
                powerValue.textContent = '30%';
            }, 500);
            // 重置进球标志
            ballPottedThisTurn = false;
        }
        // 鼠标按下
        function handleMouseDown(e) {
            if (!playerTurn || ballsMoving || gameState !== "playerAiming") return;
            
            gameMessage.textContent = "向后拖动调整力量";
            
            const rect = canvas.getBoundingClientRect();
            dragStartX = e.clientX - rect.left;
            dragStartY = e.clientY - rect.top;
            
            mouseDown = true;
            gameState = "playerPowering";
        }
        // 鼠标移动
        function handleMouseMove(e) {
            if (!playerTurn || !mouseDown || gameState !== "playerPowering") return;
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // 计算反向向量
            dragVectorX = dragStartX - mouseX;
            dragVectorY = dragStartY - mouseY;
            
            // 取拖动向量在瞄准方向上的分量
            const angleRad = aimingAngle * Math.PI / 180;
            const aimVectorX = Math.cos(angleRad);
            const aimVectorY = Math.sin(angleRad);
            
            // 计算拖动距离（投影到瞄准方向上）
            const dragMagnitude = Math.sqrt(dragVectorX * dragVectorX + dragVectorY * dragVectorY);
            const dotProduct = dragVectorX * aimVectorX + dragVectorY * aimVectorY;
            const projectionMagnitude = dragMagnitude * (dotProduct / (dragMagnitude * 1));
            
            // 更新力度
            power = Math.min(Math.max(projectionMagnitude, 10), 100);
            powerMeter.style.width = power + '%';
            powerValue.textContent = Math.round(power) + '%';
        }
        // 鼠标释放
        function handleMouseUp() {
            if (!playerTurn || !mouseDown || gameState !== "playerPowering") return;
            
            mouseDown = false;
            
            // 击球
            shootBall();
        }
        // 鼠标移动（瞄准）
        function handleMouseAim(e) {
            if (!playerTurn || gameState !== "playerAiming") return;
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // 计算瞄准角度
            aimingAngle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x) * 180 / Math.PI;
            
            // 更新瞄准引导
            updateAimingGuide(aimingAngle);
        }
        function updateAimingGuide(angle) {
            const angleRad = angle * Math.PI / 180;
            const guideCircle = document.querySelector('.guide-circle');
            
            if (!guideCircle) {
                const circle = document.createElement('div');
                circle.className = 'guide-circle';
                circle.style.width = '200px';
                circle.style.height = '200px';
                circle.style.left = cueBall.x + 'px';
                circle.style.top = cueBall.y + 'px';
                aimingGuide.appendChild(circle);
            } else {
                guideCircle.style.left = cueBall.x + 'px';
                guideCircle.style.top = cueBall.y + 'px';
            }
        }
        // 重置视角
        function handleDoubleClick() {
            aimingAngle = 0;
            updateAimingGuide(0);
        }
        // 调整画布大小
        function resizeCanvas() {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            initGame();
        }
        // 主游戏循环
        function gameLoop() {
            const wasBallsMoving = ballsMoving;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawTable();
            ballsMoving = false;
            for (let i = 0; i < balls.length; i++) {
                balls[i].update();
                for (let j = i + 1; j < balls.length; j++) {
                    balls[i].collideWith(balls[j]);
                }
                if (!ballsMoving && !balls[i].inPocket && (Math.abs(balls[i].dx) > 0.5 || Math.abs(balls[i].dy) > 0.5)) {
                    ballsMoving = true;
                }
                balls[i].draw();
                balls[i].highlight = false;
            }
            balls = balls.filter(ball => !ball.inPocket || ball.type === 'cue');
            if (playerTurn && gameState.includes("player") && !ballsMoving) {
                drawAimingFeedback();
            }
            // ======================== 斯诺克正式规则回合判定 ========================
            if (!ballsMoving && (gameState === "playerShooting" || gameState === "aiShooting")) {
                let isAI = (gameState === "aiShooting");
                let scored = false;
                // 1. 犯规处理
                if (foulThisTurn) {
                    if (isAI) playerScore += foulPoints; else aiScore += foulPoints;
                    updateScores();
                    playerTurn = !playerTurn;
                    if (snookerPhase === "reds") {
                        currentTargetType = "red";
                    } else {
                        // 修正：彩球阶段犯规后推进目标球
                        // 跳过已下台的彩球
                        while (colorOrderIndex < colorOrder.length && balls.findIndex(b => b.type === colorOrder[colorOrderIndex] && !b.inPocket) === -1) {
                            colorOrderIndex++;
                        }
                        if (colorOrderIndex < colorOrder.length) {
                            currentTargetType = colorOrder[colorOrderIndex];
                        } else {
                            // 所有彩球都下台，游戏结束
                            gameActive = false;
                            setTimeout(() => {
                                gameMessage.textContent = `游戏结束！玩家: ${playerScore} vs AI: ${aiScore}`;
                                let message;
                                if (playerScore > aiScore) {
                                    message = "恭喜你获胜！";
                                } else if (aiScore > playerScore) {
                                    message = "AI获胜！";
                                } else {
                                    message = "平局！加赛黑球";
                                }
                                setTimeout(() => {
                                    alert(`游戏结束！\n玩家分数: ${playerScore}\nAI分数: ${aiScore}\n${message}`);
                                    resetGame();
                                }, 1500);
                            }, 500);
                            return;
                        }
                    }
                    gameMessage.textContent = (isAI ? "AI犯规，轮到你了" : "犯规，AI回合");
                }
                // 2. 正常进球
                else if (pottedBallsThisTurn.length > 0) {
                    if (snookerPhase === "reds") {
                        // 立即复位，回合结算时无需再复位彩球
                        if (currentTargetType === "red") {
                            if (pottedBallsThisTurn.includes("red")) {
                                let redsPotted = pottedBallsThisTurn.filter(t => t === "red").length;
                                if (isAI) aiScore += redsPotted; else playerScore += redsPotted;
                                currentTargetType = "color";
                                gameMessage.textContent = "请击打任意彩球";
                                scored = true;
                            } else {
                                playerTurn = !playerTurn;
                                currentTargetType = "red";
                                gameMessage.textContent = isAI ? "轮到你了" : "AI回合";
                            }
                        } else if (currentTargetType === "color") {
                            let colorIn = pottedBallsThisTurn.find(t => ["yellow","green","brown","blue","pink","black"].includes(t));
                            if (colorIn) {
                                let pts = getTargetBallPointsByType(colorIn);
                                if (isAI) aiScore += pts; else playerScore += pts;
                                currentTargetType = "red";
                                gameMessage.textContent = "请击打红球";
                                scored = true;
                            } else {
                                playerTurn = !playerTurn;
                                currentTargetType = "red";
                                gameMessage.textContent = isAI ? "轮到你了" : "AI回合";
                            }
                        }
                        // 判断红球是否全部下台
                        if (balls.filter(b => b.type === "red" && !b.inPocket).length === 0) {
                            snookerPhase = "colors";
                            colorOrderIndex = 0;
                            currentTargetType = colorOrder[colorOrderIndex];
                            gameMessage.textContent = "红球已下台，进入彩球阶段";
                        }
                    } else if (snookerPhase === "colors") {
                        let colorIn = pottedBallsThisTurn.find(t => t === currentTargetType);
                        if (colorIn) {
                            let pts = getTargetBallPointsByType(colorIn);
                            if (isAI) aiScore += pts; else playerScore += pts;
                            colorOrderIndex++;
                            // 修正：推进到下一个还在台面的彩球
                            while (colorOrderIndex < colorOrder.length && balls.findIndex(b => b.type === colorOrder[colorOrderIndex] && !b.inPocket) === -1) {
                                colorOrderIndex++;
                            }
                            if (colorOrderIndex < colorOrder.length) {
                                currentTargetType = colorOrder[colorOrderIndex];
                                gameMessage.textContent = "进球！下一个目标：" + getTargetBallName(currentTargetType);
                            } else {
                                gameActive = false;
                                setTimeout(() => {
                                    gameMessage.textContent = `游戏结束！玩家: ${playerScore} vs AI: ${aiScore}`;
                                    let message;
                                    if (playerScore > aiScore) {
                                        message = "恭喜你获胜！";
                                    } else if (aiScore > playerScore) {
                                        message = "AI获胜！";
                                    } else {
                                        message = "平局！加赛黑球";
                                    }
                                    setTimeout(() => {
                                        alert(`游戏结束！\n玩家分数: ${playerScore}\nAI分数: ${aiScore}\n${message}`);
                                        resetGame();
                                    }, 1500);
                                }, 500);
                                return;
                            }
                            scored = true;
                        } else {
                            // 没有打进目标彩球，推进到下一个还在台面的目标球
                            while (colorOrderIndex < colorOrder.length && balls.findIndex(b => b.type === colorOrder[colorOrderIndex] && !b.inPocket) === -1) {
                                colorOrderIndex++;
                            }
                            if (colorOrderIndex < colorOrder.length) {
                                currentTargetType = colorOrder[colorOrderIndex];
                                playerTurn = !playerTurn;
                                gameMessage.textContent = isAI ? "轮到你了" : "AI回合";
                            } else {
                                // 所有彩球都下台，游戏结束
                                gameActive = false;
                                setTimeout(() => {
                                    gameMessage.textContent = `游戏结束！玩家: ${playerScore} vs AI: ${aiScore}`;
                                    let message;
                                    if (playerScore > aiScore) {
                                        message = "恭喜你获胜！";
                                    } else if (aiScore > playerScore) {
                                        message = "AI获胜！";
                                    } else {
                                        message = "平局！加赛黑球";
                                    }
                                    setTimeout(() => {
                                        alert(`游戏结束！\n玩家分数: ${playerScore}\nAI分数: ${aiScore}\n${message}`);
                                        resetGame();
                                    }, 1500);
                                }, 500);
                                return;
                            }
                        }
                    }
                    updateScores();
                }
                // 3. 未进球
                else {
                    if (snookerPhase === "reds") {
                        playerTurn = !playerTurn;
                        currentTargetType = "red";
                        gameMessage.textContent = isAI ? "轮到你了" : "AI回合";
                    } else {
                        // 彩球阶段未进球，推进到下一个还在台面的目标球
                        while (colorOrderIndex < colorOrder.length && balls.findIndex(b => b.type === colorOrder[colorOrderIndex] && !b.inPocket) === -1) {
                            colorOrderIndex++;
                        }
                        if (colorOrderIndex < colorOrder.length) {
                            currentTargetType = colorOrder[colorOrderIndex];
                            playerTurn = !playerTurn;
                            gameMessage.textContent = isAI ? "轮到你了" : "AI回合";
                        } else {
                            // 所有彩球都下台，游戏结束
                            gameActive = false;
                            setTimeout(() => {
                                gameMessage.textContent = `游戏结束！玩家: ${playerScore} vs AI: ${aiScore}`;
                                let message;
                                if (playerScore > aiScore) {
                                    message = "恭喜你获胜！";
                                } else if (aiScore > playerScore) {
                                    message = "AI获胜！";
                                } else {
                                    message = "平局！加赛黑球";
                                }
                                setTimeout(() => {
                                    alert(`游戏结束！\n玩家分数: ${playerScore}\nAI分数: ${aiScore}\n${message}`);
                                    resetGame();
                                }, 1500);
                            }, 500);
                            return;
                        }
                    }
                }
                // 回合切换
                firstContactType = null;
                foulThisTurn = false;
                foulPoints = 0;
                pottedBallsThisTurn = [];
                if (playerTurn) {
                    gameState = "playerAiming";
                } else {
                    gameState = "aiThinking";
                    setTimeout(() => {
                        aiMove();
                    }, 800);
                }
            }
            if (!wasBallsMoving && ballsMoving) {
                aimingGuide.style.opacity = "0";
            } else if (wasBallsMoving && !ballsMoving && playerTurn) {
                aimingGuide.style.opacity = "0.8";
            }
            updateBallStatusList();
            requestAnimationFrame(gameLoop);
        }
        // 重置游戏
        function resetGame() {
            playerScore = 0;
            aiScore = 0;
            playerTurn = true;
            aimingAngle = 0;
            power = 30;
            gameActive = true;
            gameState = "playerAiming";
            initGame();
            updateScores();
            gameMessage.textContent = "瞄准后拖拽拉杆，释放后击球";
            requestAnimationFrame(gameLoop);
        }
        // 事件绑定
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseAim);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('dblclick', handleDoubleClick);
        window.addEventListener('resize', resizeCanvas);
        
        // 启动游戏
        setTimeout(() => {
            initGame();
            updateScores();
            gameLoop();
        }, 300);
        // 新增：重新开始按钮事件
        document.getElementById('restartBtn').onclick = function() {
            resetGame();
        };
        
        // 工具函数：判定首次碰撞是否合法
        function isLegalFirstContact(type) {
            if (snookerPhase === "reds") {
                if (currentTargetType === "red") return type === "red";
                if (currentTargetType === "color") return ["yellow","green","brown","blue","pink","black"].includes(type);
            } else if (snookerPhase === "colors") {
                return type === currentTargetType;
            }
            return false;
        }
        // 工具函数：获取当前目标球分值
        function getTargetBallPoints() {
            if (snookerPhase === "reds") {
                if (currentTargetType === "red") return 1;
                return 7; // 彩球阶段犯规最高按7分
            } else if (snookerPhase === "colors") {
                const color = colorOrder[colorOrderIndex];
                switch(color) {
                    case "yellow": return 2;
                    case "green": return 3;
                    case "brown": return 4;
                    case "blue": return 5;
                    case "pink": return 6;
                    case "black": return 7;
                }
            }
            return 4;
        }
        // 工具函数：获取彩球中文名
        function getTargetBallName(type) {
            switch(type) {
                case "yellow": return "黄球";
                case "green": return "绿球";
                case "brown": return "棕球";
                case "blue": return "蓝球";
                case "pink": return "粉球";
                case "black": return "黑球";
                default: return "彩球";
            }
        }
        // ======================== 斯诺克正式规则核心逻辑 ========================
        // 工具函数：按类型获取分值
        function getTargetBallPointsByType(type) {
            switch(type) {
                case "red": return 1;
                case "yellow": return 2;
                case "green": return 3;
                case "brown": return 4;
                case "blue": return 5;
                case "pink": return 6;
                case "black": return 7;
                default: return 0;
            }
        }
        // 工具函数：复位彩球
        function resetColorBallPosition(ball) {
            const pos = colorBallPositions[ball.type];
            if (pos) {
                ball.x = pos.x;
                ball.y = pos.y;
                ball.dx = 0;
                ball.dy = 0;
            }
        }
        // 辅助函数：点到线段距离
        function pointLineDistance(px, py, x1, y1, x2, y2) {
            let A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
            let dot = A * C + B * D;
            let len_sq = C * C + D * D;
            let param = len_sq !== 0 ? dot / len_sq : -1;
            let xx, yy;
            if (param < 0) { xx = x1; yy = y1; }
            else if (param > 1) { xx = x2; yy = y2; }
            else { xx = x1 + param * C; yy = y1 + param * D; }
            let dx = px - xx, dy = py - yy;
            return Math.sqrt(dx * dx + dy * dy);
        }
        // 辅助函数：判断点是否在线段之间
        function isBetween(px, py, x1, y1, x2, y2) {
            const minX = Math.min(x1, x2) - 1, maxX = Math.max(x1, x2) + 1;
            const minY = Math.min(y1, y2) - 1, maxY = Math.max(y1, y2) + 1;
            return px >= minX && px <= maxX && py >= minY && py <= maxY;
        }
        let lastPlayerScore = 0;
        let lastAiScore = 0;
        function speak(text) {
            if ('speechSynthesis' in window) {
                const utter = new window.SpeechSynthesisUtterance(text);
                utter.lang = 'zh-CN';
                window.speechSynthesis.speak(utter);
            }
        }