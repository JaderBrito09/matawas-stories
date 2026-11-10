/* ========================================================
   MATAWAS STORIES - WORKER DEDICADO DE GRAVAÇÃO DE VÍDEO
   Renderização em Segundo Plano via OffscreenCanvas + WebCodecs
   com Aceleração por Hardware Explícita ('prefer-hardware')
   ======================================================== */

try {
  importScripts('mp4-muxer.min.js');
} catch (e) {
  // Caso importScripts relativo falhe em subdomínio
  try {
    importScripts('./mp4-muxer.min.js');
  } catch (e2) {}
}

self.onmessage = async function(e) {
  const data = e.data;
  if (!data) return;

  if (data.type === 'cancel') {
    self.isCancelled = true;
    return;
  }

  if (data.type !== 'start') return;

  self.isCancelled = false;
  const {
    targetW, targetH, fps, targetBitrate, duracaoTotal, totalFrames,
    cardsData, cardW, cardH, gap, margin,
    enableIntro, introDur, scrollCardsDur, maxDeslocamento,
    planarAudioData, sampleRate,
    codecValido, usarAvcConfig, usarHardwareAccel
  } = data;

  try {
    if (typeof Mp4Muxer === 'undefined') {
      throw new Error("Mp4Muxer não está disponível no Worker.");
    }
    if (typeof VideoEncoder === 'undefined') {
      throw new Error("VideoEncoder não está disponível no Worker.");
    }

    const offCanvas = new OffscreenCanvas(targetW, targetH);
    const outCtx = offCanvas.getContext('2d', { alpha: false });
    const scaleRatio = targetW / 1920;
    const step = cardW + gap;

    // Configuração do Codificador de Áudio AAC no Muxer
    let audioEncoder = null;
    let usarAudioNoMuxer = false;

    if (planarAudioData && typeof AudioEncoder === 'function' && typeof AudioData === 'function') {
      try {
        const aCheck = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: sampleRate || 44100,
          numberOfChannels: 2,
          bitrate: 128000
        });
        if (aCheck && aCheck.supported) {
          audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: (err) => console.error("Erro AudioEncoder Worker:", err)
          });
          await audioEncoder.configure({
            codec: 'mp4a.40.2',
            sampleRate: sampleRate || 44100,
            numberOfChannels: 2,
            bitrate: 128000
          });
          usarAudioNoMuxer = true;
        }
      } catch (aErr) {
        console.warn("AudioEncoder no Worker não suportado:", aErr);
      }
    }

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: targetW,
        height: targetH
      },
      ...(usarAudioNoMuxer ? {
        audio: {
          codec: 'aac',
          numberOfChannels: 2,
          sampleRate: sampleRate || 44100
        }
      } : {}),
      fastStart: 'in-memory'
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (err) => { throw err; }
    });

    const encoderConfig = {
      codec: codecValido,
      width: targetW,
      height: targetH,
      bitrate: targetBitrate,
      framerate: fps,
      ...(usarHardwareAccel ? { hardwareAcceleration: 'prefer-hardware' } : {}),
      latencyMode: 'quality'
    };
    if (usarAvcConfig) {
      encoderConfig.avc = { format: 'avc' };
    }

    await encoder.configure(encoderConfig);
    const frameDurationMicros = Math.round(1_000_000 / fps);

    // Função de desenho otimizada no OffscreenCanvas
    function renderizarFrame(tempo) {
      outCtx.save();
      if (scaleRatio !== 1) {
        outCtx.scale(scaleRatio, scaleRatio);
      }

      outCtx.fillStyle = '#0f1013';
      outCtx.fillRect(0, 0, 1920, 1080);

      if (enableIntro && tempo < introDur) {
        const slots = [
          { x: 20, y: 20, txtT: 0.2, imgT: 1.6 },
          { x: 665, y: 20, txtT: 2.4, imgT: 3.8 },
          { x: 1310, y: 20, txtT: 4.6, imgT: 6.0 }
        ];
        for (let i = 0; i < slots.length; i++) {
          if (!cardsData[i]) continue;
          const slot = slots[i];
          if (tempo >= slot.imgT && cardsData[i].bitmap) {
            const progress = Math.min(1, (tempo - slot.imgT) / 0.3);
            outCtx.globalAlpha = progress;
            outCtx.drawImage(cardsData[i].bitmap, slot.x, slot.y, cardW, cardH);
            outCtx.globalAlpha = 1;
          } else if (tempo >= slot.txtT && cardsData[i].txtBitmap) {
            const progress = Math.min(1, (tempo - slot.txtT) / 0.35);
            outCtx.globalAlpha = progress;
            outCtx.drawImage(cardsData[i].txtBitmap, slot.x, slot.y + (cardH * 0.66), cardW, cardH * 0.34);
            outCtx.globalAlpha = 1;
          }
        }
      } else {
        const tempoScroll = enableIntro ? (tempo - introDur) : tempo;
        const progressoScroll = Math.min(1, Math.max(0, tempoScroll / scrollCardsDur));
        let progressoAjustado = progressoScroll;
        const rampa = Math.min(0.08, 1.2 / scrollCardsDur);
        if (progressoScroll < rampa && rampa > 0) {
          const t = progressoScroll / rampa;
          progressoAjustado = rampa * (t * t * (3 - 2 * t));
        }

        const currentScrollX = progressoAjustado * maxDeslocamento;
        const minX = currentScrollX - cardW;
        const maxX = currentScrollX + 1920;
        const firstIdx = Math.max(0, Math.floor((minX - margin) / step));
        const lastIdx = Math.min(cardsData.length - 1, Math.ceil((maxX - margin) / step));

        for (let i = firstIdx; i <= lastIdx; i++) {
          const cardX = Math.round((margin + i * step) - currentScrollX);
          if (cardX + cardW >= -20 && cardX <= 1940 && cardsData[i].bitmap) {
            outCtx.drawImage(cardsData[i].bitmap, cardX, 20);
          }
        }
      }

      outCtx.restore();
    }

    // Loop de renderização acelerado
    for (let frame = 0; frame < totalFrames; frame++) {
      if (self.isCancelled) {
        encoder.close();
        if (audioEncoder) audioEncoder.close();
        self.postMessage({ type: 'cancelled' });
        return;
      }

      // Backpressure mínimo para não sobrecarregar memória da GPU
      while (encoder.encodeQueueSize >= 4) {
        if (self.isCancelled) break;
        await new Promise(r => setTimeout(r, 6));
      }

      const tempoAtual = frame / fps;
      renderizarFrame(tempoAtual);

      const videoFrame = new VideoFrame(offCanvas, {
        timestamp: frame * frameDurationMicros,
        duration: frameDurationMicros
      });

      const isKey = (frame % fps === 0) || (frame === 0);
      encoder.encode(videoFrame, { keyFrame: isKey });
      videoFrame.close();

      if (frame % 4 === 0 || frame === totalFrames - 1) {
        const pct = Math.round(15 + ((frame / totalFrames) * 75));
        let faseNome = "Scroll Contínuo";
        if (enableIntro && tempoAtual < introDur) {
          faseNome = "Intro 3 Cards";
        } else {
          const tempoScroll = enableIntro ? (tempoAtual - introDur) : tempoAtual;
          if (tempoScroll >= scrollCardsDur) {
            faseNome = "Tela Final YouTube";
          }
        }
        self.postMessage({
          type: 'progress',
          pct: pct,
          frame: frame,
          totalFrames: totalFrames,
          tempoAtual: tempoAtual,
          duracaoTotal: duracaoTotal,
          faseNome: faseNome
        });
      }
    }

    // Processamento do Áudio AAC
    if (usarAudioNoMuxer && audioEncoder && planarAudioData) {
      self.postMessage({ type: 'status', text: 'Sincronizando áudio AAC estendido no Worker...' });
      const chunkSize = 1024;
      let frameOffset = 0;
      const totalAudioFrames = Math.floor(planarAudioData.length / 2);
      const ch0 = planarAudioData.subarray(0, totalAudioFrames);
      const ch1 = planarAudioData.subarray(totalAudioFrames, totalAudioFrames * 2);

      while (frameOffset < totalAudioFrames) {
        const framesInChunk = Math.min(chunkSize, totalAudioFrames - frameOffset);
        const chunkPlanar = new Float32Array(framesInChunk * 2);
        chunkPlanar.set(ch0.subarray(frameOffset, frameOffset + framesInChunk), 0);
        chunkPlanar.set(ch1.subarray(frameOffset, frameOffset + framesInChunk), framesInChunk);

        const timestampMicros = Math.round((frameOffset / sampleRate) * 1_000_000);
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: sampleRate,
          numberOfFrames: framesInChunk,
          numberOfChannels: 2,
          timestamp: timestampMicros,
          data: chunkPlanar
        });
        audioEncoder.encode(audioData);
        audioData.close();
        frameOffset += framesInChunk;
      }
      await audioEncoder.flush();
    }

    await encoder.flush();
    muxer.finalize();

    self.postMessage({
      type: 'done',
      buffer: muxer.target.buffer
    }, [muxer.target.buffer]);

  } catch (err) {
    self.postMessage({ type: 'error', error: err.message || String(err) });
  }
};
