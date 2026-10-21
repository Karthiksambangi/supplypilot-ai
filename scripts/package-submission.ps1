param(
  [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'SupplyPilotAI-submission.zip')
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$archivePath = [System.IO.Path]::GetFullPath($OutputPath)
$stagingPath = Join-Path $env:TEMP ("supplypilot-submission-" + [guid]::NewGuid().ToString('N'))

$examplePath = Join-Path $projectRoot '.env.example'
$credentialNames = @('PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'GEMINI_API_KEY')
foreach ($line in Get-Content $examplePath) {
  if ($line -match '^\s*([^#=]+)=(.*)$' -and $credentialNames -contains $Matches[1].Trim() -and $Matches[2].Trim()) {
    throw 'Refusing to package: .env.example contains a non-empty credential field.'
  }
}

$includedFiles = @(
  'README.md', 'HACKATHON.md', '.gitignore', '.env.example', 'LICENSE', 'package.json',
  'client/package.json', 'client/package-lock.json', 'client/index.html', 'client/vite.config.js',
  'server/index.js', 'server/offers.js', 'server/index.test.js', 'scripts/package-submission.ps1', 'scripts/start-local.js'
)
$includedFiles += Get-ChildItem (Join-Path $projectRoot 'client/src') -File -Recurse | ForEach-Object {
  $_.FullName.Substring($projectRoot.Length).TrimStart([char] '\', [char] '/')
}

if (Test-Path -LiteralPath $archivePath) {
  throw 'Refusing to overwrite an existing submission archive.'
}

try {
  New-Item -ItemType Directory -Path $stagingPath | Out-Null
  foreach ($relativePath in $includedFiles) {
    $sourcePath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw "Required submission file is missing: $relativePath"
    }
    $destinationPath = Join-Path $stagingPath $relativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory($stagingPath, $archivePath)
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $unsafeEntries = @($zip.Entries | Where-Object {
      $name = $_.FullName.Replace('\', '/')
      $leaf = [System.IO.Path]::GetFileName($name)
      ($leaf -eq '.env' -or ($leaf.StartsWith('.env.') -and $leaf -ne '.env.example')) -or
        $name -match '(^|/)node_modules/'
    })
    if ($unsafeEntries.Count) {
      throw 'Submission archive safety check failed.'
    }
  } finally {
    $zip.Dispose()
  }
  Write-Output "Created a submission archive with $($includedFiles.Count) allowlisted files."
} catch {
  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
  throw
} finally {
  if (Test-Path -LiteralPath $stagingPath) { Remove-Item -LiteralPath $stagingPath -Recurse -Force }
}
