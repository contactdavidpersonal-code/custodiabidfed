# bootstrap-kms.ps1 - one-shot KMS migration for Vercel.
#
# What it does, end to end:
#   1. Prompts for ATTESTATION_SIGNING_KEY (SecureString - never echoes
#      to terminal, never stored on disk, never in shell history).
#   2. Runs scripts/bootstrap-kms-kek.ts which HKDF-derives the KEK
#      plaintext (matching the production code path) and KMS-encrypts
#      those bytes under alias/custodia-kek-prod. The ciphertext
#      output is harmless on its own - KMS + IAM are required to
#      decrypt it back.
#   3. Pushes the resulting ciphertext, KMS key id, AWS region, and
#      runtime AWS access keys to Vercel as Production env vars.
#   4. Wipes the secret from this shell session.
#
# Run from the project root:
#   .\scripts\bootstrap-kms.ps1
#
# Prerequisites:
#   - aws sts get-caller-identity returns the bootstrap user
#   - vercel whoami returns your Vercel account
#   - The repo is linked (vercel link) - the env ls output earlier
#     proves this is the case.

[CmdletBinding()]
param(
    [string]$KeyAlias = "alias/custodia-kek-prod",
    [string]$AwsRegion = "us-east-2",
    [string]$AwsAccessKeyId,
    [string]$AwsSecretAccessKey,
    [ValidateSet("production", "preview", "development")]
    [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================================="
Write-Host " Custodia BidFed - KMS bootstrap"
Write-Host "===================================================================="
Write-Host " KMS alias:    $KeyAlias"
Write-Host " AWS region:   $AwsRegion"
Write-Host " Vercel env:   $Environment"
Write-Host "===================================================================="
Write-Host ""

# 1. Paste the production ATTESTATION_SIGNING_KEY without echoing it.
Write-Host "Paste your production ATTESTATION_SIGNING_KEY value." -ForegroundColor Yellow
Write-Host "(It will not be displayed, logged, or stored on disk.)" -ForegroundColor Yellow
$secure = Read-Host -AsSecureString "ATTESTATION_SIGNING_KEY"
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
}
finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if (-not $plain -or $plain.Length -lt 32) {
    Write-Host "ERROR: pasted value looks too short (length=$($plain.Length))." -ForegroundColor Red
    exit 1
}

# 2. Run bootstrap script in a child process with the env var.
$env:ATTESTATION_SIGNING_KEY = $plain
$plain = $null

try {
    Write-Host ""
    Write-Host "Running KMS bootstrap..." -ForegroundColor Cyan
    $output = & npx tsx scripts/bootstrap-kms-kek.ts $KeyAlias 2>&1 | Out-String
}
finally {
    Remove-Item Env:ATTESTATION_SIGNING_KEY -ErrorAction SilentlyContinue
}

# 3. Parse the script output for the values we need.
$keyIdMatch = [regex]::Match($output, '(?m)^KMS_KEK_KEY_ID=(.+)$')
$ciphertextMatch = [regex]::Match($output, '(?m)^KMS_KEK_CIPHERTEXT=(.+)$')

if (-not $keyIdMatch.Success -or -not $ciphertextMatch.Success) {
    Write-Host "ERROR: could not parse KMS output. Raw:" -ForegroundColor Red
    Write-Host $output
    exit 1
}

$keyId = $keyIdMatch.Groups[1].Value.Trim()
$ciphertext = $ciphertextMatch.Groups[1].Value.Trim()

Write-Host ""
Write-Host "KMS encryption successful." -ForegroundColor Green
Write-Host "  KMS_KEK_KEY_ID:     $keyId"
$ctPreview = $ciphertext.Substring(0, 40)
$ctLen = $ciphertext.Length
Write-Host "  KMS_KEK_CIPHERTEXT: $ctPreview... [$ctLen chars total]"
Write-Host ""

# 4. Push to Vercel. We remove the existing var (if any) before adding.
function Push-VercelEnv {
    param(
        [string]$Name,
        [string]$Value,
        [string]$EnvName,
        [switch]$Sensitive
    )
    Write-Host "  Pushing $Name to Vercel [$EnvName]..." -NoNewline
    # Best effort remove (idempotent - ignore non-zero if it didn't exist).
    & vercel env rm $Name $EnvName --yes 2>&1 | Out-Null
    # Add fresh. Pipe value via stdin so it doesn't show in command line.
    $Value | & vercel env add $Name $EnvName 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host " FAILED" -ForegroundColor Red
        throw "vercel env add $Name failed (exit $LASTEXITCODE)"
    }
    Write-Host " OK" -ForegroundColor Green
}

Write-Host "Pushing KMS env vars to Vercel [$Environment]..." -ForegroundColor Cyan
Push-VercelEnv -Name "KMS_KEK_KEY_ID"     -Value $keyId      -EnvName $Environment
Push-VercelEnv -Name "KMS_KEK_CIPHERTEXT" -Value $ciphertext -EnvName $Environment
Push-VercelEnv -Name "AWS_REGION"          -Value $AwsRegion  -EnvName $Environment

if ($AwsAccessKeyId -and $AwsSecretAccessKey) {
    Push-VercelEnv -Name "AWS_ACCESS_KEY_ID"     -Value $AwsAccessKeyId     -EnvName $Environment
    Push-VercelEnv -Name "AWS_SECRET_ACCESS_KEY" -Value $AwsSecretAccessKey -EnvName $Environment
}
else {
    Write-Host ""
    Write-Host "AWS keys not provided as args; skipping AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY." -ForegroundColor Yellow
    Write-Host "Re-run with -AwsAccessKeyId AKIA... -AwsSecretAccessKey ... to push them, or set them manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===================================================================="
Write-Host " DONE." -ForegroundColor Green
Write-Host "===================================================================="
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Trigger a deploy: git commit --allow-empty -m 'redeploy: KMS' ; git push"
Write-Host "  2. After deploy, view an evidence artifact in the app to verify"
Write-Host "     KMS Decrypt path works."
Write-Host "  3. Check AWS CloudTrail for kms:Decrypt calls from custodia-kek-runtime."
Write-Host "  4. Mark the new env vars as 'Sensitive' in the Vercel dashboard."
Write-Host ""
