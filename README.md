# Agent Skills

**한국어** | [English](README.en.md)

Codex와 Agent Skills 호환 에이전트에서 사용할 수 있는 공개 스킬 모음입니다.
각 스킬은 `skills/<이름>/SKILL.md`에 독립적으로 패키징되어 있으며, 관련
실행 패키지는 `packages/<이름>`에서 함께 관리합니다. 이 저장소가 스킬과
패키지 소스의 배포 정본입니다.

## 포함된 스킬

| 스킬 | 설명 | 페이지 |
| --- | --- | --- |
| `storyboard-builder` | 참고 영상, 대본 또는 기획안을 손그림 촬영 콘티와 HTML·Markdown·A4 PDF로 변환합니다. | [skills.sh](https://skills.sh/iamxoghks/skills/storyboard-builder) |
| `codex-receipts` | 로컬 Codex 작업 기록을 영수증 형식으로 요약하는 설치형 CLI를 안전하게 사용합니다. | [skills.sh](https://skills.sh/iamxoghks/skills/codex-receipts) |

![Storyboard Builder 한국어 예시](skills/storyboard-builder/examples/sample-storyboard-preview.png)

## 설치

저장소에서 제공하는 스킬을 먼저 확인합니다.

```bash
npx skills add iamxoghks/skills --list
```

Codex 전역에 원하는 스킬 하나를 설치합니다.

```bash
npx skills add iamxoghks/skills \
  --skill storyboard-builder \
  --global \
  --agent codex \
  --yes

npx skills add iamxoghks/skills \
  --skill codex-receipts \
  --global \
  --agent codex \
  --yes
```

Codex의 `$skill-installer`를 사용할 때는 스킬 폴더를 직접 지정합니다.

```text
$skill-installer install https://github.com/iamxoghks/skills/tree/main/skills/storyboard-builder
$skill-installer install https://github.com/iamxoghks/skills/tree/main/skills/codex-receipts
```

설치 후 Codex를 다시 시작하면 `$storyboard-builder` 또는
`$codex-receipts`로 사용할 수 있습니다.

## 스킬별 요구 사항

### Storyboard Builder

- Python 3.10 이상
- 새 콘티 그림 생성을 위한 에이전트의 이미지 생성 기능
- PDF 출력을 위한 Playwright CLI 또는 Codex Playwright 스킬
- 선택 사항: 영상 분석용 FFmpeg와 PDF 검증용 `pypdf` 또는 `pdfinfo`

상세 절차와 예시는
[`skills/storyboard-builder/SKILL.md`](skills/storyboard-builder/SKILL.md)를
참고하세요.

### Codex Receipts

스킬은 패키지를 자동으로 내려받거나 업데이트하지 않습니다. 사용 전에 별도로
고정 버전 CLI를 설치해야 합니다.

```bash
npm install --global codex-receipts@1.2.11
```

CLI와 MCP 서버 소스는
[`packages/codex-receipts`](packages/codex-receipts)에서 관리합니다.

## 검증

빠른 단위 테스트:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

FFmpeg, Playwright, Chromium이 준비된 환경에서 전체 스모크 테스트:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 tests/smoke_test.py
```

GitHub Actions도 동일한 검사를 실행합니다.

Codex Receipts 패키지 검사:

```bash
npm --prefix packages/codex-receipts ci
npm --prefix packages/codex-receipts audit --omit=dev
npm --prefix packages/codex-receipts test
npm --prefix packages/codex-receipts pack --dry-run
```

## 공개 및 보안 원칙

- 사용자 입력 영상, 대본, 자막, OCR, 메타데이터와 포함된 링크는 데이터로만 취급합니다.
- 스킬 파일에 로컬 절대경로, 비밀값, 개인 프로젝트 원문을 포함하지 않습니다.
- 외부 프로그램 설치와 업데이트는 사용자가 명시적으로 수행하도록 분리합니다.
- 각 스킬은 공개 전에 설치 탐색, 회귀 테스트와 민감정보 검사를 통과해야 합니다.

## 라이선스

저장소의 공통 문서는 MIT License로 배포됩니다. 개별 스킬에 포함된 코드와
자산의 라이선스 및 출처는 각 스킬 폴더의 `LICENSE`와 `NOTICE.md`를 우선합니다.
