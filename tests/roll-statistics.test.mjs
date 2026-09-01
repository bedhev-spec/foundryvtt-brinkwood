import assert from "node:assert/strict";
import test from "node:test";

import {
  addActionRollToStatistics,
  emptyRollStatistics,
  recordActionRoll,
  renderRollStatisticsContent,
  summarizeRollStatistics
} from "../module/roll-statistics.js";

test("player statistics aggregate action outcomes, pools, and zero-dice rolls", () => {
  const rolls = [
    { outcome: "critical-success", dicePool: 4, zeroMode: false },
    { outcome: "success", dicePool: 3, zeroMode: false },
    { outcome: "partial-success", dicePool: 2, zeroMode: false },
    { outcome: "failure", dicePool: 0, zeroMode: true }
  ];
  const statistics = rolls.reduce(addActionRollToStatistics, emptyRollStatistics());
  const summary = summarizeRollStatistics(statistics);

  assert.equal(summary.total, 4);
  assert.equal(summary.averageDicePool, 2.25);
  assert.equal(summary.zeroDice, 1);
  assert.equal(summary.sixPlus, 50);
  assert.equal(summary.fourPlus, 75);
  assert.deepEqual(summary.rows.map(row => [row.outcome, row.count, row.percentage]), [
    ["critical-success", 1, 25],
    ["success", 1, 25],
    ["partial-success", 1, 25],
    ["failure", 1, 25]
  ]);
});

test("unknown roll types cannot corrupt player statistics", () => {
  const original = addActionRollToStatistics(undefined, { outcome: "resistance", dicePool: 6 });
  assert.deepEqual(original, emptyRollStatistics());
});

test("recording serializes user-flag updates", async () => {
  let stored;
  const user = {
    id: "player-1",
    getFlag: () => stored,
    async setFlag(scope, key, value) {
      assert.equal(scope, "brinkwood");
      assert.equal(key, "rollStatistics");
      await Promise.resolve();
      stored = value;
    }
  };

  await Promise.all([
    recordActionRoll({ outcome: "success", dicePool: 3 }, user),
    recordActionRoll({ outcome: "failure", dicePool: 1 }, user)
  ]);

  assert.equal(stored.total, 2);
  assert.equal(stored.totalDicePool, 4);
  assert.equal(stored.outcomes.success, 1);
  assert.equal(stored.outcomes.failure, 1);
});

test("statistics dialog is focused and escapes player names", () => {
  const content = renderRollStatisticsContent(
    addActionRollToStatistics(undefined, { outcome: "partial-success", dicePool: 2 }),
    '<script>alert("no")</script>',
    key => key
  );

  assert.doesNotMatch(content, /<script>/);
  assert.match(content, /BITD\.RollPartialSuccess/);
  assert.match(content, /BITD\.RollStatisticsAveragePool/);
  assert.match(content, /BITD\.RollStatisticsZeroDice/);
  assert.doesNotMatch(content, /Most rolled action/i);
});
