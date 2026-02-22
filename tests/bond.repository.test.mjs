import test from "node:test";
import assert from "node:assert/strict";

import { renewBondRecord } from "../assets/js/modules/repositories/bond.repository.js";

test("renewBondRecord updates original bond and creates new bond payload", async () => {
  let putPayload = null;
  let addPayload = null;

  const databaseService = {
    db: {
      bonds: {
        put: async (payload) => {
          putPayload = payload;
        },
        add: async (payload) => {
          addPayload = payload;
          return 2;
        },
      },
      transaction: async (_mode, _table, fn) => fn(),
    },
  };

  const bonds = [{ id: 1, isSettled: false, isRenewed: false, settlementReasonDisplay: "" }];
  const currentRenewBond = { id: 1, contractId: 10, projectId: 20, vendorId: 30 };
  const newBondDetails = { bondNumber: "NEW-BOND", amount: 999, cpcId: 77, displayAmount: "999" };

  const result = await renewBondRecord(
    databaseService,
    bonds,
    currentRenewBond,
    newBondDetails,
    "Renewed"
  );

  assert.equal(result.originalBondIndex, 0);
  assert.equal(result.originalBondToUpdate.isSettled, true);
  assert.equal(result.originalBondToUpdate.isRenewed, true);
  assert.equal(result.originalBondToUpdate.settlementReasonDisplay, "Renewed");
  assert.equal(result.newBond.id, 2);
  assert.equal(addPayload.cpcId, undefined);
  assert.equal(addPayload.displayAmount, undefined);
  assert.equal(putPayload.id, 1);
});
