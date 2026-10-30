# One-time setup: creates the database, loads sample data and writes the .env files.
# Run with setup.bat. It asks for the MySQL root password and keeps it only in backend\.env.
param(
  [int]$Port = 3306,
  [string]$MySqlBin = '',
  [string]$RootPassword = $null
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not $MySqlBin) {
  $found = Get-ChildItem 'C:\Program Files\MySQL' -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\mysql.exe') } | Select-Object -First 1
  if (-not $found) { throw 'MySQL was not found in C:\Program Files\MySQL. Install it first.' }
  $MySqlBin = Join-Path $found.FullName 'bin'
}
$mysql = Join-Path $MySqlBin 'mysql.exe'

if ($PSBoundParameters.ContainsKey('RootPassword')) {
  $password = $RootPassword
} else {
  $secure = Read-Host 'Enter your MySQL root password' -AsSecureString
  $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

# The password goes in a temporary options file, deleted at the end, so it never
# appears on a command line.
$optionsFile = Join-Path $env:TEMP "library-setup-$PID.cnf"
$escaped = $password.Replace('\', '\\').Replace('"', '\"')
$utf8 = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText($optionsFile, "[client]`npassword=`"$escaped`"`n", $utf8)

function Invoke-MySql([string]$Sql, [string[]]$Extra = @()) {
  Push-Location $root
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $mysql "--defaults-extra-file=$optionsFile" -h 127.0.0.1 -P $Port -u root --default-character-set=utf8mb4 @Extra -e $Sql 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output | Out-String) }
    return $output
  } finally { Pop-Location }
}

# Feeds a .sql file to mysql on standard input, because PowerShell has no < operator.
function Invoke-MySqlFile([string]$File, [string]$Extra = '') {
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = $mysql
  $start.Arguments = "--defaults-extra-file=`"$optionsFile`" -h 127.0.0.1 -P $Port -u root --default-character-set=utf8mb4 $Extra"
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($start)
  $errors = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write([IO.File]::ReadAllText((Join-Path $root $File)))
  $process.StandardInput.Close()
  $output = $process.StandardOutput.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw $errors.Result }
  return $output
}

function New-Secret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

try {
Write-Host 'Connecting to MySQL...'
Invoke-MySql 'SELECT 1' | Out-Null

$existing = Invoke-MySql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'smart_library' AND table_name = 'users'" @('-N')
if ([int]("$existing".Trim()) -gt 0) {
  Write-Host 'Database smart_library already exists, so it was left unchanged.'
} else {
  Write-Host 'Creating tables and loading sample data...'
  Invoke-MySqlFile 'database/schema.sql' | Out-Null
  Invoke-MySqlFile 'database/seed.sql' | Out-Null
}

Write-Host 'Checking data integrity...'
Invoke-MySqlFile 'database/verify.sql' '--table' | Write-Host

$serviceKey = New-Secret 24
$backendEnv = @"
PORT=5000
CLIENT_ORIGIN=http://localhost:5180

DB_HOST=127.0.0.1
DB_PORT=$Port
DB_NAME=smart_library
DB_USER=root
DB_PASSWORD='$password'
DB_TIMEZONE=+05:30

JWT_SECRET=$(New-Secret 48)
JWT_EXPIRES_IN=8h

ML_SERVICE_URL=http://127.0.0.1:8001
ML_SERVICE_KEY=$serviceKey
ML_TIMEOUT_MS=3000
"@
[IO.File]::WriteAllText((Join-Path $root 'backend\.env'), $backendEnv, $utf8)
[IO.File]::WriteAllText((Join-Path $root 'ml-service\.env'), "SERVICE_KEY=$serviceKey`n", $utf8)

} finally {
  Remove-Item $optionsFile -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'Setup complete. Double-click start.bat to run the project.'
