"use client";

import { RoleGate } from "@/components/RoleGate";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";

function Section({ titleEn, titleVi, num, children }: { titleEn: string; titleVi: string; num?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <p className="font-bold text-sm mb-0.5">{num ? `${num} ` : ""}{titleEn}</p>
      <p className="text-xs text-muted mb-3">{titleVi}</p>
      {children}
    </Card>
  );
}

function SubHeading({ en, vi }: { en: string; vi: string }) {
  return (
    <p className="text-sm font-semibold mt-3 mb-1">
      {en} <span className="text-muted font-normal">· {vi}</span>
    </p>
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

function IfWrong({ en, vi }: { en: string; vi: string }) {
  return (
    <div className="mt-3 rounded-xl bg-danger/10 p-3">
      <p className="text-xs font-bold text-danger mb-1">If wrong · Nếu sai</p>
      <p className="text-sm">{en}</p>
      <p className="text-sm text-muted">{vi}</p>
    </div>
  );
}

function ReferenceContent() {
  return (
    <div className="pb-6">
      <BackLink href="/food-safety" label="Food Safety · An toàn thực phẩm" />
      <PageHeader
        title="Reference Rules · Quy Tắc Tham Khảo"
        subtitle="From the Kitchen Food Safety Book · Trích từ Sổ Tay An Toàn Thực Phẩm Bếp"
      />
      <div className="px-4 md:px-8">
        <p className="px-1 text-xs font-bold text-muted uppercase tracking-wide mb-2">Section 1 · Personal Hygiene / Phần 1 · Vệ Sinh Cá Nhân</p>

        <Section titleEn="Before you start work" titleVi="Trước khi bắt đầu làm việc">
          <ul className="list-disc pl-4">
            <Bullet en="Wash your hands" vi="Rửa tay" />
            <Bullet en="Wear clean clothes and an apron" vi="Mặc quần áo sạch và đeo tạp dề" />
            <Bullet en="Tie back hair; wear a hat" vi="Buộc gọn tóc; đội mũ" />
            <Bullet en="Remove watches and jewellery" vi="Tháo đồng hồ và trang sức" />
            <Bullet
              en="Tell your manager if you have vomiting, diarrhoea, or a fever — do not work with food"
              vi="Báo quản lý nếu bạn bị nôn, tiêu chảy, hoặc sốt — không được chế biến thực phẩm"
            />
          </ul>
        </Section>

        <Section titleEn="While you work" titleVi="Trong khi làm việc">
          <ul className="list-disc pl-4">
            <Bullet en="No smoking, eating, or drinking in food areas" vi="Không hút thuốc, ăn, hoặc uống trong khu vực chế biến thực phẩm" />
            <Bullet en="Don't touch your face, cough, or sneeze over food" vi="Không chạm vào mặt, ho, hoặc hắt hơi gần thực phẩm" />
            <Bullet
              en="Cover any cut with a brightly coloured waterproof dressing, plus a glove if handling ready-to-eat food"
              vi="Che vết thương bằng băng chống nước màu sáng, đeo thêm găng tay nếu xử lý thực phẩm ăn liền"
            />
          </ul>
        </Section>

        <Section titleEn="Wash your hands · when" titleVi="Rửa tay khi nào">
          <ul className="list-disc pl-4">
            <Bullet en="Before touching food" vi="Trước khi chạm vào thực phẩm" />
            <Bullet en="After the toilet" vi="Sau khi đi vệ sinh" />
            <Bullet en="After every break" vi="Sau mỗi giờ nghỉ" />
            <Bullet en="After touching raw meat, poultry, fish, eggs, or unwashed vegetables" vi="Sau khi chạm vào thịt sống, gia cầm, cá, trứng, hoặc rau chưa rửa" />
            <Bullet en="After touching a cut or dressing" vi="Sau khi chạm vào vết thương hoặc băng gạc" />
            <Bullet en="After touching bins" vi="Sau khi chạm vào thùng rác" />
            <Bullet en="After cleaning" vi="Sau khi dọn dẹp" />
            <Bullet en="After touching phones, cash, or door handles" vi="Sau khi chạm vào điện thoại, tiền, hoặc tay nắm cửa" />
          </ul>
          <SubHeading en="How to wash your hands" vi="Cách rửa tay" />
          <p className="text-sm">
            Wet hands → soap and lather → rub palms, backs of hands, and between fingers → interlock fingers and rub between
            them → rub thumbs and fingertips → rinse and dry with a disposable towel.
          </p>
          <p className="text-sm text-muted mt-1">
            Làm ướt tay → xoa xà phòng tạo bọt → chà lòng bàn tay, mu bàn tay, và kẽ ngón tay → đan các ngón tay và chà giữa
            chúng → chà ngón cái và đầu ngón tay → rửa sạch và lau khô bằng khăn giấy dùng một lần.
          </p>
        </Section>

        <p className="px-1 text-xs font-bold text-muted uppercase tracking-wide mb-2 mt-6">Section 2 · Kitchen Rules / Phần 2 · Quy Tắc Bếp</p>

        <Section num="2.1" titleEn="Cross-Contamination" titleVi="Lây nhiễm chéo">
          <ul className="list-disc pl-4">
            <Bullet en="Store raw meat/poultry below and separate from ready-to-eat food" vi="Bảo quản thịt/gia cầm sống ở ngăn dưới, tách riêng khỏi thực phẩm ăn liền" />
            <Bullet en="Use separate boards/utensils (colour-coded) for raw jerk chicken vs. ready-to-eat food" vi="Dùng thớt/dụng cụ riêng (phân màu) cho gà jerk sống và thực phẩm ăn liền" />
            <Bullet en="Never reuse raw marinade on cooked food or as a sauce unless it's been boiled first" vi="Không dùng lại nước ướp sống cho thực phẩm đã nấu hoặc làm nước sốt trừ khi đã đun sôi" />
            <Bullet en="Wash hands and change gloves between raw and ready-to-eat tasks" vi="Rửa tay và thay găng tay khi chuyển giữa thực phẩm sống và thực phẩm ăn liền" />
            <Bullet en="Clean and disinfect surfaces between raw and ready-to-eat tasks" vi="Vệ sinh và khử trùng bề mặt giữa các công việc với thực phẩm sống và ăn liền" />
          </ul>
          <IfWrong
            en="Throw away any ready-to-eat food that touched raw food or raw marinade. Re-clean the surface."
            vi="Bỏ ngay thực phẩm ăn liền đã chạm vào thực phẩm sống hoặc nước ướp sống. Vệ sinh lại bề mặt."
          />
        </Section>

        <Section num="2.2" titleEn="Cleaning" titleVi="Vệ sinh">
          <ul className="list-disc pl-4">
            <Bullet en="Clean and disinfect food contact surfaces before and after use" vi="Vệ sinh và khử trùng bề mặt tiếp xúc thực phẩm trước và sau khi sử dụng" />
            <Bullet en="Detergent first to remove grease/dirt, then disinfectant" vi="Dùng chất tẩy rửa trước để loại bỏ dầu mỡ/bụi bẩn, sau đó khử trùng" />
            <Bullet en="Clean as you go — don't let food waste build up" vi="Dọn dẹp ngay trong lúc làm — không để rác thực phẩm tồn đọng" />
            <Bullet en="Store cleaning chemicals away from food, clearly labelled" vi="Bảo quản hóa chất tẩy rửa tách xa thực phẩm, có nhãn rõ ràng" />
            <Bullet en="Follow the Cleaning Schedule — Log 5.4" vi="Thực hiện theo Lịch Vệ Sinh — Biểu mẫu 5.4" />
          </ul>
          <IfWrong en="Re-clean immediately. Don't use the surface for food until it's clean." vi="Vệ sinh lại ngay. Không dùng bề mặt đó cho thực phẩm cho đến khi sạch." />
        </Section>

        <Section num="2.3" titleEn="Chilling" titleVi="Bảo quản lạnh">
          <ul className="list-disc pl-4">
            <Bullet en="Fridges ≤5°C, freezers ≤ -18°C — check and log twice a day, Log 5.1" vi="Tủ lạnh ≤5°C, tủ đông ≤ -18°C — kiểm tra và ghi lại hai lần mỗi ngày, Biểu mẫu 5.1" />
            <Bullet en="Check every cold delivery: ≤5°C chilled, frozen still solid" vi="Kiểm tra mỗi lần giao hàng lạnh: hàng mát ≤5°C, hàng đông còn cứng" />
            <Bullet en="Cool cooked food to ≤8°C within 90 minutes before refrigerating" vi="Làm nguội thực phẩm đã nấu xuống ≤8°C trong vòng 90 phút trước khi cho vào tủ lạnh" />
            <Bullet en="Don't overload fridges — let air circulate" vi="Không chất quá đầy tủ lạnh — để không khí lưu thông" />
          </ul>
          <IfWrong
            en="Move food to a working fridge immediately. If it's been above 8°C for more than 2 hours, throw it away."
            vi="Chuyển thực phẩm sang tủ lạnh hoạt động tốt ngay. Nếu đã trên 8°C hơn 2 giờ, hãy bỏ đi."
          />
        </Section>

        <Section num="2.4" titleEn="Cooking" titleVi="Nấu ăn">
          <ul className="list-disc pl-4">
            <Bullet en="Cook chicken, pork, and reheated food to 75°C core for 30 seconds — use a probe every batch, Log 5.2" vi="Nấu gà, thịt heo, và thực phẩm hâm lại đạt 75°C ở tâm trong 30 giây — dùng nhiệt kế que mỗi mẻ, Biểu mẫu 5.2" />
            <Bullet en="Chicken: juices run clear, no pink meat at the bone" vi="Gà: nước chảy ra trong, không còn thịt hồng gần xương" />
            <Bullet en="Clean and disinfect the probe before and after each use" vi="Vệ sinh và khử trùng nhiệt kế que trước và sau mỗi lần dùng" />
            <Bullet en="Check the probe monthly in ice water — should read 0°C ±1°C" vi="Kiểm tra nhiệt kế que hàng tháng trong nước đá — phải đọc 0°C ±1°C" />
          </ul>
          <IfWrong
            en="Keep cooking until it reaches 75°C. If it's already been served, pull the dish."
            vi="Tiếp tục nấu cho đến khi đạt 75°C. Nếu đã phục vụ, thu hồi món ăn ngay."
          />
        </Section>

        <Section num="2.5" titleEn="Receiving Deliveries" titleVi="Nhận hàng giao">
          <ul className="list-disc pl-4">
            <Bullet en="Check every delivery on arrival: temperature, packaging, use-by date — Log 5.3" vi="Kiểm tra mỗi lần giao hàng khi đến: nhiệt độ, bao bì, hạn sử dụng — Biểu mẫu 5.3" />
            <Bullet en="Match the delivery against the invoice" vi="Đối chiếu hàng giao với hóa đơn" />
            <Bullet en="Reject anything out of range, damaged, or past its date" vi="Từ chối hàng không đạt nhiệt độ, hư hỏng, hoặc quá hạn" />
            <Bullet en="Only order from suppliers on the Approved Supplier List — Log 5.11" vi="Chỉ đặt hàng từ nhà cung cấp trong Danh Sách Được Duyệt — Biểu mẫu 5.11" />
          </ul>
          <IfWrong
            en="Reject the delivery. Log it on the Goods Rejection Record, Log 5.12, and tell the supplier."
            vi="Từ chối nhận hàng. Ghi vào Biểu Mẫu Từ Chối Hàng, 5.12, và báo cho nhà cung cấp."
          />
        </Section>

        <Section num="2.6" titleEn="Pest Control" titleVi="Kiểm soát côn trùng, gây hại">
          <ul className="list-disc pl-4">
            <Bullet en="Keep bins closed, away from food, and empty them daily" vi="Đậy kín thùng rác, để xa thực phẩm, và đổ rác hàng ngày" />
            <Bullet en="Check deliveries for signs of pests before accepting" vi="Kiểm tra dấu hiệu côn trùng/gây hại trên hàng giao trước khi nhận" />
            <Bullet en="Report any sighting immediately" vi="Báo cáo ngay khi phát hiện" />
          </ul>
          <IfWrong
            en="Log it on the Pest Control Log, Log 5.7, and contact the pest control company."
            vi="Ghi vào Biểu Mẫu Kiểm Soát Côn Trùng, 5.7, và liên hệ công ty kiểm soát côn trùng."
          />
        </Section>

        <Section num="2.7" titleEn="Allergies" titleVi="Dị ứng thực phẩm">
          <ul className="list-disc pl-4">
            <Bullet en="Know the allergens in every dish on the menu" vi="Nắm rõ các chất gây dị ứng trong từng món trên thực đơn" />
            <Bullet en="If asked about allergens and you're not sure, say “I'll check” — never guess" vi="Nếu được hỏi về chất gây dị ứng mà không chắc, hãy nói “Tôi sẽ kiểm tra” — không đoán" />
            <Bullet en="Use separate utensils and prep area when removing an allergen on request" vi="Dùng dụng cụ và khu vực chế biến riêng khi khách yêu cầu bỏ chất gây dị ứng" />
          </ul>
          <IfWrong
            en="Log any allergy incident on the Complaint / Incident Log, Log 5.10, and tell the manager immediately."
            vi="Ghi mọi sự cố dị ứng vào Biểu Mẫu Khiếu Nại/Sự Cố, 5.10, và báo quản lý ngay lập tức."
          />
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
