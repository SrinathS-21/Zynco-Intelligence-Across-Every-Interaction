# Email Automation In Chat Guide

This guide explains how to use automation from the Email workspace chat in a safe, high-confidence way.

## What Changed

Automation is now controlled from the Email chat context (not a separate chat source).

Use the Email source in Chat, then run automation commands from there.

## Recommended Workflow

1. Sync emails first in Email workspace.
2. Confirm automation rules exist and are enabled.
3. Run dry-run from chat.
4. Review matched/executed/failed summary.
5. Confirm execution only after dry-run looks correct.

## Chat Commands

Run these commands in Email chat:

- `automation status`
- `run automation dry run for high priority`
- `apply automation rules for requires_action`
- `confirm execute automation`

You can also combine execution intent in one line:

- `apply automation rules for requires_action and confirm`

## Safety Gate Behavior

If you ask to execute but do not confirm, chat automatically runs dry-run and gives a confirmation phrase.

Expected pattern:

1. Request execute
2. Chat returns dry-run summary
3. Chat asks for confirmation phrase
4. You send confirm phrase
5. Real execution runs

## How To Test End-To-End

1. Open Email workspace and sync inbox.
2. Create at least one enabled automation rule.
3. In Chat, choose Email source.
4. Send: `automation status`.
5. Send: `run automation dry run for high priority`.
6. Verify non-zero matched count (if suitable emails exist).
7. Send: `confirm execute automation`.
8. Verify Activity History shows automation entries.

## Success Criteria

- Status shows total and enabled rules.
- Dry-run returns checks/matches without side effects.
- Confirmed execution returns executed/failed counts.
- Activity logs reflect the actions.

## Troubleshooting

- No rules found: create and enable a rule first.
- 0 matched: adjust category/priority filters or sync more emails.
- Execution failed: ensure Jira/Slack/Notion integration is connected for the selected action.
- Unsupported action: current route supports Jira, Notion, Slack actions in this execution path.

## Best Practices

- Always dry-run first in production data.
- Start with narrow filters (for example, `requires_action` + `high`).
- Enable only a small set of rules initially.
- Review failed actions after each run and fix integrations before retrying.
