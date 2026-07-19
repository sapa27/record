# รายงานการวิเคราะห์และพัฒนา Meetily Thai

## 1. เป้าหมาย

ปรับระบบ Meeting Transcription & Recorder ให้รองรับงานประชุมภาษาไทยตั้งแต่การบันทึกเสียง การนำเข้าไฟล์ การถอดเสียงซ้ำ การสรุปสาระ และการสร้างเอกสารภาษาไทย 3 ประเภท พร้อมเชื่อมต่อ Google Apps Script (GAS) อย่างปลอดภัย

เอกสารที่รองรับ:

1. สรุปการประชุม
2. บันทึกการประชุม
3. ข่าวการประชุม

## 2. สาเหตุปัญหาหลักที่พบ

### 2.1 โมเดลเริ่มต้นไม่รองรับภาษาไทย

ระบบเดิมใช้ Parakeet เป็นค่าเริ่มต้นหลายเส้นทาง ทั้ง onboarding, การตรวจความพร้อมก่อนบันทึก, sidebar และ fallback ของ backend แต่ Parakeet ในโครงการนี้ไม่มีการกำหนดภาษาไทย จึงมีโอกาสถอดผิดภาษาโดยไม่มีข้อผิดพลาดชัดเจน

**การแก้ไข**

- เปลี่ยนค่าเริ่มต้นเป็น `localWhisper`
- ใช้ Whisper multilingual รุ่น `large-v3-turbo-q5_0`
- ใช้ภาษา `th` เป็นค่าเริ่มต้นทั้ง frontend, Tauri/Rust และ Docker
- ตรวจชื่อโมเดลที่กำหนดแบบตรงตัว ไม่ยอมรับเพียงว่ามีโมเดล Whisper ใดก็ได้ เพราะอาจเป็นโมเดล `.en`
- ปฏิเสธ Parakeet ที่ trusted backend เมื่อเลือกภาษาไทย แทนการถอดผิดภาษาแบบเงียบ

### 2.2 เส้นทางสรุปเดิมสร้างภาษาอังกฤษก่อนแล้วแปลกลับ

แนวทางเดิมเสี่ยงทำให้ชื่อบุคคล หน่วยงาน ตัวเลข วันที่ มติ และถ้อยคำราชการคลาดเคลื่อน

**การแก้ไข**

- แม่แบบภาษาไทยทั้ง 3 ประเภทสร้างภาษาไทยโดยตรงจากบทถอดเสียง
- เพิ่ม prompt ป้องกัน hallucination และ prompt injection
- ใช้คำว่า “มติที่ประชุม” เฉพาะเมื่อบทถอดเสียงยืนยัน
- หากไม่มีข้อมูลให้ระบุ “ไม่ปรากฏข้อมูล”, “ยังไม่ได้กำหนด” หรือ — โดยไม่คาดเดา
- English summary เป็นเพียง cache แบบ best-effort สำหรับการเปลี่ยนภาษาในอนาคต ความล้มเหลวของ cache ไม่ทำให้เอกสารภาษาไทยล้มเหลว

### 2.3 การประมวลผลข้อความไทยใช้กติกาแบบภาษาอังกฤษ

ภาษาไทยไม่มีช่องว่างระหว่างทุกคำ ทำให้การนับคำและแบ่งช่วงข้อความแบบเดิมคลาดเคลื่อน

**การแก้ไข**

- ใช้ `Intl.Segmenter('th-TH')` สำหรับการนับคำฝั่ง UI พร้อม fallback
- ปรับ rough token estimation สำหรับอักษรไทย
- เพิ่มขอบเขตตัดข้อความที่รองรับอักขระ Unicode/ภาษาไทย

### 2.4 ความเสี่ยงด้านข้อมูลประชุมใน log

พบการเขียนข้อความถอดเสียง, ตัวอย่าง transcript, API response และบางส่วนของ token/API key ลง log หรือ CI

**การแก้ไข**

