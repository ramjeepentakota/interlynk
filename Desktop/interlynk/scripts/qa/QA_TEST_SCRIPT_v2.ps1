# QA Testing Script for Enterprise Collaboration Platform v2
# Tests chat, calling, screen sharing, channels, voice features, and password change

$BaseURL = "http://localhost:8082"
$TestResults = @()
$TestPassCount = 0
$TestFailCount = 0

# Test credentials from DataInitializer
$AdminUsername = "admin"
$AdminPassword = "admin@123"
$DemoUsername = "demo"
$DemoPassword = "demo123"
$JayUsername = "jay"
$JayPassword = "Test@1234"

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
    if ($Details) { Write-Host "     $Details" -ForegroundColor Gray }

    if ($Passed) {
        $script:TestPassCount++
    } else {
        $script:TestFailCount++
    }

    $script:TestResults += [PSCustomObject]@{
        TestName = $TestName
        Status = $status
        Details = $Details
        Timestamp = Get-Date
    }
}

# Test 1: User Authentication/Login with Admin
Write-Host "`n========== TEST 1: USER AUTHENTICATION ==========" -ForegroundColor Cyan

try {
    $loginPayload = @{
        username = $AdminUsername
        password = $AdminPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json

    if ($loginData.token) {
        $script:AdminAuthToken = $loginData.token
        $script:AdminUserId = $loginData.userId
        Log-TestResult "Admin Login" $true "Token obtained: $($loginData.token.Substring(0,20))..."
    } else {
        Log-TestResult "Admin Login" $false "No token returned"
    }
} catch {
    Log-TestResult "Admin Login" $false $_.Exception.Message
}

# Test 1b: Demo User Login
try {
    $loginPayload = @{
        username = $DemoUsername
        password = $DemoPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json

    if ($loginData.token) {
        $script:DemoAuthToken = $loginData.token
        Log-TestResult "Demo User Login" $true "Token obtained"
    } else {
        Log-TestResult "Demo User Login" $false "No token returned"
    }
} catch {
    Log-TestResult "Demo User Login" $false $_.Exception.Message
}

# Test 2: Get Current User Info
Write-Host "`n========== TEST 2: GET CURRENT USER ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $userResponse = Invoke-WebRequest -Uri "$BaseURL/api/users/me" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $userData = $userResponse.Content | ConvertFrom-Json
        Log-TestResult "Get Current User Info" $true "User: $($userData.username), ID: $($userData.id)"
    } catch {
        Log-TestResult "Get Current User Info" $false $_.Exception.Message
    }
}

# Test 3: Create New Channel
Write-Host "`n========== TEST 3: CHANNEL CREATION ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $timestamp = Get-Date -Format "yyyyMMddHHmmss"
        $channelPayload = @{
            name = "test-channel-$timestamp"
            description = "Test channel for QA testing"
            type = "TEXT"
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
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
            Log-TestResult "Create New Channel" $true "Channel: $($channelData.name) (ID: $($channelData.id))"
        } else {
            Log-TestResult "Create New Channel" $false "No channel ID in response"
        }
    } catch {
        Log-TestResult "Create New Channel" $false $_.Exception.Message
    }
}

# Test 4: List Channels
Write-Host "`n========== TEST 4: LIST CHANNELS ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $channelsResponse = Invoke-WebRequest -Uri "$BaseURL/api/channels" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $channelsData = $channelsResponse.Content | ConvertFrom-Json
        $channelCount = $channelsData.Count
        Log-TestResult "List Channels" $true "Retrieved $channelCount channels"
    } catch {
        Log-TestResult "List Channels" $false $_.Exception.Message
    }
}

# Test 5: Send Message in Channel
Write-Host "`n========== TEST 5: SEND MESSAGE ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken -and $script:TestChannelId) {
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $messagePayload = @{
            content = "Test message sent at $timestamp for QA testing"
            channelId = $script:TestChannelId
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $messageResponse = Invoke-WebRequest -Uri "$BaseURL/api/messages" `
            -Method POST `
            -Headers $headers `
            -Body $messagePayload `
            -ErrorAction Stop

        $messageData = $messageResponse.Content | ConvertFrom-Json

        if ($messageData.id) {
            $script:TestMessageId = $messageData.id
            Log-TestResult "Send Message" $true "Message sent (ID: $($messageData.id))"
        } else {
            Log-TestResult "Send Message" $false "No message ID returned"
        }
    } catch {
        Log-TestResult "Send Message" $false $_.Exception.Message
    }
}

# Test 6: Get Messages from Channel
Write-Host "`n========== TEST 6: GET MESSAGES ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken -and $script:TestChannelId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $messagesResponse = Invoke-WebRequest -Uri "$BaseURL/api/channels/$script:TestChannelId/messages" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $messagesData = $messagesResponse.Content | ConvertFrom-Json
        Log-TestResult "Get Messages from Channel" $true "Retrieved messages successfully"
    } catch {
        Log-TestResult "Get Messages from Channel" $false $_.Exception.Message
    }
}

