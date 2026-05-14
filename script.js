/**
 * Bee Pollination Game
 *
 * 功能：
 * 1. 蜜蜂位置固定於最左側垂直置中（以 px 設定）
 * 2. 四個方向鍵 / 鍵盤方向鍵 控制蜜蜂移動，每次 5px
 * 3. 左右移動時蜜蜂圖片跟隨翻轉，上下移動不翻轉
 * 4. 蜜蜂不可超出畫面邊界，下方不可進入方向鍵區域
 * 5. 其他物件每次頁面載入隨機放置，不重疊，兩花間距 ≥ 280px
 */

// ════════════════════════════════════════════════════════
// 常數設定
// ════════════════════════════════════════════════════════

const OBJECT_SIZES = {
    'dragonfly':   { w: 120, h: 90  },
    'berry':       { w: 60,  h: 60  },
    'pink-flower': { w: 100, h: 100 },
    'garlic':      { w: 80,  h: 100 },
    'red-flower':  { w: 110, h: 110 },
};

const BEE_SIZE        = { w: 100, h: 80 };  // 蜜蜂的估算尺寸（px）
let   MOVE_STEP       = 10;                 // 每次移動距離（px）
const MIN_FLOWER_DIST = 280;                // 兩朵花中心點最小距離（px）
const OVERLAP_PADDING = 15;                 // 物件間最小間隔（px）
const MAX_TRIES       = 200;                // 隨機放置最多嘗試次數

// ════════════════════════════════════════════════════════
// 草莓速度加成狀態
// ════════════════════════════════════════════════════════

let berrySpeedBoosted   = false;  // 是否已吃過草莓（只能一次）
let scallionSpeedReduced = false;  // 是否已碰過蔥（只能一次）

// ════════════════════════════════════════════════════════
// 音效
// ════════════════════════════════════════════════════════

const SFX = {
    click: new Audio('../click.mp3'),
    error: new Audio('../errorse.mp3'),
    right: new Audio('../rightse.mp3'),
    win:   new Audio('../winse.mp3'),
};

/**
 * 播放音效（重置播放位置以支援連續觸發）
 * @param {HTMLAudioElement} audio
 */
function playSound(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});  // 忽略瀏覽器自動播放限制錯誤
}

// ════════════════════════════════════════════════════════
// 蜜蜂狀態
// ════════════════════════════════════════════════════════

// 蜜蜂目前位置（left / top，單位 px）
let beeX = 0;
let beeY = 0;

/**
 * 初始化蜜蜂位置：最左側、垂直置中
 * 同時改用 px 設定位置，取代 CSS 的 % + transform 方式
 */
function initBeePosition() {
    const { w: cW, h: cH } = getContainerSize();
    beeX = cW * 0.04;                   // 靠左 4%
    beeY = (cH - BEE_SIZE.h) / 2;      // 垂直置中
    applyBeePosition();
}

/**
 * 將 beeX / beeY 套用到蜜蜂元素
 */
function applyBeePosition() {
    const bee = document.getElementById('bee');
    bee.style.left = beeX + 'px';
    bee.style.top  = beeY + 'px';
}

// ════════════════════════════════════════════════════════
// 蜜蜂移動
// ════════════════════════════════════════════════════════

/**
 * 計算蜜蜂可移動的邊界（全部使用 game-container 相對座標）
 * 使用蜜蜂元素的真實渲染尺寸，而非估算值
 */
function getBeeBounds() {
    const { w: cW, h: cH } = getContainerSize();
    const gc       = document.getElementById('game-container').getBoundingClientRect();
    const beeEl    = document.getElementById('bee');
    const beeRect  = beeEl.getBoundingClientRect();
    const beeW     = beeRect.width;   // 蜜蜂真實渲染寬度
    const beeH     = beeRect.height;  // 蜜蜂真實渲染高度

    const ctrlRect   = document.getElementById('controls').getBoundingClientRect();
    const ctrlTop    = ctrlRect.top    - gc.top;
    const ctrlLeft   = ctrlRect.left   - gc.left;

    return {
        minX:     0,
        maxX:     cW - beeW,
        minY:     0,
        maxY:     ctrlTop - beeH - 5,   // 蜜蜂底部 = beeY+beeH，不可超過 ctrlTop
        beeW,
        beeH,
        ctrlZone: { x: ctrlLeft, y: ctrlTop, w: ctrlRect.width, h: ctrlRect.height },
    };
}

/**
 * 移動蜜蜂
 * @param {'up'|'down'|'left'|'right'} direction
 */
