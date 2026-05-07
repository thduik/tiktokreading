import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type VocabItem = {
  term: string;
  definition: string;
  meaning_vi?: string;
  sentence_index?: number;
};

type PassageCard = {
  title?: string;
  vocab?: VocabItem[];
};

const datasetPaths = [
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.json",
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.additions.json",
  "../../../../artifacts/readtok/src/lib/reading-material-db.v2.stitched-8plus.json",
];

const viByTerm: Record<string, string> = {
  "accelerate": "đẩy nhanh; làm tăng tốc",
  "acceptable": "có thể chấp nhận được",
  "additional": "bổ sung; thêm",
  "agriculture": "nông nghiệp",
  "algorithmic": "thuộc về thuật toán",
  "alternatives": "các lựa chọn thay thế",
  "animal": "động vật",
  "anning": "Anning (tên riêng)",
  "antikythera": "Antikythera (tên riêng)",
  "apollo": "Apollo (tên chương trình không gian)",
  "architectural": "thuộc về kiến trúc",
  "atmosphere": "khí quyển",
  "atmospheric": "thuộc về khí quyển",
  "attribution": "sự quy kết nguyên nhân",
  "audit": "kiểm toán; rà soát",
  "aurora": "cực quang",
  "authenticity": "tính xác thực",
  "bekli": "Göbekli (tên riêng)",
  "biodiversity": "đa dạng sinh học",
  "bird": "chim",
  "black": "Đen; trong cụm 'Cái Chết Đen'",
  "bleaching": "sự tẩy trắng",
  "bletchley": "Bletchley (tên địa danh)",
  "borealis": "phương Bắc; trong cụm 'cực quang phương Bắc'",
  "camera": "buồng tối; thiết bị quang học",
  "candidates": "thí sinh; ứng viên",
  "causation": "quan hệ nhân quả",
  "centres": "các trung tâm",
  "change": "sự thay đổi",
  "city": "thành phố",
  "climate": "khí hậu",
  "clock": "đồng hồ",
  "collective": "tập thể; chung",
  "committing": "cam kết",
  "communication": "truyền thông; giao tiếp",
  "compass": "la bàn",
  "complexity": "sự phức tạp",
  "conditions": "điều kiện",
  "confidence": "sự tự tin; mức độ tin chắc",
  "congestion": "sự tắc nghẽn giao thông",
  "consciously": "một cách có ý thức",
  "consequences": "hậu quả; hệ quả",
  "conservation": "bảo tồn",
  "consistency": "sự nhất quán",
  "constrained": "bị giới hạn; bị ràng buộc",
  "consumption": "sự tiêu thụ",
  "continental": "thuộc về lục địa",
  "coral": "san hô",
  "credentials": "chứng chỉ; văn bằng",
  "criticized": "bị chỉ trích",
  "cultural": "thuộc về văn hóa",
  "culture": "văn hóa",
  "darwin": "Darwin (tên nhà khoa học)",
  "death": "cái chết",
  "decipherment": "sự giải mã",
  "decision": "quyết định",
  "decision-making": "việc ra quyết định",
  "demographic": "thuộc về dân số",
  "descriptions": "các mô tả",
  "development": "sự phát triển",
  "differently": "một cách khác biệt",
  "diffraction": "nhiễu xạ",
  "discipline": "làm cho có phương pháp; chuẩn hóa",
  "disciplined": "có phương pháp; chặt chẽ",
  "discoveries": "những khám phá",
  "dispersing": "phát tán; phân tán",
  "disproportionately": "một cách không tương xứng",
  "drift": "sự trôi dạt",
  "ecological": "thuộc về sinh thái",
  "ecologists": "các nhà sinh thái học",
  "ecosystem": "hệ sinh thái",
  "efficiently": "một cách hiệu quả",
  "eiffel": "Eiffel (tên riêng)",
  "einstein": "Einstein (tên nhà khoa học)",
  "electric": "thuộc về điện",
  "elephants": "voi",
  "enforcement": "sự thực thi",
  "engineers": "các kỹ sư",
  "environmental": "thuộc về môi trường",
  "environments": "môi trường",
  "event": "sự kiện",
  "events": "các sự kiện",
  "evidence": "bằng chứng",
  "evidence-based": "dựa trên bằng chứng",
  "expectations": "kỳ vọng",
  "exposition": "triển lãm",
  "eyewitness": "nhân chứng",
  "eyewitnesses": "các nhân chứng",
  "farming": "canh tác; làm nông",
  "farms": "các trang trại",
  "fertilizer": "phân bón",
  "fission": "sự phân hạch",
  "forest": "rừng",
  "fossil": "hóa thạch",
  "franklin": "Franklin (tên riêng)",
  "fungi": "nấm",
  "geomagnetic": "thuộc về địa từ",
  "governments": "các chính phủ",
  "great": "lớn; vĩ đại",
  "haber-bosch": "Haber-Bosch (tên quy trình)",
  "hemisphere": "bán cầu",
  "heritage": "di sản",
  "hieroglyphs": "chữ tượng hình",
  "high-latitude": "ở vĩ độ cao",
  "historic": "có tính lịch sử; cổ kính",
  "historical": "thuộc về lịch sử",
  "hospitals": "bệnh viện",
  "human-caused": "do con người gây ra",
  "immunity": "miễn dịch",
  "importance": "tầm quan trọng",
  "industrial": "thuộc về công nghiệp",
  "information": "thông tin",
  "infrastructure": "cơ sở hạ tầng",
  "instinctive": "theo bản năng",
  "institutional": "thuộc về thể chế; tổ chức",
  "institutions": "các thể chế; tổ chức",
  "intelligence": "trí thông minh",
  "interpretation": "sự diễn giải",
  "invention": "phát minh",
  "kepler": "Kepler (tên nhà khoa học)",
  "keystone": "then chốt; chủ chốt",
  "laboratory": "phòng thí nghiệm",
  "language": "ngôn ngữ",
  "later": "sau này",
  "laws": "các định luật",
  "likelihood": "khả năng xảy ra",
  "lise": "Lise (tên riêng)",
  "little": "nhỏ; trong cụm 'Tiểu Băng Hà'",
  "local": "địa phương",
  "lunar": "thuộc về Mặt Trăng",
  "magnetic": "có tính từ; thuộc từ trường",
  "making": "việc tạo ra; việc biến thành",
  "mary": "Mary (tên riêng)",
  "mathematical": "thuộc về toán học",
  "mathematicians": "các nhà toán học",
  "measurements": "các phép đo",
  "mechanical": "cơ học; cơ khí",
  "mechanics": "cơ học",
  "mechanism": "cơ chế",
  "meitner": "Meitner (tên riêng)",
  "memory": "trí nhớ; ký ức",
  "migration": "sự di cư",
  "modular": "theo mô-đun",
  "monitoring": "sự theo dõi; giám sát",
  "moon": "Mặt Trăng",
  "motion": "chuyển động",
  "mycorrhizal": "nấm rễ",
  "natural": "tự nhiên",
  "navigation": "định hướng; điều hướng",
  "nervous": "thuộc về thần kinh",
  "networks": "mạng lưới",
  "newtonian": "thuộc về Newton",
  "nitrogen": "nitơ",
  "nuclear": "hạt nhân",
  "obscura": "tối; trong cụm 'camera obscura/buồng tối'",
  "observation": "sự quan sát",
  "octopus": "bạch tuộc",
  "otto": "Otto (tên riêng)",
  "oxygen": "oxy",
  "oxygenation": "sự oxy hóa; sự gia tăng oxy",
  "park": "Park (một phần của tên địa danh)",
  "particular": "cụ thể; riêng biệt",
  "persuasive": "có sức thuyết phục",
  "photosynthesis": "quang hợp",
  "physiological": "thuộc về sinh lý",
  "planetary": "thuộc về hành tinh",
  "plate": "mảng kiến tạo",
  "policy": "chính sách",
  "practice": "tập tục; hoạt động thực hành",
  "precision": "độ chính xác",
  "predictions": "các dự đoán",
  "predictive": "có tính dự đoán",
  "preserve": "bảo tồn; gìn giữ",
  "preserving": "việc bảo tồn; gìn giữ",
  "pricing": "sự định giá",
  "private": "cá nhân; riêng tư",
  "problem-solving": "giải quyết vấn đề",
  "process": "quá trình; quy trình",
  "protected": "được bảo vệ",
  "qualifications": "bằng cấp; trình độ chuyên môn",
  "recognizable": "dễ nhận ra",
  "recollection": "sự hồi tưởng; ký ức được nhớ lại",
  "reconstruct": "tái dựng",
  "reconstruction": "sự tái dựng",
  "record": "bản ghi; hồ sơ",
  "reef": "rạn san hô",
  "reefs": "các rạn san hô",
  "relationship": "mối quan hệ",
  "relationships": "các mối quan hệ",
  "relativity": "thuyết tương đối",
  "reproduction": "sự sinh sản",
  "resilience": "khả năng phục hồi",
  "restricting": "hạn chế",
  "result": "kết quả",
  "rhythms": "nhịp điệu; nhịp sinh hoạt",
  "risk": "rủi ro",
  "ritual": "nghi lễ",
  "roles": "vai trò",
  "rosalind": "Rosalind (tên riêng)",
  "rosetta": "Rosetta (tên riêng)",
  "samples": "mẫu vật",
  "scientific": "thuộc về khoa học",
  "scientifically": "về mặt khoa học",
  "scientists": "các nhà khoa học",
  "secrecy": "sự bí mật",
  "selection": "sự chọn lọc",
  "significance": "ý nghĩa; tầm quan trọng",
  "significant": "quan trọng; đáng kể",
  "social": "thuộc về xã hội",
  "software": "phần mềm",
  "song": "tiếng hát; bài hát",
  "species": "loài",
  "spectacular": "ngoạn mục; ấn tượng",
  "standardized": "được chuẩn hóa",
  "stone": "phiến đá",
  "suggestive": "có tính gợi ý; chưa đủ thuyết phục",
  "synthesis": "sự tổng hợp",
  "system": "hệ thống",
  "tectonics": "kiến tạo",
  "telegraph": "điện báo",
  "temperatures": "nhiệt độ",
  "tepe": "Tepe (một phần của tên địa danh)",
  "testing": "việc kiểm tra; thi cử",
  "themselves": "chính bản thân chúng",
  "theory": "lý thuyết",
  "time": "thời gian",
  "tower": "tháp",
  "traditions": "truyền thống",
  "traffic": "giao thông",
  "trails": "dấu vết; nhật ký theo dõi",
  "transformed": "đã biến đổi",
  "transmitted": "được truyền lại",
  "unavailable": "không có sẵn",
  "uncertainty": "sự bất định; điều chưa chắc chắn",
  "understood": "được hiểu",
  "universelle": "Universelle (tên riêng trong tên triển lãm)",
  "universities": "các trường đại học",
  "urban": "đô thị",
  "vaccination": "tiêm chủng",
  "variability": "tính biến thiên",
  "visibility": "khả năng nhìn thấy",
  "water": "nước",
  "whale": "cá voi",
};

