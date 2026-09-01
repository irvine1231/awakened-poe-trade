#Requires -Version 5.1
<#
.SYNOPSIS
  Build and optionally publish an -irvine release to your GitHub fork.

.DESCRIPTION
  Reads GH_TOKEN from .env (repo root), builds the renderer and main, then
  packages the Windows exe. With -Publish it uploads a GitHub release
  (installer + portable exe + latest.yml) to the repo configured in
  main/electron-builder.yml (irvine1231/awakened-poe-trade).

.EXAMPLE
  .\release.ps1
  Build + package locally into main\dist\ (no upload).

.EXAMPLE
  .\release.ps1 -Publish
  Build + package + upload a DRAFT GitHub release to your fork.

.EXAMPLE
  .\release.ps1 -Publish -SkipRenderer
  Same, but reuse the existing renderer\dist (skip rebuilding the UI).
#>
[CmdletBinding()]
param(
  [switch]$Publish,
  [switch]$SkipRenderer
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# Run a native command and fail the script if it returns a non-zero exit code.
function Run {
  param(
    [Parameter(Mandatory)][string]$Exe,
    [Parameter(ValueFromRemainingArguments)][string[]]$Rest
  )
  Write-Host "  > $Exe $($Rest -join ' ')" -ForegroundColor DarkGray
  & $Exe @Rest
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): $Exe $($Rest -join ' ')"
  }
}

# --- load .env into the process environment ---
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
  throw "Missing .env at $envFile`nCopy .env.example to .env and set GH_TOKEN=<your token>."
}
foreach ($line in Get-Content $envFile) {
  $t = $line.Trim()
  if ($t -eq '' -or $t.StartsWith('#')) { continue }
  $i = $t.IndexOf('=')
  if ($i -lt 1) { continue }
  $key = $t.Substring(0, $i).Trim()
  $val = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  Set-Item -Path ("Env:" + $key) -Value $val
}

if ($Publish -and [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
  throw "GH_TOKEN is empty in .env — required for publishing."
}

$version = (Get-Content (Join-Path $root 'main\package.json') -Raw | ConvertFrom-Json).version
Write-Host "==> Release version $version  (publish = $($Publish.IsPresent))" -ForegroundColor Cyan

# --- renderer ---
if (-not $SkipRenderer) {
  Write-Host "==> Building renderer" -ForegroundColor Cyan
  Push-Location (Join-Path $root 'renderer')
  try {
    if (-not (Test-Path 'node_modules')) { Run yarn install }
    Run yarn build
  } finally { Pop-Location }
}

# --- main + package ---
Write-Host "==> Building main" -ForegroundColor Cyan
Push-Location (Join-Path $root 'main')
try {
  if (-not (Test-Path 'node_modules')) { Run yarn install }
  Run yarn build

  $policy = if ($Publish) { 'always' } else { 'never' }
  Write-Host "==> Packaging (publish policy: $policy)" -ForegroundColor Cyan
  Run yarn electron-builder build --publish $policy
} finally { Pop-Location }

Write-Host "==> Done. Artifacts in main\dist\" -ForegroundColor Green
if ($Publish) {
  Write-Host "    A DRAFT release was created on your fork - review and publish it on GitHub." -ForegroundColor Yellow
}
