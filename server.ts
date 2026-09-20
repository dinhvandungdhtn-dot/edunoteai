import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Lazy Gemini client
  let geminiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!geminiClient && process.env.GEMINI_API_KEY) {
      geminiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return geminiClient;
  }

  // API Health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      appName: 'Edunote AI',
      academicYear: '2026-2027',
    });
  });

  // Android Digital Asset Links for TWA APK Verification
  app.get('/.well-known/assetlinks.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(path.join(__dirname, 'public', '.well-known', 'assetlinks.json'));
  });

  // APK and PWA package information
  app.get('/api/apk-info', (req, res) => {
    res.json({
      packageId: 'vn.edunote.ai',
      version: '1.0.0',
      buildNumber: 1,
      appName: 'Edunote AI – Sổ Tay Giáo Dục Cá Nhân',
      minAndroidVersion: '8.0 (API 26)',
      pwaStatus: 'Ready',
      manifestUrl: '/manifest.json',
      twaManifestUrl: '/twa-manifest.json',
      assetLinksUrl: '/.well-known/assetlinks.json',
    });
  });

  // AI Comment Suggestion API
  app.post('/api/gemini/suggest-comment', async (req, res) => {
    const {
      subject,
      subjectName,
      grade,
      criterion,
      criterionName,
      level,
      evidence,
      supportGoal,
      studentName,
      tone,
    } = req.body;

    const stName = (studentName || 'Học sinh').trim();
    const subName = (subjectName || subject || 'Chung').trim();
    const critName = (criterionName || criterion || 'Năng lực môn học').trim();
    const lvl = Number(level) || 3;
    const ev = (evidence || '').trim();
    const preferredTone = tone || supportGoal || 'khích lệ';

    // Rule-based pedagogical fallback function in case Gemini is experiencing 503 high demand or unavailable
    const generatePedagogicalFallback = () => {
      let pos = '';
      let ach = '';
      let imp = '';
      let act = '';
      let full = '';
      const alternatives: string[] = [];

      if (lvl === 4) {
        pos = `Em ${stName} tiếp thu rất nhanh, chủ động và phát huy tư duy linh hoạt trong giờ học ${subName}.`;
        ach = `Em đã làm chủ hoàn toàn tiêu chí "${critName}", thực hiện chuẩn xác và tự tin.${ev ? ` Minh chứng: ${ev}.` : ''}`;
        imp = 'Tiếp tục phát huy khả năng sáng tạo và thử sức với các bài tập vận dụng nâng cao.';
        act = 'Giao thêm các nhiệm vụ nhóm, đóng vai trò hướng dẫn các bạn cùng tiến bộ.';
        full = `Em ${stName} hoàn thành xuất sắc yêu cầu tiêu chí "${critName}". Thao tác của em tự tin, chính xác và có tư duy sáng tạo.${ev ? ` Biểu hiện rõ qua: ${ev}.` : ''} Khuyến khích em tiếp tục duy trì phong độ tích cực này!`;

        alternatives.push(
          `Em ${stName} hoàn thành xuất sắc tiêu chí "${critName}", luôn chủ động, sáng tạo và thể hiện sự vượt trội trong môn ${subName}.`,
          `Em ${stName} tiếp thu bài rất nhanh, nắm vững kỹ năng ${critName} và luôn nhiệt tình giúp đỡ bạn bè cùng tiến bộ.`,
          `Thành thạo tiêu chí "${critName}", tự tin phát biểu và hoàn thành bài tập với chất lượng cao.`
        );
      } else if (lvl === 3) {
        pos = `Em ${stName} có tinh thần học tập tích cực, nắm chắc kiến thức và kỹ năng cơ bản môn ${subName}.`;
        ach = `Em đã đạt tốt các yêu cầu của tiêu chí "${critName}".${ev ? ` Minh chứng: ${ev}.` : ''}`;
        imp = 'Rèn luyện thêm tính phản xạ nhanh và chủ động chia sẻ ý kiến trước lớp.';
        act = 'Khuyến khích em tự tin phát biểu, tham gia tương tác cặp đôi và tự kiểm tra bài.';
        full = `Em ${stName} thực hiện tốt các yêu cầu của tiêu chí "${critName}". Ý thức học tập nghiêm túc, kỹ năng đạt chuẩn mức.${ev ? ` Biểu hiện: ${ev}.` : ''} Em nên mạnh dạn chia sẻ ý kiến nhiều hơn nữa nhé!`;

        alternatives.push(
          `Em ${stName} nắm chắc kiến thức và thực hiện đạt yêu cầu tiêu chí "${critName}". Thái độ học tập chăm chỉ và tiến bộ đều.`,
          `Hoàn thành tốt nội dung ${critName}, có nhiều cố gắng trong giờ học ${subName}. Nếu tích cực phát biểu hơn em sẽ càng tiến bộ.`,
          `Đạt chuẩn kiến thức kỹ năng tiêu chí "${critName}", tương tác tốt cùng bạn bè và giáo viên.`
        );
      } else if (lvl === 2) {
        pos = `Em ${stName} đã có nhiều nỗ lực và bước đầu thể hiện sự tiến bộ đáng ghi nhận ở môn ${subName}.`;
        ach = `Em bước đầu nắm được quy trình và vận dụng được hướng dẫn trong tiêu chí "${critName}".${ev ? ` Minh chứng: ${ev}.` : ''}`;
        imp = 'Còn đôi chút lúng túng khi thực hành độc lập, cần được thầy cô nhắc nhở hoặc gợi ý thêm.';
        act = 'Giáo viên hỗ trợ thêm 1-1 ở các bước khó, ghép đôi với bạn học tốt để cùng luyện tập.';
        full = `Em ${stName} đã có nhiều nỗ lực và bước đầu đạt được yêu cầu cơ bản của tiêu chí "${critName}". Tuy nhiên em vẫn cần thầy cô đồng hành, gợi ý thêm khi giải quyết nhiệm vụ. Thầy cô và gia đình sẽ tiếp tục khích lệ em!`;

        alternatives.push(
          `Em ${stName} có ý thức học tập và đang tiến bộ từng ngày ở nội dung ${critName}. Em cần chú ý luyện tập đều đặn hơn.`,
          `Bước đầu nắm được kỹ năng cơ bản tiêu chí "${critName}". Em hãy mạnh dạn hỏi thầy cô khi chưa hiểu bài để làm tốt hơn nhé!`,
          `Em có cố gắng trong giờ học ${subName}, cần rèn luyện thêm tính tập trung để hoàn thành tiêu chí "${critName}" tốt hơn.`
        );
      } else if (lvl === 1) {
        pos = `Em ${stName} luôn chăm chỉ đến lớp và có ý thức hợp tác cùng thầy cô trong các hoạt động.`;
        ach = `Em đã nhận biết được yêu cầu ban đầu của tiêu chí "${critName}".${ev ? ` Minh chứng: ${ev}.` : ''}`;
        imp = 'Cần được hướng dẫn chi tiết từng bước và củng cố lại các thao tác căn bản.';
        act = 'Áp dụng phương pháp phân nhỏ mục tiêu, hướng dẫn trực tiếp và khen thưởng các tiến bộ nhỏ.';
        full = `Em ${stName} đang trong quá trình tiếp cận tiêu chí "${critName}". Thầy cô sẽ tiếp tục chia nhỏ nhiệm vụ và dành thời gian hỗ trợ riêng để giúp em từng bước làm quen và tự tin hơn trong môn ${subName}.`;

        alternatives.push(
          `Em ${stName} có tinh thần học hỏi, cần thêm thời gian và sự kiên nhẫn đồng hành từ thầy cô để nắm vững tiêu chí "${critName}".`,
          `Em đang nỗ lực làm quen với bài học. Thầy cô sẽ tiếp tục hướng dẫn cụ thể từng bước để giúp em tiến bộ vững chắc.`,
          `Cần củng cố thêm kiến thức cơ bản tiêu chí "${critName}". Cô luôn tin tưởng và sẵn sàng hỗ trợ em mọi lúc!`
        );
      } else {
        pos = `Em ${stName} đang trong quá trình học tập và làm quen với chủ đề.`;
        ach = 'Cần thêm thời gian quan sát để ghi nhận đầy đủ minh chứng năng lực.';
        imp = 'Tăng cường theo dõi trong các tiết học tiếp theo.';
        act = 'Tạo điều kiện để em tham gia nhiều hơn vào các hoạt động thực hành cá nhân.';
        full = `Học sinh ${stName} đang trong quá trình tiếp cận tiêu chí "${critName}". Giáo viên sẽ tiếp tục theo dõi, quan sát và thu thập thêm minh chứng trong các tiết học tiếp theo.`;
        alternatives.push(full);
      }

      // Choose full comment based on preferredTone if applicable
      let selectedMain = full;
      if (preferredTone === 'ngắn gọn' && alternatives.length > 2) {
        selectedMain = alternatives[2];
      } else if (preferredTone === 'rèn luyện' && alternatives.length > 1) {
        selectedMain = alternatives[1];
      } else if (alternatives.length > 0) {
        selectedMain = alternatives[0];
      }

      return {
        comment: selectedMain,
        positiveComment: pos,
        achievements: ach,
        areasToImprove: imp,
        actionPlan: act,
        fullSuggestedComment: full,
        alternatives,
        source: 'pedagogical_template',
      };
    };

    const prompt = `
Bạn là chuyên gia sư phạm tiểu học và THCS theo chuẩn Thông tư đánh giá học sinh của Bộ GD&ĐT Việt Nam.
Hãy phân tích và viết nhận xét sư phạm hỗ trợ giáo viên cho học sinh:
- Họ tên học sinh: ${stName}
- Môn học: ${subName}
- Khối lớp: ${grade || 'Khối 5'}
- Tiêu chí năng lực cần đánh giá: "${critName}"
- Mức đánh giá hiện tại: Mức ${lvl} (1: Cần hỗ trợ, 2: Đang phát triển, 3: Đạt, 4: Thành thạo)
- Minh chứng / biểu hiện thực tế từ giáo viên: "${ev || 'Ghi nhận qua các tiết học thực hành và tương tác trên lớp'}"
- Phong cách mong muốn: "${preferredTone}"

YÊU CẦU BẮT BUỘC:
1. Tuyệt đối KHÔNG dùng từ ngữ tiêu cực gây tổn thương hoặc gắn nhãn học sinh ("yếu", "kém", "chậm", "lười").
2. Sử dụng ngôn ngữ sư phạm tích cực, ấm áp, văn minh, cụ thể và đúng bối cảnh minh chứng thực tế.
3. Trả về đúng định dạng JSON có cấu trúc gồm:
   - comment: Đoạn nhận xét hoàn chỉnh (1-3 câu) liên kết mạch lạc, ấm áp, chuẩn mực để giáo viên điền ngay vào sổ nhận xét hoặc học bạ.
   - positiveComment: Lời khích lệ, khen ngợi điểm tích cực ngắn gọn.
   - achievements: Nêu rõ điểm học sinh đã làm được theo minh chứng.
   - areasToImprove: Nêu điểm cần tiếp tục rèn luyện thêm (dùng từ ngữ chỉ dẫn tích cực).
   - actionPlan: Đề xuất giải pháp/hoạt động hỗ trợ học tập cụ thể, khả thi cho thầy cô.
   - fullSuggestedComment: Đoạn nhận xét đầy đủ và chi tiết.
   - alternatives: Mảng chứa 2-3 gợi ý nhận xét khác nhau theo các phong cách (khích lệ, chỉ dẫn, ngắn gọn).
`;

    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.json(generatePedagogicalFallback());
      }

      // Models to try with graceful fallback for 503 high demand spikes
      const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let lastErr: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  comment: { type: Type.STRING },
                  positiveComment: { type: Type.STRING },
                  achievements: { type: Type.STRING },
                  areasToImprove: { type: Type.STRING },
                  actionPlan: { type: Type.STRING },
                  fullSuggestedComment: { type: Type.STRING },
                  alternatives: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'comment',
                  'positiveComment',
                  'achievements',
                  'areasToImprove',
                  'actionPlan',
                  'fullSuggestedComment',
                ],
              },
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text.trim());
            return res.json({
              ...parsed,
              comment: parsed.comment || parsed.fullSuggestedComment,
              alternatives:
                Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0
                  ? parsed.alternatives
                  : [parsed.comment || parsed.fullSuggestedComment],
              source: 'gemini',
              model: modelName,
            });
          }
        } catch (err: any) {
          lastErr = err;
          const msg = err?.message || String(err);
          console.warn(`Gemini model ${modelName} transient issue: ${msg}`);
          // If 503 or unavailable, continue to next model in sequence
          if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('demand')) {
            continue;
          }
        }
      }

      // If all models failed or encountered 503, use pedagogical fallback
      return res.json(generatePedagogicalFallback());
    } catch (err) {
      console.warn('Gemini request encountered exception, providing pedagogical fallback:', err);
      return res.json(generatePedagogicalFallback());
    }
  });

  // Vite middleware in dev / static in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Edunote AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
