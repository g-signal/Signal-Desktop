#!/bin/bash
# Signal Desktop Linux DEB 打包脚本
# 用法: ./build-deb.sh [--skip-deps] [--sign]

set -e  # 遇到错误立即退出

# 加载NVM环境
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
    # 尝试使用22.21.1（如果可用），否则使用当前版本
    if nvm list | grep -q "v22.21.1"; then
        nvm use 22.21.1 > /dev/null 2>&1 || true
    fi
fi

# 加载PNPM环境
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# 设置npm registry为官方源（避免镜像源超时）
if command -v pnpm &> /dev/null; then
    pnpm config set registry https://registry.npmjs.org/ > /dev/null 2>&1 || true
fi

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 解析命令行参数
SKIP_DEPS=false
ENABLE_SIGN=false
HTTP_PROXY_ADDR=""
HTTPS_PROXY_ADDR=""
USE_MIRROR=false

for arg in "$@"; do
    case $arg in
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --sign)
            ENABLE_SIGN=true
            shift
            ;;
        --proxy=*)
            HTTP_PROXY_ADDR="${arg#*=}"
            HTTPS_PROXY_ADDR="${arg#*=}"
            shift
            ;;
        --mirror)
            USE_MIRROR=true
            shift
            ;;
        --help)
            echo "用法: ./build-deb.sh [选项]"
            echo ""
            echo "选项:"
            echo "  --skip-deps       跳过依赖安装步骤"
            echo "  --sign            启用DEB包签名"
            echo "  --proxy=URL       设置HTTP/HTTPS代理 (例如: --proxy=http://127.0.0.1:7890)"
            echo "  --mirror          使用国内镜像源(淘宝镜像)"
            echo "  --help            显示此帮助信息"
            exit 0
            ;;
    esac
done

# 设置代理环境变量（如果指定）
if [ -n "$HTTP_PROXY_ADDR" ]; then
    export HTTP_PROXY="$HTTP_PROXY_ADDR"
    export HTTPS_PROXY="$HTTPS_PROXY_ADDR"
    export http_proxy="$HTTP_PROXY_ADDR"
    export https_proxy="$HTTPS_PROXY_ADDR"
    print_info "使用代理: $HTTP_PROXY_ADDR"
fi

# 设置镜像源（如果指定）
if [ "$USE_MIRROR" = true ]; then
    export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
    export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
    print_info "使用淘宝镜像源: $ELECTRON_MIRROR"
fi

# 记录开始时间
START_TIME=$(date +%s)

print_info "=========================================="
print_info "Signal Desktop Linux DEB 打包脚本"
print_info "=========================================="

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    print_error "请在 Signal Desktop 项目根目录运行此脚本"
    exit 1
fi

# 检查Node.js版本
REQUIRED_NODE_VERSION=$(cat .nvmrc)
CURRENT_NODE_VERSION=$(node --version | sed 's/v//')
CURRENT_MAJOR_VERSION=$(echo $CURRENT_NODE_VERSION | cut -d'.' -f1)
REQUIRED_MAJOR_VERSION=$(echo $REQUIRED_NODE_VERSION | cut -d'.' -f1)

print_info "需要的 Node.js 版本: $REQUIRED_NODE_VERSION"
print_info "当前 Node.js 版本: $CURRENT_NODE_VERSION"

if [ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]; then
    if [ "$CURRENT_MAJOR_VERSION" != "$REQUIRED_MAJOR_VERSION" ]; then
        print_error "Node.js 主版本不匹配！当前 $CURRENT_MAJOR_VERSION，需要 $REQUIRED_MAJOR_VERSION"
        print_error "运行: nvm install $REQUIRED_NODE_VERSION && nvm use $REQUIRED_NODE_VERSION"
        exit 1
    else
        print_warning "Node.js 小版本不同，但主版本匹配，继续构建..."
    fi
fi

# 检查pnpm是否安装
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm 未安装，请先安装 pnpm"
    print_info "运行: npm install -g pnpm@10.6.4"
    exit 1
fi

print_success "pnpm 版本: $(pnpm --version)"

# 检查必要的系统依赖
print_info "检查系统依赖..."
MISSING_DEPS=""

for dep in git python3 make g++; do
    if ! command -v $dep &> /dev/null; then
        MISSING_DEPS="$MISSING_DEPS $dep"
    fi
done

if [ -n "$MISSING_DEPS" ]; then
    print_error "缺少以下系统依赖:$MISSING_DEPS"
    print_info "运行以下命令安装: sudo apt-get install -y$MISSING_DEPS"
    exit 1
fi

# 安装依赖
if [ "$SKIP_DEPS" = false ]; then
    print_info "安装 Node.js 依赖..."

    # 尝试安装依赖，如果失败提供帮助信息
    if ! pnpm install; then
        print_error "依赖安装失败"
        print_info ""
        print_info "可能的解决方案:"
        print_info "1. 如果遇到网络问题，请尝试使用镜像源:"
        print_info "   ./build-deb.sh --mirror"
        print_info ""
        print_info "2. 或者使用代理:"
        print_info "   ./build-deb.sh --proxy=http://127.0.0.1:7890"
        print_info ""
        print_info "3. 检查网络连接:"
        print_info "   curl -I https://build-artifacts.signal.org"
        print_info ""
        print_info "4. 如果已经安装过依赖，可以跳过此步骤:"
        print_info "   ./build-deb.sh --skip-deps"
        print_info ""
        print_info "5. 手动下载 ringrtc 预构建文件:"
        print_info "   下载: https://build-artifacts.signal.org/libraries/ringrtc-desktop-build-v2.56.0.tar.gz"
        print_info "   放置到: node_modules/@signalapp/ringrtc/scripts/prebuild.tar.gz"
        print_info "   然后重新运行脚本"
        exit 1
    fi

    print_success "依赖安装完成"
