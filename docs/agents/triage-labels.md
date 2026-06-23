# Triage label vocabulary

The `triage` skill moves issues through five roles. Each role maps to a GitHub label.

| Role | Label | Meaning |
|---|---|---|
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate |
| `needs-info` | `needs-info` | Waiting on reporter for more detail |
| `ready-for-agent` | `ready-for-agent` | Fully specified, AFK-ready (an agent can pick it up) |
| `ready-for-human` | `ready-for-human` | Needs human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

## Conventions

- The `triage` skill applies exactly one of these labels at a time. A issue's current triage role = the one of these labels it currently carries.
- Apply labels via `gh issue edit --add-label <name>` / `--remove-label <name>`. Use the verbatim strings above — no prefixes, no scopes.
- Before the first run, the skill will create any missing labels via `gh label create <name> --color <hex> --description "<meaning>"`. Default colors are the `triage` skill's defaults.