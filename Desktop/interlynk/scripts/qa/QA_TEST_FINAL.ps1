# QA Testing Script for Enterprise Collaboration Platform - FINAL
# Comprehensive testing for chat, calling, screen sharing, channels, voice, and password change

$BaseURL = "http://localhost:8082"
$APIVersion = "v1"
$TestResults = [System.Collections.ArrayList]@()
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

    $null = $script:TestResults.Add([PSCustomObject]@{
        TestName = $TestName
        Status = $status
        Details = $Details
        Timestamp = Get-Date
    })
}

# ========== TEST 1: USER AUTHENTICATION ==========
Write-Host "`n========== TEST 1: USER AUTHENTICATION ==========" -ForegroundColor Cyan

try {
    $loginPayload = @{
        username = $AdminUsername
        password = $AdminPassword
        rememberMe = $false
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json

    if ($loginData.accessToken) {
        $script:AdminAuthToken = $loginData.accessToken
        $script:AdminUserId = $loginData.user.id
        Log-TestResult "Admin Login" $true "User: $($loginData.user.username), ID: $($loginData.user.id)"
    } else {
        Log-TestResult "Admin Login" $false "No access token returned"
    }
} catch {
    Log-TestResult "Admin Login" $false $_.Exception.Message
}

# Test 1b: Demo User Login
try {
    $loginPayload = @{
        username = $DemoUsername
        password = $DemoPassword
        rememberMe = $false
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json

    if ($loginData.accessToken) {
        $script:DemoAuthToken = $loginData.accessToken
        Log-TestResult "Demo User Login" $true "User: $($loginData.user.username)"
    } else {
        Log-TestResult "Demo User Login" $false "No access token returned"
    }
} catch {
    Log-TestResult "Demo User Login" $false $_.Exception.Message
}

# ========== TEST 2: GET CURRENT USER ==========
Write-Host "`n========== TEST 2: GET CURRENT USER ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $userResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/auth/me" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $userData = $userResponse.Content | ConvertFrom-Json
        Log-TestResult "Get Current User Info" $true "User: $($userData.username) ($($userData.displayName))"
    } catch {
        Log-TestResult "Get Current User Info" $false $_.Exception.Message
    }
}

# ========== TEST 3: CHANNEL CREATION ==========
Write-Host "`n========== TEST 3: CHANNEL CREATION ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $timestamp = Get-Date -Format "yyyyMMddHHmmss"
        $channelPayload = @{
            name = "qa-test-channel-$timestamp"
            description = "Channel created for QA testing at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            isPrivate = $false
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $channelResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/channels" `
            -Method POST `
            -Headers $headers `
            -Body $channelPayload `
            -ErrorAction Stop

        $channelData = $channelResponse.Content | ConvertFrom-Json

        if ($channelData.id) {
            $script:TestChannelId = $channelData.id
            Log-TestResult "Create New Channel" $true "Channel: '$($channelData.name)' (ID: $($channelData.id))"
        } else {
            Log-TestResult "Create New Channel" $false "No channel ID in response"
        }
    } catch {
        Log-TestResult "Create New Channel" $false $_.Exception.Message
    }
}

# ========== TEST 4: LIST CHANNELS ==========
Write-Host "`n========== TEST 4: LIST CHANNELS ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $channelsResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/channels" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $channelsData = $channelsResponse.Content | ConvertFrom-Json
        $channelCount = if ($channelsData -is [array]) { $channelsData.Count } else { 1 }
        Log-TestResult "List Channels" $true "Retrieved $channelCount channel(s)"
    } catch {
        Log-TestResult "List Channels" $false $_.Exception.Message
    }
}

