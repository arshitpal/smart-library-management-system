# Loads the database into a hosted MySQL service and replaces all public sample passwords.
# Run with deploy-db.bat. Details come from the service's page, such as Aiven's Overview tab.
param(
  [string]$DbHost,
  [int]$Port,
  [string]$User,
  [string]$Password = $null,
  [string]$CaPath,
  [string]$MySqlBin = ''
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not $MySqlBin) {
  $found = Get-ChildItem 'C:\Program Files\MySQL' -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\mysql.exe') } | Select-Object -First 1
  if (-not $found) { throw 'MySQL was not found in C:\Program Files\MySQL.' }
  $MySqlBin = Join-Path $found.FullName 'bin'
}
$mysql = Join-Path $MySqlBin 'mysql.exe'

if (-not $DbHost) { $DbHost = Read-Host 'Host' }
if (-not $Port) { $Port = [int](Read-Host 'Port') }
if (-not $User) { $User = Read-Host 'User' }
if (-not $CaPath) { $CaPath = (Read-Host 'Full path of the downloaded ca.pem file').Trim('"') }
if (-not (Test-Path $CaPath)) { throw "File not found: $CaPath" }
if (-not $PSBoundParameters.ContainsKey('Password')) {
  $secure = Read-Host 'Password' -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$optionsFile = Join-Path $env:TEMP "library-deploy-$PID.cnf"
$utf8 = New-Object System.Text.UTF8Encoding $false
$escaped = $Password.Replace('\', '\\').Replace('"', '\"')
[IO.File]::WriteAllText($optionsFile, "[client]`npassword=`"$escaped`"`n", $utf8)

function Invoke-MySql([string]$Sql, [string]$Extra = '') {
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = $mysql
  $start.Arguments = "--defaults-extra-file=`"$optionsFile`" -h $DbHost -P $Port -u $User --ssl-mode=VERIFY_CA --ssl-ca=`"$CaPath`" --default-character-set=utf8mb4 $Extra"
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($start)
  $errors = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($Sql)
  $process.StandardInput.Close()
  $output = $process.StandardOutput.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw $errors.Result }
  return $output
}

function Read-Sql([string]$File) { return [IO.File]::ReadAllText((Join-Path $root $File)) }

try {
  Write-Host 'Connecting...'
  $existing = Invoke-MySql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'smart_library' AND table_name = 'users';" '-N'
  if ([int]"$existing".Trim() -gt 0) {
    Write-Host 'Database smart_library already exists, so its tables were left unchanged.'
  } else {
    Write-Host 'Creating tables and loading sample data...'
    Invoke-MySql (Read-Sql 'database/schema.sql') | Out-Null
    Invoke-MySql (Read-Sql 'database/seed.sql') | Out-Null
  }
  Write-Host (Invoke-MySql (Read-Sql 'database/verify.sql') '--table')

  $env:DB_HOST = $DbHost
  $env:DB_PORT = "$Port"
  $env:DB_NAME = 'smart_library'
  $env:DB_USER = $User
  $env:DB_PASSWORD = $Password
  $env:DB_SSL = 'true'
  $env:DB_SSL_CA = [IO.File]::ReadAllText($CaPath)
  $env:JWT_SECRET = 'not-used-by-this-script'
  Push-Location (Join-Path $root 'backend')
  try {
    node scripts/set-passwords.js
    if ($LASTEXITCODE -ne 0) { throw 'Setting new passwords failed.' }
  } finally { Pop-Location }
} finally {
  Remove-Item $optionsFile -ErrorAction SilentlyContinue
}
