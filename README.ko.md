# Codex Receipts

Codex 작업 세션을 영수증처럼 요약해 주는 작은 CLI/MCP 도구입니다.

이 프로젝트는 원본 [`claude-receipts`](https://github.com/chrishutchinson/claude-receipts) 아이디어를 Codex용으로 바꾼 fork입니다. 로컬 Codex 세션 로그를 읽고, 눈에 보이는 작업 흔적을 세어, 최신 세션에 대한 작은 "proof of work" 영수증을 출력합니다.

[English README](./README.md)

## 출력 내용

- 세션 id, 위치, 시간
- 사용자 프롬프트와 어시스턴트 응답 수
- 도구 호출, 도구 출력, reasoning 항목
- Codex 세션 로그에 기록된 토큰 사용량
- 실제 과금액이 아닌 장난스러운 `pts` 합계

`pts`는 재미용 점수입니다. API 과금액이나 실제 비용이 아닙니다.

## npm으로 실행

```bash
npx codex-receipts generate --output html
```

전역 설치도 가능합니다.

```bash
npm install -g codex-receipts
codex-receipts generate --output html
```

## 로컬 개발

```bash
npm install
npm test
node bin/codex-receipts.js generate
```

## 명령어

가장 최근 Codex 세션 영수증 생성:

```bash
npx codex-receipts generate
```

HTML 파일 생성:

```bash
npx codex-receipts generate --output html
```

한글 영수증 생성:

```bash
npx codex-receipts generate --output html --locale ko
```

일본어/중국어 영수증 생성:

```bash
npx codex-receipts generate --output html --locale ja
npx codex-receipts generate --output html --locale zh
```

영수증 문구 덮어쓰기:

```bash
npx codex-receipts generate \
  --cashier-label "담당" \
  --cashier "Codex Bot" \
  --footer-message "오늘도 수고했음"
```

한글 기본 footer는 도미나 대사인 `연봉 협상 때 이거 언급해.`를 사용합니다. 영어 기본 footer는 기존 `Proof of work, but cute.`를 유지합니다.

터미널 출력:

```bash
npx codex-receipts generate --output console
```

감열 영수증 프린터 출력:

```bash
npx codex-receipts generate --output printer --printer usb
```

USB 모드는 기본 Epson TM-T88V 장치(`04b8:0202`)를 찾습니다. 프린터가 다른 USB id로 보이면 명시적으로 지정할 수 있습니다.

```bash
npx codex-receipts generate --output printer --printer usb:VID:PID
```

네트워크 프린터와 CUPS 프린터도 지원합니다.

```bash
npx codex-receipts generate --output printer --printer tcp://HOST:9100
npx codex-receipts generate --output printer --printer CUPS_PRINTER_NAME
```

특정 세션 id, id prefix, thread 이름 일부로 생성:

```bash
npx codex-receipts generate --session 019de4e1
npx codex-receipts generate --session "Codex용 프로젝트"
```

위치 덮어쓰기:

```bash
npx codex-receipts generate --location "Cheonan, KR"
```

위치를 설정하지 않으면 영수증에는 `The Cloud`가 표시됩니다. Codex Receipts는 공인 IP를 조회하거나 외부 위치 조회 서비스를 호출하지 않습니다.

## MCP 서버

로컬 stdio MCP 서버 실행:

```bash
npx codex-receipts mcp
```

이 MCP 서버는 로컬 stdio 서버입니다. HTTP 포트를 열지 않습니다. MCP 클라이언트가 로컬 프로세스로 실행하고 stdin/stdout으로 통신합니다.

제공 도구:

- `list_codex_sessions`: `~/.codex`의 최근 로컬 Codex 세션 목록 조회
- `generate_codex_receipt`: 텍스트 영수증 생성, 필요하면 `~/.codex-receipts/projects` 아래에 HTML 저장

`generate_codex_receipt`는 선택적으로 `printer` 값을 받을 수 있습니다. 가능한 값은 `usb`, `usb:VID:PID`, `tcp://HOST:9100`, CUPS 프린터 이름입니다. `printer`가 있으면 MCP는 먼저 HTML 영수증을 저장한 뒤 프린터 출력을 시도합니다. 프린터가 연결되어 있지 않거나 찾을 수 없으면 전체 요청을 실패시키지 않고, 프린터 안내 메시지와 저장된 `htmlPath`를 반환합니다.
`location`, `locale`, `cashierLabel`, `cashier`, `footerMessage`도 받을 수 있습니다. `locale` 값으로 `en`, `ko`, `ja`, `zh`를 넘기면 영어/한국어/일본어/중국어 영수증 라벨을 선택할 수 있습니다. `cashier`를 생략하면 Codex 세션 로그에 기록된 모델명이 자동으로 표시됩니다. 위치는 config 또는 `The Cloud`를 기본값으로 사용하며, 공인 IP나 위치 조회는 하지 않습니다.

프린터 출력은 로컬 side effect입니다. MCP의 `printer` 옵션은 신뢰하는 로컬 MCP 클라이언트에서만 켜는 것을 권장합니다. 특히 `tcp://HOST:9100`은 입력한 host/port로 로컬 outbound socket을 엽니다. 이 기능은 네트워크 영수증 프린터용이지, 원격 API 호출용이 아닙니다.

MCP 클라이언트 설정 예시:

```json
{
  "mcpServers": {
    "codex-receipts": {
      "command": "npx",
      "args": ["-y", "codex-receipts", "mcp"]
    }
  }
}
```

stdio MCP 서버 정의를 지원하는 클라이언트에 위 설정을 추가한 뒤, 세션 목록 조회나 영수증 생성을 요청하면 됩니다.

## 설정

설정 파일 위치:

```text
~/.codex-receipts.config.json
```

```bash
npx codex-receipts setup
npx codex-receipts config --show
npx codex-receipts config --set timezone="Asia/Seoul"
npx codex-receipts config --set locale=ko
npx codex-receipts config --set cashierLabel="담당"
npx codex-receipts config --set cashier="Codex Bot"
npx codex-receipts config --set footerMessage="오늘도 수고했음"
npx codex-receipts config --set printer=usb
npx codex-receipts config --reset
```

## 데이터 소스

Codex Receipts가 읽는 파일:

```text
~/.codex/session_index.jsonl
~/.codex/sessions/**/*.jsonl
```

로컬 Codex 세션 파일만 읽고, 생성된 영수증은 `~/.codex-receipts` 아래에 씁니다. 영수증 생성 과정에서 세션 내용이나 공인 IP 정보를 원격 서비스로 보내지 않습니다.

## 보안 메모

- CLI와 MCP 서버는 `~/.codex`의 로컬 Codex 로그를 읽고 `~/.codex-receipts` 아래에 영수증을 씁니다.
- 영수증 언어는 실행 시 `--locale en|ko|ja|zh`로 지정하거나 config에 `locale=en|ko|ja|zh`로 저장할 수 있습니다.
- cashier label, cashier 값, footer message는 실행 옵션이나 config로 덮어쓸 수 있습니다. `cashier`를 설정하지 않으면 세션 로그에 기록된 모델명이 자동으로 표시됩니다.
- 위치 기본값은 `The Cloud`입니다. 공인 IP나 위치 조회 서비스를 호출하지 않습니다.
- 외부 명령은 shell 문자열이 아니라 인자 배열로 실행합니다.
- HTML 영수증은 로컬 로그에서 온 텍스트를 이스케이프한 뒤 렌더링합니다.
- 프린터 출력은 USB, CUPS, 사용자가 지정한 TCP 프린터 endpoint와 통신할 수 있습니다. MCP printer 접근은 신뢰하는 로컬 환경에서만 사용하세요.

## 출력 형식

- `console`: 터미널 박스 영수증
- `html`: `~/.codex-receipts/projects/[session-id].html` 저장
- `printer`: USB, TCP, CUPS 영수증 프린터로 ESC/POS 출력

비영어권 라벨은 console과 HTML 출력에서 동작합니다. 감열 프린터 출력은 프린터 펌웨어/코드페이지가 UTF-8 또는 해당 언어 텍스트를 지원해야 정상 출력됩니다.
비영어 locale과 `--output printer`를 함께 쓰면 CLI와 MCP 결과에 UTF-8/해당 언어 코드페이지 지원 안내가 함께 표시됩니다.

## Codex Skill

이 repo에는 `skills/codex-receipts` Codex skill이 포함되어 있습니다. 이 skill은 에이전트가 npm CLI를 사용해 최신 또는 특정 세션 영수증을 만들고, console/HTML/printer 출력과 로컬 전용 privacy 기대치를 지키도록 안내합니다.

## 릴리스

이 패키지는 GitHub Actions의 npm trusted publishing을 사용합니다. 새 버전을 배포하려면 package version을 올리고 생성된 태그를 push합니다.

```bash
npm version patch
git push origin main --tags
```

`Publish to npm` workflow는 `v*` 태그에서만 실행되고, `npm test` 후 npm에 publish합니다. 변경 범위가 크면 `patch` 대신 `minor` 또는 `major`를 사용하세요.

## 참고

이 프로젝트는 회계 도구가 아니라 재미용 유틸리티입니다. Codex는 현재 로컬 세션 활동 로그를 노출하므로, 이 프로젝트는 정확한 모델 비용이 아니라 작업 흔적을 측정합니다.