# ========== TEST 5: SEND MESSAGE ==========
Write-Host "`n========== TEST 5: SEND MESSAGE ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken -and $script:TestChannelId) {
    try {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $messagePayload = @{
            content = "QA Test Message sent at $timestamp"
            channelId = $script:TestChannelId
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $messageResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/messages" `
            -Method POST `
            -Headers $headers `
            -Body $messagePayload `
            -ErrorAction Stop

        $messageData = $messageResponse.Content | ConvertFrom-Json

        if ($messageData.id) {
            $script:TestMessageId = $messageData.id
            Log-TestResult "Send Message" $true "Message ID: $($messageData.id), Content: '$($messageData.content)'"
        } else {
            Log-TestResult "Send Message" $false "No message ID returned"
        }
    } catch {
        Log-TestResult "Send Message" $false $_.Exception.Message
    }
}

# ========== TEST 6: GET MESSAGES ==========
Write-Host "`n========== TEST 6: GET MESSAGES ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken -and $script:TestChannelId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $messagesResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/channels/$script:TestChannelId/messages" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $messagesData = $messagesResponse.Content | ConvertFrom-Json
        $messageCount = if ($messagesData -is [array]) { $messagesData.Count } else { 1 }
        Log-TestResult "Get Messages" $true "Retrieved $messageCount message(s) from channel"
    } catch {
        Log-TestResult "Get Messages" $false $_.Exception.Message
    }
}

# ========== TEST 7: CHANGE PASSWORD ==========
Write-Host "`n========== TEST 7: CHANGE PASSWORD ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $passwordPayload = @{
            currentPassword = $AdminPassword
            newPassword = "NewQAPass@123"
            confirmPassword = "NewQAPass@123"
        } | ConvertTo-Json

        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $passwordResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/auth/change-password" `
            -Method POST `
            -Headers $headers `
            -Body $passwordPayload `
            -ErrorAction Stop

        $responseData = $passwordResponse.Content | ConvertFrom-Json
        Log-TestResult "Change Password" $true "Password changed successfully"

        # Test 7b: Try login with new password
        try {
            $loginPayload = @{
                username = $AdminUsername
                password = "NewQAPass@123"
                rememberMe = $false
            } | ConvertTo-Json

            $loginResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/auth/login" `
                -Method POST `
                -ContentType "application/json" `
                -Body $loginPayload `
                -ErrorAction Stop

            $loginData = $loginResponse.Content | ConvertFrom-Json

            if ($loginData.accessToken) {
                Log-TestResult "Verify Password Change" $true "Successfully logged in with new password"
                $script:AdminAuthToken = $loginData.accessToken
            } else {
                Log-TestResult "Verify Password Change" $false "Failed to login with new password"
            }
        } catch {
            Log-TestResult "Verify Password Change" $false $_.Exception.Message
        }
    } catch {
        Log-TestResult "Change Password" $false $_.Exception.Message
    }
}

# ========== TEST 8: GET VOICE CHANNELS ==========
Write-Host "`n========== TEST 8: GET VOICE CHANNELS ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $voiceResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/call-rooms" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop

        $voiceData = $voiceResponse.Content | ConvertFrom-Json
        $roomCount = if ($voiceData -is [array]) { $voiceData.Count } else { 1 }
        Log-TestResult "Get Voice Channels" $true "Retrieved $roomCount voice channel(s)"
    } catch {
        Log-TestResult "Get Voice Channels" $false $_.Exception.Message
    }
}

# ========== TEST 9: DELETE CHANNEL ==========
Write-Host "`n========== TEST 9: CHANNEL DELETION ==========" -ForegroundColor Cyan

