#!/usr/bin/env bash
#
# 管理端小程序 · 线上环境打包
#
#   ./scripts/build-online.sh                  # 标准线上打包（要求工作区干净）
#   ./scripts/build-online.sh --allow-dirty    # 允许带未提交改动打包（manifest 里会标记 dirty）
#   ./scripts/build-online.sh --skip-checks    # 跳过 tsc 类型检查
#   ./scripts/build-online.sh --no-zip         # 只构建，不打 zip
#   ./scripts/build-online.sh --out dist_release
#
# 产物：
#   dist/                              微信开发者工具直接导入上传的目录
#   release/shinecar-admin_<ver>_<时间>_<sha>.zip   归档 / 交接用
#   release/shinecar-admin_<ver>_<时间>_<sha>.json  构建清单（commit / 尺寸 / 校验结果）
#
# 说明：线上环境由 TARO_APP_ENV=production 决定（api.shinecar.club、mock 强制关闭），
#       构建产物会覆盖 dist/，之后要继续本地调试必须重新跑 dev:weapp。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ALLOW_DIRTY=0
SKIP_CHECKS=0
NO_ZIP=0
OUT_DIR="release"

# 微信小程序体积上限：主包 2MB、单个分包 2MB、全部 20MB
LIMIT_MAIN_KB=2048
LIMIT_SUB_KB=2048
LIMIT_TOTAL_KB=20480

if [[ -t 1 ]]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'
  C_DRK=$'\033[90m'; C_BLD=$'\033[1m'; C_RST=$'\033[0m'
else
  C_RED=''; C_GRN=''; C_YEL=''; C_DRK=''; C_BLD=''; C_RST=''
fi

section() { printf '\n%s==> %s%s\n' "$C_BLD" "$1" "$C_RST"; }
info()    { printf '    %s\n' "$1"; }
ok()      { printf '    %s✓%s %s\n' "$C_GRN" "$C_RST" "$1"; }
warn()    { printf '    %s!%s %s\n' "$C_YEL" "$C_RST" "$1"; }
die()     { printf '\n%s✗ %s%s\n\n' "$C_RED" "$1" "$C_RST" >&2; exit 1; }

usage() {
  sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --skip-checks) SKIP_CHECKS=1; shift ;;
    --no-zip)      NO_ZIP=1; shift ;;
    --out)         OUT_DIR="${2:-}"; [[ -n "$OUT_DIR" ]] || die "--out 需要目录参数"; shift 2 ;;
    -h|--help)     usage ;;
    *)             die "未知参数: $1（用 --help 查看用法）" ;;
  esac
done

# ---------------------------------------------------------------- 0. 环境

section "环境检查"

# Agent 会话会注入 NODE_OPTIONS 指向 shim，会让 Taro 构建在深层目录建缓存时失败
unset NODE_OPTIONS

if [[ ! -d node_modules ]]; then
  die "缺少 node_modules，先执行 yarn install（本机无 yarn 时用 ./projects/shinecar-admin-frontend/node_modules 软链）"
fi

NODE_CUR="$(node -v 2>/dev/null | sed 's/^v//')"
NODE_WANT="$(tr -d 'v \n\r' < .nvmrc 2>/dev/null || true)"
info "Node ${NODE_CUR:-未安装}（.nvmrc 要求 ${NODE_WANT:-未声明}）"
if [[ -n "$NODE_WANT" && "${NODE_CUR%%.*}" != "${NODE_WANT%%.*}" ]]; then
  warn "Node 大版本与 .nvmrc 不一致，构建结果可能无法复现：nvm use 后再跑"
fi

for bin in ./node_modules/.bin/taro; do
  [[ -x "$bin" ]] || die "找不到 $bin，node_modules 可能不完整"
done

VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo 0.0.0)"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo nogit)"
DIRTY_COUNT="$(git status --porcelain --untracked-files=normal 2>/dev/null | wc -l | tr -d ' ')"
BUILD_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
STAMP="$(date '+%Y%m%d-%H%M')"

info "分支 ${GIT_BRANCH} @ ${GIT_SHA}"
info "版本 ${VERSION}"

