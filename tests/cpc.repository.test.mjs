import test from "node:test";
import assert from "node:assert/strict";

import { upsertCpcsAndSyncDetailLinks } from "../assets/js/modules/repositories/cpc.repository.js";

test("upsertCpcsAndSyncDetailLinks links new cpc ids back to detail rows", async () => {
  const calls = {
    cpcBulkPut: null,
    cpcBulkAdd: null,
    detailBulkPut: null,
  };

  const databaseService = {
    db: {
      cpcItems: {
        bulkPut: async (rows) => {
          calls.cpcBulkPut = rows;
        },
        bulkAdd: async (rows) => {
          calls.cpcBulkAdd = rows;
          return [101];
        },
      },
      cpcDetailRows: {
        bulkPut: async (rows) => {
          calls.detailBulkPut = rows;
        },
      },
      transaction: async (_mode, _t1, _t2, fn) => fn(),
    },
  };

  const result = await upsertCpcsAndSyncDetailLinks(
    databaseService,
    [{ id: 1, cpcIdentifier: "OLD-1" }],
    [{ cpcIdentifier: "NEW-1" }],
    [{ id: 10, cpcNo: "NEW-1", linkedCpcId: null }]
  );

  assert.equal(calls.cpcBulkPut.length, 1);
  assert.equal(calls.cpcBulkAdd.length, 1);
  assert.equal(result.cpcsToAdd[0].id, 101);
  assert.equal(result.allUpdatedDetailRows[0].linkedCpcId, 101);
  assert.equal(calls.detailBulkPut[0].linkedCpcId, 101);
});
