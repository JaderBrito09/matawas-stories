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
    baseAudioCh0, baseAudioCh1, sampleRate,
    codecValido, usarAvcConfig, usarHardwareAccel,
    isShorts, durPorCard, tituloHist
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

    if (baseAudioCh0 && baseAudioCh0.length > 0 && typeof AudioEncoder === 'function' && typeof AudioData === 'function') {
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

      if (isShorts) {
        // RENDERIZAÇÃO VERTICAL 9:16 PARA YOUTUBE SHORTS (1080x1920)
        outCtx.fillStyle = '#08090c';
        outCtx.fillRect(0, 0, 1080, 1920);

        const numCards = cardsData.length;
        if (numCards > 0) {
          const cDur = durPorCard || 5;
          const cardIdx = Math.min(numCards - 1, Math.floor(tempo / cDur));
          const tempoNoCard = tempo - (cardIdx * cDur);
          const cAtual = cardsData[cardIdx];
          const cProx = cardIdx < numCards - 1 ? cardsData[cardIdx + 1] : null;

          const cW = 840;
          const cH = 1408;
          const cX = 120;
          const cY = 256;

          const tempoTransicao = 0.35;
          const emTransicao = tempoNoCard >= (cDur - tempoTransicao) && cProx;
          const tProgress = emTransicao ? (tempoNoCard - (cDur - tempoTransicao)) / tempoTransicao : 0;
          const ease = tProgress * tProgress * (3 - 2 * tProgress);

          // 1. Fundo ambiente com a imagem do card atual
          const bgBmp = cAtual.bitmap;
          if (bgBmp) {
            outCtx.save();
            outCtx.globalAlpha = 0.22;
            outCtx.drawImage(bgBmp, -40, -40, 1160, 2000);
            outCtx.restore();
          }

          // Vinheta superior e inferior
          const gradV = outCtx.createLinearGradient(0, 0, 0, 1920);
          gradV.addColorStop(0, 'rgba(0,0,0,0.85)');
          gradV.addColorStop(0.2, 'rgba(0,0,0,0.4)');
          gradV.addColorStop(0.8, 'rgba(0,0,0,0.4)');
          gradV.addColorStop(1, 'rgba(0,0,0,0.92)');
          outCtx.fillStyle = gradV;
          outCtx.fillRect(0, 0, 1080, 1920);

          // 2. Desenho dos cards centralizados
          if (emTransicao && cProx && cProx.bitmap) {
            const shiftX = ease * (cW + 80);
            if (cAtual.bitmap) {
              outCtx.save();
              outCtx.globalAlpha = 1 - (ease * 0.4);
              outCtx.drawImage(cAtual.bitmap, cX - shiftX, cY, cW, cH);
              outCtx.restore();
            }
            outCtx.save();
            outCtx.globalAlpha = 0.6 + (ease * 0.4);
            outCtx.drawImage(cProx.bitmap, cX + (cW + 80) - shiftX, cY, cW, cH);
            outCtx.restore();
          } else if (cAtual.bitmap) {
            outCtx.drawImage(cAtual.bitmap, cX, cY, cW, cH);
          }

          // 3. Indicador e barra de progresso no topo do Shorts
          outCtx.save();
          outCtx.fillStyle = '#ffffff';
          outCtx.font = 'bold 28px sans-serif';
          outCtx.textAlign = 'center';
          if (tituloHist) {
            const titCortado = tituloHist.length > 32 ? tituloHist.slice(0, 32) + '...' : tituloHist;
            outCtx.fillText(titCortado.toUpperCase(), 540, 115);
          }
          outCtx.font = '600 20px sans-serif';
          outCtx.fillStyle = '#94a3b8';
          outCtx.fillText(`CENA ${cardIdx + 1} DE ${numCards}`, 540, 155);

          const totalT = duracaoTotal || (numCards * cDur);
          const pctGeral = Math.min(1, Math.max(0, tempo / totalT));
          outCtx.fillStyle = 'rgba(255,255,255,0.2)';
          outCtx.fillRect(60, 185, 960, 6);
          outCtx.fillStyle = '#ff4757';
          outCtx.fillRect(60, 185, 960 * pctGeral, 6);
          outCtx.restore();
        }

      } else {
        // RENDERIZAÇÃO HORIZONTAL 16:9 PADRÃO YOUTUBE
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

      // Backpressure estrito para não sobrecarregar memória da GPU
      while (encoder.encodeQueueSize >= 3) {
        if (self.isCancelled || encoder.state === 'closed') break;
        await new Promise(r => setTimeout(r, 6));
      }

      const tempoAtual = frame / fps;
      renderizarFrame(tempoAtual);

      const videoFrame = new VideoFrame(offCanvas, {
        timestamp: frame * frameDurationMicros,
        duration: frameDurationMicros
      });

      try {
        const isKey = (frame % fps === 0) || (frame === 0);
        encoder.encode(videoFrame, { keyFrame: isKey });
      } finally {
        videoFrame.close();
      }

      if (frame % 4 === 0 || frame === totalFrames - 1) {
        const pct = Math.round(15 + ((frame / totalFrames) * 75));
        let faseNome = "Scroll Contínuo";
        if (isShorts) {
          faseNome = "Renderizando Shorts 9:16";
        } else if (enableIntro && tempoAtual < introDur) {
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

    // Processamento do Áudio AAC em Streaming com Loop e Fade-Out (Zero consumo extra de RAM)
    if (usarAudioNoMuxer && audioEncoder && baseAudioCh0 && baseAudioCh0.length > 0) {
      try {
        self.postMessage({ type: 'status', text: 'Sincronizando áudio AAC em streaming no Worker...' });
        const sr = sampleRate || 44100;
        const baseLength = baseAudioCh0.length;
        const ch0 = baseAudioCh0;
        const ch1 = (baseAudioCh1 && baseAudioCh1.length === baseLength) ? baseAudioCh1 : ch0;

        const totalTargetFrames = Math.ceil(duracaoTotal * sr);
        const fadeStartSample = Math.max(0, Math.floor((duracaoTotal - 1.5) * sr));
        const fadeSamplesCount = Math.max(1, totalTargetFrames - fadeStartSample);

        const chunkSize = 1024;
        const reusablePlanar = new Float32Array(chunkSize * 2);
        let frameOffset = 0;

        while (frameOffset < totalTargetFrames) {
          if (self.isCancelled) break;
          while (audioEncoder.encodeQueueSize >= 8) {
            if (self.isCancelled || audioEncoder.state === 'closed') break;
            await new Promise(r => setTimeout(r, 4));
          }

          const framesInChunk = Math.min(chunkSize, totalTargetFrames - frameOffset);
          const chunkPlanar = framesInChunk === chunkSize ? reusablePlanar : new Float32Array(framesInChunk * 2);

          for (let s = 0; s < framesInChunk; s++) {
            const globalSample = frameOffset + s;
            const srcIdx = globalSample % baseLength;
            let gain = 1.0;
            if (globalSample >= fadeStartSample) {
              gain = Math.max(0.001, 1.0 - ((globalSample - fadeStartSample) / fadeSamplesCount));
            }
            chunkPlanar[s] = ch0[srcIdx] * gain;
            chunkPlanar[framesInChunk + s] = ch1[srcIdx] * gain;
          }

          const timestampMicros = Math.round((frameOffset / sr) * 1_000_000);
          const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate: sr,
            numberOfFrames: framesInChunk,
            numberOfChannels: 2,
            timestamp: timestampMicros,
            data: chunkPlanar
          });
          audioEncoder.encode(audioData);
          audioData.close();
          frameOffset += framesInChunk;
        }

        await Promise.race([
          audioEncoder.flush(),
          new Promise(r => setTimeout(r, 3000))
        ]);
        audioEncoder.close();
      } catch (aErr) {
        console.warn("Aviso: falha na trilha de áudio no Worker:", aErr);
      }
    }

    try {
      await Promise.race([
        encoder.flush(),
        new Promise(r => setTimeout(r, 4000))
      ]);
      encoder.close();
    } catch (e) {
      console.warn("Aviso no encoder.flush:", e);
    }

    try {
      muxer.finalize();
    } catch (muxErr) {
      console.warn("Aviso no muxer.finalize:", muxErr);
    }

    self.postMessage({
      type: 'done',
      buffer: muxer.target.buffer
    }, [muxer.target.buffer]);

  } catch (err) {
    self.postMessage({ type: 'error', error: err.message || String(err) });
  }
};