if [[ "$DIRTY_COUNT" != "0" ]]; then
  warn "工作区有 ${DIRTY_COUNT} 个未提交改动："
  git status --porcelain --untracked-files=normal | sed 's/^/        /' | head -12
  if [[ "$ALLOW_DIRTY" -eq 1 ]]; then
    warn "已用 --allow-dirty 放行，manifest 会记录 dirty=1"
  else
    die "线上包必须可追溯，请先提交；仅本地验证请加 --allow-dirty"
  fi
fi

# ---------------------------------------------------------------- 1. 静态检查

if [[ "$SKIP_CHECKS" -eq 1 ]]; then
  section "静态检查"
  warn "已跳过（--skip-checks）"
else
  section "静态检查"
  if [[ -x ./node_modules/.bin/tsc ]]; then
    ./node_modules/.bin/tsc --noEmit || die "类型检查失败，线上包不生成"
    ok "tsc --noEmit 通过"
  else
    warn "未安装 typescript，跳过类型检查"
  fi
fi

# ---------------------------------------------------------------- 2. 构建

section "构建（TARO_APP_ENV=production）"
rm -rf dist
info "dist/ 已清空，开始构建..."

if ! TARO_APP_ENV=production NODE_ENV=production \
     ./node_modules/.bin/taro build --type weapp 2>&1 | tail -20; then
  die "构建失败"
fi

[[ -f dist/app.json ]] || die "构建结束但 dist/app.json 不存在"
ok "构建完成"

# ---------------------------------------------------------------- 3. 产物校验

section "产物校验"

FAILED=0

# 3.1 页面与分包完整性
PAGE_COUNT="$(grep -o '"pages/[^"]*"' dist/app.json | wc -l | tr -d ' ')"
SUB_ROOTS="$(grep -o '"root"[[:space:]]*:[[:space:]]*"[^"]*"' dist/app.json | sed 's/.*"\([^"]*\)"$/\1/' | tr '\n' ' ')"
if [[ "$PAGE_COUNT" -ge 5 ]]; then
  ok "主包页面 ${PAGE_COUNT} 个"
else
  warn "主包页面只有 ${PAGE_COUNT} 个（预期 ≥5）"; FAILED=1
fi
if [[ -n "$SUB_ROOTS" ]]; then
  ok "分包: ${SUB_ROOTS}"
else
  warn "未检测到分包配置"; FAILED=1
fi

# 3.2 环境自证：构建戳必须是 [production]（config/index.ts 注入，见 __BUILD_STAMP__）
if grep -rqF "[production]" dist; then
  ok "产物自证环境 [production]"
else
  warn "产物里找不到 [production] 构建戳 —— 这不是线上包，环境没切过来"; FAILED=1
fi

# 3.3 接口基址：
#     env.ts 把 dev / pre / production 三套配置放在同一个静态对象里，webpack 无法 tree-shake，
#     因此 dev 与 pre 的地址也会出现在 common.js 中——运行时按 __APP_ENV__ 选择，不影响线上行为。
#     这里只做提示，不作为失败条件；要彻底剔除需把 env.ts 改成编译期裁剪。
if grep -rq "api\.shinecar\.club" dist; then
  ok "接口基址 api.shinecar.club 已打入"
else
  warn "产物里找不到 api.shinecar.club，构建配置异常"; FAILED=1
fi
if grep -rq "127.0.0.1:8991\|pre-api.shinecar.club" dist; then
  warn "产物含 dev/pre 地址（静态表驱动所致，不影响线上运行）"
else
  ok "无 dev/pre 地址残留"
fi

# 3.3 mock 泄漏（production 下 isMockEnabled=false，功能无影响，只影响包体与信息暴露）
if grep -rq "13800138000\|K7mQ2xRb" dist; then
  warn "产物里含 mock 数据（mock 未被 tree-shake，不影响功能，可接受）"
else
  ok "无 mock 数据残留"
fi

# 3.4 清理 webpack 附带的许可证文本，微信上传会当普通文件打进包
find dist -name "*.LICENSE.txt" -type f -delete 2>/dev/null || true

