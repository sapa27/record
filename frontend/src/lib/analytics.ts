/**
 * รุ่น PC ภายในหน่วยงานปิด Telemetry/Analytics อย่างถาวร
 *
 * คลาสนี้คง public API เดิมไว้เพื่อไม่ให้ส่วนบันทึก/ถอดเสียงและหน้าจออื่น
 * ต้องผูกกับบริการวิเคราะห์ภายนอก การเรียกทุกเมธอดจึงเป็น no-op ในเครื่อง
 */
export interface AnalyticsProperties {
  [key: string]: string;
}

export interface DeviceInfo {
  platform: string;
  os_version: string;
  architecture: string;
}

export interface MeetingMetrics {
  duration_seconds: number;
  transcript_segments: number;
  transcript_word_count: number;
  words_per_minute: number;
  meetings_today: number;
}

export class Analytics {
  static async init(): Promise<void> {}
  static async disable(): Promise<void> {}
  static async isEnabled(): Promise<boolean> { return false; }
  static async track(_eventName: string, _properties?: AnalyticsProperties): Promise<void> {}
  static async identify(_userId: string, _properties?: AnalyticsProperties): Promise<void> {}
  static async startSession(_userId: string): Promise<string | null> { return null; }
  static async endSession(): Promise<void> {}
  static async trackDailyActiveUser(): Promise<void> {}
  static async trackUserFirstLaunch(): Promise<void> {}
  static async isSessionActive(): Promise<boolean> { return false; }
  static async getPersistentUserId(): Promise<string> { return 'local-analytics-disabled'; }
  static async checkAndTrackFirstLaunch(): Promise<void> {}
  static async checkAndTrackDailyUsage(): Promise<void> {}
  static getCurrentUserId(): string | null { return null; }

  static async getPlatform(): Promise<string> {
    return 'Windows';
  }

  static async getOSVersion(): Promise<string> { return this.getPlatform(); }
  static async getDeviceInfo(): Promise<DeviceInfo> {
    return { platform: await this.getPlatform(), os_version: 'local', architecture: 'unknown' };
  }

  static async calculateDaysSince(_dateKey: string): Promise<number | null> { return null; }
  static async updateMeetingCount(): Promise<void> {}
  static async getMeetingsCountToday(): Promise<number> { return 0; }
  static async hasUsedFeatureBefore(_featureName: string): Promise<boolean> { return false; }
  static async markFeatureUsed(_featureName: string): Promise<void> {}
  static async trackSessionStarted(_sessionId: string): Promise<void> {}
  static async trackSessionEnded(_sessionId: string): Promise<void> {}
  static async trackMeetingCompleted(_meetingId: string, _metrics: MeetingMetrics): Promise<void> {}
  static async trackFeatureUsedEnhanced(_featureName: string, _properties?: Record<string, unknown>): Promise<void> {}
  static async trackCopy(_copyType: 'transcript' | 'summary', _properties?: Record<string, unknown>): Promise<void> {}
  static async trackMeetingStarted(_meetingId: string): Promise<void> {}
  static async trackRecordingStarted(_meetingId: string): Promise<void> {}
  static async trackRecordingStopped(_meetingId: string, _durationSeconds?: number): Promise<void> {}
  static async trackMeetingDeleted(_meetingId: string): Promise<void> {}
  static async trackSettingsChanged(_settingType: string, _newValue: string): Promise<void> {}
  static async trackFeatureUsed(_featureName: string): Promise<void> {}
  static async trackPageView(_pageName: string): Promise<void> {}
  static async trackButtonClick(_buttonName: string, _location?: string): Promise<void> {}
  static async trackError(_errorType: string, _errorMessage: string): Promise<void> {}
  static async trackAppStarted(): Promise<void> {}
  static async cleanup(): Promise<void> {}
  static reset(): void {}
  static async waitForInitialization(_timeout: number = 5000): Promise<boolean> { return true; }
  static async trackBackendConnection(_success: boolean, _error?: string): Promise<void> {}
  static async trackTranscriptionError(_errorMessage: string): Promise<void> {}
  static async trackTranscriptionSuccess(_duration?: number): Promise<void> {}
  static async trackSummaryGenerationStarted(
    _modelProvider: string,
    _modelName: string,
    _transcriptLength: number,
    _timeSinceRecordingMinutes?: number,
  ): Promise<void> {}
  static async trackSummaryGenerationCompleted(
    _modelProvider: string,
    _modelName: string,
    _success: boolean,
    _durationSeconds?: number,
    _errorMessage?: string,
  ): Promise<void> {}
  static async trackSummaryRegenerated(_modelProvider: string, _modelName: string): Promise<void> {}
  static async trackModelChanged(
    _oldProvider: string,
    _oldModel: string,
    _newProvider: string,
    _newModel: string,
  ): Promise<void> {}
  static async trackCustomPromptUsed(_promptLength: number): Promise<void> {}
}

export default Analytics;
