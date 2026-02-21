# Telegram Intake Architecture

## Scope (first release)
- Only private chat with bot.
- Input types: `text`, `caption`, `photo`, `document`.
- No LLM parsing; deterministic extraction only (regex + heuristics).
- Message text is stored as one batch `Note`, files as `Document`.
- Dedup key: `chat_id + message_id`.
- Batch timeout before decision prompt: 60 seconds.

## Main flow
1. Bot receives Telegram update (`message` or `callback_query`).
2. On startup bot synchronizes slash commands with Telegram API `setMyCommands`:
- `/help`, `/pick`, `/create`, `/cancel`.
3. Bot resolves linked user by `TelegramProfile.chat_id`.
4. For each new message:
- Upsert `TelegramInboundMessage`.
- If already processed: return idempotent response.
- Add message to active collecting batch session (or create a new one).
- Aggregate text + attachments + extracted fields into session payload.
5. Batch finalization:
- Background loop runs `finalize_ready_batches()`.
- Sessions with 60s inactivity move `collecting -> ready`.
- Bot sends one decision prompt (`/pick`, `/create`, `/cancel`).
6. User decision:
- `pick`: link to existing deal.
- `create`: create client/deal and then link.
- `cancel`: stop session.
7. Linking side effects:
- Create one batch `Note` with source metadata and message ids.
- Download all batch files and save as `Document` records.
- Update inbound/session final statuses.

## State machine
### TelegramInboundMessage.status
- `received`
- `waiting_decision`
- `linked_existing`
- `created_new_deal`
- `canceled`
- `expired`
- `failed`

### TelegramDealRoutingSession.state
- `collecting`
- `ready`
- `linked_existing`
- `created_new_deal`
- `canceled`
- `expired`
- `failed`

## Deduplication
- Unique DB constraint on `TelegramInboundMessage(chat_id, message_id)`.
- If message is already completed (`processed_at` is set), bot does not create duplicate `Note`/`Document`/`Deal`.
- Bot returns informational response with current processing status and optional link to deal.
- Duplicate `message_id` is not appended twice into batch payload.

## Timeout policy
- Active routing session TTL: 30 minutes.
- Batch decision timeout: 60 seconds without new messages.
- Expired sessions are marked `expired`; subsequent `/pick` or callbacks return expiration message.
