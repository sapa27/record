# รายงานการตรวจสอบและปรับเป็น Meetily Thai รุ่น PC

วันที่ตรวจ: 20 กรกฎาคม 2569  
รุ่น: `0.4.1`  
เป้าหมาย: Windows 10/11 แบบ 64 บิต ตัวติดตั้ง NSIS

## ผลลัพธ์

โครงการถูกปรับเป็น **Windows build-ready source** สำหรับโปรแกรมบันทึกเสียง ถอดเสียงภาษาไทย และสร้างเอกสารการประชุม โดยลดโค้ด/ไฟล์เก่าที่ไม่ใช้งาน ลดการเชื่อมต่อภายนอกที่ไม่จำเป็น และเพิ่มสคริปต์สร้างตัวติดตั้งบน Windows

ขนาดโครงการลดจาก **46,537,767 ไบต์ / 532 ไฟล์** เหลือ **3,619,733 ไบต์ / 331 ไฟล์** ก่อนบีบอัด ลดลงประมาณ **92.2% ตามขนาดไฟล์**

## การพัฒนาฟังก์ชัน PC

- ใช้ Tauri 2 + Rust เป็น Desktop Runtime และ Next.js/React เป็นส่วนติดต่อผู้ใช้
- รองรับการบันทึกไมโครโฟนและเสียงระบบบน Windows
- รองรับ Local Whisper multilingual และ Parakeet สำหรับถอดเสียง
- รองรับนำเข้าไฟล์เสียง ถอดเสียงซ้ำ สรุปการประชุม บันทึกการประชุม และข่าวการประชุม
- กำหนดชื่อผลิตภัณฑ์เป็น **Meetily Thai** รุ่น `0.4.1`
- จำกัดการสร้างแพ็กเกจเป็น Windows NSIS
- เพิ่ม `BUILD_WINDOWS_INSTALLER.cmd` และ `frontend/build-windows.cmd`
- สคริปต์ Build ตรวจ Node.js, Rust/Cargo, CMake, FFmpeg, MSVC และ LLVM ก่อนเริ่มงาน
- สร้าง `llama-helper` แบบ CPU เป็นค่าเริ่มต้นเพื่อความเข้ากันได้สูง
- ตรวจ TypeScript ก่อนสร้างตัวติดตั้ง
- ยุบการตรวจแพลตฟอร์มเป็น Windows-only และลบ OS plugin/หน้าขอสิทธิ์เฉพาะ macOS ที่ไม่ใช้

## การปรับความปลอดภัยระดับ P0

### Telemetry และการอัปเดต

- ปิด Telemetry/Analytics อย่างถาวรทั้งฝั่ง TypeScript และ Rust
- ลบ PostHog และคำสั่ง Analytics เดิม
- คงเฉพาะ no-op compatibility API เพื่อไม่ให้ส่วน UI เดิมเสียหาย
- ลบ Auto Update และ Tauri updater/process plugin รวมถึงเมนูตรวจอัปเดตที่ตกค้าง
- ไม่มีการตรวจหรือดึงรุ่นใหม่จาก repository ของเจ้าของโครงการเดิม

### FFmpeg และ executable supply chain

- ปิดการดาวน์โหลด FFmpeg ขณะ Build และขณะ Runtime
- Build รับเฉพาะ FFmpeg ที่ผู้ดูแลติดตั้งไว้ใน PATH หรือระบุผ่าน `MEETILY_FFMPEG_BINARY`
- ตรวจว่า binary เรียก `ffmpeg -version` ได้ก่อนบรรจุเป็น Tauri sidecar
- Runtime ใช้เฉพาะ sidecar ที่ติดตั้งมากับโปรแกรม หรือ FFmpeg ที่ได้รับอนุมัติใน PATH
- ลบไฟล์ติดตั้ง Build Tools และ executable เก่าทั้งหมดออกจาก source ZIP

### โมเดลถอดเสียง

- ลบ URL ดาวน์โหลด Parakeet จากโดเมนเจ้าของโครงการเดิม
- ใช้ Hugging Face repository ที่เปิดเผยแหล่งที่มา
- ตรึง Parakeet v2/v3 ด้วย revision hash เพื่อลดความเสี่ยงจากไฟล์เปลี่ยนบน branch `main`
- การดาวน์โหลดโมเดลเกิดขึ้นเฉพาะเมื่อผู้ใช้เริ่มตั้งค่าหรือสั่งดาวน์โหลด

### Google Apps Script

- บังคับ endpoint เป็น HTTPS ของ `script.google.com` และต้องลงท้าย `/exec`
- ปฏิเสธ URL ที่มี username/password, query string, fragment หรือพอร์ต HTTPS ที่ไม่ใช่มาตรฐาน
- ลงลายมือชื่อคำขอด้วย HMAC-SHA256
- ตรวจ timestamp และ nonce เพื่อป้องกัน replay attack
- ป้องกันคำขอและเอกสารซ้ำด้วย content hash
- ป้องกัน Spreadsheet formula injection
- ไม่รับไฟล์เสียงและไม่รับบทถอดเสียงดิบผ่าน GAS Bridge
- จำกัดขนาดคำขอไว้ที่ประมาณ 4 MB
- เก็บ Shared Secret ผ่าน Windows Credential Manager/Keyring

### Desktop Runtime

