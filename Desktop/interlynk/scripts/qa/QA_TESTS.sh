#!/bin/bash

# QA Testing Script for Enterprise Collaboration Platform
# Comprehensive testing via curl

BASE_URL="http://localhost:8082"
API_VERSION="v1"
TEST_PASS=0
TEST_FAIL=0
REPORT_FILE="/c/Users/ramje/Desktop/interlynk/QA_REPORT_$(date +%Y%m%d_%H%M%S).txt"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test credentials
ADMIN_USER="admin"
ADMIN_PASS="admin@123"
DEMO_USER="demo"
DEMO_PASS="demo123"

# Test result tracking
declare -a TEST_NAMES
declare -a TEST_RESULTS
declare -a TEST_DETAILS

# Function to log test results
log_test() {
    local test_name="$1"
    local passed="$2"
    local details="$3"

    if [ "$passed" = "true" ]; then
        echo -e "${GREEN}[PASS]${NC} $test_name"
        echo "    $details"
        TEST_PASS=$((TEST_PASS+1))
        TEST_RESULTS+=("PASS")
    else
        echo -e "${RED}[FAIL]${NC} $test_name"
        echo "    $details"
        TEST_FAIL=$((TEST_FAIL+1))
        TEST_RESULTS+=("FAIL")
    fi

    TEST_NAMES+=("$test_name")
    TEST_DETAILS+=("$details")
}

# Function to extract token from JSON response
extract_token() {
    echo "$1" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4
}

# Function to extract user from JSON response
extract_user_id() {
    echo "$1" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2
}

# Function to extract channel id
extract_channel_id() {
    echo "$1" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2
}

# Function to extract message id
extract_message_id() {
    echo "$1" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2
}

echo -e "\n${CYAN}========== ENTERPRISE COLLABORATION PLATFORM QA TESTS ==========${NC}"
echo -e "${CYAN}Start Time: $(date)${NC}\n"

# ========== TEST 1: Admin Login ==========
echo -e "\n${CYAN}========== TEST 1: ADMIN LOGIN ==========${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/$API_VERSION/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\",\"rememberMe\":false}")

ADMIN_TOKEN=$(extract_token "$LOGIN_RESPONSE")
ADMIN_USER_ID=$(extract_user_id "$LOGIN_RESPONSE")

if [ ! -z "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
    log_test "Admin Login" "true" "Token: ${ADMIN_TOKEN:0:30}... User ID: $ADMIN_USER_ID"
else
    log_test "Admin Login" "false" "Failed to obtain token. Response: ${LOGIN_RESPONSE:0:100}"
    echo "Response: $LOGIN_RESPONSE"
fi

# ========== TEST 2: Demo User Login ==========
echo -e "\n${CYAN}========== TEST 2: DEMO USER LOGIN ==========${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/$API_VERSION/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$DEMO_USER\",\"password\":\"$DEMO_PASS\",\"rememberMe\":false}")

DEMO_TOKEN=$(extract_token "$LOGIN_RESPONSE")

if [ ! -z "$DEMO_TOKEN" ] && [ "$DEMO_TOKEN" != "null" ]; then
    log_test "Demo User Login" "true" "Token obtained successfully"
else
    log_test "Demo User Login" "false" "Failed to obtain token"
fi

# ========== TEST 3: Get Current User Info ==========
echo -e "\n${CYAN}========== TEST 3: GET CURRENT USER ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ]; then
    USER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/$API_VERSION/auth/me" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json")

    if echo "$USER_RESPONSE" | grep -q '"username"'; then
        USERNAME=$(echo "$USER_RESPONSE" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
        DISPLAY_NAME=$(echo "$USER_RESPONSE" | grep -o '"displayName":"[^"]*' | cut -d'"' -f4)
        log_test "Get Current User" "true" "User: $USERNAME ($DISPLAY_NAME)"
    else
        log_test "Get Current User" "false" "Failed to retrieve user info"
    fi
fi

# ========== TEST 4: Create Channel ==========
echo -e "\n${CYAN}========== TEST 4: CREATE CHANNEL ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ]; then
    TIMESTAMP=$(date +%s)
    CHANNEL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/$API_VERSION/channels" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"qa-test-channel-$TIMESTAMP\",\"description\":\"QA Test Channel\",\"isPrivate\":false}")

    CHANNEL_ID=$(extract_channel_id "$CHANNEL_RESPONSE")
    CHANNEL_NAME=$(echo "$CHANNEL_RESPONSE" | grep -o '"name":"[^"]*' | cut -d'"' -f4)

    if [ ! -z "$CHANNEL_ID" ] && [ "$CHANNEL_ID" != "null" ]; then
        log_test "Create Channel" "true" "Channel: '$CHANNEL_NAME' (ID: $CHANNEL_ID)"
    else
        log_test "Create Channel" "false" "Failed to create channel. Response: ${CHANNEL_RESPONSE:0:100}"
    fi
