"use client";

import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";

function Section({ titleEn, titleVi, children }: { titleEn: string; titleVi: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <p className="font-bold text-sm mb-0.5">{titleEn}</p>
      <p className="text-xs text-muted mb-3">{titleVi}</p>
      {children}
    </Card>
  );
}

function Bullet({ en, vi }: { en: string; vi: string }) {
  return (
    <li className="mb-2">
      <span className="block text-sm">{en}</span>
      <span className="block text-sm text-muted">{vi}</span>
    </li>
  );
}

function ReferenceContent() {
  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Reference Rules · Quy Tắc Tham Khảo"
        subtitle="Read-only reference — nothing to log here · Chỉ để tham khảo — không cần ghi lại"
      />
      <div className="px-4 md:px-8">
        <Section titleEn="Personal hygiene, before work" titleVi="Vệ sinh cá nhân, trước khi làm việc">
          <ul className="list-disc pl-4">
            <Bullet en="Wash hands" vi="Rửa tay" />
            <Bullet en="Wear clean clothes and an apron" vi="Mặc quần áo sạch và tạp dề" />
            <Bullet en="Tie back hair; wear a hat" vi="Buộc tóc gọn gàng; đội mũ" />
            <Bullet en="Remove watches and jewellery" vi="Tháo đồng hồ và trang sức" />
            <Bullet
              en="Tell your manager if you have vomiting, diarrhoea, or a fever — do not work with food"
              vi="Báo quản lý nếu bạn bị nôn, tiêu chảy hoặc sốt — không làm việc với thực phẩm"
            />
          </ul>
        </Section>

        <Section titleEn="Wash your hands" titleVi="Rửa tay">
          <p className="text-sm">
            Before touching food · after the toilet · after every break · after touching raw meat, poultry,
            fish, eggs, or unwashed vegetables · after touching a cut or dressing · after touching bins ·
            after cleaning · after touching phones, cash, or door handles.
          </p>
          <p className="text-sm text-muted mt-2">
            Trước khi chạm vào thực phẩm · sau khi đi vệ sinh · sau mỗi lần nghỉ giải lao · sau khi chạm vào
            thịt sống, gia cầm, cá, trứng hoặc rau chưa rửa · sau khi chạm vào vết thương hoặc băng gạc ·
            sau khi chạm vào thùng rác · sau khi vệ sinh · sau khi chạm vào điện thoại, tiền mặt, hoặc tay nắm cửa.
          </p>
        </Section>

        <Section titleEn="Cross-contamination" titleVi="Lây nhiễm chéo">
          <p className="text-sm">
            Store raw meat/poultry below and separate from ready-to-eat food · use separate colour-coded
            boards/utensils for raw jerk chicken vs. ready-to-eat food · never reuse raw marinade unless
            boiled first · wash hands and change gloves between raw and ready-to-eat tasks · clean and
            disinfect surfaces between tasks.
          </p>
          <p className="text-sm text-muted mt-2">
            Bảo quản thịt/gia cầm sống ở dưới và tách biệt khỏi thực phẩm ăn liền · dùng thớt/dụng cụ theo
            màu riêng cho gà jerk sống và thực phẩm ăn liền · không tái sử dụng nước ướp sống trừ khi đã đun
            sôi · rửa tay và thay găng tay giữa các công việc sống và ăn liền · vệ sinh và khử trùng bề mặt
            giữa các công việc.
          </p>
          <p className="text-sm font-semibold mt-3">If something&apos;s wrong:</p>
          <p className="text-sm text-muted mb-2">Nếu có sai sót:</p>
          <p className="text-sm">
            Throw away any ready-to-eat food that touched raw food or raw marinade, re-clean the surface.
          </p>
          <p className="text-sm text-muted">
            Vứt bỏ mọi thực phẩm ăn liền đã chạm vào thực phẩm sống hoặc nước ướp sống, vệ sinh lại bề mặt.
          </p>
        </Section>

        <Section titleEn="Allergies" titleVi="Dị ứng">
          <ul className="list-disc pl-4">
            <Bullet en="Know the allergens in every dish" vi="Nắm rõ chất gây dị ứng trong từng món ăn" />
            <Bullet en="If unsure, say 'I'll check' — never guess" vi="Nếu không chắc, hãy nói 'để tôi kiểm tra' — không bao giờ đoán" />
            <Bullet
              en="Use separate utensils/prep area when removing an allergen on request"
              vi="Dùng dụng cụ/khu vực sơ chế riêng khi bỏ chất gây dị ứng theo yêu cầu"
            />
            <Bullet
              en="Log any allergy incident in the Customer Complaint log immediately"
              vi="Ghi ngay mọi sự cố dị ứng vào Sổ Khiếu Nại Khách Hàng"
            />
          </ul>
        </Section>
      </div>
    </div>
  );
}

export default function ReferencePage() {
  return (
    <RoleGate module="foodSafety">
      <ReferenceContent />
    </RoleGate>
  );
}
