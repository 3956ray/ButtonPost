import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLAN_ENTITLEMENTS,
  isButtonPostPlan,
  isPaidPlan,
} from '../lib/billing/plans.ts'

test('ButtonPost plan allowances match the public pricing model', () => {
  assert.equal(PLAN_ENTITLEMENTS.free.cloudPublishBatchesPerMonth, 5)
  assert.equal(PLAN_ENTITLEMENTS.starter.cloudPublishBatchesPerMonth, 50)
  assert.equal(PLAN_ENTITLEMENTS.pro.cloudPublishBatchesPerMonth, 200)
  assert.equal(PLAN_ENTITLEMENTS.advanced.cloudPublishBatchesPerMonth, 600)

  for (const plan of Object.values(PLAN_ENTITLEMENTS)) {
    assert.equal(plan.localRunnerUnlimited, true)
  }
})

test('ButtonPost plan type guards reject unknown billing values', () => {
  assert.equal(isButtonPostPlan('free'), true)
  assert.equal(isPaidPlan('starter'), true)
  assert.equal(isPaidPlan('pro'), true)
  assert.equal(isPaidPlan('advanced'), true)
  assert.equal(isPaidPlan('free'), false)
  assert.equal(isButtonPostPlan('enterprise'), false)
})
