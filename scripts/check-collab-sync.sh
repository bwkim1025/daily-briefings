#!/usr/bin/env bash
# 협의실 공용 코어(assets/collab-core.js)가 두 저장소에서 같은지 sha256으로 비교한다.
# 원본은 daily-briefings. 다르면 daily-briefings 쪽 파일을 study로 그대로 복사한다.
set -euo pipefail
cd "$(dirname "$0")/.."
F=assets/collab-core.js
for repo in daily-briefings study; do
  printf '%-16s ' "$repo"; curl -fsSL "https://raw.githubusercontent.com/bwkim1025/$repo/main/$F" | sha256sum | cut -d' ' -f1
done
printf '%-16s %s\n' local "$(sha256sum "$F" | cut -d' ' -f1)"
a=$(curl -fsSL "https://raw.githubusercontent.com/bwkim1025/daily-briefings/main/$F" | sha256sum)
b=$(curl -fsSL "https://raw.githubusercontent.com/bwkim1025/study/main/$F" | sha256sum)
[ "$a" = "$b" ] && echo "OK: 동기화됨" || { echo "DIFF: 원격 두 사본이 다름"; exit 1; }
