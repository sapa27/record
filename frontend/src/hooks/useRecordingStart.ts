import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { recordingService } from '@/services/recordingService';
import Analytics from '@/lib/analytics';
import { showRecordingNotification } from '@/lib/recordingNotification';
import { toast } from 'sonner';

interface UseRecordingStartReturn {
  handleRecordingStart: () => Promise<void>;
  isAutoStarting: boolean;
}

type RecordingSource = 'home_page' | 'sidebar_auto' | 'sidebar_direct';

type ModelStatus = string | Record<string, unknown> | null | undefined;

function statusIsAvailable(status: ModelStatus): boolean {
  if (status === 'Available' || status === 'available') return true;
  return !!status && typeof status === 'object' && ('Available' in status || 'available' in status);
}

function statusIsDownloading(status: ModelStatus): boolean {
  if (status === 'Downloading' || status === 'downloading') return true;
  return !!status && typeof status === 'object' && ('Downloading' in status || 'downloading' in status);
}

/**
 * Manages the complete recording-start lifecycle.
 *
 * The selected transcription provider is now the single source of truth. This
 * removes the previous hard dependency on Parakeet, which blocked Thai users
 * even after a multilingual Whisper model had been downloaded.
 */
export function useRecordingStart(
  isRecording: boolean,
  setIsRecording: (value: boolean) => void,
  showModal?: (name: 'modelSelector', message?: string) => void
): UseRecordingStartReturn {
  const [isAutoStarting, setIsAutoStarting] = useState(false);

  const { clearTranscripts, setMeetingTitle } = useTranscripts();
  const { setIsMeetingActive } = useSidebar();
  const { selectedDevices, transcriptModelConfig } = useConfig();
  const { setStatus } = useRecordingState();

  const generateMeetingTitle = useCallback(() => {
    const now = new Date();
    const date = now.toLocaleDateString('sv-SE');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    return `การประชุม_${date}_${time}`;
  }, []);

  const inspectSelectedModel = useCallback(async () => {
    const isWhisper = transcriptModelConfig.provider === 'localWhisper';
    const prefix = isWhisper ? 'whisper' : 'parakeet';

    if (!isWhisper && transcriptModelConfig.provider !== 'parakeet') {
      return { ready: false, downloading: false };
    }

    try {
      await invoke(`${prefix}_init`);
      const models = await invoke<Array<{ name?: string; status?: ModelStatus }>>(
        `${prefix}_get_available_models`
      );
      const candidates = transcriptModelConfig.model
        ? models.filter((model) => model.name === transcriptModelConfig.model)
        : models;

      return {
        ready: candidates.some((model) => statusIsAvailable(model.status)),
        downloading: candidates.some((model) => statusIsDownloading(model.status)),
      };
    } catch (error) {
      console.error('Failed to inspect transcription model state:', error);
      return { ready: false, downloading: false };
    }
  }, [transcriptModelConfig.model, transcriptModelConfig.provider]);

  const ensureModelReady = useCallback(async (source: RecordingSource): Promise<boolean> => {
    const state = await inspectSelectedModel();
    if (state.ready) return true;

    if (state.downloading) {
      toast.info('กำลังดาวน์โหลดโมเดลถอดเสียง', {
        description: 'กรุณารอให้ดาวน์โหลดเสร็จก่อนเริ่มบันทึกการประชุม',
        duration: 5000,
      });
      Analytics.trackButtonClick('start_recording_blocked_downloading', source);
    } else {
      toast.error('โมเดลถอดเสียงยังไม่พร้อมใช้งาน', {
        description: transcriptModelConfig.provider === 'localWhisper'
          ? 'โปรดดาวน์โหลดโมเดล Whisper แบบ multilingual เพื่อถอดเสียงภาษาไทย'
          : 'Parakeet ไม่เหมาะกับภาษาไทย โปรดเลือก Local Whisper',
        duration: 6000,
      });
      showModal?.('modelSelector', 'ต้องตั้งค่าโมเดล Whisper สำหรับภาษาไทย');
      Analytics.trackButtonClick('start_recording_blocked_missing', source);
    }

    setStatus(RecordingStatus.IDLE);
    return false;
  }, [inspectSelectedModel, setStatus, showModal, transcriptModelConfig.provider]);

  const startRecording = useCallback(async (source: RecordingSource) => {
    if (!(await ensureModelReady(source))) return;

    const title = generateMeetingTitle();
    setMeetingTitle(title);
    setStatus(RecordingStatus.STARTING, 'กำลังเตรียมการบันทึกเสียง...');

    await recordingService.startRecordingWithDevices(
      selectedDevices?.micDevice || null,
      selectedDevices?.systemDevice || null,
      title
    );

    setIsRecording(true);
    clearTranscripts();
    setIsMeetingActive(true);
    Analytics.trackButtonClick('start_recording', source);
    await showRecordingNotification();
  }, [
    clearTranscripts,
    ensureModelReady,
    generateMeetingTitle,
    selectedDevices,
    setIsMeetingActive,
    setIsRecording,
    setMeetingTitle,
    setStatus,
  ]);

  const runStartWithErrorHandling = useCallback(async (source: RecordingSource) => {
    try {
      await startRecording(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to start recording from ${source}:`, error);
      setStatus(RecordingStatus.ERROR, message);
      setIsRecording(false);
      toast.error('เริ่มบันทึกการประชุมไม่สำเร็จ', { description: message });
      Analytics.trackButtonClick('start_recording_error', source);
      throw error;
    }
  }, [setIsRecording, setStatus, startRecording]);

  const handleRecordingStart = useCallback(async () => {
    await runStartWithErrorHandling('home_page');
  }, [runStartWithErrorHandling]);

  useEffect(() => {
    const shouldAutoStart = typeof window !== 'undefined'
      && sessionStorage.getItem('autoStartRecording') === 'true';
    if (!shouldAutoStart || isRecording || isAutoStarting) return;

    sessionStorage.removeItem('autoStartRecording');
    setIsAutoStarting(true);
    runStartWithErrorHandling('sidebar_auto')
      .catch(() => undefined)
      .finally(() => setIsAutoStarting(false));
  }, [isAutoStarting, isRecording, runStartWithErrorHandling]);

  useEffect(() => {
    const handleDirectStart = () => {
      if (isRecording || isAutoStarting) return;
      setIsAutoStarting(true);
      runStartWithErrorHandling('sidebar_direct')
        .catch(() => undefined)
        .finally(() => setIsAutoStarting(false));
    };

    window.addEventListener('start-recording-from-sidebar', handleDirectStart);
    return () => window.removeEventListener('start-recording-from-sidebar', handleDirectStart);
  }, [isAutoStarting, isRecording, runStartWithErrorHandling]);

  return { handleRecordingStart, isAutoStarting };
}
