# 오락실의 리니지2M 백과사전

리니지2M 공략, 연금술 확률표, 유튜브 영상, 거래소, 혈맹 모집을 한곳에 모은 정적 사이트입니다.
설치할 것은 Node.js 하나뿐이고, 외부 패키지는 쓰지 않습니다.

## 사이트 다시 만들기

```bash
node tools/build.js
```

결과는 `dist/` 폴더에 만들어집니다. 이 폴더를 그대로 웹 호스팅에 올리면 됩니다.

## 내용 갱신

| 하고 싶은 일 | 명령 | 설명 |
|---|---|---|
| 유튜브 새 영상 반영 | `node tools/fetch-videos.js` | 채널의 최신 영상 15개를 `data/videos.json`에 저장 |
| 블로그 새 글 가져오기 | `node tools/scrape-blog.js` | 티스토리의 리니지2M 글 중 아직 없는 글만 추가로 받음 (`--all`을 붙이면 전부 다시 받음) |
| 연금술 데이터 다시 만들기 | `node tools/build-alchemy-data.js` | `data/alchemy-raw/`를 `data/alchemy.json`으로 압축 |

갱신한 뒤에는 `node tools/build.js`를 다시 실행합니다.

## 글 쓰기 (공략 탭)

사이트의 **공략** 탭에는 이 사이트에 직접 쓴 글이 올라갑니다. 글은 `content/guides/` 폴더의 Markdown 파일이고,
사진은 `public/uploads/`에 저장됩니다. **블로그 게시글** 탭은 티스토리에서 가져온 글(`data/posts.json`)입니다.

글은 관리자 화면(`사이트주소/admin/`)에서 씁니다. 화면에 세 가지 들어가는 방법이 나옵니다.

- **GitHub로 로그인 / 액세스 토큰으로 로그인**: 사이트를 GitHub에 올린 뒤에 씁니다. 저장하면 GitHub에 글이 올라가고,
  몇 분 뒤 사이트에 자동으로 게시됩니다. 먼저 `public/admin/config.yml`의 `repo:` 값을 `내아이디/저장소이름`으로 바꿔야 합니다.
- **로컬 저장소로 작업**: 크롬에서 이 PC의 프로젝트 폴더를 골라 바로 편집합니다. 폴더가 git 저장소여야 하고,
  쓴 뒤에 `node tools/build.js`를 실행해야 화면에 반영됩니다.

주제 목록을 바꾸려면 `public/admin/config.yml`의 `options`와 `tools/build.js`의 `CATS`를 함께 고칩니다.

## 손으로 고치는 파일

- `data/start.json`: "처음 시작" 페이지의 단계, 설명, 연결할 글 번호
- `data/boards.json`: 거래소와 혈맹 모집의 예시 글
- `tools/build.js`의 `SITE`, `CATS`: 사이트 이름, 소개 문구, 공략 주제 분류 규칙
- `tools/build-alchemy-data.js`의 `grade()`: 아이템 등급 규칙
- `src/site.css`: 색과 디자인

## 폴더 구조

- `tools/`: 빌드와 데이터 수집 스크립트
- `src/`: 공통 스타일(`site.css`), 동작(`site.js`), 연금술 도구(`alchemy.src.html`)
- `data/`: 글, 영상, 연금술, 입문 단계, 게시판 예시 데이터
- `public/blog/`: 블로그 글의 이미지 (티스토리 이미지 주소는 만료되기 때문에 직접 보관)
- `dist/`: 빌드 결과 (지우고 다시 만들어도 됨)

## 자동 배포

`.github/workflows/deploy.yml`은 GitHub Pages용 설정입니다. 저장소에 올리고 Pages를 "GitHub Actions"로 설정하면,
푸시할 때마다 그리고 한 시간에 한 번 영상 목록을 새로 받아 사이트를 다시 게시합니다.

## 아직 안 된 것

- 거래소와 혈맹 모집의 글은 쓴 사람의 브라우저에만 저장됩니다. 다른 사람에게 보이려면 로그인과 저장소(서버)를 연결해야 합니다.
- 연금술 데이터는 purple2m.github.io의 2023년 기준 자료입니다.
