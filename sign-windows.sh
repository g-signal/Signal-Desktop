#!/bin/bash
# Windows Code Signing Script
# This script signs Windows executables using signtool and the certificate

set -e

# Check if target file is provided
if [ -z "$1" ]; then
  echo "Error: No target file specified"
  echo "Usage: $0 <path-to-file>"
  exit 1
fi

TARGET_FILE="$1"

echo "====================================="
echo "Signing Windows Application"
echo "====================================="
echo "Target: $TARGET_FILE"
echo ""

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/build/codesign.conf"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file not found: $CONFIG_FILE"
  echo "Please run create-certificate.ps1 first to generate the certificate"
  exit 1
fi

# Source the configuration
source "$CONFIG_FILE"

# Check if certificate exists
CERT_PATH="$SCRIPT_DIR/$CERTIFICATE_PATH"
if [ ! -f "$CERT_PATH" ]; then
  echo "Error: Certificate file not found: $CERT_PATH"
  echo "Please run create-certificate.ps1 first to generate the certificate"
  exit 1
fi

echo "Using certificate: $CERT_PATH"
echo "Certificate SHA1: $CERTIFICATE_SHA1"
echo ""

# Find signtool.exe
# Common locations for Windows SDK
SIGNTOOL_PATHS=(
  "C:/Program Files (x86)/Windows Kits/10/bin/10.0.22621.0/x64/signtool.exe"
  "C:/Program Files (x86)/Windows Kits/10/bin/10.0.22000.0/x64/signtool.exe"
  "C:/Program Files (x86)/Windows Kits/10/bin/10.0.19041.0/x64/signtool.exe"
  "C:/Program Files (x86)/Windows Kits/10/bin/x64/signtool.exe"
  "C:/Program Files/Microsoft SDKs/Windows/v7.1/Bin/signtool.exe"
)

SIGNTOOL=""
for path in "${SIGNTOOL_PATHS[@]}"; do
  if [ -f "$path" ]; then
    SIGNTOOL="$path"
    echo "Found signtool: $SIGNTOOL"
    break
  fi
done

if [ -z "$SIGNTOOL" ]; then
  # Try to find signtool in PATH
  if command -v signtool.exe &> /dev/null; then
    SIGNTOOL="signtool.exe"
    echo "Found signtool in PATH"
  else
    echo "Error: signtool.exe not found"
    echo "Please install Windows SDK from:"
    echo "https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/"
    echo ""
    echo "Or add signtool.exe to your PATH"
    exit 1
  fi
fi

echo ""
echo "Signing file..."

# Sign the file
# Using SHA256 algorithm for better security
"$SIGNTOOL" sign \
  /f "$CERT_PATH" \
  /p "$CERTIFICATE_PASSWORD" \
  /fd SHA256 \
  /tr http://timestamp.digicert.com \
  /td SHA256 \
  /v \
  "$TARGET_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "====================================="
  echo "File signed successfully!"
  echo "====================================="
  echo ""

  # Verify the signature
  echo "Verifying signature..."
  "$SIGNTOOL" verify /pa /v "$TARGET_FILE"

  if [ $? -eq 0 ]; then
    echo ""
    echo "Signature verified successfully!"
  else
    echo ""
    echo "Warning: Signature verification failed"
    echo "This is expected for self-signed certificates"
  fi
else
  echo ""
  echo "Error: Failed to sign file"
  exit 1
fi

exit 0
