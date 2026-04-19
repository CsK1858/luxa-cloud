'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase-client';
import { DeviceCard } from '@/components/device/device-card';
import { PlusCircle, Cpu, Camera, Keyboard, X } from 'lucide-react';
import type { Device } from '@/lib/types';

export default function DevicesPage() {
  const t = useTranslations('nav');
  const tAdd = useTranslations('addDevice');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showAdd, setShowAdd] = useState(searchParams.get('add') === 'true');
  const [mode, setMode] = useState<'choose' | 'code' | 'scan'>('choose');
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadDevices = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('devices').select('*').order('last_seen', { ascending: false });
    if (data) setDevices(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setMode('scan');
    setClaimMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Start scanning frames for QR codes using BarcodeDetector API
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState !== 4) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const raw = barcodes[0].rawValue;
              handleQRData(raw);
            }
          } catch { /* ignore scan errors */ }
        }, 300);
      } else {
        // Fallback: no BarcodeDetector, ask user to type
        setClaimMsg({ text: tAdd('noBarcodeApi'), ok: false });
        stopCamera();
        setMode('code');
      }
    } catch (err) {
      setClaimMsg({ text: tAdd('cameraError'), ok: false });
      setMode('code');
    }
  };

  const handleQRData = (raw: string) => {
    stopCamera();
    try {
      // QR from ESP32 is JSON: {"type":"luxa_device","id":"LUXA-XXXXXX",...}
      const data = JSON.parse(raw);
      if (data.type === 'luxa_device' && data.id) {
        setCode(data.id);
        setMode('code');
        // Auto-claim
        claimDevice(data.id);
        return;
      }
    } catch { /* not JSON */ }
    // Fallback: try raw text as device code
    if (raw.startsWith('LUXA-')) {
      setCode(raw);
      setMode('code');
      claimDevice(raw);
    } else {
      setClaimMsg({ text: tAdd('invalidQR'), ok: false });
      setMode('code');
    }
  };

  const claimDevice = async (deviceId?: string) => {
    const id = deviceId || code.trim();
    if (!id) return;
    setClaiming(true);
    setClaimMsg(null);

    const supabase = createClient();

    // Use secure RPC function for atomic claiming
    const { data, error } = await supabase.rpc('claim_device', {
      p_device_id: id.toUpperCase()
    });

    if (error) {
      setClaimMsg({ text: tAdd('claimFailed'), ok: false });
      setClaiming(false);
      return;
    }

    const result = data as { ok: boolean; error?: string; message?: string };

    if (result.ok) {
      const msg = result.message === 'already_yours' ? tAdd('alreadyYours') : tAdd('claimSuccess');
      setClaimMsg({ text: msg, ok: true });
      setCode('');
      setShowAdd(false);
      loadDevices();
    } else {
      const errorMap: Record<string, string> = {
        'device_not_found': tAdd('claimFailed'),
        'already_claimed': tAdd('alreadyClaimed'),
        'not_authenticated': tAdd('claimFailed'),
      };
      setClaimMsg({ text: errorMap[result.error || ''] || tAdd('claimFailed'), ok: false });
    }
    setClaiming(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-luxa-text">{t('devices')}</h1>
        <button
          onClick={() => { setShowAdd(!showAdd); setMode('choose'); setClaimMsg(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-luxa-gold text-luxa-bg text-sm font-semibold rounded-lg hover:bg-luxa-gold-light transition"
        >
          <PlusCircle size={16} />
          {t('addDevice')}
        </button>
      </div>

      {/* Add Device Panel */}
      {showAdd && (
        <div className="bg-luxa-bg-card border border-luxa-gold/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-luxa-gold">{tAdd('title')}</h2>
            <button onClick={() => { setShowAdd(false); stopCamera(); }} className="text-luxa-muted hover:text-luxa-text">
              <X size={20} />
            </button>
          </div>

          {/* Instructions */}
          <div className="space-y-2 text-sm text-luxa-muted">
            <p>1. {tAdd('step1')}</p>
            <p>2. {tAdd('step2')}</p>
            <p>3. {tAdd('step3')}</p>
          </div>

          {/* Mode selector */}
          {mode === 'choose' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startCamera}
                className="flex flex-col items-center gap-3 p-6 bg-luxa-bg border border-luxa-border rounded-xl hover:border-luxa-gold transition"
              >
                <Camera size={32} className="text-luxa-gold" />
                <span className="text-sm font-medium text-luxa-text">{tAdd('scanQR')}</span>
              </button>
              <button
                onClick={() => { setMode('code'); setClaimMsg(null); }}
                className="flex flex-col items-center gap-3 p-6 bg-luxa-bg border border-luxa-border rounded-xl hover:border-luxa-gold transition"
              >
                <Keyboard size={32} className="text-luxa-gold" />
                <span className="text-sm font-medium text-luxa-text">{tAdd('enterCode')}</span>
              </button>
            </div>
          )}

          {/* QR Scanner */}
          {mode === 'scan' && (
            <div className="space-y-3">
              <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {/* Viewfinder overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-luxa-gold rounded-2xl opacity-60" />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { stopCamera(); setMode('choose'); }}
                  className="flex-1 py-2 text-sm text-luxa-muted border border-luxa-border rounded-lg hover:bg-luxa-bg"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={() => { stopCamera(); setMode('code'); }}
                  className="flex-1 py-2 text-sm text-luxa-gold border border-luxa-gold/30 rounded-lg hover:bg-luxa-gold/10"
                >
                  {tAdd('enterCode')}
                </button>
              </div>
            </div>
          )}

          {/* Manual Code Entry */}
          {mode === 'code' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && claimDevice()}
                  placeholder={tAdd('deviceCodePlaceholder')}
                  className="flex-1 px-4 py-3 bg-luxa-bg border border-luxa-border rounded-lg text-luxa-text font-mono tracking-wider text-center uppercase focus:outline-none focus:border-luxa-gold"
                  maxLength={12}
                  autoFocus
                />
                <button
                  onClick={() => claimDevice()}
                  disabled={claiming || !code.trim()}
                  className="px-6 py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition disabled:opacity-50"
                >
                  {claiming ? '...' : tAdd('claim')}
                </button>
              </div>
              <button
                onClick={() => setMode('choose')}
                className="text-sm text-luxa-muted hover:text-luxa-gold"
              >
                &larr; {tCommon('back')}
              </button>
            </div>
          )}

          {claimMsg && (
            <p className={`text-sm ${claimMsg.ok ? 'text-luxa-success' : 'text-luxa-error'}`}>
              {claimMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-luxa-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 bg-luxa-bg-card border border-luxa-border rounded-xl">
          <Cpu size={48} className="mx-auto text-luxa-muted mb-4" />
          <p className="text-luxa-muted mb-4">{tCommon('noDevices')}</p>
          <button
            onClick={() => { setShowAdd(true); setMode('choose'); }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-luxa-gold text-luxa-bg font-semibold rounded-lg hover:bg-luxa-gold-light transition"
          >
            <PlusCircle size={16} />
            {t('addDevice')}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map(device => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
