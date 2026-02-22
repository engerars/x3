import test from "node:test";
import assert from "node:assert/strict";

import { importProjectDatasetAtomic } from "../assets/js/modules/repositories/import.repository.js";

function createAnyOfChain(onAnyOf) {
  return {
    anyOf(ids) {
      onAnyOf(ids);
      return this;
    },
    async toArray() {
      return [{ id: 100 }, { id: 101 }];
    },
    async delete() {},
  };
}

test("importProjectDatasetAtomic deletes old graph and upserts new dataset atomically", async () => {
  const calls = {
    anyOfArgs: [],
    deletedProjectId: null,
    bulkPutCounts: {},
  };

  const db = {
    tables: [{ name: "dummy" }],
    transaction: async (_mode, _tables, fn) => fn(),
    projects: {
      async delete(id) {
        calls.deletedProjectId = id;
      },
      async bulkPut(rows) {
        calls.bulkPutCounts.projects = rows.length;
      },
    },
    vendors: {
      async bulkPut(rows) {
        calls.bulkPutCounts.vendors = rows.length;
      },
    },
    contracts: {
      where(field) {
        assert.equal(field, "projectId");
        return {
          equals(id) {
            assert.equal(id, 9);
            return {
              async primaryKeys() {
                return [10, 11];
              },
              async delete() {},
            };
          },
        };
      },
      async bulkPut(rows) {
        calls.bulkPutCounts.contracts = rows.length;
      },
    },
    cpcItems: {
      where(field) {
        assert.equal(field, "contractId");
        return createAnyOfChain((ids) => calls.anyOfArgs.push(ids));
      },
      async bulkPut(rows) {
        calls.bulkPutCounts.cpcItems = rows.length;
      },
    },
    cpcDetailRows: {
      where(field) {
        assert.equal(field, "contractId");
        return createAnyOfChain((ids) => calls.anyOfArgs.push(ids));
      },
      async bulkPut(rows) {
        calls.bulkPutCounts.cpcDetailRows = rows.length;
      },
    },
    installments: {
      where(field) {
        assert.equal(field, "cpcId");
        return createAnyOfChain((ids) => calls.anyOfArgs.push(ids));
      },
      async bulkPut(rows) {
        calls.bulkPutCounts.installments = rows.length;
      },
    },
    bonds: {
      where(field) {
        if (field === "cpcId" || field === "contractId") {
          return createAnyOfChain((ids) => calls.anyOfArgs.push(ids));
        }
        throw new Error(`Unexpected bonds.where field: ${field}`);
      },
      async bulkPut(rows) {
        calls.bulkPutCounts.bonds = rows.length;
      },
    },
  };

  const databaseService = { db };
  const data = {
    projects: [{ id: 1 }],
    vendors: [{ id: 2 }],
    contracts: [{ id: 3 }],
    cpcItems: [{ id: 4 }],
    cpcDetailRows: [{ id: 5 }],
    installments: [{ id: 6 }],
    bonds: [{ id: 7 }],
  };

  await importProjectDatasetAtomic(databaseService, data, 9);

  assert.equal(calls.deletedProjectId, 9);
  assert.equal(calls.bulkPutCounts.projects, 1);
  assert.equal(calls.bulkPutCounts.vendors, 1);
  assert.equal(calls.bulkPutCounts.contracts, 1);
  assert.equal(calls.bulkPutCounts.cpcItems, 1);
  assert.equal(calls.bulkPutCounts.cpcDetailRows, 1);
  assert.equal(calls.bulkPutCounts.installments, 1);
  assert.equal(calls.bulkPutCounts.bonds, 1);
  assert.ok(calls.anyOfArgs.some((ids) => Array.isArray(ids) && ids.includes(10)));
});