- ไม่บันทึกเนื้อหาถอดเสียงจริงลง log
- log เฉพาะจำนวนอักขระ ระยะเวลา segment ค่า confidence และสถานะ
- ไม่แสดง token/API key prefix
- จำกัดข้อความผิดพลาดและขนาด response
- ลดสิทธิ์ Tauri โดยยกเลิก `fs:read-all` และ `fs:write-all`

## 3. สถาปัตยกรรมหลังปรับปรุง

```text
Microphone / Imported Audio
          |
          v
Audio normalization (16 kHz mono) + VAD
          |
          v
Whisper multilingual
model: large-v3-turbo-q5_0
language: th
          |
          v
Thai transcript + timestamps/confidence
          |
          v
Thai NLP document pipeline
  - สรุปการประชุม
  - บันทึกการประชุม
  - ข่าวการประชุม
          |
          v (ผู้ใช้กดส่งเท่านั้น)
Signed HMAC-SHA256 request
          |
          v
Google Apps Script Web App
  - ตรวจ Client ID / timestamp / nonce / signature
  - ป้องกัน replay และ duplicate
  - สร้าง Google Docs
  - ลงทะเบียน excerpt/hash ใน Google Sheets
```

ระบบไม่อัปโหลดไฟล์เสียงไป GAS และ frontend ไม่ส่งบทถอดเสียงเต็มโดยอัตโนมัติ

## 4. Google Apps Script Integration

### 4.1 ฝั่ง Desktop/Tauri

เพิ่มคำสั่ง:

- `gas_save_config`
- `gas_get_config`
- `gas_clear_config`
- `gas_test_connection`
- `gas_publish_meeting_document`

มาตรการสำคัญ:

- รับเฉพาะ URL HTTPS ของ `script.google.com/macros/s/.../exec`
- Shared Secret อย่างน้อย 24 ตัวอักษร
- HMAC-SHA256 บน canonical request
- timestamp + UUID nonce
- timeout 30 วินาที และ redirect ไม่เกิน 5 ครั้ง
- จำกัดเอกสาร 2 MB และ transcript ทางเลือก 5 MB
- อนุญาตเฉพาะ `meeting_summary`, `meeting_minutes`, `meeting_news`
- อนุญาตเฉพาะ `language=th`
- หน้า UI ไม่อ่าน Shared Secret เดิมกลับมาแสดง

### 4.2 ฝั่ง GAS

ไฟล์อยู่ในโฟลเดอร์ `gas/`

- `Code.gs`
- `appsscript.json`
- `README_TH.md`

Script Properties ที่ต้องกำหนด:

- `GAS_SHARED_SECRET`
- `ALLOWED_CLIENT_ID`
- `SPREADSHEET_ID`
- `DRIVE_FOLDER_ID` (ไม่บังคับ)

มาตรการสำคัญ:

- ตรวจ HMAC แบบ constant-time comparison
- อายุคำขอไม่เกิน 5 นาที
- nonce cache + ScriptLock ป้องกัน replay/race condition
- content hash ป้องกันสร้างเอกสารซ้ำแม้ retry ด้วย nonce ใหม่
- ป้องกัน Spreadsheet Formula Injection (`=`, `+`, `-`, `@`)
- เก็บเนื้อหาเต็มใน Google Docs; Sheets เก็บ excerpt ไม่เกิน 45,000 ตัวอักษรและ SHA-256
- จำกัดขนาด request/payload
- ไม่บันทึก secret หรือเนื้อหาเอกสารลง log

ดูขั้นตอน deploy โดยละเอียดที่ `gas/README_TH.md`

## 5. แม่แบบเอกสารภาษาไทย

### `thai_meeting_summary`

เน้นข้อมูลการประชุม สาระสำคัญ มติ งานที่มอบหมาย และประเด็นติดตาม

### `thai_meeting_minutes`

จัดทำบันทึกแบบเป็นทางการ แยกตามระเบียบวาระ ผลการพิจารณา มติ งานที่มอบหมาย การประชุมครั้งต่อไป และผู้จัดทำ/ผู้ตรวจ

### `thai_meeting_news`

สร้างข่าวประชาสัมพันธ์ตามหลัก 5W1H ประกอบด้วยพาดหัว โปรยข่าว เนื้อหา ประเด็นสำคัญ คำกล่าวสำคัญ และข้อมูลเผยแพร่ โดยห้ามสร้างคำกล่าวที่ไม่มีในบทถอดเสียง