else
    print_warning "跳过依赖安装步骤"
fi

# 清理之前的构建
print_info "清理之前的构建文件..."
rm -rf release/*.deb
rm -rf dist/
print_success "清理完成"

# 生成必要的文件
print_info "生成项目文件..."
pnpm run generate
print_success "文件生成完成"

# 构建生产版本
print_info "开始构建生产版本（这可能需要几分钟）..."
pnpm run build:esbuild:prod
print_success "代码编译完成"

# 打包DEB文件
print_info "打包 DEB 文件..."
if ! SIGNAL_ENV=production pnpm run build:electron --linux deb --config.directories.output=release --publish=never; then
    print_error "DEB 包打包失败"
    print_info ""
    print_info "可能的原因:"
    print_info "1. 网络问题（无法下载 Electron）"
    print_info "   - 下载地址: https://github.com/electron/electron/releases/"
    print_info "   - 需要的版本可在 package.json 中查看"
    print_info ""
    print_info "2. 磁盘空间不足"
    print_info "   - 检查: df -h"
    print_info ""
    print_info "解决方案:"
    print_info "1. 使用国内镜像源重新运行:"
    print_info "   ./build-deb.sh --skip-deps --mirror"
    print_info ""
    print_info "2. 使用代理重新运行:"
    print_info "   ./build-deb.sh --skip-deps --proxy=http://127.0.0.1:7890"
    print_info ""
    print_info "3. 手动下载 Electron 并缓存:"
    print_info "   - 下载 electron-v*.*.zip"
    print_info "   - 放置到: ~/.cache/electron/"
    print_info ""
    print_info "4. 检查构建日志了解详细错误"
    exit 1
fi
print_success "DEB 包打包完成"

# 签名DEB包（如果启用）
if [ "$ENABLE_SIGN" = true ]; then
    print_info "=========================================="
    print_info "DEB 包签名配置"
    print_info "=========================================="

    # 检查GPG密钥
    if ! gpg --list-keys &> /dev/null; then
        print_warning "未找到 GPG 密钥，需要创建新密钥"
        print_info "创建 GPG 密钥..."

        # 创建GPG密钥配置文件
        cat > /tmp/gpg-key-config <<EOF
%echo Generating Signal Desktop signing key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: Signal Desktop Builder
Name-Email: builder@localhost
Expire-Date: 0
%no-protection
%commit
%echo Done
EOF

        gpg --batch --generate-key /tmp/gpg-key-config
        rm /tmp/gpg-key-config
        print_success "GPG 密钥创建完成"
    fi

    # 获取密钥ID
    GPG_KEY_ID=$(gpg --list-keys --with-colons | grep "^pub" | cut -d: -f5 | head -n1)
    print_info "使用 GPG 密钥: $GPG_KEY_ID"

    # 签名所有DEB包
    print_info "签名 DEB 包..."
    for deb in release/*.deb; do
        if [ -f "$deb" ]; then
            print_info "签名: $(basename $deb)"
            dpkg-sig --sign builder -k $GPG_KEY_ID "$deb"
            print_success "$(basename $deb) 签名完成"
        fi
    done

    # 导出公钥
    GPG_PUBLIC_KEY="release/signal-desktop-gpg-public.key"
    gpg --armor --export $GPG_KEY_ID > $GPG_PUBLIC_KEY
    print_success "GPG 公钥已导出到: $GPG_PUBLIC_KEY"
    print_info "用户可以使用此公钥验证 DEB 包: gpg --import $GPG_PUBLIC_KEY"
fi

# 显示构建结果
print_info "=========================================="
print_success "构建完成！"
print_info "=========================================="

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

print_info "总耗时: ${MINUTES}分${SECONDS}秒"
print_info ""
print_info "DEB 包位置:"
for deb in release/*.deb; do
    if [ -f "$deb" ]; then
        SIZE=$(du -h "$deb" | cut -f1)
        print_success "  $(basename $deb) ($SIZE)"
    fi
done

print_info ""
print_info "安装命令:"
for deb in release/*.deb; do
    if [ -f "$deb" ]; then
        echo "  sudo dpkg -i $deb"
        echo "  sudo apt-get install -f  # 安装缺失的依赖"
    fi
done

# 生成安装脚本
INSTALL_SCRIPT="release/install.sh"
cat > $INSTALL_SCRIPT <<'INSTALL_EOF'
#!/bin/bash
# Signal Desktop 安装脚本

set -e

# 查找DEB文件
DEB_FILE=$(find . -name "signal-desktop*.deb" -type f | head -n1)

if [ -z "$DEB_FILE" ]; then
    echo "错误: 未找到 DEB 文件"
    exit 1
fi

echo "找到 DEB 文件: $DEB_FILE"
echo "开始安装..."

# 安装DEB包
sudo dpkg -i "$DEB_FILE"

# 修复依赖
echo "修复依赖..."
sudo apt-get install -f -y

echo "安装完成！"
echo "运行 'signal-desktop' 或从应用菜单启动 Signal"
INSTALL_EOF

chmod +x $INSTALL_SCRIPT
print_success "已生成安装脚本: $INSTALL_SCRIPT"

print_info ""
print_success "所有任务完成！"
