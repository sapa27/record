import React from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SetupOverviewStep() {
  const { goNext } = useOnboarding();
  const steps = [
    {
      number: 1,
      type: 'transcription',
      title: 'ดาวน์โหลด Whisper สำหรับถอดเสียงภาษาไทย',
    },
    {
      number: 2,
      type: 'summarization',
      title: 'ดาวน์โหลดโมเดลจัดทำสรุปและเอกสาร',
    },
  ];

  const handleContinue = () => {
    goNext();
  };

  return (
    <OnboardingContainer
      title="ภาพรวมการตั้งค่า"
      description="ระบบต้องใช้โมเดลถอดเสียงภาษาไทยและโมเดลจัดทำสรุปก่อนเริ่มใช้งาน"
      step={2}
      totalSteps={3}
    >
      <div className="flex flex-col items-center space-y-10">
        {/* Steps Card */}
        <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 p-4">
          <div className="space-y-4">
            {steps.map((step, idx) => {
              return (
                <div
                  key={step.number}
                  className={`flex items-start gap-4 p-1`}
                >
                  <div className="flex-1 ml-1">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        ขั้นตอนที่ {step.number}:  {step.title}

                        {step.type === "summarization" && (
                            <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <button className="text-gray-400 hover:text-gray-600">
                                    <Info className="w-4 h-4" />
                                </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-sm">
                                สามารถเลือกผู้ให้บริการ AI ภายนอก เช่น OpenAI, Claude หรือ Ollama
                                สำหรับสร้างสรุปได้ภายหลังในหน้าการตั้งค่า
                                </TooltipContent>
                            </Tooltip>
                            </TooltipProvider>
                        )}
                        </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* CTA Section */}
        <div className="w-full max-w-xs space-y-4">
          <Button
            onClick={handleContinue}
            className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white"
          >
            เริ่มตั้งค่า
          </Button>
          <p className="text-center text-xs text-gray-600">
            ข้อมูลการประชุมจะจัดเก็บในเครื่องเป็นค่าเริ่มต้น
          </p>
        </div>
      </div>
    </OnboardingContainer>
  );
}
