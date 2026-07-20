import React, { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import Image from "next/image";

export function About() {
  const [currentVersion, setCurrentVersion] = useState("0.4.1");

  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(() => undefined);
  }, []);

  return (
    <div className="p-5 space-y-5 h-[80vh] overflow-y-auto">
      <div className="text-center">
        <Image
          src="/icon_128x128.png"
          alt="Meetily Thai"
          width={72}
          height={72}
          className="mx-auto mb-3"
        />
        <h1 className="text-xl font-semibold text-gray-900">Meetily Thai</h1>
        <p className="text-sm text-gray-500">เวอร์ชัน {currentVersion}</p>
        <p className="mt-2 text-sm text-gray-700">
          โปรแกรมบันทึกเสียง ถอดเสียงภาษาไทย และจัดทำเอกสารการประชุมบนเครื่องคอมพิวเตอร์
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold text-gray-900">ประมวลผลในเครื่อง</h2>
          <p className="mt-1 text-sm text-gray-600">
            การบันทึกและถอดเสียงใช้โมเดลภายในเครื่องเป็นค่าเริ่มต้น โดยไม่ส่งไฟล์เสียงออกไปภายนอก
          </p>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold text-gray-900">รองรับภาษาไทย</h2>
          <p className="mt-1 text-sm text-gray-600">
            รองรับการถอดเสียง การสรุปการประชุม บันทึกการประชุม และข่าวการประชุมภาษาไทย
          </p>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold text-gray-900">ควบคุมการส่งข้อมูล</h2>
          <p className="mt-1 text-sm text-gray-600">
            Google Apps Script และผู้ให้บริการ AI ภายนอกจะทำงานเมื่อผู้ใช้ตั้งค่าและสั่งใช้งานเท่านั้น
          </p>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold text-gray-900">ข้อมูลจัดเก็บในเครื่อง</h2>
          <p className="mt-1 text-sm text-gray-600">
            ไฟล์เสียง บทถอดเสียง และฐานข้อมูลจัดเก็บในโฟลเดอร์ข้อมูลของผู้ใช้บน Windows
          </p>
        </section>
      </div>

      <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        ควรแจ้งผู้เข้าร่วมประชุมและได้รับความยินยอมก่อนเริ่มบันทึกเสียง รวมถึงกำหนดระยะเวลาเก็บรักษาข้อมูลตามนโยบายของหน่วยงาน
      </div>
    </div>
  );
}