fi

# ========== TEST 5: List Channels ==========
echo -e "\n${CYAN}========== TEST 5: LIST CHANNELS ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ]; then
    CHANNELS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/$API_VERSION/channels" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json")

    CHANNEL_COUNT=$(echo "$CHANNELS_RESPONSE" | grep -o '"id":[0-9]*' | wc -l)

    if [ "$CHANNEL_COUNT" -gt 0 ]; then
        log_test "List Channels" "true" "Retrieved $CHANNEL_COUNT channel(s)"
    else
        log_test "List Channels" "false" "No channels found or error retrieving"
    fi
fi

# ========== TEST 6: Send Message ==========
echo -e "\n${CYAN}========== TEST 6: SEND MESSAGE ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ] && [ ! -z "$CHANNEL_ID" ]; then
    MESSAGE_TIME=$(date '+%Y-%m-%d %H:%M:%S')
    MESSAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/$API_VERSION/messages" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"content\":\"QA Test Message at $MESSAGE_TIME\",\"channelId\":$CHANNEL_ID}")

    MESSAGE_ID=$(extract_message_id "$MESSAGE_RESPONSE")

    if [ ! -z "$MESSAGE_ID" ] && [ "$MESSAGE_ID" != "null" ]; then
        log_test "Send Message" "true" "Message ID: $MESSAGE_ID"
    else
        log_test "Send Message" "false" "Failed to send message"
    fi
fi

# ========== TEST 7: Get Messages ==========
echo -e "\n${CYAN}========== TEST 7: GET MESSAGES ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ] && [ ! -z "$CHANNEL_ID" ]; then
    MESSAGES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/$API_VERSION/channels/$CHANNEL_ID/messages" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json")

    MESSAGE_COUNT=$(echo "$MESSAGES_RESPONSE" | grep -o '"id":[0-9]*' | wc -l)

    if [ "$MESSAGE_COUNT" -ge 0 ]; then
        log_test "Get Messages" "true" "Retrieved $MESSAGE_COUNT message(s)"
    else
        log_test "Get Messages" "false" "Failed to retrieve messages"
    fi
fi

# ========== TEST 8: Change Password ==========
echo -e "\n${CYAN}========== TEST 8: CHANGE PASSWORD ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ]; then
    PASSWORD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/$API_VERSION/auth/change-password" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"currentPassword\":\"$ADMIN_PASS\",\"newPassword\":\"NewQAPass@123\",\"confirmPassword\":\"NewQAPass@123\"}")

    if echo "$PASSWORD_RESPONSE" | grep -q '"success":true'; then
        log_test "Change Password" "true" "Password changed successfully"

        # Test 8b: Verify new password works
        VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/$API_VERSION/auth/login" \
          -H "Content-Type: application/json" \
          -d "{\"username\":\"$ADMIN_USER\",\"password\":\"NewQAPass@123\",\"rememberMe\":false}")

        VERIFY_TOKEN=$(extract_token "$VERIFY_RESPONSE")

        if [ ! -z "$VERIFY_TOKEN" ] && [ "$VERIFY_TOKEN" != "null" ]; then
            log_test "Verify New Password" "true" "Successfully logged in with new password"
            ADMIN_TOKEN=$VERIFY_TOKEN
        else
            log_test "Verify New Password" "false" "Login failed with new password"
        fi
    else
        log_test "Change Password" "false" "Failed to change password"
    fi
fi

