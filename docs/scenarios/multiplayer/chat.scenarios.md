# Chat Scenarios

> In-game chat, message broadcasting, and basic moderation.

---

### Scenario: Player can send a chat message

A connected player should be able to send a text message that is stored and broadcast to all other players in the round.

**Given** player A is connected to a round with players B and C
**When** player A sends "ahoy mateys!"
**Then** the message should be stored in the chat store
**And** players B and C should receive the message with player A's name

```yaml
id: send_chat_message
tags: [multiplayer, chat]
status: passing
sprint: v0.6-existing
priority: p0

setup:
  players: [A, B, C]

actions:
  - sendChat: { player: A, text: "ahoy mateys!" }

assertions:
  - chatStore.lastMessage.player: A
  - chatStore.lastMessage.text: "ahoy mateys!"
  - broadcastReceived: [B, C]
```

---

### Scenario: Chat messages are timestamped

Each chat message should include a server-authoritative timestamp for proper ordering and display.

**Given** a player sends a message
**When** the message is stored
**Then** it should have a numeric timestamp (Date.now)

```yaml
id: chat_messages_timestamped
tags: [multiplayer, chat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  player: A

actions:
  - sendChat: { player: A, text: "test" }

assertions:
  - chatStore.lastMessage.ts: ">= 0"
```

---

### Scenario: Chat history retrievable for late joiners

When a player joins mid-round, they should be able to see recent chat history so they have context.

**Given** 5 messages have been sent before player D joins
**When** player D connects and requests chat history
**Then** the most recent messages should be returned

```yaml
id: chat_history_for_late_joiners
tags: [multiplayer, chat]
status: passing
sprint: v0.6-existing
priority: p1

setup:
  chatStore: { messageCount: 5 }

actions:
  - playerJoin: { player: D }
  - getChatHistory: {}

assertions:
  - history.length: ">= 5"
```

---

### Scenario: Message length is capped

Messages exceeding a reasonable length limit should be truncated to prevent spam and abuse.

**Given** a player sends a message of 500 characters
**When** the message is processed
**Then** the stored message should be truncated to the server's max length

```yaml
id: message_length_capped
tags: [multiplayer, chat]
status: pending
sprint: v0.8
priority: p1

setup:
  player: A
  messageLength: 500

actions:
  - sendChat: { player: A, text: "<500 characters>" }

assertions:
  - chatStore.lastMessage.text.length: "<= 200"
```

---

### Scenario: Rate limiting prevents chat spam

Players should be rate-limited on chat messages to prevent flooding the chat channel.

**Given** a player sends 10 messages in 2 seconds
**When** the rate limiter evaluates the requests
**Then** messages beyond the limit should be silently dropped

```yaml
id: chat_rate_limiting
tags: [multiplayer, chat]
status: pending
sprint: v0.8
priority: p1

setup:
  player: A
  rateLimitWindow: 2
  rateLimitMax: 5

actions:
  - sendChat: { player: A, text: "spam", repeat: 10 }

assertions:
  - chatStore.messagesFromA: "<= 5"
```

---

### Scenario: Profanity filter on chat messages

Chat messages should pass through a basic profanity filter before being broadcast. Filtered words should be replaced with asterisks or a placeholder.

**Given** a profanity word list is configured
**When** a player sends a message containing a filtered word
**Then** the broadcast message should have the word replaced

```yaml
id: profanity_filter
tags: [multiplayer, chat]
status: pending
sprint: v0.8
priority: p2

setup:
  player: A
  filterEnabled: true

actions:
  - sendChat: { player: A, text: "you <filtered_word> landlubber" }

assertions:
  - chatStore.lastMessage.text: { contains: "***" }
```