- ปรับ CSP ให้ WebView ไม่เชื่อมต่อเครือข่ายโดยตรง
- ลบสิทธิ์ Tauri File System plugin ที่ Frontend ไม่ได้ใช้
- จำกัดลิงก์ภายนอกที่โปรแกรมเปิดได้
- เปลี่ยน application identifier และ keyring namespace เป็น `com.meetily.thai`
- จำกัด Keyring backend เป็น Windows Credential Manager
- Confidential Mode เป็นค่าเริ่มต้น
- การใช้ Cloud LLM, GAS และการดาวน์โหลดโมเดลต้องเกิดจากการตั้งค่าหรือคำสั่งของผู้ใช้

## ส่วนที่ลบออก

- Python/FastAPI/Docker/Whisper HTTP backend รุ่นเก่า
- ระบบ Auto Update และ Analytics เดิม
- เอกสาร upstream, workflow, issue template, release script และภาพสาธิตขนาดใหญ่
- ไฟล์ log, cache, binary และ Visual Studio Build Tools installer
- สคริปต์ macOS signing/notarization, plist, entitlement และ icon ที่ไม่ใช้กับ Windows
- config ซ้ำและสคริปต์ Build หลายเวอร์ชัน
- คอมโพเนนต์ React, hook และ dependency ที่ไม่มีเส้นทางเรียกใช้
- Tauri OS/File System plugin ฝั่ง Frontend และหน้าขอสิทธิ์ macOS ที่ไม่ใช้ใน Windows
- สคริปต์ตรวจ GPU แบบข้ามแพลตฟอร์มที่ไม่ใช้ในชุด Build Windows
- ข้อความประชาสัมพันธ์ ลิงก์ upstream และหน้า About เดิม

## ผลการตรวจแบบ Static/Structural

ผ่านการตรวจต่อไปนี้:

- JSON และ TOML parse
- `package.json` ตรงกับ direct dependency ใน `pnpm-lock.yaml`: 46 dependencies และ 9 devDependencies
- TypeScript/TSX syntax และ local import resolution ผ่านทั้ง **133 ไฟล์**
- Google Apps Script JavaScript syntax ผ่านด้วย Node parser
- Rust module path ครบ รวม module ที่ใช้ `#[path = ...]`
- Rust lexical delimiter scan ผ่าน 141 ไฟล์
- Cargo direct dependencies ตรงกับ root package ใน lockfile: 66 รายการ
- Cargo lock dependency reference ครบ 823 package blocks
- Unit test `onboarding-summary-model.test.mjs` ผ่าน
- ไม่มี dependency updater/process/PostHog/FFmpeg downloader ที่ถอดออก
- ไม่พบ `.exe`, `.dll`, `.msi`, private key, token signature หรือไฟล์ `.env` ในแพ็กเกจ
- ไม่พบ import ของคอมโพเนนต์และ dependency ที่ลบแล้ว
- ไม่พบ Telemetry/Updater endpoint ใน runtime source

## ข้อจำกัดของการตรวจ

สภาพแวดล้อมที่ใช้จัดทำแพ็กเกจนี้เป็น Linux และไม่มี Rust/Cargo, Windows MSVC, LLVM/Windows SDK, NSIS และ dependency ใน `node_modules` จึง **ยังไม่ได้รัน Full Cargo/Next/Tauri native build และยังไม่ได้สร้างตัวติดตั้ง `.exe` ภายในสภาพแวดล้อมนี้**

ต้องนำ ZIP ไป Build บน Windows 10/11 ด้วย `BUILD_WINDOWS_INSTALLER.cmd` เพื่อยืนยัน native compilation, driver/audio-device behavior และผลิตตัวติดตั้งจริง ผลลัพธ์จะอยู่ที่:

```text
target\release\bundle\nsis\
```

## ข้อแนะนำก่อนใช้งานจริง

- Build บนเครื่อง Windows ที่ควบคุมได้ และตรวจ SHA-256 ของ FFmpeg ก่อนอนุมัติ
- ลงนาม Code Signing Certificate ให้ตัวติดตั้งและ executable
- ทดสอบไมโครโฟน เสียงระบบ อุปกรณ์ Bluetooth และการประชุมยาวอย่างน้อย 2–4 ชั่วโมง
- ทดสอบโมเดลภาษาไทยกับศัพท์เฉพาะของหน่วยงานและกำหนด dictionary/post-processing เพิ่มเติม
- กำหนดสิทธิ์เข้าถึง ระยะเวลาเก็บ การสำรอง และการทำลายไฟล์เสียง/บทถอดเสียง
- แจ้งและขอความยินยอมจากผู้เข้าร่วมก่อนบันทึกเสียง

## การแก้ไข Build Launcher รุ่น r1

- แก้ `BUILD_WINDOWS_INSTALLER.cmd` ไม่ให้หน้าต่างปิดทันทีเมื่อ Build ล้มเหลว
- ตรวจและแจ้งชัดเจนเมื่อผู้ใช้เรียกไฟล์จากภายใน ZIP โดยยังไม่ได้ Extract All
- เปลี่ยนสคริปต์ `.cmd` ทั้งสองไฟล์เป็น ASCII พร้อม CRLF เพื่อรองรับ Windows Command Prompt อย่างสม่ำเสมอ
- เพิ่มการตรวจ Windows x64, Node.js, npm, Git, Rust/rustup, MSVC target, CMake, FFmpeg, pnpm/Corepack, Visual C++ Build Tools และ LLVM/libclang
- รองรับตำแหน่ง LLVM ทั้งแบบติดตั้งแยกและ Visual Studio LLVM component
- เพิ่มรหัสข้อผิดพลาดแยกตามขั้นตอน และคงหน้าต่างไว้ให้ผู้ใช้เห็น `[ERROR]` แรก
- เพิ่ม `--locked` สำหรับ Cargo build และตรวจว่า sidecar/NSIS installer ถูกสร้างจริง

