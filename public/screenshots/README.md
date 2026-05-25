# PWA Screenshots

매니페스트에서 참조하는 스크린샷 — Android Chrome 설치 모달 + Play Store 등록에 사용.

## 필요한 파일 3장

| 파일명 | 화면 | 사이즈 |
|--------|------|--------|
| `mobile-home.png` | 메인 그리드 (카드 4~6개 보이게) | 1080×1920 |
| `mobile-card.png` | 카드 상세 (이미지 + 제목 + 신청 방법) | 1080×1920 |
| `mobile-my.png` | /my 페이지 (내 관심·신청 카드) | 1080×1920 |

## 캡처 가이드

### 1. 폰에서 캡처

1. **Android Chrome** 또는 **PWA 설치한 상태**에서 `umbba-radar.com` 접속
2. 위 3개 화면 각각 캡처 (전원+볼륨다운 동시 누름)
3. 갤러리에서 PC로 전송

### 2. 사이즈 정리 (필수)

Play Store는 1080×1920 (or 9:16 비율) 요구. 폰 해상도 다양해서 리사이즈 필요할 수 있음.

**Mac/Linux** (sharp 이용):
```bash
node -e "
const sharp = require('sharp');
['home', 'card', 'my'].forEach(async (name) => {
  await sharp(\`./mobile-\${name}-raw.png\`)
    .resize(1080, 1920, { fit: 'cover' })
    .png()
    .toFile(\`./mobile-\${name}.png\`);
});
"
```

**Windows / 간단한 방법**: 그림판 또는 온라인 도구로 1080×1920 크롭.

### 3. 업로드

위 3개 파일을 이 폴더 (`public/screenshots/`)에 직접 넣고 git push.

## 적용 확인

배포 후 (~2분):
- `https://umbba-radar.com/screenshots/mobile-home.png` 등 직접 접속해서 이미지 보이면 ✓
- `pwabuilder.com` 재분석 → screenshots 항목 ✓ 표시
- Android Chrome 신규 설치 시 모달에 미리보기 노출

## 주의

- 개인정보 포함된 화면(이메일, 자녀 이름 등)은 캡처 전에 가리거나 더미 데이터로 변경
- 캡처 시점에 카드 충분히 있어야 함 (`/admin/queue`에서 published 카드 늘려놓기)
