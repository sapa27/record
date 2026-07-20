'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, CloudCog, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GasConnectionInfo {
  endpoint_url: string;
  client_id: string;
  configured: boolean;
}

export function GASIntegrationSettings() {
  const [endpointUrl, setEndpointUrl] = useState('');
  const [clientId, setClientId] = useState('meetily-thai');
  const [sharedSecret, setSharedSecret] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invoke<GasConnectionInfo | null>('gas_get_config')
      .then((config) => {
        if (cancelled || !config) return;
        setEndpointUrl(config.endpoint_url);
        setClientId(config.client_id);
        setConfigured(config.configured);
      })
      .catch((error) => {
        if (!cancelled) console.error('Failed to load GAS integration config:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!endpointUrl.trim() || !clientId.trim() || (!configured && !sharedSecret.trim())) {
      toast.error('กรุณากรอก URL, Client ID และ Shared Secret ให้ครบ');
      return;
    }

    setSaving(true);
    try {
      const config = await invoke<GasConnectionInfo>('gas_save_config', {
        endpointUrl: endpointUrl.trim(),
        clientId: clientId.trim(),
        sharedSecret,
      });
      setEndpointUrl(config.endpoint_url);
      setClientId(config.client_id);
      setConfigured(config.configured);
      setSharedSecret('');
      toast.success('บันทึกการเชื่อมต่อ Google Apps Script แล้ว');
    } catch (error) {
      toast.error('บันทึกการเชื่อมต่อไม่สำเร็จ', { description: String(error) });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await invoke('gas_test_connection');
      toast.success('เชื่อมต่อ Google Apps Script สำเร็จ');
    } catch (error) {
      toast.error('ทดสอบการเชื่อมต่อไม่สำเร็จ', { description: String(error) });
    } finally {
      setTesting(false);
    }
  };

  const clear = async () => {
    try {
      await invoke('gas_clear_config');
      setEndpointUrl('');
      setClientId('meetily-thai');
      setSharedSecret('');
      setConfigured(false);
      toast.success('ลบการตั้งค่า Google Apps Script แล้ว');
    } catch (error) {
      toast.error('ลบการตั้งค่าไม่สำเร็จ', { description: String(error) });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลดการตั้งค่า...
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
            <CloudCog className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Google Apps Script</h2>
            <p className="mt-1 text-sm text-gray-600">
              ส่งสรุปการประชุม บันทึกการประชุม และข่าวการประชุมไปจัดเก็บใน Google Sheets และ Google Docs
            </p>
          </div>
          {configured && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" /> ตั้งค่าแล้ว
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gas-endpoint">GAS Web App URL</Label>
            <Input
              id="gas-endpoint"
              type="url"
              autoComplete="off"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
            />
            <p className="text-xs text-gray-500">อนุญาตเฉพาะ URL ทางการของ script.google.com ที่ลงท้ายด้วย /exec</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gas-client-id">Client ID</Label>
            <Input
              id="gas-client-id"
              autoComplete="off"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="meetily-thai"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gas-secret">Shared Secret {configured && '(เว้นว่างเพื่อใช้ค่าเดิม)'}</Label>
            <Input
              id="gas-secret"
              type="password"
              autoComplete="new-password"
              value={sharedSecret}
              onChange={(event) => setSharedSecret(event.target.value)}
              placeholder="อย่างน้อย 24 ตัวอักษร แนะนำ 32 ตัวอักษรแบบสุ่มขึ้นไป"
            />
            <p className="text-xs text-gray-500">Secret ไม่ถูกส่งกลับมาแสดงใน UI และไฟล์ตั้งค่าถูกจำกัดสิทธิ์บนระบบที่รองรับ</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            บันทึกการตั้งค่า
          </Button>
          <Button variant="outline" onClick={test} disabled={!configured || testing}>
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ทดสอบการเชื่อมต่อ
          </Button>
          <Button variant="ghost" onClick={clear} disabled={!configured} className="text-red-600 hover:text-red-700">
            <Trash2 className="mr-2 h-4 w-4" /> ลบการตั้งค่า
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-medium">มาตรการความปลอดภัย</p>
            <p className="mt-1 leading-6">
              การส่งข้อมูลใช้ HTTPS พร้อมลายมือชื่อ HMAC-SHA256, timestamp และ nonce ป้องกันการปลอมคำขอและ replay attack โดยค่าเริ่มต้นจะส่งเฉพาะเอกสารที่ผู้ใช้กดส่ง ไม่อัปโหลดไฟล์เสียงหรือบทถอดเสียงเต็มโดยอัตโนมัติ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
