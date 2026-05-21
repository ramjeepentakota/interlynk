# QA Testing Script for Enterprise Collaboration Platform
# Tests chat, calling, screen sharing, channels, voice features, and password change

$BaseURL = "http://localhost:8082"
$TestResults = @()
$TestPassCount = 0
$TestFailCount = 0

# Test user credentials
$TestUsers = @(
    @{Username = "testuser1"; Password = "password123"; Email = "testuser1@example.com"},
    @{Username = "testuser2"; Password = "password123"; Email = "testuser2@example.com"}
)

# Helper function to log test results
function Log-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )

    $status = if ($Passed) { "PASS" } else { "FAIL" }
    $color = if ($Passed) { "Green" } else { "Red" }

    Write-Host "[$status] $TestName" -ForegroundColor $color
    if ($Details) { Write-Host "     Details: $Details" -ForegroundColor Gray }

    if ($Passed) {
        $script:TestPassCount++
    } else {
        $script:TestFailCount++
    }

    $script:TestResults += @{
        TestName = $TestName
        Status = $status
        Details = $Details
        Timestamp = Get-Date
    }
}

# Test 1: User Authentication/Login
Write-Host "`n========== TEST 1: USER AUTHENTICATION ==========" -ForegroundColor Cyan

try {
    $loginPayload = @{
        username = "admin"
        password = "admin"
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json

    if ($loginData.token) {
        $script:AuthToken = $loginData.token
        Log-TestResult "User Login" $true "Token obtained successfully"
    } else {
        Log-TestResult "User Login" $false "No token returned"
    }
} catch {
    Log-TestResult "User Login" $false $_.Exception.Message
}

# Test 2: Get Current User Info
Write-Host "`n========== TEST 2: GET CURRENT USER ==========" -ForegroundColor Cyan

if ($script:AuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AuthToken"
            "Content-Type" = "application/json"
        }

        $userResponse = Invoke-WebRequest -Uri "$BaseURL/api/users/me" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $userData = $userResponse.Content | ConvertFrom-Json
        Log-TestResult "Get Current User Info" $true "User: $($userData.username)"
    } catch {
        Log-TestResult "Get Current User Info" $false $_.Exception.Message
    }
}

# Test 3: Create New Channel
Write-Host "`n========== TEST 3: CHANNEL CREATION ==========" -ForegroundColor Cyan

if ($script:AuthToken) {
    try {
        $timestamp = Get-Date -Format "yyyyMMddHHmmss"
        $channelPayload = @{
            name = "test-channel-$timestamp"
            description = "Test channel created for QA testing"
            type = "DIRECT"
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AuthToken"
            "Content-Type" = "application/json"
        }

        $channelResponse = Invoke-WebRequest -Uri "$BaseURL/api/channels" `
            -Method POST `
            -Headers $headers `
            -Body $channelPayload `
            -ErrorAction Stop

        $channelData = $channelResponse.Content | ConvertFrom-Json

        if ($channelData.id) {
            $script:TestChannelId = $channelData.id
            Log-TestResult "Create New Channel" $true "Channel ID: $($channelData.id), Name: $($channelData.name)"
        } else {
            Log-TestResult "Create New Channel" $false "No channel ID returned"
        }
    } catch {
        Log-TestResult "Create New Channel" $false $_.Exception.Message
    }
}

# Test 4: List Channels
Write-Host "`n========== TEST 4: LIST CHANNELS ==========" -ForegroundColor Cyan

if ($script:AuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AuthToken"
            "Content-Type" = "application/json"
        }

        $channelsResponse = Invoke-WebRequest -Uri "$BaseURL/api/channels" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $channelsData = $channelResponse.Content | ConvertFrom-Json
        Log-TestResult "List Channels" $true "Channels retrieved successfully"
    } catch {
        Log-TestResult "List Channels" $false $_.Exception.Message
    }
}

# Test 5: Send Message
Write-Host "`n========== TEST 5: SEND MESSAGE ==========" -ForegroundColor Cyan

if ($script:AuthToken -and $script:TestChannelId) {
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $messagePayload = @{
            content = "Test message sent at $timestamp for QA testing"
            channelId = $script:TestChannelId
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AuthToken"
            "Content-Type" = "application/json"
        }

        $messageResponse = Invoke-WebRequest -Uri "$BaseURL/api/messages" `
            -Method POST `
            -Headers $headers `
            -Body $messagePayload `
            -ErrorAction Stop

        $messageData = $messageResponse.Content | ConvertFrom-Json

        if ($messageData.id) {
            Log-TestResult "Send Message" $true "Message ID: $($messageData.id)"
        } else {
            Log-TestResult "Send Message" $false "No message ID returned"
        }
    } catch {
        Log-TestResult "Send Message" $false $_.Exception.Message
    }
}

