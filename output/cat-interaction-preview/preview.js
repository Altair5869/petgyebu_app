/* Throwaway browser preview. No application state, API or production imports. */
(() => {
  const $ = (id) => document.getElementById(id);
  const states = [
    { name: '안정', file: 'stable', head: [0.30, 0.12, 0.44, 0.27] },
    { name: '주의', file: 'caution', head: [0.33, 0.15, 0.43, 0.27] },
    { name: '경고', file: 'warning', head: [0.27, 0.12, 0.45, 0.27] },
    { name: '예산 도달', file: 'budget-reached', head: [0.27, 0.12, 0.45, 0.27] },
  ];
  // Target rectangles use original @3x coordinates (372 × 288).
  // Source rectangles use each state's actual two-column v2 PNG pixel coordinates.
  // Only the two eye bounds plus a small skin margin are composited. Body, head outline, mouth and feet
  // always come from the unchanged original; the drifting full sprites are never drawn.
  const eyes = [
    { target: [[144, 148, 59, 61], [229, 168, 56, 57]], half: [[365, 351, 165, 150], [620, 407, 150, 143]], closed: [[1380, 370, 160, 146], [1630, 424, 150, 143]] },
    { target: [[148, 136, 58, 58], [229, 157, 51, 54]], half: [[471, 346, 142, 136], [669, 400, 130, 120]], closed: [[1367, 363, 142, 136], [1570, 425, 125, 120]] },
    { target: [[94, 125, 57, 64], [194, 121, 59, 64]], half: [[274, 342, 154, 145], [528, 339, 160, 149]], closed: [[1278, 353, 154, 145], [1535, 350, 160, 149]] },
    { target: [[95, 121, 57, 64], [195, 118, 61, 66]], half: [[271, 350, 160, 145], [543, 345, 174, 150]], closed: [[1304, 363, 160, 145], [1568, 358, 174, 150]] },
  ];
  const canvas = $('cat');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let budget = 0;
  let active = null; // Transient pose keeps its own row; never writes budget.
  let frame = null;
  let timers = [];
  let idleTimer;
  let pointer = null;
  let ready = false;
  let focused = document.hasFocus();
  let originals;
  let preparedFrames;
  const log = (message) => { $('trace').textContent = message; };
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };

  function prepareFrames(sources) {
    // Prepare fixed-size full frames once. Playback never repositions body parts.
    // The replacement material is generated artwork, not a scaled/deformed original eye.
    return states.map((_, row) => [originals[row], ...['half', 'closed'].map((pose) => {
      const result = document.createElement('canvas');
      result.width = canvas.width;
      result.height = canvas.height;
      const output = result.getContext('2d');
      output.drawImage(originals[row], 0, 0, result.width, result.height);
      const originalPixels = output.getImageData(0, 0, result.width, result.height);
      eyes[row].target.forEach((target, index) => {
        const [x, y, w, h] = target.map((value, axis) => value * (axis % 2 === 0 ? canvas.width / 372 : canvas.height / 288));
        const source = sources[row];
        const [sx, sy, sw, sh] = eyes[row][pose][index];
        const patch = document.createElement('canvas');
        patch.width = result.width;
        patch.height = result.height;
        const paint = patch.getContext('2d');
        // Fully cover the old open-eye outline. A feathered ellipse through the
        // eye itself left parts of that outline visible as extra "wrinkle" lines.
        // Add skin outside the eye without moving/scaling the new eyelid artwork.
        const marginX = 3 * canvas.width / 372;
        const marginY = 3 * canvas.height / 288;
        const dx = x - marginX;
        const dy = y - marginY;
        const dw = w + 2 * marginX;
        const dh = h + 2 * marginY;
        const sourceMarginX = marginX * sw / w;
        const sourceMarginY = marginY * sh / h;
        paint.drawImage(source, sx - sourceMarginX, sy - sourceMarginY, sw + 2 * sourceMarginX, sh + 2 * sourceMarginY, dx, dy, dw, dh);
        const eyePixels = paint.getImageData(dx, dy, dw, dh);
        globalThis.CatEyeCompositor.removeDonorBlush(eyePixels);
        paint.putImageData(eyePixels, dx, dy);
        // Feather only in the added skin margin. The entire original eye box,
        // including the corners, remains fully opaque in both mask directions.
        paint.globalCompositeOperation = 'destination-in';
        const horizontal = paint.createLinearGradient(dx, dy, dx + dw, dy);
        const vertical = paint.createLinearGradient(dx, dy, dx, dy + dh);
        for (const [edge, margin] of [[horizontal, marginX / dw], [vertical, marginY / dh]]) {
          edge.addColorStop(0, 'rgba(255,255,255,0)');
          edge.addColorStop(margin, '#fff');
          edge.addColorStop(1 - margin, '#fff');
          edge.addColorStop(1, 'rgba(255,255,255,0)');
          paint.fillStyle = edge;
          paint.fillRect(dx, dy, dw, dh);
        }
        output.drawImage(patch, 0, 0);
      });
      const composedPixels = output.getImageData(0, 0, result.width, result.height);
      globalThis.CatEyeCompositor.restoreOriginalBlush(composedPixels, originalPixels, row === 1 && pose === 'closed');
      output.putImageData(composedPixels, 0, 0);
      return result;
    })]);
  }

  function drawComparison() {
    if (!ready) return;
    for (const [pose, id] of ['frame-open', 'frame-half', 'frame-closed'].entries()) {
      const item = $(id);
      const context = item.getContext('2d');
      context.clearRect(0, 0, item.width, item.height);
      context.drawImage(preparedFrames[budget][pose], 0, 0, item.width, item.height);
    }
    $('frame-version').textContent = `${states[budget].name} · 눈 소재 v2 / ${budget === 1 ? '감은 눈 오른쪽 볼 경계 수정' : '원본 볼터치 고정'}`;
    $('source-sheet').href = `cat-${states[budget].file}-blink-source-v2.png`;
  }

  function draw() {
    if (!ready) return;
    const row = active ? active.row : budget;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pose = frame === null ? 0 : frame === 1 ? 1 : 2;
    ctx.drawImage(preparedFrames[row][pose], 0, 0, canvas.width, canvas.height);
    if ($('overlay').checked && pose !== 0) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(originals[row], 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    $('state-label').textContent = states[budget].name;
    $('source').textContent = frame === null ? '기존 원본 PNG · 위치 고정' : '정렬된 표정 프레임 · 검토 중';
    $('reaction').textContent = active
      ? `${states[row].name} · ${active.type === 'blink' ? '눈 깜빡이는 중' : '쓰다듬는 중'}`
      : '현재 예산 감정으로 쉬고 있어요';
    canvas.setAttribute('aria-label', `${states[row].name} 상태의 고양이${active ? ', ' + $('reaction').textContent : ''}`);
    const [x, y, w, h] = states[row].head;
    Object.assign($('head').style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` });
    for (const id of ['head', 'pet', 'blink', 'change-during-pet']) $(id).disabled = !$('draft').checked;
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    clearTimeout(idleTimer);
  }
  function releaseCapture() {
    const id = pointer;
    pointer = null;
    if (id !== null && $('head').hasPointerCapture(id)) $('head').releasePointerCapture(id);
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (!ready || !focused || document.hidden || active || reduced.matches || !$('draft').checked || !$('idle').checked || budget === 3) return;
    idleTimer = setTimeout(blink, 4000 + Math.random() * 3000);
  }
  function finish(reason = '반응 종료') {
    clearTimers();
    releaseCapture();
    active = null;
    frame = null;
    draw();
    log(`${reason} → 최신 예산 상태: ${states[budget].name} · 기존 원본 표시`);
    scheduleIdle();
  }
  function blink() {
    if (!ready || active || !$('draft').checked) return;
    if (reduced.matches) { log('동작 줄이기 설정으로 깜빡임을 생략했습니다.'); return; }
    clearTimers();
    active = { type: 'blink', row: budget };
    frame = 1;
    draw();
    later(() => { frame = 2; draw(); }, 90);
    later(() => { frame = 1; draw(); }, 180);
    later(() => finish('깜빡임 종료'), 270);
  }
  function startPet() {
    if (!ready || !$('draft').checked) return false;
    clearTimers();
    active = { type: 'pet', row: budget };
    frame = reduced.matches ? 3 : 1;
    draw();
    if (!reduced.matches) later(() => { frame = 3; draw(); }, 100);
    log(`쓰다듬기 시작: ${states[budget].name}`);
    return true;
  }
  function endPet() {
    if (!active || active.type !== 'pet') return;
    clearTimers();
    releaseCapture();
    if (reduced.matches) { finish(); return; }
    frame = 2;
    draw();
    later(() => { frame = 1; draw(); }, 120);
    later(() => finish(), 240);
  }
  function petOnce(changeBudget = false) {
    releaseCapture();
    if (!startPet()) return;
    if (changeBudget) later(() => {
      budget = (budget + 1) % states.length;
      $('budget').value = String(budget);
      draw();
      drawComparison();
      log(`반응 중 예산 변경 → ${states[budget].name} · 종료 후 복귀 예정`);
    }, 300);
    later(endPet, 850);
  }

  $('head').addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
    if (!startPet()) return;
    event.preventDefault();
    pointer = event.pointerId;
    $('head').setPointerCapture(pointer);
  });
  $('head').addEventListener('pointerup', (event) => { if (event.pointerId === pointer) endPet(); });
  $('head').addEventListener('pointercancel', (event) => { if (event.pointerId === pointer) finish('터치 취소'); });
  $('head').addEventListener('lostpointercapture', (event) => { if (event.pointerId === pointer) finish('터치 해제'); });
  $('head').addEventListener('click', (event) => { if (event.detail === 0) petOnce(); });
  $('pet').addEventListener('click', () => petOnce());
  $('change-during-pet').addEventListener('click', () => petOnce(true));
  $('blink').addEventListener('click', blink);
  $('reset').addEventListener('click', () => { $('draft').checked = false; finish('원본으로 복귀'); });
  $('budget').addEventListener('change', () => { budget = Number($('budget').value); draw(); drawComparison(); scheduleIdle(); });
  $('draft').addEventListener('change', () => finish('미리보기 모드 변경'));
  $('idle').addEventListener('change', () => { if (active?.type === 'blink') finish(); else scheduleIdle(); });
  $('overlay').addEventListener('change', draw);
  $('area').addEventListener('change', () => $('stage').classList.toggle('show-area', $('area').checked));
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish('화면 숨김'); else scheduleIdle(); });
  window.addEventListener('blur', () => { focused = false; finish('화면 이탈'); });
  window.addEventListener('focus', () => { focused = true; scheduleIdle(); });
  window.addEventListener('pagehide', () => { clearTimers(); releaseCapture(); });
  function motionLabel() {
    $('motion').textContent = reduced.matches ? '시스템 동작 줄이기: 켜짐 · 자동 동작 생략' : '예산 도달 상태는 자동 동작을 멈춥니다.';
  }
  reduced.addEventListener('change', () => { motionLabel(); finish('동작 설정 변경'); });
  motionLabel();
  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  Promise.all([
    ...states.map(({ file }) => loadImage(`../../assets/images/pets/cat-${file}@3x.png`)),
    ...states.map(({ file }) => loadImage(`cat-${file}-blink-source-v2.png`)),
  ]).then((images) => {
    originals = images.slice(0, 4);
    preparedFrames = prepareFrames(images.slice(4));
    ready = true;
    $('draft').disabled = false;
    draw();
    drawComparison();
    // CLI export uses the very same prepared canvases the user reviewed.
    if (window.location?.search === '?export=frames') {
      const frames = {};
      states.forEach(({ file }, row) => ['open', 'half', 'closed'].forEach((pose, index) => {
        const exported = document.createElement('canvas');
        exported.width = canvas.width;
        exported.height = canvas.height;
        exported.getContext('2d').drawImage(preparedFrames[row][index], 0, 0, canvas.width, canvas.height);
        frames[`cat-${file}-${pose}.png`] = exported.toDataURL('image/png').split(',')[1];
      }));
      const data = document.createElement('script');
      data.id = 'exported-cat-frames';
      data.type = 'application/json';
      data.textContent = JSON.stringify(frames);
      document.body.appendChild(data);
    }
  }).catch(() => { $('reaction').textContent = '미리보기를 준비하지 못했어요. 로컬 서버를 실행한 뒤 http://127.0.0.1:8765/ 에서 열어 주세요.'; });
})();
