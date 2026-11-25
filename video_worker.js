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

// Helper de traçado para retângulos com cantos arredondados no Worker
function pathCardArredondado(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
  } else {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.arcTo(x + w, y, x + w, y + r, r);
    context.arcTo(x + w, y + h, x + w - r, y + h, r);
    context.arcTo(x, y + h, x, y + h - r, r);
    context.arcTo(x, y, x + r, y, r);
    context.closePath();
  }
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
    isShorts, durPorCard, tituloHist,
    enableCinematicCamera = true, cinematicIntensity = 'gokushow'
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
        // RENDERIZAÇÃO VERTICAL 9:16 PARA YOUTUBE SHORTS (1080x1920 - ESTEIRA CONTÍNUA CINEMATOGRÁFICA)
        const numCards = cardsData.length;
        if (numCards > 0) {
          const cDur = durPorCard || 5;
          const cardW = 860;
          const cardH = 1440;
          const gap = 50;
          const step = cardW + gap; // 910px
          const cY = 160; // Safe zone vertical: 160px topo, 320px rodapé para UI do Shorts
          const heroX = Math.round((1080 - cardW) / 2); // 110px

          const cardIdx = Math.min(numCards - 1, Math.floor(tempo / cDur));
          const nextIdx = Math.min(numCards - 1, cardIdx + 1);
          const tempoNoCard = tempo - (cardIdx * cDur);

          // Transição suave com deslize cinematográfico
          const transDur = Math.min(0.95, cDur * 0.28);
          const emTransicao = cardIdx < numCards - 1 && tempoNoCard >= (cDur - transDur);
          const tProgress = emTransicao ? (tempoNoCard - (cDur - transDur)) / transDur : 0;
          const ease = tProgress * tProgress * (3 - 2 * tProgress);

          // Cálculo do deslocamento contínuo da câmera pela esteira
          let currentScrollX = 0;
          if (cardIdx === numCards - 1) {
            const pctUltimo = Math.min(1, tempoNoCard / cDur);
            currentScrollX = (cardIdx * step) + (pctUltimo * 16);
          } else if (emTransicao) {
            currentScrollX = (cardIdx * step) + 14 + (ease * (step - 14));
          } else {
            const pctLeitura = tempoNoCard / (cDur - transDur);
            currentScrollX = (cardIdx * step) + (pctLeitura * 14);
          }

          // 1. Fundo Ambiente Imersivo (Ambient Backdrop preenchendo 1080x1920)
          outCtx.fillStyle = '#0a0b0e';
          outCtx.fillRect(0, 0, 1080, 1920);

          const cAtual = cardsData[cardIdx];
          const cProx = cardsData[nextIdx];
          const bgImgAtual = cAtual ? cAtual.bitmap : null;
          const bgImgProx = cProx ? cProx.bitmap : null;

          const zoom = 1.12 + ((tempoNoCard / cDur) * 0.05);
          const bgW = Math.round(1080 * zoom);
          const bgH = Math.round(1920 * zoom);
          const bgX = Math.round((1080 - bgW) / 2);
          const bgY = Math.round((1920 - bgH) / 2);

          if (bgImgAtual) {
            outCtx.save();
            outCtx.globalAlpha = 0.26 * (1 - (ease * 0.55));
            outCtx.drawImage(bgImgAtual, bgX, bgY, bgW, bgH);
            outCtx.restore();
          }
          if (ease > 0 && bgImgProx && bgImgProx !== bgImgAtual) {
            outCtx.save();
            outCtx.globalAlpha = 0.26 * ease;
            outCtx.drawImage(bgImgProx, bgX, bgY, bgW, bgH);
            outCtx.restore();
          }

          // Vinheta cinematográfica vertical suave
          const gradV = outCtx.createLinearGradient(0, 0, 0, 1920);
          gradV.addColorStop(0, 'rgba(8, 10, 14, 0.94)');
          gradV.addColorStop(0.12, 'rgba(8, 10, 14, 0.55)');
          gradV.addColorStop(0.5, 'rgba(8, 10, 14, 0.18)');
          gradV.addColorStop(0.85, 'rgba(8, 10, 14, 0.65)');
          gradV.addColorStop(1, 'rgba(8, 10, 14, 0.96)');
          outCtx.fillStyle = gradV;
          outCtx.fillRect(0, 0, 1080, 1920);

          // 2. Renderização dos cards da Esteira Contínua em 9:16 com Ken Burns e Impact Shake
          const firstIdx = Math.max(0, cardIdx - 1);
          const lastIdx = Math.min(numCards - 1, cardIdx + 2);

          // Tremor de impacto na transição de card
          let shakeX = 0, shakeY = 0;
          if (enableCinematicCamera && tempoNoCard < 0.52) {
            const t = tempoNoCard / 0.52;
            const decay = Math.exp(-4.8 * t);
            const mult = cinematicIntensity === 'intenso' ? 1.6 : (cinematicIntensity === 'suave' ? 0.6 : 1.0);
            const amp = 10 * mult * decay;
            shakeX = Math.sin(tempoNoCard * 42) * amp;
            shakeY = Math.cos(tempoNoCard * 52) * (amp * 0.7);
          }

          const zoomMult = cinematicIntensity === 'intenso' ? 1.075 : (cinematicIntensity === 'suave' ? 1.03 : 1.05);
          const kenBurnsZoom = enableCinematicCamera ? (1.0 + ((zoomMult - 1.0) * (tempoNoCard / cDur))) : 1.0;

          for (let i = firstIdx; i <= lastIdx; i++) {
            const cardItem = cardsData[i];
            if (!cardItem || !cardItem.bitmap) continue;
            const posX = Math.round(heroX + (i * step) - currentScrollX);

            if (posX + cardW >= -50 && posX <= 1130) {
              outCtx.save();
              if (shakeX !== 0 || shakeY !== 0) {
                outCtx.translate(shakeX, shakeY);
              }
              if (kenBurnsZoom !== 1.0 && i === cardIdx) {
                const cX = posX + cardW / 2;
                const cYCenter = cY + (cardH * 0.38);
                outCtx.translate(cX, cYCenter);
                outCtx.scale(kenBurnsZoom, kenBurnsZoom);
                outCtx.translate(-cX, -cYCenter);
              }

              outCtx.save();
              outCtx.shadowColor = 'rgba(0, 0, 0, 0.72)';
              outCtx.shadowBlur = 38;
              outCtx.shadowOffsetX = 0;
              outCtx.shadowOffsetY = 14;
              outCtx.fillStyle = '#14161d';
              pathCardArredondado(outCtx, posX, cY, cardW, cardH, 24);
              outCtx.fill();
              outCtx.restore();

              outCtx.save();
              pathCardArredondado(outCtx, posX, cY, cardW, cardH, 24);
              outCtx.clip();
              outCtx.drawImage(cardItem.bitmap, posX, cY, cardW, cardH);
              outCtx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
              outCtx.lineWidth = 2;
              outCtx.stroke();
              outCtx.restore();

              outCtx.restore();
            }
          }

          // 3. Título elegante e discreto no topo
          if (tituloHist) {
            outCtx.save();
            const titCortado = tituloHist.length > 34 ? tituloHist.slice(0, 34) + '...' : tituloHist;
            outCtx.font = 'bold 22px sans-serif';
            outCtx.textAlign = 'center';
            outCtx.fillStyle = 'rgba(255, 255, 255, 0.82)';
            outCtx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            outCtx.shadowBlur = 10;
            outCtx.shadowOffsetY = 2;
            outCtx.fillText(titCortado.toUpperCase(), 540, 110);
            outCtx.restore();
          }
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
              const tempoVisivel = tempo - slot.imgT;
              const progress = Math.min(1, tempoVisivel / 0.3);

              let shakeX = 0, shakeY = 0;
              if (enableCinematicCamera && tempoVisivel < 0.45) {
                const t = tempoVisivel / 0.45;
                const decay = Math.exp(-4.5 * t);
                const mult = cinematicIntensity === 'intenso' ? 1.5 : (cinematicIntensity === 'suave' ? 0.6 : 1.0);
                const amp = 8 * mult * decay;
                shakeX = Math.sin(tempoVisivel * 38) * amp;
                shakeY = Math.cos(tempoVisivel * 48) * (amp * 0.7);
              }

              const zoomMult = cinematicIntensity === 'intenso' ? 1.06 : (cinematicIntensity === 'suave' ? 1.025 : 1.04);
              const kenBurns = enableCinematicCamera ? (1.0 + ((zoomMult - 1.0) * Math.min(1, tempoVisivel / 2.5))) : 1.0;

              outCtx.save();
              if (shakeX !== 0 || shakeY !== 0) outCtx.translate(shakeX, shakeY);
              if (kenBurns !== 1.0) {
                const cX = slot.x + cardW / 2;
                const cYCenter = slot.y + (cardH * 0.35);
                outCtx.translate(cX, cYCenter);
                outCtx.scale(kenBurns, kenBurns);
                outCtx.translate(-cX, -cYCenter);
              }
              outCtx.globalAlpha = progress;
              outCtx.drawImage(cardsData[i].bitmap, slot.x, slot.y, cardW, cardH);
              outCtx.restore();
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

          const cDur = durPorCard || 5;
          const tempoNoCard = tempoScroll % cDur;
          let shakeX = 0, shakeY = 0;
          if (enableCinematicCamera && tempoNoCard < 0.45 && progressoScroll < 0.98) {
            const t = tempoNoCard / 0.45;
            const decay = Math.exp(-4.5 * t);
            const mult = cinematicIntensity === 'intenso' ? 1.5 : (cinematicIntensity === 'suave' ? 0.6 : 1.0);
            const amp = 7 * mult * decay;
            shakeX = Math.sin(tempoNoCard * 38) * amp;
            shakeY = Math.cos(tempoNoCard * 46) * (amp * 0.7);
          }

          for (let i = firstIdx; i <= lastIdx; i++) {
            const cardX = Math.round((margin + i * step) - currentScrollX);
            if (cardX + cardW >= -20 && cardX <= 1940 && cardsData[i].bitmap) {
              const cardCenterX = cardX + cardW / 2;
              const distFromCenter = Math.abs(cardCenterX - 960);
              const focus = Math.max(0, 1 - (distFromCenter / 480));
              const zoomMult = cinematicIntensity === 'intenso' ? 1.055 : (cinematicIntensity === 'suave' ? 1.02 : 1.038);
              const cardScale = enableCinematicCamera ? (1.0 + ((zoomMult - 1.0) * focus)) : 1.0;

              outCtx.save();
              if (shakeX !== 0 || shakeY !== 0) outCtx.translate(shakeX, shakeY);
              if (cardScale > 1.002) {
                const cX = cardCenterX;
                const cYCenter = 20 + (cardH * 0.35);
                outCtx.translate(cX, cYCenter);
                outCtx.scale(cardScale, cardScale);
                outCtx.translate(-cX, -cYCenter);
              }
              outCtx.drawImage(cardsData[i].bitmap, cardX, 20);
              outCtx.restore();
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

