import React from 'react';
import { AlertTriangle, Mic, Speaker, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PermissionWarningProps {
  hasMicrophone: boolean;
  hasSystemAudio: boolean;
  onRecheck: () => void;
  isRechecking?: boolean;
}

export function PermissionWarning({
  hasMicrophone,
  hasSystemAudio,
  onRecheck,
  isRechecking = false,
}: PermissionWarningProps) {
  if (hasMicrophone && hasSystemAudio) {
    return null;
  }

  const title = !hasMicrophone && !hasSystemAudio
    ? 'ไม่พบอุปกรณ์บันทึกเสียง'
    : !hasMicrophone
      ? 'ไม่พบไมโครโฟน'
      : 'ไม่พบอุปกรณ์เสียงระบบ';

  return (
    <div className="max-w-md mb-4 space-y-3">
      <Alert variant="destructive" className="border-amber-400 bg-amber-50">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertTitle className="text-amber-900 font-semibold">
          <div className="flex items-center gap-2">
            {!hasMicrophone && <Mic className="h-4 w-4" />}
            {!hasSystemAudio && <Speaker className="h-4 w-4" />}
            {title}
          </div>
        </AlertTitle>

        <div className="mt-4">
          <button
            type="button"
            onClick={onRecheck}
            disabled={isRechecking}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRechecking ? 'animate-spin' : ''}`} />
            ตรวจสอบอีกครั้ง
          </button>
        </div>

        <AlertDescription className="text-amber-800 mt-3 space-y-3">
          {!hasMicrophone && (
            <div>
              <p>Meetily Thai ต้องใช้ไมโครโฟนเพื่อบันทึกการประชุม</p>
              <ul className="list-disc list-inside ml-2 mt-2 space-y-1 text-sm">
                <li>ตรวจว่าไมโครโฟนเชื่อมต่อและเปิดใช้งานอยู่</li>
                <li>ไปที่ Windows Settings &gt; Privacy &amp; security &gt; Microphone แล้วอนุญาตการเข้าถึง</li>
                <li>ปิดโปรแกรมอื่นที่อาจกำลังใช้งานไมโครโฟนแบบผูกขาด</li>
              </ul>
            </div>
          )}

          {!hasSystemAudio && (
            <div>
              <p>
                {hasMicrophone
                  ? 'ยังไม่พบอุปกรณ์สำหรับบันทึกเสียงจากคอมพิวเตอร์ แต่ยังบันทึกจากไมโครโฟนได้'
                  : 'ยังไม่พบอุปกรณ์สำหรับบันทึกเสียงจากคอมพิวเตอร์'}
              </p>
              <ul className="list-disc list-inside ml-2 mt-2 space-y-1 text-sm">
                <li>เลือกอุปกรณ์เสียงระบบหรืออุปกรณ์ Loopback/What U Hear ที่พร้อมใช้งาน</li>
                <li>ตรวจว่าอุปกรณ์เล่นเสียงของ Windows ไม่ถูกปิดใช้งาน</li>
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