if ($script:AdminAuthToken -and $script:TestChannelId) {
    try {
        $headers = @{
            "Authorization" = "Bearer $script:AdminAuthToken"
            "Content-Type" = "application/json"
        }

        $deleteResponse = Invoke-WebRequest -Uri "$BaseURL/api/$APIVersion/channels/$script:TestChannelId" `
            -Method DELETE `
            -Headers $headers `
            -ErrorAction Stop

        Log-TestResult "Delete Channel" $true "Channel deleted successfully"
    } catch {
        Log-TestResult "Delete Channel" $false $_.Exception.Message
    }
}

# ========== TEST 10: API HEALTH CHECK ==========
Write-Host "`n========== TEST 10: API HEALTH CHECK ==========" -ForegroundColor Cyan

try {
    $healthResponse = Invoke-WebRequest -Uri "$BaseURL/actuator/health" `
        -Method GET `
        -ErrorAction Stop

    $healthData = $healthResponse.Content | ConvertFrom-Json
    Log-TestResult "API Health Check" $true "Status: $($healthData.status)"
} catch {
    Log-TestResult "API Health Check" $false $_.Exception.Message
}

# ========== GENERATE FINAL REPORT ==========

Write-Host "`n========== FINAL QA TEST REPORT ==========" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow

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

Write-Host "`n========== DETAILED TEST RESULTS ==========" -ForegroundColor Yellow

foreach ($result in $script:TestResults) {
    $statusColor = if ($result.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "`n[$($result.Status)] $($result.TestName)" -ForegroundColor $statusColor
    if ($result.Details) {
        Write-Host "    Details: $($result.Details)" -ForegroundColor Gray
    }
}

Write-Host "`n========== FEATURES TESTED (AUTOMATED) ==========" -ForegroundColor Yellow
$featuresTestedAutomated = @(
    "User Authentication & Login",
    "Multi-user login support",
    "User Profile Retrieval",
    "Channel Creation",
    "Channel Listing",
    "Chat Message Sending",
    "Message Retrieval",
    "Password Change & Verification",
    "Voice Channel Access",
    "API Health & Availability"
)

foreach ($feature in $featuresTestedAutomated) {
    Write-Host "  ✓ $feature" -ForegroundColor Green
}

Write-Host "`n========== FEATURES REQUIRING MANUAL UI TESTING ==========" -ForegroundColor Yellow
$featuresManual = @(
    "Screen Sharing (WebRTC)",
    "Voice Calling Audio/Video",
    "Microphone Mute/Unmute",
    "Speaker Mute/Unmute",
    "Voice Channel Join/Exit",
    "Real-time Chat Message Display",
    "WebSocket Connection Stability",
    "Presence Indicator Updates"
)

foreach ($feature in $featuresManual) {
    Write-Host "  ○ $feature" -ForegroundColor Yellow
}

Write-Host "`n========== SUMMARY ==========" -ForegroundColor Yellow

if ($TestFailCount -eq 0) {
    Write-Host "`n✓ ALL AUTOMATED TESTS PASSED!" -ForegroundColor Green
    Write-Host "The backend API is functioning correctly." -ForegroundColor Green
    Write-Host "Please proceed with manual UI testing in the browser." -ForegroundColor Cyan
} else {
    Write-Host "`n✗ SOME TESTS FAILED" -ForegroundColor Red
    Write-Host "Failed tests:" -ForegroundColor Yellow
    foreach ($result in $script:TestResults) {
        if ($result.Status -eq "FAIL") {
            Write-Host "  - $($result.TestName)" -ForegroundColor Red
            Write-Host "    $($result.Details)" -ForegroundColor DarkRed
        }
    }
}

Write-Host "`n========== RECOMMENDATIONS ==========" -ForegroundColor Yellow
Write-Host "1. Test backend APIs using curl/Postman" -ForegroundColor Cyan
Write-Host "2. Verify frontend loads at http://localhost:5173" -ForegroundColor Cyan
Write-Host "3. Manually test UI features in browser" -ForegroundColor Cyan
Write-Host "4. Check WebSocket connection for real-time updates" -ForegroundColor Cyan
Write-Host "5. Verify database connectivity and data persistence" -ForegroundColor Cyan
Write-Host "6. Test with multiple concurrent users (if applicable)" -ForegroundColor Cyan

Write-Host "`n========== ENVIRONMENT INFO ==========" -ForegroundColor Yellow
Write-Host "Backend URL: $BaseURL" -ForegroundColor Gray
Write-Host "Frontend URL: http://localhost:5173" -ForegroundColor Gray
Write-Host "Database: MySQL (localhost:3306)" -ForegroundColor Gray
Write-Host "Test User Accounts: admin, demo, jay" -ForegroundColor Gray
Write-Host "Report Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

Write-Host "`n========== END OF REPORT ==========" -ForegroundColor Yellow
Write-Host ""

# Save results to file
$reportPath = "c:\Users\ramje\Desktop\interlynk\QA_TEST_REPORT_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$script:TestResults | Format-Table -AutoSize | Out-File -FilePath $reportPath
Write-Host "Report saved to: $reportPath" -ForegroundColor Cyan