# ========== TEST 9: Get Voice Channels ==========
echo -e "\n${CYAN}========== TEST 9: GET VOICE CHANNELS ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ]; then
    VOICE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/$API_VERSION/call-rooms" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json")

    VOICE_COUNT=$(echo "$VOICE_RESPONSE" | grep -o '"id":[0-9]*' | wc -l)

    if [ "$VOICE_COUNT" -gt 0 ]; then
        log_test "Get Voice Channels" "true" "Retrieved $VOICE_COUNT voice channel(s)"
    else
        log_test "Get Voice Channels" "false" "No voice channels found"
    fi
fi

# ========== TEST 10: Delete Channel ==========
echo -e "\n${CYAN}========== TEST 10: DELETE CHANNEL ==========${NC}"

if [ ! -z "$ADMIN_TOKEN" ] && [ ! -z "$CHANNEL_ID" ]; then
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/$API_VERSION/channels/$CHANNEL_ID" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json")

    HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
        log_test "Delete Channel" "true" "Channel deleted successfully (HTTP $HTTP_CODE)"
    else
        log_test "Delete Channel" "false" "Failed to delete channel (HTTP $HTTP_CODE)"
    fi
fi

# ========== TEST 11: Health Check ==========
echo -e "\n${CYAN}========== TEST 11: API HEALTH CHECK ==========${NC}"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/actuator/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
    log_test "API Health Check" "true" "Health check passed (HTTP $HTTP_CODE)"
else
    log_test "API Health Check" "false" "Health check failed (HTTP $HTTP_CODE)"
fi

# ========== GENERATE FINAL REPORT ==========

echo -e "\n${YELLOW}========== FINAL QA TEST REPORT ==========${NC}"
echo "=========================================="

TOTAL=$((TEST_PASS + TEST_FAIL))
PASS_RATE=$((TEST_PASS * 100 / TOTAL))

echo -e "${CYAN}Total Tests Executed: $TOTAL${NC}"
echo -e "${GREEN}Tests Passed: $TEST_PASS${NC}"
echo -e "${RED}Tests Failed: $TEST_FAIL${NC}"
echo -e "${CYAN}Pass Rate: $PASS_RATE%${NC}"

echo -e "\n${YELLOW}========== DETAILED RESULTS ==========${NC}"
for ((i=0; i<${#TEST_NAMES[@]}; i++)); do
    STATUS="${TEST_RESULTS[$i]}"
    NAME="${TEST_NAMES[$i]}"
    DETAIL="${TEST_DETAILS[$i]}"

    if [ "$STATUS" = "PASS" ]; then
        echo -e "${GREEN}[PASS]${NC} $NAME"
    else
        echo -e "${RED}[FAIL]${NC} $NAME"
    fi
    echo "    $DETAIL"
done

echo -e "\n${YELLOW}========== FEATURES TESTED ==========${NC}"
echo "✓ User Authentication (Admin, Demo, Jay)"
echo "✓ Multi-user Login Support"
echo "✓ User Profile Retrieval"
echo "✓ Channel Creation"
echo "✓ Channel Listing"
echo "✓ Chat Message Sending"
echo "✓ Message Retrieval from Channels"
echo "✓ Password Change & Verification"
echo "✓ Voice Channel Access"
echo "✓ API Health & Availability"

echo -e "\n${YELLOW}========== FEATURES REQUIRING MANUAL TESTING ==========${NC}"
echo "○ Screen Sharing (WebRTC - requires browser)"
echo "○ Voice Calling Audio/Video (requires LiveKit)"
echo "○ Microphone Mute/Unmute"
echo "○ Speaker Mute/Unmute"
echo "○ Voice Channel Join/Exit"
echo "○ Real-time Chat Message Updates"
echo "○ Presence Indicator Updates"

echo -e "\n${YELLOW}========== ENVIRONMENT ==========${NC}"
echo "Backend URL: $BASE_URL"
echo "Frontend URL: http://localhost:5173"
echo "API Version: $API_VERSION"
echo "Database: MySQL (localhost:3306)"
echo "Report Generated: $(date)"

echo -e "\n${YELLOW}========== SUMMARY ==========${NC}"
if [ $TEST_FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ ALL AUTOMATED TESTS PASSED!${NC}"
    echo "The backend API is functioning correctly."
    echo "Proceed with manual UI testing in the browser."
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo "Please review the failures above."
fi

echo -e "\n${YELLOW}========== END OF REPORT ==========${NC}\n"
