// Shadow Step — sound, made in code, no audio files.
// One job: tiny WebAudio bleeps — footsteps that tell you where a guard
// is, a sting when the alarm goes up, a blip for a pickup. Everything
// is synthesised, so the game loads no network and no assets.

export function createAudio() {
  return {
    ctx: null,
    muted: false,
    lastStepAt: 0,
  };
}

function ensure(audio) {
  if (audio.ctx) return audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
  } catch {
    audio.ctx = null;
  }
  return audio.ctx;
}

function tone(audio, freq, dur, type, gain, slideTo) {
  const ctx = ensure(audio);
  if (!ctx || audio.muted) return;
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain || 0.08, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch {
    // Sound is garnish; a failure here must never break the game.
  }
}

// A soft tick per step. Guards step lower and slower than the player,
// so you can hear a patrol coming before you see its cone.
export function playSteps(audio, game, time) {
  if (time - audio.lastStepAt < 0.12) return;
  audio.lastStepAt = time;
  const player = game.player;
  if (player && player.moving && Math.floor(player.stepClock) !== Math.floor(player.stepClock - 0.05)) {
    tone(audio, player.sneaking ? 220 : 300, 0.05, 'triangle', player.sneaking ? 0.015 : 0.03);
  }
  for (const guard of game.guards) {
    if (Math.floor(guard.stepClock) !== Math.floor(guard.stepClock - 0.05)) {
      // Only the nearest guard's steps are loud enough to matter.
      const d = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (d < 320) tone(audio, 140, 0.06, 'sine', 0.035 * (1 - d / 320));
    }
  }
}

export function playAlarm(audio) {
  tone(audio, 660, 0.18, 'square', 0.05, 440);
  setTimeout(() => tone(audio, 660, 0.18, 'square', 0.05, 440), 180);
}

export function playPickup(audio) {
  tone(audio, 880, 0.09, 'sine', 0.06, 1320);
}

export function playPebble(audio) {
  tone(audio, 1400, 0.05, 'triangle', 0.05, 900);
}

export function playCaught(audio) {
  tone(audio, 220, 0.4, 'sawtooth', 0.06, 110);
}

export function playWin(audio) {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(audio, f, 0.22, 'sine', 0.06), i * 130));
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  return audio.muted;
}