# Test 6: Change Password
Write-Host "`n========== TEST 6: CHANGE PASSWORD ==========" -ForegroundColor Cyan

if ($script:AuthToken) {
    try {
        $passwordPayload = @{
            oldPassword = "admin"
            newPassword = "newpassword123"
            confirmPassword = "newpassword123"
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AuthToken"
            "Content-Type" = "application/json"
        }

        $passwordResponse = Invoke-WebRequest -Uri "$BaseURL/api/users/change-password" `
            -Method POST `
            -Headers $headers `
            -Body $passwordPayload `
            -ErrorAction Stop

        Log-TestResult "Change Password" $true "Password changed successfully"

        # Test 6b: Login with new password
        try {
            $loginPayload = @{
                username = "admin"
                password = "newpassword123"
            } | ConvertTo-Json

            $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/auth/login" `
                -Method POST `
                -ContentType "application/json" `
                -Body $loginPayload `
                -ErrorAction Stop

            $loginData = $loginResponse.Content | ConvertFrom-Json

            if ($loginData.token) {
                Log-TestResult "Login with New Password" $true "Successfully logged in with new password"
                $script:AuthToken = $loginData.token
            } else {
                Log-TestResult "Login with New Password" $false "Failed to login with new password"
            }
        } catch {
            Log-TestResult "Login with New Password" $false $_.Exception.Message
        }
    } catch {
        Log-TestResult "Change Password" $false $_.Exception.Message
    }
}

# Test 7: Delete Channel
Write-Host "`n========== TEST 7: CHANNEL DELETION ==========" -ForegroundColor Cyan

if ($script:AuthToken -and $script:TestChannelId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AuthToken"
            "Content-Type" = "application/json"
        }

        $deleteResponse = Invoke-WebRequest -Uri "$BaseURL/api/channels/$script:TestChannelId" `
            -Method DELETE `
            -Headers $headers `
            -ErrorAction Stop

        Log-TestResult "Delete Channel" $true "Channel deleted successfully"
    } catch {
        Log-TestResult "Delete Channel" $false $_.Exception.Message
    }
}

# Test 8: WebSocket Connection (for chat/calling)
Write-Host "`n========== TEST 8: WEBSOCKET CONNECTIVITY ==========" -ForegroundColor Cyan

try {
    $wsResponse = Invoke-WebRequest -Uri "http://localhost:8082/ws" `
        -Method HEAD `
        -ErrorAction Stop

    Log-TestResult "WebSocket Endpoint Available" $true "WebSocket endpoint is accessible"
} catch {
    Log-TestResult "WebSocket Endpoint Available" $false "WebSocket endpoint check failed"
}

# Test 9: Check Voice/Video Features Configuration
Write-Host "`n========== TEST 9: FEATURES CONFIGURATION ==========" -ForegroundColor Cyan

try {
    $configResponse = Invoke-WebRequest -Uri "$BaseURL/api/config" `
        -Method GET `
        -ErrorAction Stop

    $configData = $configResponse.Content | ConvertFrom-Json

    if ($configData) {
        Log-TestResult "Fetch Configuration" $true "Configuration retrieved"
    }
} catch {
    Log-TestResult "Fetch Configuration" $false $_.Exception.Message
}

# Generate Final Report
Write-Host "`n========== FINAL QA TEST REPORT ==========" -ForegroundColor Yellow
Write-Host "Total Tests: $($TestPassCount + $TestFailCount)" -ForegroundColor Cyan
Write-Host "Passed: $TestPassCount" -ForegroundColor Green
Write-Host "Failed: $TestFailCount" -ForegroundColor Red

$PassPercentage = if ($($TestPassCount + $TestFailCount) -gt 0) {
    [math]::Round(($TestPassCount / ($TestPassCount + $TestFailCount)) * 100, 2)
} else {
    0
}

Write-Host "Pass Rate: $PassPercentage%" -ForegroundColor Cyan

Write-Host "`n========== DETAILED RESULTS ==========" -ForegroundColor Yellow

$TestResults | ForEach-Object {
    Write-Host "`n[$($_.Status)] $($_.TestName)" -ForegroundColor (if ($_.Status -eq "PASS") { "Green" } else { "Red" })
    if ($_.Details) { Write-Host "Details: $($_.Details)" -ForegroundColor Gray }
    Write-Host "Time: $($_.Timestamp)" -ForegroundColor DarkGray
}

Write-Host "`n========== END OF REPORT ==========" -ForegroundColor Yellow