function cardArrayFromJson(input: unknown): PassageCard[] {
  if (Array.isArray(input)) {
    return input as PassageCard[];
  }

  if (
    typeof input === "object" &&
    input !== null &&
    "cards" in input &&
    Array.isArray((input as { cards?: unknown }).cards)
  ) {
    return (input as { cards: PassageCard[] }).cards;
  }

  throw new Error("Expected a JSON array of passage cards or an object with cards[].");
}

async function updateDataset(datasetPath: string) {
  const raw = await readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const cards = cardArrayFromJson(parsed);
  let updatedItems = 0;
  const missingTerms = new Set<string>();

  for (const card of cards) {
    for (const vocabItem of card.vocab ?? []) {
      const key = vocabItem.term.trim().toLowerCase();
      const translation = viByTerm[key];
      if (!translation) {
        missingTerms.add(vocabItem.term);
        continue;
      }

      vocabItem.meaning_vi = translation;
      updatedItems += 1;
    }
  }

  if (missingTerms.size > 0) {
    throw new Error(
      `Missing Vietnamese translations for: ${[...missingTerms].sort().join(", ")}`,
    );
  }

  await writeFile(datasetPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return { cardCount: cards.length, updatedItems };
}

async function run() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const targetPaths = datasetPaths.map((datasetPath) =>
    path.resolve(scriptDir, datasetPath),
  );

  let totalCards = 0;
  let totalItems = 0;
  for (const datasetPath of targetPaths) {
    const result = await updateDataset(datasetPath);
    totalCards += result.cardCount;
    totalItems += result.updatedItems;
    console.log(
      `Updated ${datasetPath}: ${result.cardCount} cards, ${result.updatedItems} vocab translations.`,
    );
  }

  console.log(`Vietnamese vocab pass complete: ${totalCards} cards, ${totalItems} items.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