## 6. การตรวจสอบที่ดำเนินการแล้ว

ผลการตรวจแบบ static/contract:

- TypeScript/TSX syntax: ผ่าน 22 ไฟล์ที่แก้ไข
- JSON/YAML/TOML syntax: ผ่าน
- Google Apps Script syntax: ผ่าน
- Shell syntax: ผ่าน
- Rust lexical delimiter check: ผ่าน 19 ไฟล์ที่แก้ไข
- Security/product invariants: ผ่าน 20 รายการ
- HMAC-SHA256: ผ่าน RFC test vector และ application canonical request vector
- GAS pure-function tests: ผ่าน 7 assertions
- Git whitespace validation: ผ่าน

## 7. ข้อจำกัดของการทดสอบในสภาพแวดล้อมนี้

ยังไม่ได้รัน full production build ดังต่อไปนี้ เพราะสภาพแวดล้อมไม่มี dependency/toolchain ที่จำเป็น:

- `next build` ไม่ได้รัน เนื่องจากไม่มี `frontend/node_modules`
- `cargo check` / `cargo test` / Tauri build ไม่ได้รัน เนื่องจากไม่มี Rust/Cargo toolchain
- PowerShell scripts ตรวจด้วยการทบทวนและ structured diff แต่ไม่มี `pwsh` สำหรับ parser/runtime test
- GAS ยังต้อง deploy และทดสอบกับ Spreadsheet/Drive จริงของผู้ใช้
- คุณภาพการถอดเสียงจริงขึ้นกับไมโครโฟน เสียงรบกวน ผู้พูดซ้อนกัน และทรัพยากรเครื่อง จึงควรทดสอบด้วยไฟล์ประชุมภาษาไทยจริงก่อนใช้งาน production

## 8. ข้อเสนอแนะก่อน Production

1. ติดตั้ง dependencies ตาม `pnpm-lock.yaml` แล้วรัน `pnpm build`
2. ติดตั้ง Rust toolchain ตาม `rust-version` ใน Cargo และรัน `cargo fmt --check`, `cargo check`, `cargo test`
3. ทดสอบ recording/import/retranscription ด้วยเสียงไทยอย่างน้อย 3 สถานการณ์: ห้องเงียบ, ห้องประชุมจริง, ผู้พูดซ้อนกัน
4. ตรวจชื่อบุคคล ตัวเลข วันที่ มติ และ action items เทียบเสียงต้นฉบับ
5. Deploy GAS ด้วยบัญชีหน่วยงานและจำกัดสิทธิ์ Sheet/Drive ตาม least privilege
6. เปลี่ยน Shared Secret เป็นระยะและเมื่อสงสัยว่ารั่วไหล
7. สำหรับการเก็บ secret ระดับองค์กร ควรย้ายจากไฟล์ app-data ไปใช้ OS Keychain/Credential Manager ในระยะถัดไป
8. จัดทำ consent/retention policy สำหรับไฟล์เสียงและบทถอดเสียงตามนโยบายคุ้มครองข้อมูลของหน่วยงาน

## 9. เกณฑ์ยอมรับงานแนะนำ

- เริ่มบันทึกได้เมื่อโมเดล Whisper ที่กำหนดพร้อมใช้งาน
- ถอดเสียงไทยโดยไม่แปลเป็นอังกฤษ
- นำเข้าไฟล์และถอดซ้ำใช้ `th` เป็นค่าเริ่มต้น
- แม่แบบทั้ง 3 สร้างเอกสารภาษาไทยโดยตรง
- ไม่มี transcript/API secret ปรากฏใน application log
- GAS ปฏิเสธ signature ผิด, timestamp หมดอายุ, nonce ซ้ำ, client ไม่ตรง และเอกสารไม่ใช่ภาษาไทย
- retry เอกสารเดิมไม่สร้าง Google Docs ซ้ำ
- Sheets ไม่ประมวลผลข้อความเอกสารเป็นสูตร
