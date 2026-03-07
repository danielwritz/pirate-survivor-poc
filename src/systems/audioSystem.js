function localClamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function createCrusherCurve(steps = 30) {
    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
  return curve;
}

export function normalizeOr(x, y, fallbackX = 1, fallbackY = 0) {
    const len = Math.hypot(x, y);
    if (!Number.isFinite(len) || len <= 0.00001) return { x: fallbackX, y: fallbackY };
    return { x: x / len, y: y / len };
}

export function createGameAudioSystem(config) {
    const {
      getPlayerPosition,
      getForwardVector,
      getRightVector,
      button,
      clamp = localClamp
    } = config;

    const audio = {
      ctx: null,
      master: null,
      crusherCurve: null,
      targetVolume: 0.4,
      muted: false,
      ready: false,
      lastGunAt: -10,
      lastCannonAt: -10,
      lastPlayerCannonAt: -10,
      lastGunImpactAt: -10,
      lastCannonImpactAt: -10
    };

    function safeRun(fn) {
      try {
        fn();
      } catch {
      }
    }

    function ensureAudioReady() {
      if (audio.ready) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;

      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = audio.muted ? 0.0001 : audio.targetVolume;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 16;
      comp.ratio.value = 4.2;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5600;
      lp.Q.value = 0.4;

      master.connect(comp);
      comp.connect(lp);
      lp.connect(ctx.destination);

      audio.ctx = ctx;
      audio.master = master;
      audio.crusherCurve = createCrusherCurve(28);
      audio.ready = true;
    }

    function unlockAudio() {
      safeRun(() => {
        ensureAudioReady();
        if (!audio.ready) return;
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
      });
    }

    function setSfxMuted(muted) {
      audio.muted = !!muted;
      if (button) {
        button.textContent = audio.muted ? 'SFX: OFF' : 'SFX: ON';
        button.classList.toggle('is-muted', audio.muted);
      }
      if (audio.ready) {
        const now = audio.ctx.currentTime;
        audio.master.gain.cancelScheduledValues(now);
        audio.master.gain.setTargetAtTime(audio.muted ? 0.0001 : audio.targetVolume, now, 0.02);
      }
    }

    function getSpatialMix(originX, originY, dirX, dirY) {
      const playerPos = getPlayerPosition();
      const toSourceX = originX - playerPos.x;
      const toSourceY = originY - playerPos.y;
      const sourceDist = Math.hypot(toSourceX, toSourceY);
      const sourceNormX = toSourceX / Math.max(1, sourceDist);
      const sourceNormY = toSourceY / Math.max(1, sourceDist);

      const fwd = getForwardVector();
      const right = getRightVector();

      const sourcePan = sourceNormX * right.x + sourceNormY * right.y;
      const sourceFront = sourceNormX * fwd.x + sourceNormY * fwd.y;
      const dirPan = dirX * right.x + dirY * right.y;
      const dirFront = dirX * fwd.x + dirY * fwd.y;

      const pan = clamp(sourcePan * 0.8 + dirPan * 0.2, -1, 1);
      const front = clamp(sourceFront * 0.65 + dirFront * 0.35, -1, 1);
      const distanceNorm = clamp(sourceDist / 920, 0, 1);
      // Hard-cull sounds beyond hearing range — stops Web Audio node creation for distant events
      if (sourceDist > 1400) return null;

      const distanceAtten = 1 / (1 + (sourceDist / 360) ** 2.15);
      const gain = clamp(0.012 + distanceAtten * 1.05, 0.008, 1.05);
      return {
        pan,
        front,
        gain,
        sourceDist,
        distanceAtten,
        distanceNorm
      };
    }

    function createVoiceChain(spatial) {
      const voiceGain = audio.ctx.createGain();
      const tone = audio.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      const farCut = 1 - spatial.distanceNorm;
      const frontBase = spatial.front < 0 ? 980 : 2450;
      const frontBoost = spatial.front < 0 ? 460 : 1700;
      tone.frequency.value = frontBase + frontBoost * farCut;
      tone.Q.value = spatial.front < 0 ? 0.6 : 0.25;

      const crusher = audio.ctx.createWaveShaper();
      crusher.curve = audio.crusherCurve;
      crusher.oversample = 'none';

      let panNode = null;
      if (typeof audio.ctx.createStereoPanner === 'function') {
        panNode = audio.ctx.createStereoPanner();
        panNode.pan.value = spatial.pan;
      } else {
        panNode = audio.ctx.createGain();
      }

      voiceGain.connect(tone);
      tone.connect(crusher);
      crusher.connect(panNode);
      panNode.connect(audio.master);
      return voiceGain;
    }

    function bassFromSourceSize(sourceSize = 16) {
      return clamp((sourceSize - 12) / 28, 0, 1);
    }

    function playUiChirp() {
      safeRun(() => {
        if (!audio.ready || audio.muted) return;
        const now = audio.ctx.currentTime;
        const osc = audio.ctx.createOscillator();
        const gain = audio.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(780, now);
        osc.frequency.exponentialRampToValueAtTime(1080, now + 0.06);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        osc.connect(gain);
        gain.connect(audio.master);
        osc.start(now);
        osc.stop(now + 0.07);
      });
    }

    function playGunVolleySfx(originX, originY, dirX, dirY, count = 1, sourceSize = 16) {
      safeRun(() => {
        if (!audio.ready || audio.muted) return;
        if (audio.ctx.currentTime - audio.lastGunAt < 0.03) return;
        audio.lastGunAt = audio.ctx.currentTime;

        const dir = normalizeOr(dirX, dirY, 1, 0);
        const bass = bassFromSourceSize(sourceSize);
        const spatial = getSpatialMix(originX, originY, dir.x, dir.y);
        if (!spatial) return;
        const now = audio.ctx.currentTime;
        const pops = clamp(1 + Math.floor(count * 0.33), 1, 4);

        for (let i = 0; i < pops; i++) {
          const start = now + i * (0.016 + Math.random() * 0.01);
          const dur = 0.03 + Math.random() * 0.024;
          const out = createVoiceChain(spatial);

          out.gain.setValueAtTime(0.0001, start);
          out.gain.linearRampToValueAtTime((0.18 + count * 0.011 + bass * 0.035) * spatial.gain, start + 0.002);
          out.gain.exponentialRampToValueAtTime(0.0001, start + dur);

          const osc = audio.ctx.createOscillator();
          osc.type = Math.random() < 0.65 ? 'square' : 'triangle';
          const pitchMul = 1 - bass * 0.32;
          const f0 = (700 + Math.random() * 300) * pitchMul;
          const f1 = f0 * (0.44 + Math.random() * 0.12);
          osc.frequency.setValueAtTime(f0, start);
          osc.frequency.exponentialRampToValueAtTime(f1, start + dur);

          const hp = audio.ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 360 + Math.random() * 140;
          hp.Q.value = 0.65;
          osc.connect(hp);
          hp.connect(out);

          const noise = audio.ctx.createBufferSource();
          const noiseBuffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * 0.04), audio.ctx.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let n = 0; n < data.length; n++) data[n] = (Math.random() * 2 - 1) * 0.7;
          noise.buffer = noiseBuffer;

          const bp = audio.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = (820 + Math.random() * 560) * (1 - bass * 0.2);
          bp.Q.value = 0.9;
          const ng = audio.ctx.createGain();
          ng.gain.setValueAtTime(0.0001, start);
          ng.gain.linearRampToValueAtTime(0.09 * spatial.gain, start + 0.0015);
          ng.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.65);
          noise.connect(bp);
          bp.connect(ng);
          ng.connect(out);

          osc.start(start);
          osc.stop(start + dur + 0.01);
          noise.start(start);
          noise.stop(start + dur);
        }
      });
    }

    function playCannonVolleySfx(originX, originY, dirX, dirY, count = 1, sourceSize = 16) {
      safeRun(() => {
        if (!audio.ready || audio.muted || count <= 0) return;
        const playerPos = getPlayerPosition();
        const isPlayerSource = Math.hypot(originX - playerPos.x, originY - playerPos.y) < 18;
        const nowTime = audio.ctx.currentTime;
        if (isPlayerSource) {
          if (nowTime - audio.lastPlayerCannonAt < 0.02) return;
          audio.lastPlayerCannonAt = nowTime;
        } else {
          if (nowTime - audio.lastCannonAt < 0.09) return;
          audio.lastCannonAt = nowTime;
        }

        const dir = normalizeOr(dirX, dirY, 1, 0);
        const bass = bassFromSourceSize(sourceSize);
        const spatial = getSpatialMix(originX, originY, dir.x, dir.y);
        if (!spatial) return;
        const nearField = spatial.sourceDist < 120;
        const cannonGain = nearField ? Math.max(0.46, spatial.gain * 1.12) : spatial.gain;
        const now = audio.ctx.currentTime;
        const out = createVoiceChain(spatial);
        const weight = clamp(0.8 + count * 0.12 + bass * 0.25, 0.85, 2.05);
        const dur = 0.24 + Math.random() * 0.15;

        out.gain.setValueAtTime(0.0001, now);
        out.gain.linearRampToValueAtTime(0.34 * weight * cannonGain, now + 0.007);
        out.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        const low = audio.ctx.createOscillator();
        low.type = 'triangle';
        const lowStart = (74 + Math.random() * 20) * (1 - bass * 0.22);
        const lowEnd = (32 + Math.random() * 12) * (1 - bass * 0.18);
        low.frequency.setValueAtTime(lowStart, now);
        low.frequency.exponentialRampToValueAtTime(lowEnd, now + dur * 0.92);

        const sub = audio.ctx.createOscillator();
        sub.type = 'sine';
        const subStart = (40 + Math.random() * 12) * (1 - bass * 0.16);
        const subEnd = (24 + Math.random() * 8) * (1 - bass * 0.14);
        sub.frequency.setValueAtTime(subStart, now);
        sub.frequency.exponentialRampToValueAtTime(subEnd, now + dur);

        const bodyLp = audio.ctx.createBiquadFilter();
        bodyLp.type = 'lowpass';
        bodyLp.frequency.value = spatial.front < 0 ? 760 : 1200;
        bodyLp.Q.value = 0.55;

        low.connect(bodyLp);
        sub.connect(bodyLp);
        bodyLp.connect(out);

        const blast = audio.ctx.createBufferSource();
        const blastBuffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * 0.2), audio.ctx.sampleRate);
        const blastData = blastBuffer.getChannelData(0);
        for (let n = 0; n < blastData.length; n++) {
          const decay = 1 - n / blastData.length;
          blastData[n] = (Math.random() * 2 - 1) * decay * (0.55 + Math.random() * 0.28);
        }
        blast.buffer = blastBuffer;
        const blastLp = audio.ctx.createBiquadFilter();
        blastLp.type = 'lowpass';
        blastLp.frequency.value = 620 + Math.random() * 260;
        blastLp.Q.value = 0.65;
        const blastGain = audio.ctx.createGain();
        blastGain.gain.setValueAtTime(0.0001, now);
        blastGain.gain.linearRampToValueAtTime(0.24 * weight * cannonGain, now + 0.008);
        blastGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.88);
        blast.connect(blastLp);
        blastLp.connect(blastGain);
        blastGain.connect(out);

        const echoDelay = 0.075 + spatial.distanceNorm * 0.11;
        const echoOut = createVoiceChain({
          pan: spatial.pan * 0.65,
          front: spatial.front,
          gain: cannonGain * (0.34 + spatial.distanceNorm * 0.42)
        });
        const echoDur = dur * 0.72;
        echoOut.gain.setValueAtTime(0.0001, now + echoDelay);
        echoOut.gain.linearRampToValueAtTime((0.11 + 0.05 * spatial.distanceNorm) * weight, now + echoDelay + 0.012);
        echoOut.gain.exponentialRampToValueAtTime(0.0001, now + echoDelay + echoDur);

        const echoOsc = audio.ctx.createOscillator();
        echoOsc.type = 'triangle';
        echoOsc.frequency.setValueAtTime(lowStart * 0.72, now + echoDelay);
        echoOsc.frequency.exponentialRampToValueAtTime(lowEnd * 0.7, now + echoDelay + echoDur);
        const echoLP = audio.ctx.createBiquadFilter();
        echoLP.type = 'lowpass';
        echoLP.frequency.value = 480 + Math.random() * 180;
        echoLP.Q.value = 0.45;
        echoOsc.connect(echoLP);
        echoLP.connect(echoOut);

        low.start(now);
        sub.start(now);
        low.stop(now + dur + 0.02);
        sub.stop(now + dur + 0.02);
        blast.start(now);
        blast.stop(now + dur);
        echoOsc.start(now + echoDelay);
        echoOsc.stop(now + echoDelay + echoDur + 0.02);

        if (isPlayerSource) {
          const dry = audio.ctx.createGain();
          dry.gain.setValueAtTime(0.0001, now);
          dry.gain.linearRampToValueAtTime(0.22, now + 0.004);
          dry.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
          dry.connect(audio.master);

          const dryOsc = audio.ctx.createOscillator();
          dryOsc.type = 'triangle';
          dryOsc.frequency.setValueAtTime(118, now);
          dryOsc.frequency.exponentialRampToValueAtTime(52, now + 0.08);
          const dryLP = audio.ctx.createBiquadFilter();
          dryLP.type = 'lowpass';
          dryLP.frequency.value = 950;
          dryOsc.connect(dryLP);
          dryLP.connect(dry);

          const dryNoise = audio.ctx.createBufferSource();
          const dryNoiseBuffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * 0.06), audio.ctx.sampleRate);
          const dryData = dryNoiseBuffer.getChannelData(0);
          for (let i = 0; i < dryData.length; i++) {
            const decay = 1 - i / dryData.length;
            dryData[i] = (Math.random() * 2 - 1) * decay * 0.7;
          }
          dryNoise.buffer = dryNoiseBuffer;
          const dryBP = audio.ctx.createBiquadFilter();
          dryBP.type = 'bandpass';
          dryBP.frequency.value = 420;
          dryBP.Q.value = 0.8;
          dryNoise.connect(dryBP);
          dryBP.connect(dry);

          dryOsc.start(now);
          dryOsc.stop(now + 0.1);
          dryNoise.start(now);
          dryNoise.stop(now + 0.085);
        }
      });
    }

    function playGunImpactSfx(originX, originY, dirX, dirY, sourceSize = 16) {
      safeRun(() => {
        if (!audio.ready || audio.muted) return;
        if (audio.ctx.currentTime - audio.lastGunImpactAt < 0.02) return;
        audio.lastGunImpactAt = audio.ctx.currentTime;

        const dir = normalizeOr(dirX, dirY, 1, 0);
        const bass = bassFromSourceSize(sourceSize);
        const spatial = getSpatialMix(originX, originY, dir.x, dir.y);
        if (!spatial) return;
        const now = audio.ctx.currentTime;
        const out = createVoiceChain(spatial);
        const dur = 0.038 + Math.random() * 0.03;

        out.gain.setValueAtTime(0.0001, now);
        out.gain.linearRampToValueAtTime((0.16 + bass * 0.04) * spatial.gain, now + 0.002);
        out.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        const osc = audio.ctx.createOscillator();
        osc.type = Math.random() < 0.55 ? 'square' : 'triangle';
        const f0 = (540 + Math.random() * 240) * (1 - bass * 0.28);
        const f1 = f0 * (0.42 + Math.random() * 0.16);
        osc.frequency.setValueAtTime(f0, now);
        osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
        const hp = audio.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 280 + Math.random() * 110;
        hp.Q.value = 0.75;
        osc.connect(hp);
        hp.connect(out);

        const noise = audio.ctx.createBufferSource();
        const noiseBuffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * 0.05), audio.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (0.8 - i / data.length * 0.35);
        noise.buffer = noiseBuffer;
        const bp = audio.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 760 + Math.random() * 520;
        bp.Q.value = 1.05;
        const ng = audio.ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.linearRampToValueAtTime((0.11 + bass * 0.02) * spatial.gain, now + 0.0015);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.72);
        noise.connect(bp);
        bp.connect(ng);
        ng.connect(out);

        osc.start(now);
        osc.stop(now + dur + 0.01);
        noise.start(now);
        noise.stop(now + dur);
      });
    }

    function playCannonImpactSfx(originX, originY, dirX, dirY, sourceSize = 16) {
      safeRun(() => {
        if (!audio.ready || audio.muted) return;
        if (audio.ctx.currentTime - audio.lastCannonImpactAt < 0.05) return;
        audio.lastCannonImpactAt = audio.ctx.currentTime;

        const dir = normalizeOr(dirX, dirY, 1, 0);
        const bass = bassFromSourceSize(sourceSize);
        const spatial = getSpatialMix(originX, originY, dir.x, dir.y);
        if (!spatial) return;
        const now = audio.ctx.currentTime;
        const out = createVoiceChain(spatial);
        const dur = 0.18 + Math.random() * 0.11;

        out.gain.setValueAtTime(0.0001, now);
        out.gain.linearRampToValueAtTime((0.2 + bass * 0.09) * spatial.gain, now + 0.006);
        out.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        const low = audio.ctx.createOscillator();
        low.type = 'triangle';
        const lowStart = (62 + Math.random() * 18) * (1 - bass * 0.24);
        const lowEnd = (28 + Math.random() * 10) * (1 - bass * 0.18);
        low.frequency.setValueAtTime(lowStart, now);
        low.frequency.exponentialRampToValueAtTime(lowEnd, now + dur * 0.95);

        const sub = audio.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime((34 + Math.random() * 11) * (1 - bass * 0.14), now);
        sub.frequency.exponentialRampToValueAtTime((22 + Math.random() * 7) * (1 - bass * 0.12), now + dur);

        const lp = audio.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = spatial.front < 0 ? 700 : 980;
        lp.Q.value = 0.5;
        low.connect(lp);
        sub.connect(lp);
        lp.connect(out);

        const air = audio.ctx.createBufferSource();
        const airBuffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * 0.16), audio.ctx.sampleRate);
        const airData = airBuffer.getChannelData(0);
        for (let i = 0; i < airData.length; i++) {
          const decay = 1 - i / airData.length;
          airData[i] = (Math.random() * 2 - 1) * decay * 0.55;
        }
        air.buffer = airBuffer;
        const airLp = audio.ctx.createBiquadFilter();
        airLp.type = 'lowpass';
        airLp.frequency.value = 520 + Math.random() * 220;
        airLp.Q.value = 0.6;
        const airGain = audio.ctx.createGain();
        airGain.gain.setValueAtTime(0.0001, now);
        airGain.gain.linearRampToValueAtTime((0.12 + bass * 0.04) * spatial.gain, now + 0.01);
        airGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.85);
        air.connect(airLp);
        airLp.connect(airGain);
        airGain.connect(out);

        low.start(now);
        sub.start(now);
        low.stop(now + dur + 0.02);
        sub.stop(now + dur + 0.02);
        air.start(now);
        air.stop(now + dur);
      });
    }

    /**
     * Boss spawn announcement stinger — a deep ominous horn + rumble that plays
     * at full volume regardless of the boss position (global alert).
     */
    function playBossSpawnSfx() {
      safeRun(() => {
        if (!audio.ready || audio.muted) return;
        const now = audio.ctx.currentTime;

        // Low sub-bass rumble
        const sub = audio.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(48, now);
        sub.frequency.exponentialRampToValueAtTime(30, now + 1.8);
        const subGain = audio.ctx.createGain();
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(0.28, now + 0.06);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
        sub.connect(subGain);
        subGain.connect(audio.master);
        sub.start(now);
        sub.stop(now + 1.85);

        // Mid-range horn tone (sawtooth falling pitch)
        const horn = audio.ctx.createOscillator();
        horn.type = 'sawtooth';
        horn.frequency.setValueAtTime(220, now + 0.04);
        horn.frequency.exponentialRampToValueAtTime(110, now + 1.0);
        const hornGain = audio.ctx.createGain();
        hornGain.gain.setValueAtTime(0.0001, now + 0.04);
        hornGain.gain.linearRampToValueAtTime(0.18, now + 0.1);
        hornGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        const hornLp = audio.ctx.createBiquadFilter();
        hornLp.type = 'lowpass';
        hornLp.frequency.value = 900;
        hornLp.Q.value = 1.2;
        horn.connect(hornLp);
        hornLp.connect(hornGain);
        hornGain.connect(audio.master);
        horn.start(now + 0.04);
        horn.stop(now + 1.25);

        // Short high transient "strike" at the start
        const strike = audio.ctx.createOscillator();
        strike.type = 'triangle';
        strike.frequency.setValueAtTime(380, now);
        strike.frequency.exponentialRampToValueAtTime(60, now + 0.18);
        const strikeGain = audio.ctx.createGain();
        strikeGain.gain.setValueAtTime(0.0001, now);
        strikeGain.gain.linearRampToValueAtTime(0.22, now + 0.006);
        strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        strike.connect(strikeGain);
        strikeGain.connect(audio.master);
        strike.start(now);
        strike.stop(now + 0.22);
      });
    }

    function bindUi() {      if (!button) return;
      button.addEventListener('click', () => {
        unlockAudio();
        setSfxMuted(!audio.muted);
        if (!audio.muted) playUiChirp();
      });
      setSfxMuted(false);
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }

  bindUi();

  return {
    unlockAudio,
    setSfxMuted,
    playUiChirp,
    playGunVolleySfx,
    playCannonVolleySfx,
    playGunImpactSfx,
    playCannonImpactSfx,
    playBossSpawnSfx
  };
}
