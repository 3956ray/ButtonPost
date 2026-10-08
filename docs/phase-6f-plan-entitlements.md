# Phase 6F — plan entitlements

ButtonPost's paid-beta pricing is usage-based first. We do not lock specific
current platforms behind higher tiers and we do not invent scheduling,
analytics, teams, or AI features that are not shipped yet.

## Plans

| Plan | Price | Cloud publish batches / calendar month | Local Runner |
| --- | ---: | ---: | --- |
| Free | $0 | 5 | Unlimited |
| Starter | $5/mo or $50/yr | 50 | Unlimited |
| Pro | $9/mo or $90/yr | 200 | Unlimited |
| Advanced | $19/mo or $190/yr | 600 | Unlimited |

A **cloud publish batch** is one accepted ButtonPost server publish action.
Selecting X and DEV together in the same action counts once, not twice.

Xiaohongshu, Jike, LearnBlockchain, and other Local Runner destinations execute
on the user's machine and do not consume cloud quota.

## Failed publishes

ButtonPost reserves one batch before calling cloud publisher adapters so
concurrent requests cannot race past the allowance. If every cloud destination
fails or is skipped, the reservation is released and the user does not lose
quota. If at least one cloud destination publishes (or creates a draft), the
batch counts.

## Reset

Usage resets at the start of each UTC calendar month. This intentionally does
not depend on Paddle subscription renewal dates, so monthly allowances are
predictable for monthly and yearly subscribers alike.

## Why these limits

The MVP differentiates tiers by actual service usage rather than artificial
platform locks. Pro/Advanced product features can be added later when features
such as scheduling, analytics, multi-account publishing, or team workflows
actually exist.

The cloud limits also leave headroom for usage-priced third-party APIs such as
X while ButtonPost gathers real paid-beta usage data.

## Rollout flag

`BUTTONPOST_ENFORCE_PLANS=true` turns monthly limits on.

The older `BUTTONPOST_REQUIRE_PRO` variable is deprecated and only remains as
a fallback for older deployments.
