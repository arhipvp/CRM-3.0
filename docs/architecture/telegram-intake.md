# Telegram Intake Architecture

## Scope (first release)
- Only private chat with bot.
- Input types: `text`, `caption`, `photo`, `document`.
- No LLM parsing; deterministic extraction only (regex + heuristics).
- Message text is stored as `Note`, files as `Document`.
- Dedup key: `chat_id + message_id`.

## Main flow
1. Bot receives Telegram update (`message` or `callback_query`).
2. Bot resolves linked user by `TelegramProfile.chat_id`.
3. For a new message:
- Upsert `TelegramInboundMessage`.
- If already processed: return idempotent response.
- Extract `phones`, `emails`, `client_name`, `title`.
- Find candidate deals only in current user access scope (`seller/executor/visible_users`).
- Create/update `TelegramDealRoutingSession` in `pending` state with TTL 30 minutes.
4. User decision:
- `pick`: link to existing deal.
- `create`: create client/deal and then link.
- `cancel`: stop session.
5. Linking side effects:
- Create `Note` with source metadata.
- Download Telegram files and save as `Document` records.
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
- `pending`
- `linked_existing`
- `created_new_deal`
- `canceled`
- `expired`
- `failed`

## Deduplication
- Unique DB constraint on `TelegramInboundMessage(chat_id, message_id)`.
- If message is already completed (`processed_at` is set), bot does not create duplicate `Note`/`Document`/`Deal`.
- Bot returns informational response with current processing status and optional link to deal.

## Timeout policy
- Active routing session TTL: 30 minutes.
- Expired sessions are marked `expired`; subsequent `/pick` or callbacks return expiration message.
