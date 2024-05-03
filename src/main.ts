import { SuiObjectData } from "@mysten/sui.js/client";
import { SUI_TYPE_ARG, SuiKit, SuiObjectArg, SuiTxBlock } from "@scallop-io/sui-kit";
import BigNumber from "bignumber.js";
import * as dotenv from "dotenv";
import { MAIN_NODES } from "./const/rpc";
import { Logger } from "./utils/logger";
import { ProtocolConfig } from "@mysten/sui.js/client";
import { shuffle } from "./utils/common";
import { SpamTxBuilder } from "./contract";
import { SuiObjectRef } from "@mysten/sui.js/src/transactions";
dotenv.config();

type CounterObject = {
  readyToRegister: SuiObjectData[];
  readyToClaim: SuiObjectData[];
  currentCounter: SuiObjectData | undefined;
  outdated: SuiObjectData[];
};

const mnemonics = process.env.MNEMONICS!;
const batchSize = +(process.env.BATCH_SIZE ?? MAIN_NODES.length);

console.log(`Batch Size: ${batchSize}`);

const suiKit: SuiKit = new SuiKit({
  mnemonics,
  // secretKey: parsedSecretKey!
});

let protocolConfig: null | ProtocolConfig = null;
const getProtocolConfig = async () => {
  if (!protocolConfig) {
    protocolConfig = await suiKit.client().getProtocolConfig();
  }
  return protocolConfig;
};

const executeSpam = async (suiKit: SuiKit, counterObj: SuiObjectArg, gasCoin?: SuiObjectData) => {
  try {
    const tx = new SuiTxBlock();
    tx.setSender(suiKit.currentAddress());
    if (!!gasCoin) {
      tx.setGasPayment([
        {
          objectId: gasCoin.objectId,
          version: gasCoin.version,
          digest: gasCoin.digest,
        },
      ]);
    }
    SpamTxBuilder.increment_counter(tx, counterObj);

    Logger.info(`Sending spam with node ${suiKit.suiInteractor.currentFullNode}`);
    const txBuildBytes = await tx.txBlock.build({
      client: suiKit.client(),
      protocolConfig: await getProtocolConfig(),
    });

    const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
    // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
    const res = await suiKit.client().executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: {
        showEffects: true,
      },
    });

    if (res.effects?.status.status === "success") {
      Logger.success(`Success spam: ${res.digest} with node ${suiKit.suiInteractor.currentFullNode}`);
      return {
        mutations: [
          res.effects.gasObject.reference,
          res.effects.mutated?.find((item) => item.reference.objectId !== res.effects?.gasObject.reference.objectId)
            ?.reference,
        ], // [gas, counter]
        epoch: res.effects.executedEpoch,
      };
    } else {
      console.error(res.errors ? res.errors[0] : "Error occurred");
      return undefined;
    }
  } catch (e) {
    console.error(e);
  }
  return undefined;
};

const timeout = async (ms: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Task took too long"));
    }, ms);
  });
};

const requestGasCoin = async (suiKit: SuiKit, addresses: string[]) => {
  try {
    const tx = new SuiTxBlock();
    tx.setSender(suiKit.currentAddress());

    const iter = +(process.env.ITER ?? 1);
    // each tx need approx. 0.000774244SUI
    const requiredGasFee = Math.max(0.000774244 * iter, 0.05);

    const coins = tx.splitSUIFromGas(addresses.map(() => BigNumber(requiredGasFee).shiftedBy(9).toString()));
    addresses.map((_, idx) => {
      tx.transferObjects([coins[idx]], addresses[idx]);
    });

    const txBuildBytes = await tx.txBlock.build({
      client: suiKit.client(),
      protocolConfig: await getProtocolConfig(),
    });
    const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
    // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
    const res = await suiKit.client().executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: {
        showEffects: true,
      },
    });
    if (res.effects?.status.status === "success") {
      Logger.success(`Success send gas coins: ${res.digest}`);
    } else {
      Logger.error(res.errors ? res.errors[0] : "Error occurred");
    }
  } catch (e) {
    console.error;
  }
};

const getCurrentEpoch = async (suiKit: SuiKit) => {
  const latestCheckpoints = await suiKit.client().getCheckpoint({
    id: await suiKit.client().getLatestCheckpointSequenceNumber(),
  });

  return latestCheckpoints.epoch;
};

