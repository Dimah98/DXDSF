import WebSocket from 'ws';
import { Logger } from '../logger';
import { ProjectSession } from '../types';
import { isSessionBrowserAlive } from '../browserManager';

const logger = new Logger('WebRTCStreamer');

// In-page streamer script injected into Camoufox/Firefox session.page
const IN_PAGE_WEBRTC_SCRIPT = `
(async function() {
  // If streamer already active, clean up previous connection first
  if (window.__sf_webrtc_cleanup) {
    try { window.__sf_webrtc_cleanup(); } catch (_) {}
  }

  window.__sf_webrtc_active = true;

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  function sendSignal(sig) {
    if (typeof window.__sf_send_webrtc_signal === 'function') {
      try {
        window.__sf_send_webrtc_signal(JSON.stringify(sig));
      } catch (err) {
        console.warn('[WebRTC-InPage] Failed to send signal:', err);
      }
    }
  }

  function findBestCanvas() {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (canvases.length === 0) return null;
    if (canvases.length === 1) return canvases[0];
    return canvases.reduce((max, c) => {
      const area = (c.width || 0) * (c.height || 0);
      const maxArea = (max.width || 0) * (max.height || 0);
      return area > maxArea ? c : max;
    }, canvases[0]);
  }

  let pc = null;
  let activeStream = null;
  let fbInterval = null;
  let observer = null;
  let isUsingFallback = false;

  try {
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    window.__sf_webrtc_pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({ type: 'candidate', candidate: e.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      sendSignal({ type: 'iceConnectionState', state: pc.iceConnectionState });
    };

    let targetCanvas = findBestCanvas();

    if (targetCanvas && typeof targetCanvas.captureStream === 'function') {
      try {
        activeStream = targetCanvas.captureStream(30);
      } catch (e) {
        console.warn('[WebRTC-InPage] canvas.captureStream failed:', e);
      }
    }

    if (!activeStream) {
      isUsingFallback = true;
      const fbCanvas = document.createElement('canvas');
      fbCanvas.width = 1280;
      fbCanvas.height = 720;
      const ctx = fbCanvas.getContext('2d');

      const renderFallback = () => {
        if (!ctx) return;
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, 1280, 720);

        // Gradient banner
        const grad = ctx.createLinearGradient(0, 0, 1280, 0);
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(1, '#06b6d4');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 310, 1280, 4);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌻 Sunflower Land — WebRTC Stream', 640, 270);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px sans-serif';
        ctx.fillText('Очікування завантаження ігрового полотна (Canvas)...', 640, 360);
      };

      renderFallback();
      fbInterval = setInterval(renderFallback, 500);
      window.__sf_webrtc_fb_interval = fbInterval;

      try {
        activeStream = fbCanvas.captureStream(10);
      } catch (fbErr) {
        console.error('[WebRTC-InPage] Fallback captureStream failed:', fbErr);
      }

      // Check for real game canvas dynamically
      observer = new MutationObserver(() => {
        const c = findBestCanvas();
        if (c && c !== fbCanvas && typeof c.captureStream === 'function') {
          observer.disconnect();
          observer = null;
          try {
            const realStream = c.captureStream(30);
            const realTrack = realStream.getVideoTracks()[0];
            if (realTrack && pc) {
              const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
              if (sender) {
                sender.replaceTrack(realTrack);
              }
            }
            if (fbInterval) {
              clearInterval(fbInterval);
              fbInterval = null;
            }
            activeStream = realStream;
            isUsingFallback = false;
          } catch (_) {}
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
      window.__sf_webrtc_observer = observer;
    }

    window.__sf_webrtc_stream = activeStream;

    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        pc.addTrack(track, activeStream);
      });
    }

    const offer = await pc.createOffer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false
    });
    await pc.setLocalDescription(offer);

    const devWidth = targetCanvas ? targetCanvas.width : (window.innerWidth || 1280);
    const devHeight = targetCanvas ? targetCanvas.height : (window.innerHeight || 720);

    sendSignal({
      type: 'offer',
      sdp: offer.sdp,
      metadata: {
        deviceWidth: devWidth,
        deviceHeight: devHeight
      }
    });

  } catch (initErr) {
    console.error('[WebRTC-InPage] Initialization failed:', initErr);
    sendSignal({ type: 'error', message: String(initErr) });
  }

  window.__sf_webrtc_handle_signal = async function(sig) {
    if (!window.__sf_webrtc_pc) return;
    const peer = window.__sf_webrtc_pc;
    try {
      if (sig.type === 'answer') {
        if (peer.signalingState === 'have-local-offer') {
          await peer.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sig.sdp }));
        }
      } else if (sig.type === 'candidate' && sig.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(sig.candidate));
      }
    } catch (sigErr) {
      console.error('[WebRTC-InPage] Error handling remote signal:', sigErr);
    }
  };

  window.__sf_webrtc_cleanup = function() {
    if (window.__sf_webrtc_fb_interval) {
      clearInterval(window.__sf_webrtc_fb_interval);
      window.__sf_webrtc_fb_interval = null;
    }
    if (window.__sf_webrtc_observer) {
      window.__sf_webrtc_observer.disconnect();
      window.__sf_webrtc_observer = null;
    }
    if (window.__sf_webrtc_pc) {
      try { window.__sf_webrtc_pc.close(); } catch (_) {}
      window.__sf_webrtc_pc = null;
    }
    if (window.__sf_webrtc_stream) {
      try {
        window.__sf_webrtc_stream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      window.__sf_webrtc_stream = null;
    }
    window.__sf_webrtc_active = false;
  };
})();
`;