# 3.5 体积（主包 = 总体积 - 各分包）
TOTAL_KB="$(du -sk dist | awk '{print $1}')"
SUB_KB=0
for r in $SUB_ROOTS; do
  if [[ -d "dist/$r" ]]; then
    k="$(du -sk "dist/$r" | awk '{print $1}')"
    SUB_KB=$((SUB_KB + k))
    if (( k > LIMIT_SUB_KB )); then
      warn "分包 $r ${k}KB 超过 2MB 上限"; FAILED=1
    else
      ok "分包 $r ${k}KB"
    fi
  else
    warn "app.json 声明了分包 $r 但产物里没有该目录"; FAILED=1
  fi
done
MAIN_KB=$((TOTAL_KB - SUB_KB))
fmt_kb() { awk -v k="$1" 'BEGIN{printf "%.2f MB", k/1024}'; }

if (( MAIN_KB > LIMIT_MAIN_KB )); then
  warn "主包 $(fmt_kb "$MAIN_KB") 超过 2MB 上限"; FAILED=1
else
  ok "主包 $(fmt_kb "$MAIN_KB")"
fi
if (( TOTAL_KB > LIMIT_TOTAL_KB )); then
  warn "总体积 $(fmt_kb "$TOTAL_KB") 超过 20MB 上限"; FAILED=1
else
  ok "总体积 $(fmt_kb "$TOTAL_KB")"
fi

FILE_COUNT="$(find dist -type f | wc -l | tr -d ' ')"
info "文件数 ${FILE_COUNT}"

if [[ "$FAILED" -ne 0 ]]; then
  die "产物校验未通过，已中止（dist 保留供排查）"
fi
ok "校验全部通过"

# ---------------------------------------------------------------- 4. 打包

section "打包"

BASE_NAME="shinecar-admin_${VERSION}_${STAMP}_${GIT_SHA}"
[[ "$DIRTY_COUNT" != "0" ]] && BASE_NAME="${BASE_NAME}-dirty"

ZIP_PATH=""
if [[ "$NO_ZIP" -eq 1 ]]; then
  info "已跳过 zip（--no-zip）"
else
  mkdir -p "$OUT_DIR"
  ZIP_PATH="${OUT_DIR}/${BASE_NAME}.zip"
  rm -f "$ZIP_PATH"
  (cd dist && zip -qr "$ROOT_DIR/$ZIP_PATH" .)
  ok "zip: ${ZIP_PATH}（$(du -h "$ZIP_PATH" | awk '{print $1}')）"
fi

MANIFEST="${OUT_DIR}/${BASE_NAME}.json"
mkdir -p "$OUT_DIR"
cat > "$MANIFEST" <<JSON
{
  "app": "shinecar-admin-frontend",
  "env": "production",
  "apiBaseUrl": "https://api.shinecar.club",
  "version": "${VERSION}",
  "buildTime": "${BUILD_TIME}",
  "branch": "${GIT_BRANCH}",
  "commit": "${GIT_SHA}",
  "dirty": $([[ "$DIRTY_COUNT" != "0" ]] && echo true || echo false),
  "node": "${NODE_CUR}",
  "sizeKb": { "main": ${MAIN_KB}, "subTotal": ${SUB_KB}, "total": ${TOTAL_KB} },
  "fileCount": ${FILE_COUNT},
  "zip": "${ZIP_PATH}"
}
JSON
ok "manifest: ${MANIFEST}"

# ---------------------------------------------------------------- 5. 后续

section "完成"
info "dist/ 现为线上产物（会覆盖 dev 产物，继续本地调试请重跑 npm run dev:weapp）"
info ""
info "上传步骤："
info "  1. 微信开发者工具 → 导入项目 → 选择本目录（miniprogramRoot 已是 dist/）"
info "  2. 点「上传」，版本号填 ${VERSION}，备注填 ${GIT_BRANCH}@${GIT_SHA}"
info "  3. 小程序后台设为体验版验收，通过后提交审核"
[[ -n "$ZIP_PATH" ]] && info "" && info "归档包：${ZIP_PATH}"