const createCounterObject = async (suiKit: SuiKit) => {
  const tx = new SuiTxBlock();
  tx.setSender(suiKit.currentAddress());

  SpamTxBuilder.new_user_counter(tx);
  const txBuildBytes = await tx.txBlock.build({
    client: suiKit.client(),
    protocolConfig: await getProtocolConfig(),
  });
  const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
  // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
  const res = await suiKit.client().executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: {
      showEffects: true,
    },
  });
  if (res.effects?.status.status === "success") {
    Logger.success(`Success create counter: ${res.digest}`);
  } else {
    Logger.error(res.errors ? res.errors[0] : "Error occurred");
  }
};

const getCounterObject = async (suiKit: SuiKit) => {
  // create new counter if not exists
  const get = async () => {
    const counters = await suiKit.client().getOwnedObjects({
      owner: suiKit.currentAddress(),
      filter: {
        MatchAny: [
          {
            StructType: "0x30a644c3485ee9b604f52165668895092191fcaf5489a846afa7fc11cdb9b24a::spam::UserCounter",
          },
        ],
      },
      limit: 1,
    });

    const results: CounterObject = {
      readyToRegister: [],
      readyToClaim: [],
      currentCounter: undefined,
      outdated: [],
    };
    if (counters.data.length === 0) return results;

    const counterObjects = await suiKit.getObjects(
      counters.data.filter((item) => !!item.data).map((item) => item.data!.objectId),
      {
        showContent: true,
      }
    );

    const currentEpoch = +(await getCurrentEpoch(suiKit));

    counterObjects.forEach((counter) => {
      if (counter.content?.dataType === "moveObject") {
        const fields = counter.content.fields as any;
        if (+fields.epoch < currentEpoch - 2) {
          results.outdated.push(counter);
        } else if (+fields.epoch === currentEpoch - 2) {
          results.readyToClaim.push(counter);
        } else if (+fields.epoch === currentEpoch - 1) {
          results.readyToRegister.push(counter);
        } else if (fields.epoch === currentEpoch) {
          results.currentCounter = counter;
        }
      }
    });
    return results;
  };

  let existing = await get();
  if (existing.currentCounter) return existing;

  await createCounterObject(suiKit);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  existing = await get();
  if (existing.currentCounter) return existing;

  throw new Error("Failed to create counter object");
};

const updateObject = async (obj: SuiObjectData, ref?: SuiObjectRef) => {
  if (!ref) return;
  obj.version = String(ref.version);
  obj.digest = ref.digest;
};

const registerCounter = async (suiKit: SuiKit, counter: SuiObjectData, gasCoin?: SuiObjectData) => {
  const tx = new SuiTxBlock();
  tx.setSender(suiKit.currentAddress());
  if (!!gasCoin) {
    tx.setGasPayment([
      {
        objectId: gasCoin.objectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      },
    ]);
  }

  SpamTxBuilder.register_user_counter(tx, counter);
  const txBuildBytes = await tx.txBlock.build({
    client: suiKit.client(),
    protocolConfig: await getProtocolConfig(),
  });
  const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
  // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
  const res = await suiKit.client().executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: {
      showEffects: true,
    },
  });
  if (res.effects?.status.status === "success") {
    Logger.success(`Success register counter ${counter.objectId} : ${res.digest}`);
    return {
      mutations: [
        res.effects.gasObject.reference,
        ...(res.effects.mutated
          ?.filter((item) => item.reference.objectId !== res.effects?.gasObject.reference.objectId)
          .map((item) => item.reference) ?? []),
      ], // [gas, counter]
      epoch: res.effects.executedEpoch,
    };
  } else {
    console.error(res.errors ? res.errors[0] : "Error occurred");
    return undefined;
  }
};

const claimReward = async (suiKit: SuiKit, counter: SuiObjectData, gasCoin?: SuiObjectData) => {
  const tx = new SuiTxBlock();
  tx.setSender(suiKit.currentAddress());
  if (!!gasCoin) {
    tx.setGasPayment([
      {
        objectId: gasCoin.objectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      },
    ]);
  }

  const spamCoin = SpamTxBuilder.claim_reward(tx, counter);
  tx.transferObjects([spamCoin], suiKit.currentAddress());
  const txBuildBytes = await tx.txBlock.build({
    client: suiKit.client(),
    protocolConfig: await getProtocolConfig(),
  });
  const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
  // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
  const res = await suiKit.client().executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: {
      showEffects: true,
    },
  });
  if (res.effects?.status.status === "success") {
    Logger.success(`Success register counter ${counter.objectId} : ${res.digest}`);
    return {
      mutations: [
        res.effects.gasObject.reference,
        ...(res.effects.mutated
          ?.filter((item) => item.reference.objectId !== res.effects?.gasObject.reference.objectId)
          .map((item) => item.reference) ?? []),
      ], // [gas, counter]
      epoch: res.effects.executedEpoch,
    };
  } else {
    console.error(res.errors ? res.errors[0] : "Error occurred");
    return undefined;
  }
};

