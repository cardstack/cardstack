# Cardbot
## discord_bots table

| Name                   | Type      | Nullability |
|------------------------|-----------|-------------|
| bot_id                 | string    | NOT NULL    |
| bot_type               | string    | NOT NULL    |
| status                 | enum: CONNECTING,CONNECTED,LISTENING,DISCONNECTED,UNRESPONSIVE | NOT NULL |
| last_message_id        | string    | NULL        |

## Handling multiple bot instances

Single bot

```mermaid
sequenceDiagram
    participant Database
    participant Bot
    participant Server

    Bot->>Database: I'm CONNECTING
    Note left of Database: Creates record for Bot
    Note left of Database: Sets Bot record's STATUS to CONNECTING
    Bot->>Server: Log in
    Server-->>Bot: "Ready"
    Bot->>Database: I'm CONNECTED
    Bot->>Database: LISTEN on discord_bot_status postgres channel
    Bot->>Database: LISTEN on discord_bot_message_processing postgres channel
    Note left of Database: Sets Bot record's STATUS to CONNECTED
    Note left of Bot: Bot Starts listening for Discord events
    Bot->>Database: I'm LISTENING if no other bot is
    Note left of Database: Sets Bot record's STATUS to LISTENING
    Database->>Bot: 1 row updated

    Server-->>Bot: "Message 1"
    Note left of Bot: Bot is in listening state, so it processes the message
    Bot-->>Bot: Process message
    Bot->>Database: I processed the message with ID 1
    Note left of Database: Sets Bot record's LAST_MESSAGE_ID to 1
```

Two bots

```mermaid
sequenceDiagram
    participant Database
    participant Bot A
    participant Bot B
    participant Server

    Note left of Bot A: Bot A is logged in and in LISTENING state

    Bot B->>Database: I'm CONNECTING
    Note left of Database: Creates record for Bot B
    Note left of Database: Sets Bot B record's STATUS to CONNECTING
    Bot B->>Server: Log in
    Server-->>Bot B: "Ready"
    Bot B->>Database: I'm CONNECTED
    Bot B->>Database: LISTEN on discord_bot_status postgres channel
    Bot B->>Database: LISTEN on discord_bot_message_processing postgres channel
    Note left of Database: Sets Bot B record's STATUS to CONNECTED
    Note left of Bot B: Bot B Starts listening for events
    Bot B->>Database: I'm LISTENING if no other bot is
    Note left of Database: Bot A already LISTENING
    Database->>Bot B: 0 rows updated

    Server-->>Bot B: "Message 2"
    Note left of Bot B: Bot B is NOT in listening state, so it queues the message in memory
    Bot B-->>Bot B: Queue message
    Server-->>Bot A: "Message 2"
    Note left of Bot A: Bot A is in listening state, so it processes the message
    Bot A-->>Bot A: Process message
    Bot A->>Database: I processed the message with ID 2
    Note left of Database: Sets Bot A record's LAST_MESSAGE_ID to 2
    Database->>Bot A: Notify on discord_bot_message_processing LAST_MESSAGE_ID=2
    Note left of Bot A: Nothing to do in response to this
    Database->>Bot B: Notify on discord_bot_message_processing LAST_MESSAGE_ID=2
    Note left of Bot B: Discards message from queue because it was processed
```

Two bots, Bot A shuts down normally, Bot B immediately takes over

```mermaid
sequenceDiagram
    participant Database
    participant Bot A
    participant Bot B
    participant Server

    Note left of Bot A: Bot A is logged in and in LISTENING state
    Note left of Bot B: Bot B is logged in and in CONNECTED state

    Bot A-->>Bot A: Shutting down
    Bot A-->>Server: Logout
    Bot A->>Database: I am DISCONNECTING
    Note left of Database: Sets Bot A record's STATUS to DISCONNECTED
    Database->>Bot B: Notify on discord_bot_status DISCONNECTED
    Bot B->>Database: I'm LISTENING if no other bot is
    Note left of Database: Sets Bot record's STATUS to LISTENING
    Database->>Bot B: 1 row updated

    Server-->>Bot B: "Message 3"
    Bot B-->>Bot B: Process message
    Bot B->>Database: I processed the message with ID 3
    Note left of Database: Sets Bot B record's LAST_MESSAGE_ID to 3
```

Two bots, Bot A becomes unresponsive, Bot B takes over after 15 seconds

```mermaid
sequenceDiagram
    participant Database
    participant Bot A
    participant Bot B
    participant Server

    Note left of Bot A: Bot A is logged in and in LISTENING state
    Note left of Bot B: Bot B is logged in and in CONNECTED state

    Server-->>Bot A: "Message 4"
    Note left of Bot A: Bot A is unresponsive so it does not act
    Server-->>Bot B: "Message 4"
    Note left of Bot B: Bot B is NOT in listening state, so it queues the message in memory
    Bot B-->>Bot B: Queue message
    Note left of Bot B: 15 seconds after queuing message
    Bot B->>Database: What's the latest timestamp that has been processed?
    Database->>Bot B: C
    Bot B->>Database: I'm LISTENING if no other bot besides Bot A is
    Note left of Database: Sets Bot A record's STATUS to UNRESPONSIVE
    Note left of Database: Sets Bot B record's STATUS to LISTENING
    Database->>Bot B: 1 row updated
    Database->>Bot A: Notify on discord_bot_status NEW_LISTENER
    Bot B-->>Bot B: Process message
    Bot B->>Database: I processed the message for with ID 4
    Note left of Database: Sets Bot B record's LAST_MESSAGE_ID to 4
```
