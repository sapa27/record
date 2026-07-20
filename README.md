# Meetily Thai — โปรแกรมบันทึกและถอดเสียงการประชุมสำหรับ PC

รุ่นนี้จัดเป็น **Windows build-ready source** สำหรับสร้างตัวติดตั้งแบบ NSIS โดยเน้นการทำงานภายในเครื่องและภาษาไทย

## ความสามารถหลัก

- บันทึกเสียงไมโครโฟนและเสียงระบบบน Windows
- ถอดเสียงภาษาไทยด้วยโมเดล Whisper multilingual ภายในเครื่อง
- นำเข้าไฟล์เสียงเพื่อถอดเสียงซ้ำ
- จัดทำสรุปการประชุม บันทึกการประชุม และข่าวการประชุมภาษาไทย
- เชื่อม Google Apps Script เฉพาะเมื่อผู้ใช้ตั้งค่าและสั่งส่งข้อมูล
- ปิด Telemetry, Analytics และ Auto Update ที่ติดต่อบริการภายนอก

## สร้างตัวติดตั้ง Windows 10/11 แบบ 64 บิต

1. คลิกขวาไฟล์ ZIP เลือก **Properties > Unblock** หากมีตัวเลือกนี้ แล้วกด **Extract All**
2. ย้ายโฟลเดอร์ที่แตกแล้วไปไว้ที่ `C:\MeetilyThai` เพื่อหลีกเลี่ยงปัญหา path ยาวหรืออักขระพิเศษ
3. ติดตั้ง Node.js LTS, Git for Windows, Rust MSVC, CMake, LLVM, FFmpeg และ Visual Studio Build Tools 2022 พร้อม workload `Desktop development with C++`
4. เปิดโฟลเดอร์ที่แตกแล้วและดับเบิลคลิก `BUILD_WINDOWS_INSTALLER.cmd` ห้ามเรียกไฟล์จากหน้าต่างดูตัวอย่างภายใน ZIP
5. หน้าต่าง Build จะค้างไว้และแสดง `[ERROR]` แรกที่ตรวจพบ ไม่ปิดทันทีเหมือนรุ่นเดิม
6. ตัวติดตั้งที่สร้างสำเร็จจะอยู่ใน `target\release\bundle\nsis\`

สคริปต์รุ่นแก้ไขใช้ไฟล์แบบ ASCII/CRLF เพื่อรองรับ `cmd.exe` อย่างสม่ำเสมอ ตรวจว่าแตก ZIP ครบ ตรวจ Windows x64, Node.js, npm, Git, Rust MSVC, CMake, FFmpeg, Visual C++ Build Tools, LLVM/libclang และ pnpm ก่อนเริ่ม Build

กรณีดับเบิลคลิกแล้วยังไม่มีหน้าต่าง ให้เปิด Command Prompt แล้วเรียก:

```bat
cd /d C:\MeetilyThai
BUILD_WINDOWS_INSTALLER.cmd
```

หาก Windows บล็อกไฟล์ ให้คลิกขวา `BUILD_WINDOWS_INSTALLER.cmd` เลือก **Properties > Unblock** หรือเปิด PowerShell ในโฟลเดอร์แล้วใช้ `Unblock-File .\BUILD_WINDOWS_INSTALLER.cmd`

## ความปลอดภัยและความเป็นส่วนตัว

- ปิดระบบ Telemetry/Analytics อย่างถาวร
- ปิด Auto Update จาก repository ภายนอก
- ไม่ดาวน์โหลด executable ระหว่าง Build; ใช้ FFmpeg ที่ผู้ดูแลติดตั้งและอนุมัติบนเครื่อง Build
- ไม่มี Python/FastAPI/Docker backend รุ่นเก่า
- Confidential Mode เปิดเป็นค่าเริ่มต้น
- API key และ GAS shared secret เก็บผ่าน Credential Manager/Keyring
- CSP ของ WebView ไม่อนุญาตการเชื่อมต่อเครือข่ายโดยตรง
- การใช้ Cloud LLM, การดาวน์โหลดโมเดล และการส่ง GAS จะเกิดขึ้นเฉพาะเมื่อผู้ใช้เลือกตั้งค่า/เรียกใช้ฟังก์ชันนั้น

## ข้อควรปฏิบัติ

ควรแจ้งและขอความยินยอมจากผู้เข้าร่วมก่อนบันทึกเสียง รวมถึงกำหนดสิทธิ์เข้าถึง ระยะเวลาเก็บ และวิธีทำลายไฟล์เสียง/บทถอดเสียงตามนโยบายของหน่วยงาน

รายละเอียดรายการแก้ไขและข้อจำกัดการตรวจอยู่ใน `PC_RELEASE_AUDIT_TH.md`