const destroyCounter = async(suiKit: SuiKit, counter: SuiObjectData, gasCoin?: SuiObjectData) => {
  const tx = new SuiTxBlock();
  tx.setSender(suiKit.currentAddress());
  if (!!gasCoin) {
    tx.setGasPayment([
      {
        objectId: gasCoin.objectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      },
    ]);
  }

  SpamTxBuilder.destroy_counter(tx, counter);
  const txBuildBytes = await tx.txBlock.build({
    client: suiKit.client(),
    protocolConfig: await getProtocolConfig(),
  });
  const { bytes, signature } = await suiKit.signTxn(txBuildBytes);
  // const borrowFlashLoanResult = await suiKit.signAndSendTxn(tx);
  const res = await suiKit.client().executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: {
      showEffects: true,
    },
  });
  if (res.effects?.status.status === "success") {
    Logger.success(`Success destroy counter ${counter.objectId} : ${res.digest}`);
    return {
      mutations: [
        res.effects.gasObject.reference,
      ], // [gas, counter]
      epoch: res.effects.executedEpoch,
    };
  } else {
    console.error(res.errors ? res.errors[0] : "Error occurred");
    return undefined;
  }
}

const main = async () => {
  const targetAddresses = [];
  try {
    const suiKits: SuiKit[] = Array(batchSize).fill(null);
    let counters: CounterObject[] = Array(batchSize).fill(null);
    const gasCoins: SuiObjectData[] = Array(batchSize).fill(null);

    for (let i = 0; i < batchSize; i++) {
      suiKits[i] = new SuiKit({
        fullnodeUrls: [...MAIN_NODES],
        mnemonics,
        // secretKey: parsedSecretKey!,
      });
      suiKits[i].switchAccount({ accountIndex: i });

      // check for gas coin
      // i = 0 is the main account
      if (i > 0) {
        // calculate approximation gas coin needed for ITER times
        const iter = +(process.env.ITER ?? 1);
        // each tx need approx. 0.000774244SUI
        const requiredGasFee = Math.max(0.000774244 * iter, 0.05);
        const gasCoin = await suiKits[i].getBalance(SUI_TYPE_ARG);
        console.log(
          `${suiKits[i].currentAddress()} has ${BigNumber(gasCoin.totalBalance)
            .shiftedBy(-1 * 9)
            .toNumber()} SUI`
        );
        if (
          gasCoin.totalBalance === "0" ||
          BigNumber(gasCoin.totalBalance)
            .shiftedBy(-1 * 9)
            .lt(requiredGasFee)
        ) {
          targetAddresses.push(suiKits[i].currentAddress());
        }
      }
      shuffle(MAIN_NODES);
    }

    Logger.info("-".repeat(80));
    Logger.info(`Running with ${batchSize} accounts`);

    if (targetAddresses.length > 0) {
      Logger.info(`Requesting gas coin for addresses: ${targetAddresses.join(", ")}`);
      try {
        await requestGasCoin(suiKits[0], targetAddresses);
      } catch (e) {
        Logger.error(JSON.stringify(e));
      }
    }

    // create counter objects
    let tasks = [];
    for (let i = 0; i < suiKits.length; i++) {
      tasks.push(async () => {
        let _tasks = [];
        const counter = await getCounterObject(suiKits[i]);
        if (!counter.currentCounter) throw new Error("Failed to get counter object");

        // checks for ready to claim counters
        _tasks.push(...counter.readyToClaim.map(async (obj) => await claimReward(suiKit, obj)));
        if(_tasks.length > 0) {
          await Promise.allSettled(_tasks);
          counter.readyToClaim = []
        }

        // checks for ready to register counters
        _tasks.push(...counter.readyToRegister.map(async (obj) => await registerCounter(suiKit, obj)));
        if(_tasks.length > 0) {
          await Promise.allSettled(_tasks);
          counter.readyToRegister = []
        }

        // checks for outdated counters
        _tasks.push(...counter.outdated.map(async (obj) => await destroyCounter(suiKit, obj)));
        if(_tasks.length > 0) {
          await Promise.allSettled(_tasks);
          counter.outdated = []
        }
        counters[i] = counter;
      });
    }

    await Promise.all(tasks.map((t) => t()));

    tasks = [];
    let results = [];
    let claimCnt = 0;
    let iter = 0;
    let initialEpoch = +(await getCurrentEpoch(suiKits[0]));

    while (iter < +(process.env.ITER ?? 1)) {
      for (let i = 0; i < suiKits.length; i++) {
        const currentCounter = counters[i].currentCounter;
        if (currentCounter) {
          tasks.push(executeSpam(suiKits[i], currentCounter, gasCoins[i]));
        }
      }
      results = await Promise.allSettled(tasks);
      await new Promise((resolve) => setTimeout(resolve, +(process.env.INTERVAL ?? 2000))); // safe value to allow rpc to obtain changes from the transactions

      let executedEpoch = 0;
      // update objects
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") {
          const res = (results[i] as PromiseFulfilledResult<any>).value;
          if (res) {
            if (res.mutations) {
              if (res.mutations[0]) {
                if (!gasCoins[i]) {
                  gasCoins[i] = res.mutations[0];
                } else {
                  updateObject(gasCoins[i], res.mutations[0]);
                }
              }
              if (res.mutations[1]) {
                if (!counters[i].currentCounter) {
                  counters[i].currentCounter = {
                    objectId: res.mutations[1].objectId,
                    version: res.mutations[1].version,
                    digest: res.mutations[1].digest,
                  };
                } else {
                  updateObject(counters[i].currentCounter!, res.mutations[1]);
                }
              }
            }
            res.mutations = null;
          }
        }
      }

      tasks = [];
      results = [];

      // check epoch
      if (executedEpoch >= initialEpoch + 1) {
        // reset protocol config
        protocolConfig = null;
        // register the counter object
        tasks.push(
          ...counters.map(async (counter, idx) => {
            const currentCounter = counter.currentCounter;
            if (currentCounter) {
              const res = await registerCounter(suiKits[idx], currentCounter, gasCoins[idx]);
              if (res && res.mutations) {
                if (res.mutations[0]) {
                  if (!gasCoins[idx]) {
                    gasCoins[idx] = res.mutations[0];
                  } else {
                    updateObject(gasCoins[idx], res.mutations[0]);
                  }
                }
                if (res.mutations[1]) {
                  updateObject(
                    currentCounter,
                    res.mutations.find((item) => item.objectId === currentCounter.objectId)
                  );
                }
              }
            }
          })
        );
        await Promise.allSettled(tasks);
        tasks = [];

        // create new counter objects for new epoch
        for (let i = 0; i < suiKits.length; i++) {
          tasks.push(async () => {
            const counter = await getCounterObject(suiKits[i]);
            if (!counter) throw new Error("Failed to get counter object");
            counters[i] = counter;
          });
        }
        await Promise.allSettled(tasks);
        tasks = [];

        await new Promise((resolve) => setTimeout(resolve, 2000));
        claimCnt++;
        initialEpoch = executedEpoch;
        // Nice to have: set a Telegram notification bot on error registering counter
      }

      // check for claim
      if (claimCnt === 2) {
        claimCnt = 0;

        // claim $SPAM
        tasks.push(
          ...counters.map(async (counter, idx) => {
            const currentCounter = counter.currentCounter;
            if (currentCounter) {
              const res = await claimReward(suiKits[idx], currentCounter, gasCoins[idx]);
              if (res && res.mutations) {
                if (res.mutations[0]) {
                  if (!gasCoins[idx]) {
                    gasCoins[idx] = res.mutations[0];
                  } else {
                    updateObject(gasCoins[idx], res.mutations[0]);
                  }
                }
                if (res.mutations[1]) {
                  updateObject(
                    currentCounter,
                    res.mutations.find((item) => item.objectId === currentCounter.objectId)
                  );
                }
              }
            }
          })
        );

        await Promise.allSettled(tasks);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        tasks = [];
      }
      iter++;
    }
  } catch (e) {
    Logger.error(JSON.stringify(e));
  }
  return;
};

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => process.exit(0));