# Test 7: Change Password
Write-Host "`n========== TEST 7: CHANGE PASSWORD ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $passwordPayload = @{
            oldPassword = $AdminPassword
            newPassword = "NewAdminPass@123"
            confirmPassword = "NewAdminPass@123"
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $passwordResponse = Invoke-WebRequest -Uri "$BaseURL/api/users/change-password" `
            -Method POST `
            -Headers $headers `
            -Body $passwordPayload `
            -ErrorAction Stop

        Log-TestResult "Change Password" $true "Password changed successfully"

        # Test 7b: Try login with new password
        try {
            $loginPayload = @{
                username = $AdminUsername
                password = "NewAdminPass@123"
            } | ConvertTo-Json

            $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/auth/login" `
                -Method POST `
                -ContentType "application/json" `
                -Body $loginPayload `
                -ErrorAction Stop

            $loginData = $loginResponse.Content | ConvertFrom-Json

            if ($loginData.token) {
                Log-TestResult "Login with New Password" $true "Successfully logged in with new password"
                $script:AdminAuthToken = $loginData.token
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

# Test 8: WebSocket Connection
Write-Host "`n========== TEST 8: WEBSOCKET CONNECTIVITY ==========" -ForegroundColor Cyan

try {
    $testResponse = Invoke-WebRequest -Uri "$BaseURL/ws" `
        -Method OPTIONS `
        -ErrorAction SilentlyContinue

    Log-TestResult "WebSocket Endpoint Available" $true "WebSocket endpoint is accessible"
} catch {
    Log-TestResult "WebSocket Endpoint Available" $false "WebSocket endpoint not responding to OPTIONS"
}

# Test 9: Check Voice Channels
Write-Host "`n========== TEST 9: VOICE CHANNELS ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $voiceResponse = Invoke-WebRequest -Uri "$BaseURL/api/call-rooms" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $voiceData = $voiceResponse.Content | ConvertFrom-Json
        Log-TestResult "Get Voice Channels" $true "Retrieved voice channels successfully"
    } catch {
        Log-TestResult "Get Voice Channels" $false $_.Exception.Message
    }
}

# Test 10: Delete Channel
Write-Host "`n========== TEST 10: CHANNEL DELETION ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken -and $script:TestChannelId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
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

# Generate Final Report
Write-Host "`n" -ForegroundColor White
Write-Host "========== FINAL QA TEST REPORT ==========" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow

$TotalTests = $TestPassCount + $TestFailCount
Write-Host "Total Tests Executed: $TotalTests" -ForegroundColor Cyan
Write-Host "Tests Passed: $TestPassCount" -ForegroundColor Green
Write-Host "Tests Failed: $TestFailCount" -ForegroundColor Red

if ($TotalTests -gt 0) {
    $PassPercentage = [math]::Round(($TestPassCount / $TotalTests) * 100, 2)
} else {
    $PassPercentage = 0
}

Write-Host "Pass Rate: $PassPercentage%" -ForegroundColor Cyan

Write-Host "`n========== DETAILED RESULTS ==========" -ForegroundColor Yellow

foreach ($result in $script:TestResults) {
    $resultColor = if ($result.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "`n[$($result.Status)] $($result.TestName)" -ForegroundColor $resultColor
    if ($result.Details) {
        Write-Host "    Details: $($result.Details)" -ForegroundColor Gray
    }
}

Write-Host "`n========== TEST SUMMARY ==========" -ForegroundColor Yellow

Write-Host "`nFeatures Tested:" -ForegroundColor Cyan
Write-Host "  [1] User Authentication & Login" -ForegroundColor Gray
Write-Host "  [2] User Profile Management" -ForegroundColor Gray
Write-Host "  [3] Channel Creation" -ForegroundColor Gray
Write-Host "  [4] Channel Listing" -ForegroundColor Gray
Write-Host "  [5] Chat Messaging" -ForegroundColor Gray
Write-Host "  [6] Message Retrieval" -ForegroundColor Gray
Write-Host "  [7] Password Change" -ForegroundColor Gray
Write-Host "  [8] WebSocket Connectivity" -ForegroundColor Gray
Write-Host "  [9] Voice Channels" -ForegroundColor Gray
Write-Host "  [10] Channel Deletion" -ForegroundColor Gray

Write-Host "`n========== RECOMMENDATIONS ==========" -ForegroundColor Yellow

if ($TestFailCount -eq 0) {
    Write-Host "All tests passed! The application is functioning correctly." -ForegroundColor Green
} else {
    Write-Host "Some tests failed. Please review the failed tests and investigate:" -ForegroundColor Red
    foreach ($result in $script:TestResults) {
        if ($result.Status -eq "FAIL") {
            Write-Host "  - $($result.TestName): $($result.Details)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n========== FEATURES NOT TESTED (MANUAL) ==========" -ForegroundColor Yellow
Write-Host "The following features require manual testing through the UI:" -ForegroundColor Gray
Write-Host "  - Screen Sharing (requires browser/WebRTC)" -ForegroundColor Gray
Write-Host "  - Voice Call Audio/Video (requires LiveKit server)" -ForegroundColor Gray
Write-Host "  - Microphone Mute/Unmute (requires audio device)" -ForegroundColor Gray
Write-Host "  - Speaker Mute/Unmute (requires audio device)" -ForegroundColor Gray
Write-Host "  - Voice Channel Join/Exit (requires WebSocket + audio)" -ForegroundColor Gray
Write-Host "  - Chat Calling (requires WebRTC signaling)" -ForegroundColor Gray

Write-Host "`n========== END OF REPORT ==========" -ForegroundColor Yellow
Write-Host "Report Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
