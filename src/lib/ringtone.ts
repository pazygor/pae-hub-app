// Toque de "telefone" sintetizado via Web Audio API (sem depender de arquivo de
// áudio). Toca EM LOOP até stopRingtone() — chama atenção enquanto o modal de
// nova ocorrência estiver aberto.
// Observação: navegadores só tocam áudio após interação do usuário — como o login
// é uma interação, os toques seguintes funcionam; falhas são silenciadas.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let intervalId: number | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = ctx ?? new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Uma cadência: 2 "toques" (dois tons 440/480 Hz) roteados pelo master gain. */
function ringOnce(audio: AudioContext, out: GainNode) {
  const now = audio.currentTime;
  const ringDur = 0.4;
  const gap = 0.18;
  for (let i = 0; i < 2; i++) {
    const start = now + i * (ringDur + gap);
    for (const freq of [440, 480]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
      gain.gain.setValueAtTime(0.16, start + ringDur - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + ringDur);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + ringDur);
    }
  }
}

/** Inicia o toque em loop (idempotente — chamar de novo reinicia). */
export function startRingtone() {
  const audio = getCtx();
  if (!audio) return;
  stopRingtone();
  master = audio.createGain();
  master.gain.value = 1;
  master.connect(audio.destination);
  ringOnce(audio, master); // imediato
  intervalId = window.setInterval(() => {
    if (ctx && master) ringOnce(ctx, master);
  }, 1500);
}

/** Para o toque imediatamente (corta o master gain e limpa o loop). */
export function stopRingtone() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (master && ctx) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0.0001, ctx.currentTime); // silêncio imediato
    } catch {
      /* ignore */
    }
    try {
      master.disconnect();
    } catch {
      /* ignore */
    }
    master = null;
  }
}