/**
 * Registers WebRTC signaling bridge and in-page capture streamer for the session
 */
export async function startWebRTCStream(session: ProjectSession, ws: WebSocket, projectName: string): Promise<void> {
  if (!isSessionBrowserAlive(session) || !session.page) {
    logger.warn(`Cannot start WebRTC stream: Browser not alive for ${projectName}`);
    return;
  }

  // Manage set of active WebRTC client sockets
  if (!(session as any)._webrtcClients) {
    (session as any)._webrtcClients = new Set<WebSocket>();
  }
  (session as any)._webrtcClients.add(ws);
  (ws as any).isWebRTCStreaming = true;

  // Expose signal callback function into the page if not already exposed
  if (!(session as any)._webrtcExposed) {
    try {
      await session.page.exposeFunction('__sf_send_webrtc_signal', (rawSignalStr: string) => {
        try {
          const parsedSignal = JSON.parse(rawSignalStr);
          const clients: Set<WebSocket> = (session as any)._webrtcClients;
          if (clients) {
            for (const clientWs of clients) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'WEBRTC_SIGNAL',
                  projectName,
                  signal: parsedSignal
                }));
              }
            }
          }
        } catch (parseErr) {
          logger.debug(`Failed to parse WebRTC signal from page in ${projectName}`, { error: String(parseErr) });
        }
      });
      (session as any)._webrtcExposed = true;
    } catch (exposeErr: any) {
      // Function might already be exposed on page context
      if (!String(exposeErr?.message || exposeErr).includes('already registered')) {
        logger.warn(`Failed to expose __sf_send_webrtc_signal for ${projectName}`, { error: String(exposeErr) });
      } else {
        (session as any)._webrtcExposed = true;
      }
    }
  }

  // Hook navigation listener to automatically re-inject streamer on page refresh/navigate
  if (!(session as any)._webrtcNavAttached) {
    const handleNav = async () => {
      const activeClients: Set<WebSocket> = (session as any)._webrtcClients;
      if (activeClients && activeClients.size > 0 && isSessionBrowserAlive(session) && session.page) {
        logger.info(`Page navigation detected in ${projectName}, re-injecting WebRTC streamer...`);
        try {
          await session.page.evaluate(IN_PAGE_WEBRTC_SCRIPT);
        } catch (reinjectErr) {
          logger.debug(`Could not re-inject WebRTC streamer after navigation in ${projectName}`, { error: String(reinjectErr) });
        }
      }
    };
    session.page.on('domcontentloaded', handleNav);
    (session as any)._webrtcNavAttached = true;
  }

  // Inject in-page streamer script
  try {
    await session.page.evaluate(IN_PAGE_WEBRTC_SCRIPT);
    logger.info(`WebRTC streamer injected successfully for project ${projectName}`);
  } catch (evalErr) {
    logger.error(`Failed to inject WebRTC streamer into page for ${projectName}`, evalErr instanceof Error ? evalErr : new Error(String(evalErr)));
    ws.send(JSON.stringify({
      type: 'WEBRTC_SIGNAL',
      projectName,
      signal: { type: 'error', message: 'Failed to inject WebRTC streamer into page' }
    }));
  }
}

/**
 * Handles incoming WebRTC signal (SDP Answer or ICE Candidate) from client
 */
export async function handleWebRTCSignal(session: ProjectSession, _ws: WebSocket, signal: any): Promise<void> {
  if (!isSessionBrowserAlive(session) || !session.page) {
    return;
  }

  try {
    await session.page.evaluate((sig) => {
      if (typeof (window as any).__sf_webrtc_handle_signal === 'function') {
        (window as any).__sf_webrtc_handle_signal(sig);
      }
    }, signal);
  } catch (err) {
    logger.debug(`Error delivering WebRTC signal to page for ${session.projectName}`, { error: String(err) });
  }
}

/**
 * Stops WebRTC stream for a specific client socket or for the entire session
 */
export async function stopWebRTCStream(session: ProjectSession, ws?: WebSocket): Promise<void> {
  const clients: Set<WebSocket> = (session as any)._webrtcClients;
  if (ws) {
    (ws as any).isWebRTCStreaming = false;
    if (clients) {
      clients.delete(ws);
    }
  }

  // If no more WebRTC clients are active, stop in-page streamer to save CPU
  if (!clients || clients.size === 0) {
    if (isSessionBrowserAlive(session) && session.page) {
      try {
        await session.page.evaluate(() => {
          if (typeof (window as any).__sf_webrtc_cleanup === 'function') {
            (window as any).__sf_webrtc_cleanup();
          }
        });
        logger.info(`WebRTC streamer stopped for project ${session.projectName} (no active viewers)`);
      } catch (_) {}
    }
  }
}
