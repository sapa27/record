"use client"

import { useEffect, useState } from "react"
import { FolderOpen } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { Switch } from "./ui/switch"
import { NotificationSettings, useConfig } from "@/contexts/ConfigContext"

export function PreferenceSettings() {
  const {
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
    loadPreferences,
    updateNotificationSettings,
  } = useConfig()

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null)
  const [savedNotificationsEnabled, setSavedNotificationsEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  useEffect(() => {
    if (notificationSettings) {
      const enabled =
        notificationSettings.notification_preferences.show_recording_started &&
        notificationSettings.notification_preferences.show_recording_stopped
      setNotificationsEnabled(enabled)
      setSavedNotificationsEnabled(enabled)
      return
    }

    if (!isLoadingPreferences) {
      setNotificationsEnabled(true)
      setSavedNotificationsEnabled(true)
    }
  }, [notificationSettings, isLoadingPreferences])

  useEffect(() => {
    if (
      notificationsEnabled === null ||
      savedNotificationsEnabled === null ||
      notificationsEnabled === savedNotificationsEnabled ||
      !notificationSettings
    ) {
      return
    }

    const save = async () => {
      const updatedSettings: NotificationSettings = {
        ...notificationSettings,
        notification_preferences: {
          ...notificationSettings.notification_preferences,
          show_recording_started: notificationsEnabled,
          show_recording_stopped: notificationsEnabled,
        },
      }

      try {
        await updateNotificationSettings(updatedSettings)
        setSavedNotificationsEnabled(notificationsEnabled)
      } catch (error) {
        console.error("บันทึกการตั้งค่าการแจ้งเตือนไม่สำเร็จ", error)
        setNotificationsEnabled(savedNotificationsEnabled)
      }
    }

    void save()
  }, [
    notificationSettings,
    notificationsEnabled,
    savedNotificationsEnabled,
    updateNotificationSettings,
  ])

  const openRecordingsFolder = async () => {
    try {
      await invoke("open_recordings_folder")
    } catch (error) {
      console.error("เปิดโฟลเดอร์บันทึกเสียงไม่สำเร็จ", error)
    }
  }

  if (isLoadingPreferences && !notificationSettings && !storageLocations) {
    return <div className="mx-auto max-w-2xl p-6">กำลังโหลดการตั้งค่า...</div>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">การแจ้งเตือน</h3>
            <p className="text-sm text-gray-600">แจ้งเมื่อเริ่มและสิ้นสุดการบันทึกการประชุม</p>
          </div>
          <Switch
            checked={notificationsEnabled ?? false}
            onCheckedChange={setNotificationsEnabled}
            aria-label="เปิดหรือปิดการแจ้งเตือนการบันทึก"
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">ตำแหน่งจัดเก็บไฟล์เสียง</h3>
        <p className="mb-4 break-all font-mono text-xs text-gray-600">
          {storageLocations?.recordings || "ยังไม่พบตำแหน่งจัดเก็บ"}
        </p>
        <button
          type="button"
          onClick={openRecordingsFolder}
          className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-100"
        >
          <FolderOpen className="h-4 w-4" />
          เปิดโฟลเดอร์บันทึกเสียง
        </button>
      </section>
    </div>
  )
}
