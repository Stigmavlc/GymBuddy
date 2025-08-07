# GymBuddy Telegram Bot - Complete Testing Protocol
*Generated: August 7, 2025*

## How to Test
Open Telegram and search for **@GymBuddyAppBot**. Send the following messages one by one and verify the responses.

## Test Categories

### 1. BASIC COMMUNICATION TESTS ✅
Test that the bot responds to basic commands:

```
/start
```
**Expected**: Welcome message with introduction

```
Hi
```
**Expected**: Friendly greeting response

```
Hello
```
**Expected**: Greeting with possible suggestions

```
What can you do?
```
**Expected**: List of bot capabilities

---

### 2. AVAILABILITY MANAGEMENT TESTS 📅

#### Adding Availability (Natural Language)
```
I'm free Monday 6-8pm
```
**Expected**: Confirmation of availability added for Monday 18:00-20:00

```
Available Tuesday and Thursday 7-9pm
```
**Expected**: Confirmation for both days added

```
I can gym weekdays 5-7am
```
**Expected**: Mon-Fri morning slots added

```
Free weekends all day
```
**Expected**: Saturday and Sunday full availability

#### Checking Availability
```
What's my availability?
```
**Expected**: List of all your available time slots

```
Show my schedule
```
**Expected**: Your current availability schedule

#### Modifying Availability
```
Remove Monday from my schedule
```
**Expected**: Monday availability removed

```
Clear all my availability
```
**Expected**: All availability slots cleared

```
Update my Monday to 7-9pm instead
```
**Expected**: Monday slot updated to new time

---

### 3. SESSION MANAGEMENT TESTS 💪

#### Creating Sessions
```
Let's gym tomorrow at 6pm
```
**Expected**: Session proposal sent to partner

```
Book a session for Monday 7pm
```
**Expected**: Session created if both available

```
Schedule workout Sunday morning
```
**Expected**: Session proposal with specific time

#### Viewing Sessions
```
What sessions do we have?
```
**Expected**: List of upcoming sessions

```
Show upcoming workouts
```
**Expected**: Display scheduled gym sessions

```
Any sessions this week?
```
**Expected**: This week's scheduled sessions

#### Managing Sessions
```
Cancel tomorrow's session
```
**Expected**: Session cancelled, partner notified

```
Delete Monday workout
```
**Expected**: Specific session removed

```
Reschedule tomorrow to 8pm
```
**Expected**: Session time updated

---

### 4. PARTNER COORDINATION TESTS 👥

#### Partner Availability
```
When is Youssef free?
```
**Expected**: Partner's availability displayed

```
What's Ivan's schedule?
```
**Expected**: Partner's available times

```
Show partner availability
```
**Expected**: Your gym partner's schedule

#### Finding Overlap
```
When can we both gym?
```
**Expected**: Overlapping available times

```
Find common gym times
```
**Expected**: Times when both are free

```
What times work for both?
```
**Expected**: Mutual availability slots

#### Communication
```
Remind Youssef about tomorrow
```
**Expected**: Reminder sent to partner

```
Tell my partner I'll be late
```
**Expected**: Message relayed to partner

---

### 5. PENDING SESSION RESPONSES 🔔

When your partner proposes a session, test:

```
Yes
```
**Expected**: Session confirmed

```
No
```
**Expected**: Session declined

```
Maybe later
```
**Expected**: Session postponed

```
Can we do 7pm instead?
```
**Expected**: Counter-proposal sent

---

### 6. ADVANCED QUERIES 🎯

```
How many sessions this month?
```
**Expected**: Session count/statistics

```
Show my gym stats
```
**Expected**: Performance metrics

```
Weekly summary
```
**Expected**: This week's activity summary

```
Help
```
**Expected**: Command list and usage guide

---

## Testing Checklist

### Phase 1: Basic Functions
- [ ] Bot responds to /start
- [ ] Bot greets users properly
- [ ] Bot explains its capabilities
- [ ] Bot understands basic queries

### Phase 2: Availability
- [ ] Natural language parsing works
- [ ] Multiple time slots can be added
- [ ] Availability can be viewed
- [ ] Availability can be modified
- [ ] Availability can be cleared

### Phase 3: Sessions
- [ ] Sessions can be proposed
- [ ] Sessions appear in list
- [ ] Sessions can be cancelled
- [ ] Partner gets notifications
- [ ] Pending sessions work

### Phase 4: Coordination
- [ ] Partner availability visible
- [ ] Overlap detection works
- [ ] Reminders can be sent
- [ ] Conflict detection works

### Phase 5: Data Sync
- [ ] Bot changes appear on website
- [ ] Website changes visible in bot
- [ ] Real-time synchronization works
- [ ] No data conflicts occur

---

## Common Issues & Solutions

### Bot Not Responding
1. Check webhook: `https://gymbuddy-telegram-bot-ee4daa273c58.herokuapp.com/`
2. Verify bot token is correct
3. Check Heroku logs for errors

### Availability Not Saving
1. Verify database connection
2. Check time format parsing
3. Ensure user is registered

### Sessions Not Creating
1. Verify both users have availability
2. Check for time conflicts
3. Ensure partner notification works

### Natural Language Not Working
1. Check AI service connection
2. Verify Claude API key
3. Review parsing logic

---

## Test Users

**Ivan (You)**
- Telegram ID: 1195143765
- Username: Object_Oriented_Guy
- Email: ivanaguilarmari@gmail.com

**Youssef (Test Partner)**
- Telegram ID: 8124655852
- Email: youssef.dummy@test.com

---

## Quick Test Sequence
For a rapid functionality check, send these in order:
1. `/start`
2. `I'm free Monday 6-8pm`
3. `What's my availability?`
4. `When is Youssef free?`
5. `Let's gym Monday at 6pm`
6. `What sessions do we have?`

---

## Notes
- Allow 2-3 seconds between messages for processing
- If bot doesn't respond, check Heroku logs
- Test from both Ivan and Youssef accounts if possible
- Document any unexpected responses

---

*End of Testing Protocol*