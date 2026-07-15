# Storyboard Builder

**한국어** | [English](README.en.md)

Storyboard Builder는 참고 영상 또는 대사·화면 구도·인물 동작이 적힌
스크립트를 자세한 촬영용 스토리보드로 바꾸는 Codex 스킬입니다. 영상이
없어도 대본이나 기획안에서 컷과 구도, 동작, 반응, 예상 시간을 설계합니다.
컷마다 새로운 16:9 손그림을 만들고, 주요 행동을 중앙 9:16 안전 영역에
배치하며, 한국어 HTML과 Markdown, 페이지가 정확히 나뉜 A4 PDF를 생성합니다.

![한국어 A4 스토리보드 미리보기](storyboard-builder/examples/sample-storyboard-preview.png)

## 입력 자료

- 참고 영상: 원본 장면의 순서와 시간, 구도, 자세와 움직임을 반영합니다.
- 상세 스크립트: 대사와 화면 구도, 인물 동작, 반응, 소품, 장면 전환을 반영합니다.
- 대사만 있는 대본 또는 기획안: 필요한 컷과 구도, 동선, 말없는 반응과 예상 시간을 새로 설계합니다.
- 기존 콘티 또는 시각 참고자료: 구성과 스타일만 분석하고 최종 그림은 새로 만듭니다.

## 주요 기능

- 참고 영상 정보 확인, 장면 전환 감지, 대표 프레임 추출
- 대사와 몸짓, 소품, 반응, 말없는 행동까지 포함한 세부 컷 구성
- 중앙 9:16 자르기 안내선이 있는 16:9 손그림
- 표지에서 16:9 외곽선과 9:16 안전 영역을 설명하는 화면 구성 가이드
- 한국어 기본 문서와 영어 보조 문서, 사용자 정의 항목명 지원
- PNG, JPEG, WebP 파일의 개인 및 편집기 메타데이터 정리
- 내용이 넘치면 컷 단위로 페이지를 추가하는 A4 PDF 출력
- HTML, Markdown, JSON 원고, PDF, 이미지 묶음 생성
- 로컬 경로, 파일명, Markdown, 개인정보 검증

## 필요 환경

- 새 스토리보드 그림을 만들 수 있는 Codex 이미지 생성 기능
- Python 3.10 이상
- PDF 출력을 위한 Node.js `npx`, `playwright-cli` 또는 Codex Playwright 스킬
- 선택 사항: 영상 분석용 FFmpeg의 `ffmpeg`와 `ffprobe`
- 선택 사항: PDF 페이지 검증용 `pypdf` 또는 `pdfinfo`
- 선택 사항: PDF 이미지 최적화용 Pillow 또는 macOS `sips`

## 설치

이 저장소에서 다음 명령을 실행합니다.

```bash
./scripts/install.sh
```

설치기는 `storyboard-builder` 폴더를 다음 위치에 복사합니다.

```text
${CODEX_HOME:-$HOME/.codex}/skills/storyboard-builder
```

기존 설치가 있으면 덮어쓰지 않습니다. 교체하려면 `--force`를 사용합니다.

## Codex에서 사용

```text
$storyboard-builder를 사용해서 이 참고 영상 또는 스크립트를 자세한 촬영용
스토리보드로 만들고, 필요한 컷과 구도, 인물 동작을 설계해서 새로운 손그림과
A4 PDF까지 생성해줘.
```

기본 한국어 원고는
`storyboard-builder/assets/storyboard.template.json`에 있습니다. 영어 원고는
`storyboard-builder/assets/storyboard.template.en.json`을 사용합니다.

## 명령줄 도구

HTML과 Markdown 생성:

```bash
python3 storyboard-builder/scripts/storyboard_builder.py storyboard.json \
  --output-dir outputs \
  --basename project-storyboard
```

A4 PDF 생성:

```bash
python3 storyboard-builder/scripts/render_storyboard_pdf.py \
  outputs/project-storyboard.html \
  outputs/project-storyboard.pdf
```

참고 영상 분석:

```bash
python3 storyboard-builder/scripts/analyze_video.py reference.mp4 \
  --output-dir work/video-analysis
```

## 예시

한국어 기본 예시:

- [원고](storyboard-builder/examples/sample-storyboard.json)
- [HTML](storyboard-builder/examples/sample-storyboard.html)
- [Markdown](storyboard-builder/examples/sample-storyboard.md)
- [A4 PDF](storyboard-builder/examples/sample-storyboard.pdf)

영어 보조 예시:

- [Manifest](storyboard-builder/examples/sample-storyboard-en.json)
- [HTML](storyboard-builder/examples/sample-storyboard-en.html)
- [Markdown](storyboard-builder/examples/sample-storyboard-en.md)
- [A4 PDF](storyboard-builder/examples/sample-storyboard-en.pdf)

예시는 가상의 성인 인물과 범용 홍보 영상 대사만 사용합니다. 원본 영상 캡처,
실명, 로컬 절대경로, 특정 프로젝트 대사는 포함하지 않습니다.

## 개인정보 보호 기본값

- 재사용 파일에는 로컬 절대경로나 계정명을 저장하지 않습니다.
- PNG, JPEG, WebP에서 흔한 개인 및 편집기 메타데이터를 제거하면서 안정적인
  표시에 필요한 이미지 데이터는 유지합니다.
- 영상 분석 결과에는 사용자가 요청하지 않는 한 원본 파일명을 기록하지 않습니다.
- 추출한 영상 프레임은 로컬 분석 자료로만 유지합니다.
- 이미지 생성은 외부 서비스 경계입니다. 사용 권한이 확인되지 않은 기밀 자료는
  전송하지 마세요.

## 테스트

```bash
python3 -m unittest discover -s tests -v
python3 tests/smoke_test.py
```

GitHub Actions는 Linux에서 필요한 실행 환경을 설치하고 두 명령을 실행합니다.

## 라이선스와 출처

Storyboard Builder는 MIT License로 배포됩니다. 손그림 시각 방향은 MIT
License로 공개된
[Ian Xiaohei Illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations)를
참고했습니다. 자세한 내용은 [NOTICE.md](NOTICE.md)를 확인하세요.