function moveBee(direction) {
    const bounds = getBeeBounds();
    const bee    = document.getElementById('bee');
    const prevX  = beeX;
    const prevY  = beeY;

    switch (direction) {
        case 'up':
            beeY = Math.max(bounds.minY, beeY - MOVE_STEP);
            break;
        case 'down':
            beeY = Math.min(bounds.maxY, beeY + MOVE_STEP);
            break;
        case 'left':
            beeX = Math.max(bounds.minX, beeX - MOVE_STEP);
            bee.classList.remove('facing-right');
            bee.classList.add('facing-left');
            break;
        case 'right':
            beeX = Math.min(bounds.maxX, beeX + MOVE_STEP);
            bee.classList.remove('facing-left');
            bee.classList.add('facing-right');
            break;
    }

    // 雙重保險：若蜜蜂底部仍超過 controls 頂端，強制回退
    if (beeY + bounds.beeH + 5 > bounds.ctrlZone.y) {
        beeY = prevY;
    }

    applyBeePosition();
    playSound(SFX.click);       // 移動音效
    checkDragonflyCollision();
    checkFlowerCollisions();
    checkBerryCollision();
    checkScallionCollision();
}

// ════════════════════════════════════════════════════════
// 輸入控制：鍵盤 + 畫面按鈕（持續移動，無停頓）
// ════════════════════════════════════════════════════════

// 目前正被按住的方向鍵集合
const keysHeld = new Set();

// 按鈕按住的方向（null 表示沒有按鈕被按住）
let btnHeld = null;

/**
 * 鍵盤方向鍵監聽（keydown / keyup）
 */
function initKeyboardControl() {
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowUp':    e.preventDefault(); keysHeld.add('up');    break;
            case 'ArrowDown':  e.preventDefault(); keysHeld.add('down');  break;
            case 'ArrowLeft':  e.preventDefault(); keysHeld.add('left');  break;
            case 'ArrowRight': e.preventDefault(); keysHeld.add('right'); break;
        }
    });
    document.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'ArrowUp':    keysHeld.delete('up');    break;
            case 'ArrowDown':  keysHeld.delete('down');  break;
            case 'ArrowLeft':  keysHeld.delete('left');  break;
            case 'ArrowRight': keysHeld.delete('right'); break;
        }
    });
}

/**
 * 畫面按鈕：按住持續移動，放開停止
 */
function initButtonControl() {
    const btns = [
        { id: 'arrow-up',    dir: 'up'    },
        { id: 'arrow-down',  dir: 'down'  },
        { id: 'arrow-left',  dir: 'left'  },
        { id: 'arrow-right', dir: 'right' },
    ];
    btns.forEach(({ id, dir }) => {
        const el = document.getElementById(id);
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); btnHeld = dir; });
    });
    document.addEventListener('pointerup',    () => { btnHeld = null; });
    document.addEventListener('pointercancel', () => { btnHeld = null; });
}

/**
 * 主遊戲循環：每幀根據按住的鍵/按鈕持續移動蜜蜂
 */
