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
    Note left of Database: Sets Bot record's STATE to CONNECTING
    Bot->>Server: Log in
    Server-->>Bot: "Ready"
    Bot->>Database: I'm CONNECTED
    Bot->>Database: LISTEN on discord_bot_status postgres channel
    Bot->>Database: LISTEN on discord_bot_message_processing postgres channel
    Note left of Database: Sets Bot record's STATE to CONNECTED
    Note left of Bot: Bot Starts listening for Discord events
    Bot->>Database: I'm LISTENING if no other bot is
    Note left of Database: Sets Bot record's STATE to LISTENING
    Database->>Bot: 1 row updated

    Server-->>Bot: "Message A"
    Note left of Bot: Bot is in listening state, so it processes the message
    Bot-->>Bot: Process message
    Bot->>Database: I processed the message for timestamp A
    Note left of Database: Sets Bot record's LAST_TIMESTAMP to A
```

Two bots

```mermaid
sequenceDiagram
    participant Database
    participant Bot 1
    participant Bot 2
    participant Server

    Note left of Bot 1: Bot 1 is logged in and in LISTENING state

    Bot 2->>Database: I'm CONNECTING
    Note left of Database: Creates record for Bot 2
    Note left of Database: Sets Bot 2 record's STATE to CONNECTING
    Bot 2->>Server: Log in
    Server-->>Bot 2: "Ready"
    Bot 2->>Database: I'm CONNECTED
    Bot 2->>Database: LISTEN on discord_bot_status postgres channel
    Bot 2->>Database: LISTEN on discord_bot_message_processing postgres channel
    Note left of Database: Sets Bot 2 record's STATE to CONNECTED
    Note left of Bot 2: Bot 2 Starts listening for events
    Bot 2->>Database: I'm LISTENING if no other bot is
    Note left of Database: Bot 1 already LISTENING
    Database->>Bot 2: 0 rows updated

    Server-->>Bot 2: "Message B"
    Note left of Bot 2: Bot 2 is NOT in listening state, so it queues the message in memory
    Bot 2-->>Bot 2: Queue message
    Server-->>Bot 1: "Message B"
    Note left of Bot 1: Bot 1 is in listening state, so it processes the message
    Bot 1-->>Bot 1: Process message
    Bot 1->>Database: I processed the message for timestamp A
    Note left of Database: Sets Bot 1 record's LAST_TIMESTAMP to A
    Database->>Bot 1: Notify on discord_bot_message_processing LAST_TIMESTAMP=A
    Note left of Bot 1: Nothing to do in response to this
    Database->>Bot 2: Notify on discord_bot_message_processing LAST_TIMESTAMP=A
    Note left of Bot 2: Discards message from queue because it was processed
```

Two bots, Bot 1 shuts down normally, Bot 2 immediately takes over

```mermaid
sequenceDiagram
    participant Database
    participant Bot 1
    participant Bot 2
    participant Server

    Note left of Bot 1: Bot 1 is logged in and in LISTENING state
    Note left of Bot 2: Bot 2 is logged in and in CONNECTED state

    Bot 1-->>Bot 1: Shutting down
    Bot 1-->>Server: Logout
    Bot 1->>Database: I am DISCONNECTING
    Note left of Database: Sets Bot 1 record's STATE to DISCONNECTED
    Database->>Bot 2: Notify on discord_bot_status DISCONNECTED
    Bot 2->>Database: I'm LISTENING if no other bot is
    Note left of Database: Sets Bot record's STATE to LISTENING
    Database->>Bot 2: 1 row updated

    Server-->>Bot 2: "Message C"
    Bot 2-->>Bot 2: Process message
    Bot 2->>Database: I processed the message for timestamp C
    Note left of Database: Sets Bot 2 record's LAST_TIMESTAMP to C
```

Two bots, Bot 1 becomes unresponsive, Bot 2 takes over after 30 seconds

```mermaid
sequenceDiagram
    participant Database
    participant Bot 1
    participant Bot 2
    participant Server

    Note left of Bot 1: Bot 1 is logged in and in LISTENING state
    Note left of Bot 2: Bot 2 is logged in and in CONNECTED state

    Server-->>Bot 1: "Message D"
    Note left of Bot 1: Bot 1 is unresponsive so it does not act
    Server-->>Bot 2: "Message D"
    Note left of Bot 2: Bot 2 is NOT in listening state, so it queues the message in memory
    Bot 2-->>Bot 2: Queue message
    Note left of Bot 2: 30 seconds after queuing message
    Bot 2->>Database: What's the latest timestamp that has been processed?
    Database->>Bot 2: C
    Bot 2->>Database: I'm LISTENING if no other bot besides Bot 1 is
    Note left of Database: Sets Bot 1 record's STATE to UNRESPONSIVE
    Note left of Database: Sets Bot 2 record's STATE to LISTENING
    Database->>Bot 2: 1 row updated
    Database->>Bot 1: Notify on discord_bot_status NEW_LISTENER
    Bot 2-->>Bot 2: Process message
    Bot 2->>Database: I processed the message for timestamp D
    Note left of Database: Sets Bot 2 record's LAST_TIMESTAMP to D
```

Message Processing Decision Tree

```mermaid
flowchart TD
    message[Message event] --> MessageType{Message Type?}
    MessageType -->

```