function startGameLoop() {
    function loop() {
        // 優先順序：上 > 下 > 左 > 右（多鍵同時按時取第一個）
        const dirs = ['up', 'down', 'left', 'right'];
        const activeDir = dirs.find(d => keysHeld.has(d)) ?? btnHeld;
        if (activeDir) moveBee(activeDir);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

// ════════════════════════════════════════════════════════
// 隨機放置其他物件
// ════════════════════════════════════════════════════════

let placedObjects = [];

function getContainerSize() {
    const c = document.getElementById('game-container');
    return { w: c.clientWidth, h: c.clientHeight };
}

function getControlsRect() {
    const r = document.getElementById('controls').getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function getBeeRect() {
    return { x: beeX, y: beeY, w: BEE_SIZE.w, h: BEE_SIZE.h };
}

function isOverlapping(a, b, padding = OVERLAP_PADDING) {
    return !(
        a.x + a.w + padding < b.x ||
        b.x + b.w + padding < a.x ||
        a.y + a.h + padding < b.y ||
        b.y + b.h + padding < a.y
    );
}

function centerDistance(a, b) {
    return Math.sqrt(
        (a.x + a.w / 2 - b.x - b.w / 2) ** 2 +
        (a.y + a.h / 2 - b.y - b.h / 2) ** 2
    );
}

function findRandomPosition(objW, objH, flowerPartner = null) {
    const { w: cW, h: cH } = getContainerSize();
    const minX = cW * 0.18;
    const maxX = cW * 0.92 - objW;
    const minY = cH * 0.05;
    const maxY = cH * 0.72 - objH;

    for (let i = 0; i < MAX_TRIES; i++) {
        const x = Math.random() * (maxX - minX) + minX;
        const y = Math.random() * (maxY - minY) + minY;
        const candidate = { x, y, w: objW, h: objH };

        if (isOverlapping(candidate, getBeeRect()))     continue;
        if (isOverlapping(candidate, getControlsRect())) continue;

        let overlaps = false;
        for (const placed of placedObjects) {
            if (isOverlapping(candidate, placed)) { overlaps = true; break; }
        }
        if (overlaps) continue;

        if (flowerPartner && centerDistance(candidate, flowerPartner) < MIN_FLOWER_DIST) continue;

        return candidate;
    }
    return null;
}

function placeObject(id, pos) {
    const el = document.getElementById(id);
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';
    placedObjects.push(pos);
}

function initRandomPositions() {
    placedObjects = [];
    placedObjects.push(getBeeRect());
    placedObjects.push(getControlsRect());

    // 兩朵花先放（互相保持距離）
    const pf = OBJECT_SIZES['pink-flower'];
    const rf = OBJECT_SIZES['red-flower'];
    let pinkPos = null, redPos = null;

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        pinkPos = findRandomPosition(pf.w, pf.h);
        if (!pinkPos) continue;
        placedObjects.push(pinkPos);
        redPos = findRandomPosition(rf.w, rf.h, pinkPos);
        placedObjects.pop();
        if (pinkPos && redPos) break;
    }

    if (pinkPos) placeObject('pink-flower', pinkPos);
    if (redPos)  placeObject('red-flower',  redPos);

    // 其他物件
    for (const [id, size] of [
        ['dragonfly', OBJECT_SIZES['dragonfly']],
        ['berry',     OBJECT_SIZES['berry']    ],
        ['garlic',    OBJECT_SIZES['garlic']   ],
    ]) {
        const pos = findRandomPosition(size.w, size.h);
        if (pos) placeObject(id, pos);
        else console.warn(`無法為 #${id} 找到合法的隨機位置`);
    }
}

// ════════════════════════════════════════════════════════
// 蜻蜓碰撞偵測
// ════════════════════════════════════════════════════════

/**
 * 偵測蜜蜂是否碰到蜻蜓
 * 碰到即回到初始位置
 */
function checkDragonflyCollision() {
    const dragonfly = document.getElementById('dragonfly');
    if (!dragonfly || dragonfly.style.display === 'none') return;

    const gc  = document.getElementById('game-container').getBoundingClientRect();
    const bee = document.getElementById('bee');

    const br = bee.getBoundingClientRect();
    const dr = dragonfly.getBoundingClientRect();

    const beeRect = { x: br.left - gc.left, y: br.top - gc.top, w: br.width,  h: br.height };
    const dfRect  = { x: dr.left - gc.left, y: dr.top - gc.top, w: dr.width,  h: dr.height };

    if (isOverlapping(beeRect, dfRect, 0)) {
        playSound(SFX.error);       // 碰到蝶蝶音效
        initBeePosition();          // 回到初始位置
        showResetMessage();         // 顯示提示
    }
}

/**
 * 在畫面短暫顯示「被蜻蜓打到！回到起點」提示
 */
function showResetMessage() {
    const old = document.getElementById('reset-msg');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const msg = document.createElement('div');
    msg.id = 'reset-msg';
    msg.textContent = '🐝 被蜻蜓打到！回到起點';
    msg.style.cssText = [
        'position:absolute',
        'top:12%',
        'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(80,40,160,0.90)',
        'color:#fff',
        'font-size:1.5rem',
        'font-weight:700',
        'padding:10px 28px',
        'border-radius:16px',
        'pointer-events:none',
        'z-index:999',
        'animation:fadeOutUp 2s ease forwards',
    ].join(';');
    document.getElementById('game-container').appendChild(msg);
    setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 2000);
}

// ════════════════════════════════════════════════════════
// 花朵授粉碰撞偵測
// ════════════════════════════════════════════════════════

let pinkFlowerVisited = false;  // 粉花已碰觸
let redFlowerVisited  = false;  // 紅花已碰觸

/**
 * 將 ok.png 定位到花朵正上方
 * @param {string} okId   ok 圖片的 id
 * @param {string} flowerId 花朵的 id
 */
function showOkOnFlower(okId, flowerId) {
    const gc     = document.getElementById('game-container').getBoundingClientRect();
    const flower = document.getElementById(flowerId);
    const ok     = document.getElementById(okId);
    const fr     = flower.getBoundingClientRect();
    const okW    = 48;  // 與 CSS 一致

    // 水平置中在花朵上方
    ok.style.left    = (fr.left - gc.left + (fr.width - okW) / 2) + 'px';
    ok.style.top     = (fr.top  - gc.top  - okW - 4) + 'px';
    ok.style.display = 'block';
}

/**
 * 偵測蜜蜂是否碰到兩朵花並處理授粉
 */
function checkFlowerCollisions() {
    const gc  = document.getElementById('game-container').getBoundingClientRect();
    const bee = document.getElementById('bee');
    const br  = bee.getBoundingClientRect();
    const beeRect = { x: br.left - gc.left, y: br.top - gc.top, w: br.width, h: br.height };

    // 偵測粉花
    if (!pinkFlowerVisited) {
        const pf = document.getElementById('pink-flower');
        const pfr = pf.getBoundingClientRect();
        const pfRect = { x: pfr.left - gc.left, y: pfr.top - gc.top, w: pfr.width, h: pfr.height };
        if (isOverlapping(beeRect, pfRect, 0)) {
            pinkFlowerVisited = true;
            showOkOnFlower('ok-pink', 'pink-flower');
            playSound(SFX.right);   // 碰到花音效
            checkPollinationSuccess();
        }
    }

    // 偵測紅花
    if (!redFlowerVisited) {
        const rf = document.getElementById('red-flower');
        const rfr = rf.getBoundingClientRect();
        const rfRect = { x: rfr.left - gc.left, y: rfr.top - gc.top, w: rfr.width, h: rfr.height };
        if (isOverlapping(beeRect, rfRect, 0)) {
            redFlowerVisited = true;
            showOkOnFlower('ok-red', 'red-flower');
            playSound(SFX.right);   // 碰到花音效
            checkPollinationSuccess();
        }
    }
}

/**
 * 判斷兩朵花是否全部碰觸完成，展示授粉成功
 */
function checkPollinationSuccess() {
    if (!pinkFlowerVisited || !redFlowerVisited) return;

    playSound(SFX.win);             // 授粉成功音效

    // 移除舊訊息
    const old = document.getElementById('pollination-msg');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const msg = document.createElement('div');
    msg.id = 'pollination-msg';
    msg.textContent = '🌸 授粉成功！ 🌸';
    msg.style.cssText = [
        'position:absolute',
        'top:50%',
        'left:50%',
        'transform:translate(-50%,-50%)',
        'background:rgba(255,180,0,0.95)',
        'color:#5a3000',
        'font-size:3rem',
        'font-weight:900',
        'padding:24px 48px',
        'border-radius:24px',
        'pointer-events:none',
        'z-index:9999',
        'box-shadow:0 8px 32px rgba(0,0,0,0.3)',
        'letter-spacing:0.1em',
        'animation:pollinationPop 0.4s ease',
    ].join(';');
    document.getElementById('game-container').appendChild(msg);

    // 注入動畫 keyframe
    if (!document.getElementById('pollination-style')) {
        const style = document.createElement('style');
        style.id = 'pollination-style';
        style.textContent = `
            @keyframes pollinationPop {
                0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 0; }
                70%  { transform: translate(-50%,-50%) scale(1.1); opacity: 1; }
                100% { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// ════════════════════════════════════════════════════════
// 草莓碰撞偵測
// ════════════════════════════════════════════════════════

/**
 * 偵測蜜蜂是否碰到草莓
 * 若尚未觸發過，速度 +10 並隱藏草莓，只執行一次
 */
function checkBerryCollision() {
    if (berrySpeedBoosted) return;   // 已吃過，直接略過

    const berry = document.getElementById('berry');
    if (!berry || berry.style.display === 'none') return;

    const beeRect   = { x: beeX, y: beeY, w: BEE_SIZE.w, h: BEE_SIZE.h };
    const br        = berry.getBoundingClientRect();
    const gc        = document.getElementById('game-container').getBoundingClientRect();
    const berryRect = {
        x: br.left - gc.left,
        y: br.top  - gc.top,
        w: br.width,
        h: br.height,
    };

    if (isOverlapping(beeRect, berryRect, 0)) {
        MOVE_STEP         += 10;           // 速度 +10
        berrySpeedBoosted  = true;         // 標記：只能吃一次
        berry.style.display = 'none';      // 隱藏草莓
        showSpeedUpMessage();              // 顯示提示訊息
    }
}

/**
 * 在畫面短暫顯示「Speed +10!」提示
 */
function showSpeedUpMessage() {
    let msg = document.getElementById('speed-up-msg');
    if (!msg) {
        msg = document.createElement('div');
        msg.id = 'speed-up-msg';
        msg.textContent = '🍓 Speed +10!';
        msg.style.cssText = [
            'position:absolute',
            'top:18%',
            'left:50%',
            'transform:translateX(-50%)',
            'background:rgba(255,80,80,0.88)',
            'color:#fff',
            'font-size:1.6rem',
            'font-weight:700',
            'padding:10px 28px',
            'border-radius:16px',
            'pointer-events:none',
            'z-index:999',
            'animation:fadeOutUp 1.8s ease forwards',
        ].join(';');
        document.getElementById('game-container').appendChild(msg);

        // 注入 keyframe（只注入一次）
        if (!document.getElementById('speedup-style')) {
            const style = document.createElement('style');
            style.id = 'speedup-style';
            style.textContent = `
                @keyframes fadeOutUp {
                    0%   { opacity:1; transform:translateX(-50%) translateY(0); }
                    70%  { opacity:1; }
                    100% { opacity:0; transform:translateX(-50%) translateY(-40px); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 1800);
}

// ════════════════════════════════════════════════════════
// 蔥碰撞偵測
// ════════════════════════════════════════════════════════

/**
 * 偵測蜜蜂是否碰到蔥
 * 若尚未觸發過，速度 -5 並隱藏蔥，只執行一次
 */
function checkScallionCollision() {
    if (scallionSpeedReduced) return;   // 已碰過，直接略過

    const scallion = document.getElementById('garlic');
    if (!scallion || scallion.style.display === 'none') return;

    const beeRect     = { x: beeX, y: beeY, w: BEE_SIZE.w, h: BEE_SIZE.h };
    const sr          = scallion.getBoundingClientRect();
    const gc          = document.getElementById('game-container').getBoundingClientRect();
    const scallionRect = {
        x: sr.left - gc.left,
        y: sr.top  - gc.top,
        w: sr.width,
        h: sr.height,
    };

    if (isOverlapping(beeRect, scallionRect, 0)) {
        MOVE_STEP             = Math.max(1, MOVE_STEP - 5); // 速度 -5（最低 1）
        scallionSpeedReduced   = true;                      // 標記：只能碰一次
        scallion.style.display = 'none';                    // 隱藏蔥
        showSpeedDownMessage();                             // 顯示提示訊息
    }
}

/**
 * 在畫面短暫顯示「Speed -5!」提示
 */
function showSpeedDownMessage() {
    let msg = document.getElementById('speed-down-msg');
    if (!msg) {
        msg = document.createElement('div');
        msg.id = 'speed-down-msg';
        msg.textContent = '🧅 Speed -5!';
        msg.style.cssText = [
            'position:absolute',
            'top:28%',
            'left:50%',
            'transform:translateX(-50%)',
            'background:rgba(80,160,80,0.88)',
            'color:#fff',
            'font-size:1.6rem',
            'font-weight:700',
            'padding:10px 28px',
            'border-radius:16px',
            'pointer-events:none',
            'z-index:999',
            'animation:fadeOutDown 1.8s ease forwards',
        ].join(';');
        document.getElementById('game-container').appendChild(msg);

        // 注入 keyframe（只注入一次）
        if (!document.getElementById('speeddown-style')) {
            const style = document.createElement('style');
            style.id = 'speeddown-style';
            style.textContent = `
                @keyframes fadeOutDown {
                    0%   { opacity:1; transform:translateX(-50%) translateY(0); }
                    70%  { opacity:1; }
                    100% { opacity:0; transform:translateX(-50%) translateY(40px); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 1800);
}

// ════════════════════════════════════════════════════════
// 啟動
// ════════════════════════════════════════════════════════

window.addEventListener('load', () => {
    initBeePosition();       // 1. 先設定蜜蜂的 px 位置
    initRandomPositions();   // 2. 其他物件隨機放置（會讀取蜜蜂位置作為避開依據）
    initKeyboardControl();   // 3. 鍵盤控制
    initButtonControl();     // 4. 畫面按鈕控制
    startGameLoop();         // 5. 啟動遊戲循環（持續移動）
});

